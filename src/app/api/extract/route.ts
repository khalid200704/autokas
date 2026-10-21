import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

const extractionPrompt = `Analisis gambar struk atau bukti transaksi ini.
Kembalikan HANYA JSON valid tanpa markdown, backtick, atau teks tambahan.

Format:
{
  "merchant": "string",
  "date": "YYYY-MM-DD",
  "transaction_type": "PENGELUARAN" | "PENDAPATAN",
  "total_amount": number,
  "description": "string",
  "items": [
    {
      "item_name": "string",
      "price": number,
      "qty": number,
      "category": "Makanan & Minuman" | "Kebutuhan Rumah" | "Kesehatan" | "Transportasi/BBM" | "Tagihan" | "Operasional" | "Pendapatan" | "Lain-lain"
    }
  ]
}

Aturan:
- Jika merchant tidak jelas, isi "Umum".
- Jika tanggal tidak jelas, gunakan ${new Date().toISOString().slice(0, 10)}.
- Jika total tidak jelas, hitung dari item.
- Semua nominal harus berupa angka rupiah tanpa titik, koma, atau simbol mata uang.
- Untuk PENDAPATAN, item boleh berisi satu item "Pendapatan".`;

const allowedOrigins = new Set([
  "https://autokas-ohuv.vercel.app",
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
]);

function corsHeaders(request: Request) {
  const headers = new Headers();
  const origin = request.headers.get("origin");
  headers.set("Vary", "Origin");
  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, apikey, x-client-info");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return headers;
}

function apiResponse(
  request: Request,
  body: unknown,
  status = 200
) {
  return NextResponse.json(body, { status, headers: corsHeaders(request) });
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function parseModelJson(text: string) {
  const withoutFence = text.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("Respons Gemini bukan JSON.");
  }

  return JSON.parse(withoutFence.slice(start, end + 1));
}

function normalizeResult(value: unknown) {
  const result = value as Record<string, unknown>;
  const rawItems = Array.isArray(result.items) ? result.items : [];
  const items = rawItems.map((item) => {
    const entry = item as Record<string, unknown>;
    return {
      item_name: String(entry.item_name || "Item tidak dikenal"),
      price: Math.max(0, Number(entry.price) || 0),
      qty: Math.max(1, Number(entry.qty) || 1),
      category: String(entry.category || "Lain-lain"),
    };
  });

  return {
    merchant: String(result.merchant || "Umum"),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(result.date))
      ? String(result.date)
      : new Date().toISOString().slice(0, 10),
    transaction_type:
      result.transaction_type === "PENDAPATAN" ? "PENDAPATAN" : "PENGELUARAN",
    total_amount: Math.max(0, Number(result.total_amount) || 0),
    description: String(result.description || ""),
    items,
  };
}

function extractGeneratedText(responseBody: unknown): string | null {
  const body = responseBody as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const texts = (body.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text)
    .filter((partText): partText is string => typeof partText === "string" && partText.trim().length > 0);

  return texts.join("\n").trim() || null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerToken);

    if (authError || !user) {
      return apiResponse(request,
        { message: "Silakan login terlebih dahulu untuk memindai struk." },
        401
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return apiResponse(request,
        { message: "GEMINI_API_KEY belum diatur di .env.local." },
        503
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || !(image instanceof File)) {
      return apiResponse(request,
        { message: "File gambar tidak valid." },
        400
      );
    }

    if (image.size === 0 || image.size > 10 * 1024 * 1024) {
      return apiResponse(request,
        { message: "Ukuran gambar harus lebih dari 0 dan maksimal 10 MB." },
        400
      );
    }

    const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedMimeTypes.has(image.type)) {
      return apiResponse(request,
        { message: "Format gambar harus JPG, PNG, atau WebP." },
        400
      );
    }

    const { data: canExtract, error: quotaError } = await supabase.rpc(
      "consume_ai_request",
      { p_daily_limit: 20 }
    );
    if (quotaError) {
      console.error("AI quota check error:", quotaError);
      return apiResponse(request,
        { message: "Kuota scan belum bisa diperiksa. Coba lagi sebentar." },
        503
      );
    }
    if (!canExtract) {
      return apiResponse(request,
        { message: "Batas 20 scan harian tercapai. Coba lagi besok." },
        429
      );
    }

    const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");

    let lastGeminiError: { status: number; details: string } | null = null;
    let extractedText: string | null = null;

    for (const modelName of GEMINI_MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: extractionPrompt },
                  {
                    inline_data: {
                      mime_type: image.type || "image/jpeg",
                      data: imageBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        const details = await response.text();
        console.error(`Gemini ${modelName} response error:`, details);
        lastGeminiError = { status: response.status, details };
        continue;
      }

      const responseBody = await response.json();
      const modelText = extractGeneratedText(responseBody);
      if (modelText) {
        extractedText = modelText;
        break;
      }
    }

    if (!extractedText) {
      const providerMessage = lastGeminiError
        ? (() => {
            try {
              const parsedDetails = JSON.parse(lastGeminiError.details) as {
                error?: { message?: string };
              };
              return parsedDetails.error?.message || lastGeminiError.details;
            } catch {
              return lastGeminiError.details;
            }
          })()
        : "Gemini tidak mengembalikan hasil.";

      const fallbackStatus = lastGeminiError?.status === 429 ? 429 : 502;
      return apiResponse(request,
        {
          message:
            lastGeminiError?.status === 429
              ? "Kuota Gemini sedang habis atau terlalu banyak permintaan. Coba lagi beberapa saat."
              : `Gemini error (${lastGeminiError?.status ?? "unknown"}): ${providerMessage}`,
        },
        fallbackStatus
      );
    }

    return apiResponse(request, normalizeResult(parseModelJson(extractedText)));
  } catch (error) {
    console.error("Extract API error:", error);
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return apiResponse(request,
        { message: "Gemini terlalu lama membaca gambar. Coba foto yang lebih jelas atau ulangi." },
        504
      );
    }

    return apiResponse(request,
      {
        message:
          error instanceof Error
            ? `Gagal membaca hasil Gemini: ${error.message}`
            : "Gemini gagal memproses gambar.",
      },
      500
    );
  }
}

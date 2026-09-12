import { NextResponse } from "next/server";

export const maxDuration = 8;

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

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "GEMINI_API_KEY belum diatur di .env.local." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image");

    if (!image || !(image instanceof File)) {
      return NextResponse.json(
        { message: "File gambar tidak valid." },
        { status: 400 }
      );
    }

    if (image.size === 0 || image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { message: "Ukuran gambar harus lebih dari 0 dan maksimal 10 MB." },
        { status: 400 }
      );
    }

    const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(7500),
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
      console.error("Gemini response error:", details);
      return NextResponse.json(
        { message: "Gemini gagal memproses gambar. Periksa API key atau kuota." },
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    const responseBody = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const modelText = responseBody.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!modelText) throw new Error("Gemini tidak mengembalikan isi.");

    return NextResponse.json(normalizeResult(parseModelJson(modelText)), { status: 200 });
  } catch (error) {
    console.error("Extract API error:", error);
    return NextResponse.json(
      { message: "Gemini gagal memproses gambar." },
      { status: 500 }
    );
  }
}

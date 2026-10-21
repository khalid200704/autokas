"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import Image from "next/image";
import { Camera, CameraDirection } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Sparkles } from "lucide-react";
import { emptyTransaction, formatCurrency, type ExtractedTransaction, type TransactionItem } from "@/lib/mock-data";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import { createTransactionWithItems, uploadReceipt } from "@/lib/supabase/transactions";
import { hasSupabaseConfig } from "@/lib/supabase/client";

const categoryOptions = [
  "Makanan & Minuman",
  "Kebutuhan Rumah",
  "Kesehatan",
  "Transportasi/BBM",
  "Tagihan",
  "Operasional",
  "Pendapatan",
  "Lain-lain",
] as const;

export default function ScanPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<ExtractedTransaction>(emptyTransaction);
  const [aiResult, setAiResult] = useState<ExtractedTransaction | null>(null);
  const [hasDetectionResult, setHasDetectionResult] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const totalItems = useMemo(
    () =>
      transaction.items.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.qty),
        0
      ),
    [transaction.items]
  );

  const handleImageUpload = async (file: File) => {
    setError(null);
    setHasDetectionResult(false);
    setTransaction(emptyTransaction);
    setAiResult(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsSaved(false);
    setIsLoading(true);
    setProcessingStage("Menyiapkan foto...");

    try {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Gunakan gambar JPG, PNG, atau WebP.");
      }

      if (file.size === 0) {
        throw new Error("File gambar kosong. Pilih foto lain.");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Ukuran file melebihi 10 MB.");
      }

      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.25,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        initialQuality: 0.8,
      });

      setProcessingStage("Mengirim foto ke AI...");
      setSelectedFile(compressedFile);
      setPreviewUrl(URL.createObjectURL(compressedFile));

      const formData = new FormData();
      formData.append("image", compressedFile, compressedFile.name);

      if (!hasSupabaseConfig()) {
        throw new Error("Supabase belum dikonfigurasi. Hubungkan proyek Anda sebelum memindai struk.");
      }
      const supabase = createClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        throw new Error("Sesi login berakhir. Masuk kembali untuk memindai struk.");
      }

      const extractUrl = Capacitor.isNativePlatform()
        ? "https://autokas-ohuv.vercel.app/api/extract"
        : "/api/extract";
      const response = await fetch(extractUrl, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(errorBody?.message || "Gagal memproses foto struk.");
      }

      const parsed = (await response.json()) as ExtractedTransaction;
      setProcessingStage("Selesai membaca struk.");
      setTransaction(parsed);
      setAiResult(parsed);
      setHasDetectionResult(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setError(message);
      setProcessingStage("Deteksi gagal.");
    } finally {
      setIsLoading(false);
    }
  };

  const retryDetection = () => {
    if (selectedFile) handleImageUpload(selectedFile);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) handleImageUpload(file);
  };

  const captureReceiptPhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }

    setError(null);
    setIsLoading(true);
    setProcessingStage("Membuka kamera...");
    try {
      const photo = await Camera.takePhoto({
        quality: 85,
        correctOrientation: true,
        cameraDirection: CameraDirection.Rear,
      });
      if (!photo.webPath) throw new Error("Foto kamera tidak dapat dibaca.");

      const imageResponse = await fetch(photo.webPath);
      if (!imageResponse.ok) throw new Error("Foto kamera gagal dimuat.");
      const blob = await imageResponse.blob();
      const extension = photo.metadata?.format?.toLowerCase() === "png" ? "png" : "jpg";
      const mimeType = blob.type.startsWith("image/")
        ? blob.type
        : extension === "png" ? "image/png" : "image/jpeg";
      const imageFile = new File([blob], `struk-${Date.now()}.${extension}`, { type: mimeType });
      await handleImageUpload(imageFile);
    } catch (captureError) {
      const message = captureError instanceof Error ? captureError.message : "Kamera gagal dibuka.";
      if (!/cancel/i.test(message)) {
        setError(message);
        setProcessingStage("Deteksi gagal.");
      } else {
        setProcessingStage(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = <K extends keyof ExtractedTransaction>(field: K, value: ExtractedTransaction[K]) => {
    setTransaction((current) => ({ ...current, [field]: value }));
  };

  const updateItem = (index: number, field: keyof TransactionItem, value: string | number) => {
    setTransaction((current) => {
      const nextItems = [...current.items];
      nextItems[index] = {
        ...nextItems[index],
        [field]: value,
      };
      return { ...current, items: nextItems };
    });
  };

  const addItem = () => {
    setTransaction((current) => ({
      ...current,
      items: [
        ...current.items,
        { item_name: "Item baru", price: 0, qty: 1, category: "Lain-lain" },
      ],
    }));
  };

  const removeItem = (index: number) => {
    setTransaction((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSave = async () => {
    if (!transaction.merchant.trim() || !transaction.date || transaction.total_amount < 0) {
      setError("Merchant, tanggal, dan total wajib diisi dengan benar.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      if (!hasSupabaseConfig()) throw new Error("Supabase belum dikonfigurasi.");
      const { data: userData, error: authError } = await createClient().auth.getUser();
      if (authError) throw authError;
      const userId = userData.user?.id;

      if (userId) {
        const transactionId = crypto.randomUUID();
        let imagePath: string | null = null;
        if (selectedFile) {
          imagePath = await uploadReceipt(userId, transactionId, selectedFile);
        }
        await createTransactionWithItems({
          transaction,
          transactionId,
          imagePath,
          aiResult,
          sourceFileName: selectedFile?.name,
        });
      } else throw new Error("Silakan masuk terlebih dahulu untuk menyimpan transaksi.");

      setIsSaved(true);
      window.setTimeout(() => router.push("/dashboard"), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaksi gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      title="Catat transaksi"
      description="Pilih foto agar AI mengisi otomatis, atau isi sendiri. Periksa data sebelum menyimpan."
      backHref="/dashboard"
      backLabel="Ke dashboard"
    >
        <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="app-panel p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-sm font-bold text-[var(--mint-dark)]">1</span>
              <div>
                <h2 className="font-bold text-[var(--ink)]">Foto struk</h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">JPG, PNG, atau WebP · maksimal 10 MB</p>
              </div>
            </div>
            <label className="relative flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--mint)] bg-[var(--surface-soft)] px-5 py-7 text-center transition hover:bg-[#e2f0e6] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--mint-dark)]">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isLoading || isSaving}
                aria-label="Pilih foto struk"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
                onChange={handleFileChange}
              />
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--mint-dark)] shadow-sm">
                <ImagePlus size={23} aria-hidden="true" />
              </span>
              <span className="mt-3 text-sm font-bold text-[var(--ink)]">{selectedFile ? "Ganti foto struk" : "Pilih foto struk dari galeri"}</span>
              <span className="mt-1 text-xs text-[var(--muted)]">Foto diperkecil sebelum dikirim ke AI.</span>
            </label>
            <button
              type="button"
              disabled={isLoading || isSaving}
              onClick={() => void captureReceiptPhoto()}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
            >
              <ImagePlus size={17} aria-hidden="true" />
              Ambil foto dengan kamera
            </button>

            {previewUrl && (
              <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-slate-50 p-2">
                <Image
                  src={previewUrl}
                  alt="Preview struk"
                  width={960}
                  height={640}
                  unoptimized
                  className="mx-auto max-h-80 w-full object-contain"
                />
              </div>
            )}

            {processingStage && (
              <div role="status" aria-live="polite" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${isLoading ? "border-[var(--mint)]/30 bg-[var(--surface-soft)] text-[var(--mint-dark)]" : processingStage.includes("gagal") ? "border-[var(--coral)]/30 bg-[#fff0ed] text-[var(--coral)]" : "border-[var(--mint)]/30 bg-[var(--surface-soft)] text-[var(--mint-dark)]"}`}>
                <span className="font-semibold">{processingStage}</span>
                {isLoading && <span className="ml-2 inline-block animate-pulse">Mohon tunggu...</span>}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-[var(--coral)]/30 bg-[#fff0ed] px-4 py-3 text-sm text-[var(--coral)]">
                <p>{error}</p>
                {selectedFile && !isLoading && (
                  <button
                    type="button"
                    onClick={retryDetection}
                    className="mt-3 rounded-full border border-[var(--coral)] px-3 py-1.5 text-xs font-semibold transition hover:bg-white"
                  >
                    Coba lagi
                  </button>
                )}
              </div>
            )}

            {selectedFile && (
              <div className="mt-4 text-sm text-[var(--muted)]">
                <span>File siap:</span>{" "}
                <span className="break-all font-semibold text-[var(--ink)]">{selectedFile.name}</span>
              </div>
            )}
          </section>

          <section className="app-panel p-4 sm:p-5">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-sm font-bold text-[var(--mint-dark)]">2</span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold">Periksa dan lengkapi</h2>
                  {hasDetectionResult && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800"><Sparkles size={12} aria-hidden="true" /> Dibaca AI</span>}
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Pastikan nama, tanggal, dan nominal sudah benar. Semua kolom bisa diedit.</p>
              </div>
            </div>

            {!hasDetectionResult && !isLoading && (
              <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
                Anda bisa mengisi transaksi secara manual, atau pilih foto agar AI mengisinya otomatis.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-[var(--muted)] md:col-span-1">
                <span>Merchant</span>
                <input
                  required
                  value={transaction.merchant}
                  onChange={(event) => updateField("merchant", event.target.value)}
                  className="app-input w-full px-3 py-2.5"
                />
              </label>

              <label className="space-y-2 text-sm text-[var(--muted)] md:col-span-1">
                <span>Tanggal</span>
                <input
                  required
                  type="date"
                  value={transaction.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  className="app-input w-full px-3 py-2.5"
                />
              </label>

              <label className="space-y-2 text-sm text-[var(--muted)] md:col-span-1">
                <span>Tipe</span>
                <select
                  value={transaction.transaction_type}
                  onChange={(event) =>
                    updateField("transaction_type", event.target.value as ExtractedTransaction["transaction_type"])
                  }
                  className="app-input w-full px-3 py-2.5"
                >
                  <option value="PENGELUARAN">Pengeluaran</option>
                  <option value="PENDAPATAN">Pemasukan</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-[var(--muted)] md:col-span-1">
                <span>Total transaksi (Rp)</span>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  required
                  value={transaction.total_amount || ""}
                  onChange={(event) => updateField("total_amount", Number(event.target.value))}
                  className="app-input w-full px-3 py-2.5"
                />
              </label>

              <label className="space-y-2 text-sm text-[var(--muted)] md:col-span-2">
                <span>Keterangan</span>
                <textarea
                  value={transaction.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={3}
                  placeholder="Contoh: Belanja stok toko atau makan siang tim"
                  className="app-input w-full resize-none px-3 py-2.5"
                />
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--ink)]">Rincian item</h3>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">Opsional — bantu memahami kategori pengeluaran.</p>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="min-h-10 rounded-full bg-[var(--ink)] px-3.5 py-2 text-xs font-semibold text-white"
                >
                  + Tambah item
                </button>
              </div>

              <div className="space-y-3">
                {transaction.items.map((item, index) => (
                  <div key={`${item.item_name}-${index}`} className="rounded-xl border border-[var(--line)] bg-white p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_0.6fr_0.5fr_0.9fr_auto] sm:gap-3">
                      <input
                        value={item.item_name}
                        onChange={(event) => updateItem(index, "item_name", event.target.value)}
                        className="app-input col-span-2 min-h-11 px-3 py-2 text-sm sm:col-span-1"
                        placeholder="Nama item"
                        aria-label={`Nama item ${index + 1}`}
                      />
                      <input
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={item.price || ""}
                        onChange={(event) => updateItem(index, "price", Number(event.target.value))}
                        className="app-input min-h-11 px-3 py-2 text-sm"
                        placeholder="Harga"
                        aria-label={`Harga item ${index + 1}`}
                      />
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={item.qty || ""}
                        onChange={(event) => updateItem(index, "qty", Number(event.target.value))}
                        className="app-input min-h-11 px-3 py-2 text-sm"
                        placeholder="Qty"
                        aria-label={`Jumlah item ${index + 1}`}
                      />
                      <select
                        value={item.category}
                        onChange={(event) => updateItem(index, "category", event.target.value)}
                        className="app-input min-h-11 px-3 py-2 text-sm"
                        aria-label={`Kategori item ${index + 1}`}
                      >
                        {categoryOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="min-h-11 rounded-lg border border-[var(--coral)]/30 bg-[#fff0ed] px-3 py-2 text-xs font-medium text-[var(--coral)]"
                        aria-label={`Hapus item ${index + 1}`}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4 text-sm">
              <span className="text-[var(--muted)]">Total item terhitung</span>
              <span className="font-semibold text-[var(--ink)]">{formatCurrency(totalItems)}</span>
            </div>

            {Number(transaction.total_amount) !== Number(totalItems) && (
              <div className="mt-4 rounded-xl border border-[#e5c98b] bg-[#fff8e7] px-4 py-3 text-sm text-[var(--amber)]">
                Total transaksi berbeda dari rincian item. Ini bisa terjadi karena pajak atau potongan; pastikan angka totalnya benar.
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaved || isSaving || isLoading || !transaction.merchant.trim() || !transaction.date}
              className="app-button-primary mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 text-sm font-bold disabled:opacity-50"
            >
              {isSaved ? <><Check size={18} aria-hidden="true" /> Tersimpan</> : isSaving ? "Menyimpan transaksi..." : "Simpan transaksi"}
            </button>
            <p className="mt-2 text-center text-xs text-[var(--muted)]">Transaksi hanya disimpan setelah Anda menekan tombol ini.</p>
          </section>
        </div>
    </AppShell>
  );
}

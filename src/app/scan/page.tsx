"use client";

import { useMemo, useState } from "react";
import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import { emptyTransaction, formatCurrency, type ExtractedTransaction, type TransactionItem } from "@/lib/mock-data";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import { createTransactionWithItems, uploadReceipt } from "@/lib/supabase/transactions";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<ExtractedTransaction>(emptyTransaction);
  const [aiResult, setAiResult] = useState<ExtractedTransaction | null>(null);
  const [hasDetectionResult, setHasDetectionResult] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    setIsLoading(true);

    try {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Gunakan gambar JPG, PNG, atau WebP.");
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

      setSelectedFile(compressedFile);
      setPreviewUrl(URL.createObjectURL(compressedFile));

      const formData = new FormData();
      formData.append("image", compressedFile, compressedFile.name);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(errorBody?.message || "Gagal memproses foto struk.");
      }

      const parsed = (await response.json()) as ExtractedTransaction;
      setTransaction(parsed);
      setAiResult(parsed);
      setHasDetectionResult(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setError(message);
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
    if (!hasDetectionResult || !transaction.merchant.trim() || !transaction.date || transaction.total_amount < 0) {
      setError("Merchant, tanggal, dan total wajib diisi dengan benar.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        const transactionId = crypto.randomUUID();
        let imagePath: string | null = null;
        if (selectedFile) {
          imagePath = await uploadReceipt(userData.user.id, transactionId, selectedFile);
        }
        await createTransactionWithItems({
          transaction,
          transactionId,
          imagePath,
          aiResult,
          sourceFileName: selectedFile?.name,
        });
      } else {
        throw new Error("Silakan login terlebih dahulu untuk menyimpan transaksi.");
      }

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
      title="Scan & verifikasi"
      description="Foto struk, periksa hasil AI, lalu simpan setelah datanya benar."
      backHref="/dashboard"
      backLabel="Ke dashboard"
    >
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="app-panel p-5">
            <label className="relative flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--mint)] bg-[var(--surface-soft)] px-6 py-10 text-center transition hover:bg-[#e2f0e6]">
              <input type="file" accept="image/jpeg,image/png,image/webp" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={handleFileChange} />
              <span className="text-lg font-semibold text-[var(--ink)]">Tambahkan foto struk</span>
              <span className="mt-2 text-sm text-[var(--muted)]">Ambil foto baru atau pilih dari galeri</span>
              <div className="mt-5 flex flex-col gap-2 min-[380px]:flex-row">
                <span className="app-button-primary px-4 py-2.5 text-sm font-semibold">Pilih foto</span>
              </div>
              <span className="mt-3 text-xs text-[var(--muted)]">JPG, PNG, WebP • maksimal 10 MB</span>
            </label>

            {previewUrl && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                <img src={previewUrl} alt="Preview struk" className="h-72 w-full object-cover" />
              </div>
            )}

            {isLoading && (
              <div className="mt-4 rounded-xl border border-[var(--mint)]/30 bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--mint-dark)]">
                Mengompresi dan mengekstrak data dari gambar...
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
                File siap: <span className="font-semibold text-[var(--ink)]">{selectedFile.name}</span>
              </div>
            )}
          </section>

          <section className="app-panel p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Periksa transaksi</h2>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaved || isSaving || !hasDetectionResult}
                className="app-button-primary px-3 py-1.5 text-xs font-semibold"
              >
                {isSaved ? "Tersimpan" : isSaving ? "Menyimpan..." : "Simpan transaksi"}
              </button>
            </div>

            {!hasDetectionResult && !isLoading && (
              <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">
                Pilih foto struk terlebih dahulu. Form akan terisi otomatis setelah gambar selesai dianalisis.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300 md:col-span-1">
                <span>Merchant</span>
                <input
                  value={transaction.merchant}
                  onChange={(event) => updateField("merchant", event.target.value)}
                  className="app-input w-full px-3 py-2.5"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300 md:col-span-1">
                <span>Tanggal</span>
                <input
                  type="date"
                  value={transaction.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  className="app-input w-full px-3 py-2.5"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300 md:col-span-1">
                <span>Tipe</span>
                <select
                  value={transaction.transaction_type}
                  onChange={(event) =>
                    updateField("transaction_type", event.target.value as ExtractedTransaction["transaction_type"])
                  }
                  className="app-input w-full px-3 py-2.5"
                >
                  <option value="PENGELUARAN">PENGELUARAN</option>
                  <option value="PENDAPATAN">PENDAPATAN</option>
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-300 md:col-span-1">
                <span>Total</span>
                <input
                  type="number"
                  value={transaction.total_amount}
                  onChange={(event) => updateField("total_amount", Number(event.target.value))}
                  className="app-input w-full px-3 py-2.5"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
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
                <h3 className="font-semibold text-[var(--ink)]">Daftar item</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  + Tambah item
                </button>
              </div>

              <div className="space-y-3">
                {transaction.items.map((item, index) => (
                  <div key={`${item.item_name}-${index}`} className="rounded-xl border border-[var(--line)] bg-white p-3">
                    <div className="grid gap-3 md:grid-cols-[1.2fr_0.6fr_0.5fr_0.9fr_auto]">
                      <input
                        value={item.item_name}
                        onChange={(event) => updateItem(index, "item_name", event.target.value)}
                        className="app-input px-2 py-2 text-sm"
                        placeholder="Nama item"
                      />
                      <input
                        type="number"
                        value={item.price}
                        onChange={(event) => updateItem(index, "price", Number(event.target.value))}
                        className="app-input px-2 py-2 text-sm"
                        placeholder="Harga"
                      />
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(event) => updateItem(index, "qty", Number(event.target.value))}
                        className="app-input px-2 py-2 text-sm"
                        placeholder="Qty"
                      />
                      <select
                        value={item.category}
                        onChange={(event) => updateItem(index, "category", event.target.value)}
                        className="app-input px-2 py-2 text-sm"
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
                        className="rounded-lg border border-[var(--coral)]/30 bg-[#fff0ed] px-2 py-2 text-xs font-medium text-[var(--coral)]"
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
                Warning: total transaksi tidak sama dengan total item. Silakan cek kembali.
              </div>
            )}
          </section>
        </div>
    </AppShell>
  );
}

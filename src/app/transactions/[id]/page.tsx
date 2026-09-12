"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { emptyTransaction, formatCurrency, type ExtractedTransaction, type TransactionItem } from "@/lib/mock-data";
import {
  deleteOwnTransaction,
  readOwnTransaction,
  updateOwnTransaction,
} from "@/lib/supabase/transactions";

const categories: TransactionItem["category"][] = [
  "Makanan & Minuman", "Kebutuhan Rumah", "Kesehatan", "Transportasi/BBM",
  "Tagihan", "Operasional", "Pendapatan", "Lain-lain",
];

export default function TransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [transaction, setTransaction] = useState<ExtractedTransaction>(emptyTransaction);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readOwnTransaction(params.id)
      .then((row) => {
        if (!row) throw new Error("Transaksi tidak ditemukan.");
        setTransaction({
          merchant: row.merchant,
          description: row.description ?? "",
          date: row.date,
          transaction_type: row.transaction_type,
          total_amount: Number(row.total_amount),
          items: (row.transaction_items ?? []).map((item: { item_name: string; price: number | string; qty: number | string; category: TransactionItem["category"] }) => ({
            item_name: item.item_name,
            price: Number(item.price),
            qty: Number(item.qty),
            category: item.category,
          })),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Transaksi gagal dimuat."))
      .finally(() => setLoading(false));
  }, [params.id]);

  const updateField = <K extends keyof ExtractedTransaction>(field: K, value: ExtractedTransaction[K]) => {
    setTransaction((current) => ({ ...current, [field]: value }));
  };

  const updateItem = (index: number, field: keyof TransactionItem, value: string | number) => {
    setTransaction((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  };

  const itemTotal = useMemo(() => transaction.items.reduce((sum, item) => sum + item.price * item.qty, 0), [transaction.items]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateOwnTransaction(params.id, transaction);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Perubahan gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.")) return;
    setSaving(true);
    try {
      await deleteOwnTransaction(params.id);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaksi gagal dihapus.");
      setSaving(false);
    }
  };

  if (loading) {
    return <AppShell title="Memuat transaksi..."><div className="app-panel h-48 animate-pulse" /></AppShell>;
  }

  return (
    <AppShell title="Detail transaksi" description="Periksa atau ubah data transaksi yang tersimpan." backHref="/dashboard" backLabel="Ringkasan">
      <section className="app-panel max-w-3xl p-6">
        {error && <p className="mb-5 rounded-xl bg-[#fff0ed] p-3 text-sm text-[var(--coral)]">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">Merchant<input className="app-input w-full px-3 py-2.5" value={transaction.merchant} onChange={(event) => updateField("merchant", event.target.value)} /></label>
          <label className="space-y-2 text-sm">Tanggal<input type="date" className="app-input w-full px-3 py-2.5" value={transaction.date} onChange={(event) => updateField("date", event.target.value)} /></label>
          <label className="space-y-2 text-sm">Tipe<select className="app-input w-full px-3 py-2.5" value={transaction.transaction_type} onChange={(event) => updateField("transaction_type", event.target.value as ExtractedTransaction["transaction_type"])}><option value="PENGELUARAN">Pengeluaran</option><option value="PENDAPATAN">Pendapatan</option></select></label>
          <label className="space-y-2 text-sm">Total<input type="number" className="app-input w-full px-3 py-2.5" value={transaction.total_amount} onChange={(event) => updateField("total_amount", Number(event.target.value))} /></label>
          <label className="space-y-2 text-sm sm:col-span-2">Keterangan<textarea className="app-input w-full resize-none px-3 py-2.5" rows={3} value={transaction.description} onChange={(event) => updateField("description", event.target.value)} /></label>
        </div>
        <div className="mt-6 space-y-3">
          <h2 className="text-xl font-semibold">Item</h2>
          {transaction.items.map((item, index) => <div key={`${item.item_name}-${index}`} className="grid gap-2 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-[1fr_120px_80px_180px]"><input className="app-input px-2 py-2 text-sm" value={item.item_name} onChange={(event) => updateItem(index, "item_name", event.target.value)} /><input type="number" className="app-input px-2 py-2 text-sm" value={item.price} onChange={(event) => updateItem(index, "price", Number(event.target.value))} /><input type="number" className="app-input px-2 py-2 text-sm" value={item.qty} onChange={(event) => updateItem(index, "qty", Number(event.target.value))} /><select className="app-input px-2 py-2 text-sm" value={item.category} onChange={(event) => updateItem(index, "category", event.target.value as TransactionItem["category"])}>{categories.map((category) => <option key={category}>{category}</option>)}</select></div>)}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4 text-sm"><span className="text-[var(--muted)]">Total item</span><span className="font-semibold">{formatCurrency(itemTotal)}</span></div>
        <div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={handleSave} className="app-button-primary px-5 py-2.5 text-sm font-semibold">{saving ? "Menyimpan..." : "Simpan perubahan"}</button><button type="button" disabled={saving} onClick={handleDelete} className="rounded-full border border-[var(--coral)] px-5 py-2.5 text-sm font-semibold text-[var(--coral)]">Hapus transaksi</button></div>
      </section>
    </AppShell>
  );
}
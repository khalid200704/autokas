"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { emptyTransaction, formatCurrency, type ExtractedTransaction, type TransactionItem } from "@/lib/mock-data";
import { calculateSplit, type SplitMode } from "@/lib/split-bill";
import { createClient } from "@/lib/supabase/client";
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
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [participantInput, setParticipantInput] = useState("Saya, Teman 1");
  const [itemAssignments, setItemAssignments] = useState<Record<string, string>>({});
  const [sharedCharge, setSharedCharge] = useState("0");
  const [splitMode, setSplitMode] = useState<SplitMode>("items");
  const [splitSaved, setSplitSaved] = useState(false);
  const [splitSaving, setSplitSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      readOwnTransaction(params.id),
      createClient().from("transaction_splits").select("split_data").eq("transaction_id", params.id).maybeSingle(),
    ])
      .then(([row, splitResult]) => {
        if (splitResult.error) throw splitResult.error;
        if (!row) throw new Error("Transaksi tidak ditemukan.");
        const itemRows = (row.transaction_items ?? []) as {
          id: string;
          item_name: string;
          price: number | string;
          qty: number | string;
          category: TransactionItem["category"];
        }[];
        const mappedItems: TransactionItem[] = itemRows.map((item) => ({
          item_name: item.item_name,
          price: Number(item.price),
          qty: Number(item.qty),
          category: item.category,
        }));
        setTransaction({
          merchant: row.merchant,
          description: row.description ?? "",
          date: row.date,
          transaction_type: row.transaction_type,
          total_amount: Number(row.total_amount),
          items: mappedItems,
        });
        setItemIds(itemRows.map((item: { id: string }) => item.id));
        const savedSplit = splitResult.data?.split_data as {
          participantNames?: string[];
          itemAssignments?: Record<string, string>;
          sharedCharge?: number;
          mode?: SplitMode;
        } | null | undefined;
        const mappedTotal = mappedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
        setSharedCharge(String(savedSplit?.sharedCharge ?? Math.max(0, Number(row.total_amount) - mappedTotal)));
        if (savedSplit) {
          if (savedSplit.participantNames?.length) setParticipantInput(savedSplit.participantNames.join(", "));
          setItemAssignments(savedSplit.itemAssignments ?? {});
          setSplitMode(savedSplit.mode === "equal" ? "equal" : "items");
          setSplitSaved(true);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Transaksi gagal dimuat."))
      .finally(() => setLoading(false));
  }, [params.id]);

  const updateField = <K extends keyof ExtractedTransaction>(field: K, value: ExtractedTransaction[K]) => {
    setSplitSaved(false);
    setTransaction((current) => ({ ...current, [field]: value }));
  };

  const updateItem = (index: number, field: keyof TransactionItem, value: string | number) => {
    setSplitSaved(false);
    setTransaction((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  };

  const itemTotal = useMemo(() => transaction.items.reduce((sum, item) => sum + item.price * item.qty, 0), [transaction.items]);
  const participantNames = useMemo(
    () => [...new Set(participantInput.split(",").map((name) => name.trim()).filter(Boolean))],
    [participantInput]
  );
  const splitParticipants = useMemo(
    () => calculateSplit(
      transaction.total_amount,
      transaction.items,
      itemIds,
      participantNames,
      itemAssignments,
      Number(sharedCharge) || 0,
      splitMode
    ),
    [itemAssignments, itemIds, participantNames, sharedCharge, splitMode, transaction.items, transaction.total_amount]
  );

  const saveSplit = async () => {
    setError(null);
    setSplitSaving(true);
    try {
      if (participantNames.length < 2) throw new Error("Masukkan minimal dua nama peserta, dipisahkan dengan koma.");
      if (participantNames.length > 20) throw new Error("Split bill mendukung maksimal 20 peserta.");
      if (Number(sharedCharge) < 0 || !Number.isFinite(Number(sharedCharge))) throw new Error("Biaya bersama tidak valid.");
      if (new Set(participantNames.map((name) => name.toLowerCase())).size !== participantNames.length) {
        throw new Error("Nama peserta tidak boleh duplikat.");
      }
      if (splitMode === "items") {
        const assignedTotal = transaction.items.reduce((sum, item, index) => (
          participantNames.includes(itemAssignments[itemIds[index]])
            ? sum + Number(item.price) * Number(item.qty)
            : sum
        ), 0);
        if (assignedTotal + Number(sharedCharge) > transaction.total_amount) {
          throw new Error("Total item dan biaya bersama melebihi total transaksi.");
        }
      }

      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error("Silakan masuk kembali untuk menyimpan pembagian.");
      const { error: saveError } = await supabase.from("transaction_splits").upsert({
        transaction_id: params.id,
        owner_id: authData.user.id,
        split_data: {
          participantNames,
          itemAssignments,
          sharedCharge: Number(sharedCharge) || 0,
          mode: splitMode,
        },
        updated_at: new Date().toISOString(),
      });
      if (saveError) throw saveError;
      setSplitSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Split bill gagal disimpan.");
    } finally {
      setSplitSaving(false);
    }
  };

  const shareSplitMessage = [
    `Rincian patungan: ${transaction.merchant}`,
    ...splitParticipants.map((person) => `${person.name}: ${formatCurrency(person.amount)}${person.items.length ? ` (${person.items.map((item) => item.name).join(", ")})` : ""}`),
    `Total: ${formatCurrency(splitParticipants.reduce((sum, person) => sum + person.amount, 0))}`,
  ].join("\n");

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
      <section className="mx-auto max-w-3xl rounded-[26px] border border-[var(--line)] bg-white p-5 shadow-[0_20px_60px_rgba(23,51,47,0.06)] sm:p-6">
        {error && <p className="mb-5 rounded-xl bg-[#fff0ed] p-3 text-sm text-[var(--coral)]">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-[var(--muted)]">
            Merchant
            <input className="app-input w-full px-3 py-2.5" value={transaction.merchant} onChange={(event) => updateField("merchant", event.target.value)} />
          </label>
          <label className="space-y-2 text-sm text-[var(--muted)]">
            Tanggal
            <input type="date" className="app-input w-full px-3 py-2.5" value={transaction.date} onChange={(event) => updateField("date", event.target.value)} />
          </label>
          <label className="space-y-2 text-sm text-[var(--muted)]">
            Tipe
            <select className="app-input w-full px-3 py-2.5" value={transaction.transaction_type} onChange={(event) => updateField("transaction_type", event.target.value as ExtractedTransaction["transaction_type"])}>
              <option value="PENGELUARAN">Pengeluaran</option>
              <option value="PENDAPATAN">Pendapatan</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-[var(--muted)]">
            Total
            <input type="number" className="app-input w-full px-3 py-2.5" value={transaction.total_amount} onChange={(event) => updateField("total_amount", Number(event.target.value))} />
          </label>
          <label className="space-y-2 text-sm text-[var(--muted)] sm:col-span-2">
            Keterangan
            <textarea className="app-input w-full resize-none px-3 py-2.5" rows={3} value={transaction.description} onChange={(event) => updateField("description", event.target.value)} />
          </label>
        </div>

        <div className="mt-6 space-y-3">
          <h2 className="text-xl font-semibold">Item</h2>
          {transaction.items.map((item, index) => (
            <div key={`${item.item_name}-${index}`} className="grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-3 sm:grid-cols-[1fr_120px_80px_180px]">
              <input className="app-input px-2 py-2 text-sm" value={item.item_name} onChange={(event) => updateItem(index, "item_name", event.target.value)} />
              <input type="number" className="app-input px-2 py-2 text-sm" value={item.price} onChange={(event) => updateItem(index, "price", Number(event.target.value))} />
              <input type="number" className="app-input px-2 py-2 text-sm" value={item.qty} onChange={(event) => updateItem(index, "qty", Number(event.target.value))} />
              <select className="app-input px-2 py-2 text-sm" value={item.category} onChange={(event) => updateItem(index, "category", event.target.value as TransactionItem["category"])}>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-4 text-sm">
          <span className="text-[var(--muted)]">Total item</span>
          <span className="font-semibold">{formatCurrency(itemTotal)}</span>
        </div>

        <section className="mt-7 rounded-2xl border border-[var(--line)] bg-[#f8f9ff] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mint-dark)]">Patungan</p>
              <h2 className="mt-1 text-lg font-bold">Bagi item struk</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Pembagian ini hanya untuk transaksi Anda. Nama peserta tidak perlu memiliki akun AutoKas.</p>
            </div>
            {splitSaved && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Tersimpan</span>}
          </div>

          <label className="mt-4 block text-xs font-medium text-[var(--muted)]">
            Nama peserta (pisahkan dengan koma)
            <input
              value={participantInput}
              onChange={(event) => { setParticipantInput(event.target.value); setSplitSaved(false); }}
              className="app-input mt-1 w-full px-3 py-2.5 text-sm"
              placeholder="Saya, Sarah, Budi"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Metode pembagian">
            <button type="button" onClick={() => { setSplitMode("items"); setSplitSaved(false); }} aria-pressed={splitMode === "items"} className={`min-h-10 rounded-full px-4 py-2 text-xs font-semibold ${splitMode === "items" ? "bg-[var(--mint-dark)] text-white" : "border border-[var(--line)] bg-white text-[var(--muted)]"}`}>Pilih item per orang</button>
            <button type="button" onClick={() => { setSplitMode("equal"); setSplitSaved(false); }} aria-pressed={splitMode === "equal"} className={`min-h-10 rounded-full px-4 py-2 text-xs font-semibold ${splitMode === "equal" ? "bg-[var(--mint-dark)] text-white" : "border border-[var(--line)] bg-white text-[var(--muted)]"}`}>Bagi rata</button>
          </div>

          {splitMode === "items" && (
            <>
              <div className="mt-4 space-y-2">
                {transaction.items.map((item, index) => (
                  <label key={itemIds[index] ?? `${item.item_name}-${index}`} className="grid items-center gap-2 rounded-xl border border-[var(--line)] bg-white p-3 sm:grid-cols-[1fr_1fr]">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{item.item_name}</span>
                      <span className="text-xs text-[var(--muted)]">{item.qty} × {formatCurrency(item.price)}</span>
                    </span>
                    <select
                      value={itemAssignments[itemIds[index]] ?? ""}
                      onChange={(event) => {
                        setItemAssignments((current) => ({ ...current, [itemIds[index]]: event.target.value }));
                        setSplitSaved(false);
                      }}
                      className="app-input w-full px-3 py-2 text-sm"
                      aria-label={`Peserta untuk ${item.item_name}`}
                    >
                      <option value="">Belum ditugaskan</option>
                      {participantNames.map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              <label className="mt-3 block text-xs font-medium text-[var(--muted)]">
                Pajak / biaya bersama dari total struk
                <input
                  type="number"
                  min="0"
                  max={transaction.total_amount}
                  value={sharedCharge}
                  onChange={(event) => { setSharedCharge(event.target.value); setSplitSaved(false); }}
                  className="app-input mt-1 w-full px-3 py-2.5 text-sm"
                />
                <span className="mt-1 block font-normal">Dibagikan proporsional terhadap item yang ditugaskan. Sisa total dibagi rata.</span>
              </label>
            </>
          )}

          <div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-white px-3">
            {splitParticipants.map((person) => (
              <div key={person.name} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="block font-semibold">{person.name}</span>
                  {person.items.length > 0 && <span className="mt-0.5 block text-xs text-[var(--muted)]">{person.items.map((item) => item.name).join(", ")}</span>}
                </span>
                <span className="shrink-0 font-bold tabular-nums">{formatCurrency(person.amount)}</span>
              </div>
            ))}
            {splitParticipants.length === 0 && <p className="py-3 text-sm text-[var(--muted)]">Tambahkan minimal satu peserta untuk melihat rincian.</p>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={splitSaving} onClick={() => void saveSplit()} className="app-button-primary min-h-11 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              {splitSaving ? "Menyimpan..." : splitSaved ? "Simpan ulang pembagian" : "Simpan pembagian"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareSplitMessage)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)]"
            >
              Bagikan rincian
            </a>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={saving} onClick={handleSave} className="app-button-primary px-5 py-2.5 text-sm font-semibold">
            {saving ? "Menyimpan..." : "Simpan perubahan"}
          </button>
          <button type="button" disabled={saving} onClick={handleDelete} className="rounded-full border border-[var(--coral)] bg-[#fff0ed] px-5 py-2.5 text-sm font-semibold text-[var(--coral)]">
            Hapus transaksi
          </button>
        </div>
      </section>
    </AppShell>
  );
}
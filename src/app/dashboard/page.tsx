"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatCurrency,
  type ItemCategory,
} from "@/lib/mock-data";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import { readOwnTransactions } from "@/lib/supabase/transactions";
import type { SavedTransaction } from "@/lib/transaction-storage";

export default function DashboardPage() {
  const [savedTransactions, setSavedTransactions] = useState<SavedTransaction[]>([]);
  const [accountName, setAccountName] = useState("Anda");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"SEMUA" | "PENGELUARAN" | "PENDAPATAN">("SEMUA");

  useEffect(() => {
    let active = true;

    async function loadTransactions() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (active) setSavedTransactions([]);
          return;
        }

        const fallbackName = userData.user.user_metadata?.full_name || userData.user.user_metadata?.name || userData.user.email?.split("@")[0] || "Anda";
        if (active) {
          setAccountName(fallbackName);
          setAccountEmail(userData.user.email ?? null);
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", userData.user.id)
          .maybeSingle();
        if (active && profile?.full_name) setAccountName(profile.full_name);

        const remoteTransactions = await readOwnTransactions();
        const normalized = remoteTransactions.map((transaction) => ({
          id: transaction.id,
          merchant: transaction.merchant,
          description: transaction.description ?? "",
          date: transaction.date,
          transaction_type: transaction.transaction_type,
          total_amount: Number(transaction.total_amount),
          items: (transaction.transaction_items ?? []).map((item: {
            item_name: string;
            price: number | string;
            qty: number | string;
            category: ItemCategory;
          }) => ({
            item_name: item.item_name,
            price: Number(item.price),
            qty: Number(item.qty),
            category: item.category,
          })),
          savedAt: transaction.created_at,
        })) as SavedTransaction[];
        if (active) setSavedTransactions(normalized);
      } catch {
        if (active) {
          setSavedTransactions([]);
          setLoadError("Ringkasan belum bisa dimuat. Coba segarkan halaman.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadTransactions();
    return () => {
      active = false;
    };
  }, []);

  const transactions = [
    ...savedTransactions.map((transaction) => ({
      id: transaction.id,
      merchant: transaction.merchant,
      date: transaction.date,
      type: transaction.transaction_type,
      total: transaction.total_amount,
      category: transaction.items[0]?.category ?? "Lain-lain",
    })),
  ];

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesType = typeFilter === "SEMUA" || transaction.type === typeFilter;
      const matchesSearch =
        !normalizedSearch ||
        transaction.merchant.toLowerCase().includes(normalizedSearch) ||
        transaction.category.toLowerCase().includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [search, typeFilter, transactions]);

  const liveStats = useMemo(() => {
    const income = savedTransactions
      .filter((transaction) => transaction.transaction_type === "PENDAPATAN")
      .reduce((total, transaction) => total + transaction.total_amount, 0);
    const expense = savedTransactions
      .filter((transaction) => transaction.transaction_type === "PENGELUARAN")
      .reduce((total, transaction) => total + transaction.total_amount, 0);

    return [
      { label: "Pendapatan", value: income, tone: "emerald" },
      { label: "Pengeluaran", value: expense, tone: "rose" },
      { label: "Saldo", value: income - expense, tone: "blue" },
    ];
  }, [savedTransactions]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    savedTransactions
      .filter((transaction) => transaction.transaction_type === "PENGELUARAN")
      .forEach((transaction) => {
        transaction.items.forEach((item) => {
          totals.set(item.category, (totals.get(item.category) ?? 0) + item.price * item.qty);
        });
      });
    const max = Math.max(...totals.values(), 0);
    return [...totals.entries()]
      .sort(([, first], [, second]) => second - first)
      .slice(0, 6)
      .map(([name, value], index) => ({
        name,
        value,
        width: max ? (value / max) * 100 : 0,
        color: ["#2f9d78", "#5c8fca", "#d89b3d", "#d8645a", "#9275b9", "#6f817c"][index],
      }));
  }, [savedTransactions]);

  return (
    <AppShell
      title="Ringkasan kas"
      description="Lihat arus uang bulan ini dan catat transaksi baru dalam hitungan detik."
    >
      <div className="space-y-8">
        <section className="flex flex-col justify-between gap-5 rounded-2xl bg-[var(--ink)] p-6 text-white shadow-lg shadow-[#315b4930] sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-[#b9dcca]">Selamat datang kembali,</p>
            <h2 className="mt-1 text-3xl font-bold">{accountName}</h2>
            {accountEmail && <p className="mt-2 text-sm text-[#c2d3cb]">{accountEmail}</p>}
          </div>
          <a href="/scan" className="inline-flex items-center justify-center rounded-full bg-[#b9dcca] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-white">
            + Catat transaksi
          </a>
        </section>

        {loadError && (
          <div role="alert" className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--coral)]/30 bg-[#fff0ed] px-4 py-3 text-sm text-[var(--coral)] sm:flex-row sm:items-center">
            <span>{loadError}</span>
            <button type="button" onClick={() => window.location.reload()} className="font-semibold underline underline-offset-4">Coba lagi</button>
          </div>
        )}

        <section aria-label="Ringkasan saldo" className="grid gap-4 md:grid-cols-3">
          {liveStats.map((item) => (
            <div key={item.label} className="app-panel relative overflow-hidden p-5">
              <div className={`absolute inset-y-0 left-0 w-1 ${item.label === "Pendapatan" ? "bg-[var(--mint)]" : item.label === "Pengeluaran" ? "bg-[var(--coral)]" : "bg-[#5c8fca]"}`} />
              <p className="text-sm text-[var(--muted)]">{item.label}</p>
              {isLoading ? <div className="mt-4 h-9 w-36 animate-pulse rounded-lg bg-[var(--surface-soft)]" /> : <p className="mt-3 text-3xl font-bold text-[var(--ink)]">{formatCurrency(item.value)}</p>}
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="app-panel p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold">Riwayat transaksi</h2>
              <span className="text-sm text-[var(--muted)]">
                {savedTransactions.length ? `${savedTransactions.length} transaksi` : "Belum ada"}
              </span>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="sr-only" htmlFor="transaction-search">
                Cari transaksi
              </label>
              <input
                id="transaction-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari merchant atau kategori"
                className="app-input w-full px-3 py-2.5 text-sm"
              />
              <label className="sr-only" htmlFor="transaction-type">
                Filter tipe transaksi
              </label>
              <select
                id="transaction-type"
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as typeof typeFilter)
                }
                className="app-input px-3 py-2.5 text-sm"
              >
                <option value="SEMUA">Semua tipe</option>
                <option value="PENGELUARAN">Pengeluaran</option>
                <option value="PENDAPATAN">Pendapatan</option>
              </select>
            </div>

            <div className="space-y-3" aria-live="polite">
              {isLoading && [1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-[var(--surface-soft)]" />)}
              {!isLoading && filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4"
                >
                  <div>
                    <a href={`/transactions/${transaction.id}`} className="font-medium text-[var(--ink)] hover:text-[var(--mint-dark)]">
                      {transaction.merchant}
                    </a>
                    <p className="text-sm text-[var(--muted)]">
                      {transaction.date} • {transaction.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        transaction.type === "PENDAPATAN"
                          ? "text-[var(--mint-dark)]"
                          : "text-[var(--coral)]"
                      }`}
                    >
                      {transaction.type === "PENDAPATAN" ? "+" : "-"}
                      {formatCurrency(transaction.total)}
                    </p>
                    <p className="text-xs text-[var(--muted)]">{transaction.id}</p>
                  </div>
                </div>
              ))}
              {!isLoading && !filteredTransactions.length && (
                <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-5 py-8 text-center">
                  <p className="font-semibold text-[var(--ink)]">Belum ada transaksi</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Mulai dengan mencatat uang masuk atau scan struk pertama Anda.
                  </p>
                  <a
                    href="/scan"
                    className="app-button-primary mt-4 inline-flex px-4 py-2 text-sm font-semibold"
                  >
                    Scan struk
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="app-panel p-6">
            <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Pengeluaran per kategori</h2><p className="mt-1 text-sm text-[var(--muted)]">Bulan berjalan</p></div><span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--mint-dark)]">Ringkas</span></div>
            <div className="space-y-4">
              {categoryTotals.map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                    <span>{item.name}</span>
                    <span>{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-800">
                    <div
                      className="h-2.5 rounded-full"
                      style={{ width: `${item.width}%`, background: item.color }}
                    />
                  </div>
                </div>
              ))}
              {!categoryTotals.length && (
                <p className="text-sm text-[var(--muted)]">Belum ada data pengeluaran.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

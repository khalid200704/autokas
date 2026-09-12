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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"SEMUA" | "PENGELUARAN" | "PENDAPATAN">("SEMUA");

  useEffect(() => {
    let active = true;

    async function loadTransactions() {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (active) setSavedTransactions([]);
          return;
        }

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
        if (active) setSavedTransactions([]);
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
        <section className="grid gap-4 md:grid-cols-3">
          {liveStats.map((item) => (
            <div key={item.label} className="app-panel p-5">
              <p className="text-sm text-[var(--muted)]">{item.label}</p>
              <p className="mt-3 text-3xl font-bold text-[var(--ink)]">
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="app-panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Riwayat transaksi</h2>
              <span className="text-sm text-[var(--muted)]">
                {savedTransactions.length ? `${savedTransactions.length} tersimpan` : "Bulan ini"}
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

            <div className="space-y-3">
              {filteredTransactions.map((transaction) => (
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
              {!filteredTransactions.length && (
                <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-5 py-8 text-center">
                  <p className="font-semibold text-[var(--ink)]">Belum ada transaksi yang cocok</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Coba ubah pencarian atau mulai dengan scan struk baru.
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
            <h2 className="mb-4 text-xl font-semibold">Pengeluaran per kategori</h2>
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

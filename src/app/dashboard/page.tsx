"use client";

import { useEffect, useState } from "react";
import {
  categoryBreakdown,
  formatCurrency,
  recentTransactions,
  summaryStats,
} from "@/lib/mock-data";
import { readSavedTransactions, type SavedTransaction } from "@/lib/transaction-storage";

export default function DashboardPage() {
  const [savedTransactions, setSavedTransactions] = useState<SavedTransaction[]>([]);

  useEffect(() => {
    setSavedTransactions(readSavedTransactions());
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
    ...recentTransactions,
  ];

  return (
    <main className="app-shell px-4 py-8 text-[var(--ink)]">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="app-header -mx-4 -mt-8 flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--mint-dark)]">
              AutoKas
            </p>
            <h1 className="mt-2 text-3xl font-bold">Ringkasan kas</h1>
          </div>
          <a
            href="/scan"
            className="app-button-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold"
          >
            + Tambah transaksi
          </a>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {summaryStats.map((item) => (
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

            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4"
                >
                  <div>
                    <p className="font-medium text-[var(--ink)]">{transaction.merchant}</p>
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
            </div>
          </div>

          <div className="app-panel p-6">
            <h2 className="mb-4 text-xl font-semibold">Pengeluaran per kategori</h2>
            <div className="space-y-4">
              {categoryBreakdown.map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-sm text-slate-300">
                    <span>{item.name}</span>
                    <span>{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-800">
                    <div
                      className="h-2.5 rounded-full"
                      style={{ width: `${(item.value / 640000) * 100}%`, background: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

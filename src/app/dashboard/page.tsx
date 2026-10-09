"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CashflowChart, CategoryPieChart } from "@/components/finance-charts";
import {
  ITEM_CATEGORIES,
  categoryExpenseTotals,
  dailyCashflow,
  formatDateLabel,
  matchesFilters,
  presetRange,
  summarizeTransactions,
  type DatePreset,
  type TransactionFilters,
} from "@/lib/finance";
import { formatCurrency, type ItemCategory } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { readOwnTransactions } from "@/lib/supabase/transactions";
import type { SavedTransaction } from "@/lib/transaction-storage";

const PAGE_SIZE = 20;

export default function DashboardPage() {
  const [savedTransactions, setSavedTransactions] = useState<SavedTransaction[]>([]);
  const [accountName, setAccountName] = useState("Anda");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preset, setPreset] = useState<DatePreset>("bulan-ini");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<TransactionFilters>(() => {
    const range = presetRange("bulan-ini");
    return {
      search: "",
      type: "SEMUA",
      category: "SEMUA",
      dateFrom: range.from,
      dateTo: range.to,
    };
  });

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

        const fallbackName =
          userData.user.user_metadata?.full_name ||
          userData.user.user_metadata?.name ||
          userData.user.email?.split("@")[0] ||
          "Anda";
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
          items: (transaction.transaction_items ?? []).map(
            (item: { item_name: string; price: number | string; qty: number | string; category: ItemCategory }) => ({
              item_name: item.item_name,
              price: Number(item.price),
              qty: Number(item.qty),
              category: item.category,
            })
          ),
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

  const applyPreset = (next: DatePreset) => {
    setPreset(next);
    setPage(1);
    if (next === "kustom") return;
    const range = presetRange(next);
    setFilters((current) => ({ ...current, dateFrom: range.from, dateTo: range.to }));
  };

  const updateFilter = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
    if (key === "dateFrom" || key === "dateTo") setPreset("kustom");
  };

  const filteredTransactions = useMemo(
    () => savedTransactions.filter((transaction) => matchesFilters(transaction, filters)),
    [filters, savedTransactions]
  );

  const liveStats = useMemo(() => summarizeTransactions(filteredTransactions), [filteredTransactions]);
  const categoryTotals = useMemo(() => categoryExpenseTotals(filteredTransactions), [filteredTransactions]);
  const cashflowDays = useMemo(
    () => dailyCashflow(filteredTransactions, filters.dateFrom, filters.dateTo),
    [filteredTransactions, filters.dateFrom, filters.dateTo]
  );

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const pagedTransactions = filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const periodLabel =
    filters.dateFrom && filters.dateTo
      ? `${formatDateLabel(filters.dateFrom)} – ${formatDateLabel(filters.dateTo)}`
      : "Semua waktu";

  return (
    <AppShell
      title="Ringkasan kas"
      description="Lihat arus uang bulanan Anda dan catat transaksi baru dengan cepat."
    >
      <div className="space-y-6">
        <section className="rounded-[22px] bg-[#17332f] p-5 text-white shadow-[0_18px_40px_rgba(23,51,47,0.14)] sm:p-6">
          <div>
            <p className="text-sm text-[#d3ebdf]">Selamat datang kembali,</p>
            <h2 className="mt-1 text-3xl font-bold leading-tight">{accountName}</h2>
            {accountEmail && <p className="mt-2 text-sm text-[#cfe4de]">{accountEmail}</p>}
          </div>
        </section>

        {loadError && (
          <div role="alert" className="rounded-xl border border-[var(--coral)]/30 bg-[#fff0ed] px-4 py-3 text-sm text-[var(--coral)]">
            <span>{loadError}</span>
          </div>
        )}

        <section aria-label="Filter periode laporan" className="app-panel p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">Periode laporan</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Ringkasan, grafik, dan riwayat mengikuti periode yang dipilih.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["bulan-ini", "Bulan ini"],
                ["7-hari", "7 hari"],
                ["30-hari", "30 hari"],
                ["semua", "Semua waktu"],
                ["kustom", "Kustom"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={preset === value}
                  onClick={() => applyPreset(value)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    preset === value
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--mint)] hover:text-[var(--ink)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {preset === "kustom" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-[var(--muted)]">
                  Dari tanggal
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(event) => updateFilter("dateFrom", event.target.value)}
                    className="app-input mt-1 w-full px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Sampai tanggal
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(event) => updateFilter("dateTo", event.target.value)}
                    className="app-input mt-1 w-full px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
            )}
          </div>
        </section>

        <section aria-label="Ringkasan saldo" className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Pendapatan", value: liveStats.income, accent: "bg-[var(--mint)]" },
            { label: "Pengeluaran", value: liveStats.expense, accent: "bg-[var(--coral)]" },
            { label: "Saldo", value: liveStats.balance, accent: "bg-[#5c8fca]" },
          ].map((item) => (
            <div key={item.label} className="app-panel relative overflow-hidden p-5">
              <div className={`absolute inset-y-0 left-0 w-1 ${item.accent}`} />
              <p className="text-sm text-[var(--muted)]">{item.label}</p>
              {isLoading ? (
                <div className="mt-4 h-9 w-36 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
              ) : (
                <p className="mt-3 text-3xl font-bold text-[var(--ink)]">{formatCurrency(item.value)}</p>
              )}
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <article className="app-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Pendapatan vs pengeluaran</h2>
              <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                {periodLabel}
              </span>
            </div>
            <p className="mb-4 text-sm text-[var(--muted)]">Periode: {periodLabel}</p>
            {isLoading ? <div className="h-52 animate-pulse rounded-xl bg-[var(--surface-soft)]" /> : <CashflowChart days={cashflowDays} />}
          </article>

          <article className="app-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Pengeluaran per kategori</h2>
              <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                {periodLabel}
              </span>
            </div>
            {isLoading ? (
              <div className="h-52 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4">
                <CategoryPieChart slices={categoryTotals} />
                <p className="text-center text-3xl font-bold text-[var(--ink)]">{formatCurrency(liveStats.expense)}</p>
                <p className="text-sm text-[var(--muted)]">Total pengeluaran</p>
              </div>
            )}
          </article>
        </section>

        <section className="app-panel p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Riwayat transaksi</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {isLoading ? "Memuat transaksi..." : `${filteredTransactions.length} transaksi ditemukan`}
              </p>
            </div>
            <Link href="/scan" className="app-button-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold">
              + Catat transaksi
            </Link>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-[1.6fr_1fr_1fr]">
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              aria-label="Cari transaksi"
              placeholder="Cari merchant atau kategori"
              className="app-input w-full px-3 py-2.5 text-sm"
            />
            <select
              value={filters.type}
              onChange={(event) => updateFilter("type", event.target.value as TransactionFilters["type"])}
              aria-label="Filter tipe transaksi"
              className="app-input w-full px-3 py-2.5 text-sm"
            >
              <option value="SEMUA">Semua tipe</option>
              <option value="PENGELUARAN">Pengeluaran</option>
              <option value="PENDAPATAN">Pendapatan</option>
            </select>
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value as TransactionFilters["category"])}
              aria-label="Filter kategori transaksi"
              className="app-input w-full px-3 py-2.5 text-sm"
            >
              <option value="SEMUA">Semua kategori</option>
              {ITEM_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="space-y-3" aria-label="Memuat transaksi">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-16 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
              ))}
            </div>
          ) : pagedTransactions.length > 0 ? (
            <>
              <ul className="divide-y divide-[var(--line)]">
                {pagedTransactions.map((transaction) => {
                  const category =
                    transaction.items[0]?.category ??
                    (transaction.transaction_type === "PENDAPATAN" ? "Pendapatan" : "Lain-lain");
                  const isIncome = transaction.transaction_type === "PENDAPATAN";
                  return (
                    <li key={transaction.id}>
                      <Link
                        href={`/transactions/${transaction.id}`}
                        className="flex flex-col gap-3 rounded-xl px-3 py-4 transition hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-dark)] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-[var(--ink)]">{transaction.merchant}</p>
                            <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--muted)]">
                              {category}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-[var(--muted)]">
                            {formatDateLabel(transaction.date)}
                            {transaction.description ? ` · ${transaction.description}` : ""}
                          </p>
                        </div>
                        <p className={`shrink-0 font-semibold tabular-nums ${isIncome ? "text-[var(--mint-dark)]" : "text-[var(--ink)]"}`}>
                          {isIncome ? "+" : "−"}{formatCurrency(transaction.total_amount)}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {pageCount > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-sm text-[var(--muted)]">Halaman {page} dari {pageCount}</span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    disabled={page === pageCount}
                    className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-[18px] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-5 py-10 text-center">
              {savedTransactions.length === 0 ? (
                <>
                  <p className="text-base font-semibold text-[var(--ink)]">Belum ada transaksi</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Catat transaksi pertama Anda. Anda bisa mengisi manual atau memindai foto struk.
                  </p>
                  <Link href="/scan" className="app-button-primary mt-5 inline-flex px-4 py-2.5 text-sm font-semibold">
                    Mulai mencatat
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-[var(--ink)]">Tidak ada transaksi yang cocok</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Coba ubah kata kunci, kategori, tipe, atau rentang tanggal.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({ search: "", type: "SEMUA", category: "SEMUA", dateFrom: "", dateTo: "" });
                      setPreset("semua");
                      setPage(1);
                    }}
                    className="mt-5 rounded-full border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)]"
                  >
                    Hapus semua filter
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

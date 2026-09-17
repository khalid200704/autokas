"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CashflowChart, CategoryPieChart } from "@/components/finance-charts";
import {
  ITEM_CATEGORIES,
  categoryExpenseTotals,
  dailyCashflow,
  formatDateLabel,
  jakartaMonthStart,
  jakartaToday,
  matchesFilters,
  presetRange,
  summarizeTransactions,
  thisMonthTransactions,
  type DatePreset,
  type TransactionFilters,
} from "@/lib/finance";
import { emptyFinancePlan, readFinancePlan } from "@/lib/finance-plan";
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
  const [plan, setPlan] = useState(emptyFinancePlan);
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
    setPlan(readFinancePlan());
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

  const monthStats = useMemo(
    () => summarizeTransactions(thisMonthTransactions(savedTransactions)),
    [savedTransactions]
  );
  const budgetLeft = plan.monthlyExpenseBudget - monthStats.expense;
  const savingsGap = monthStats.balance - plan.savingsTarget;

  const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const pagedTransactions = filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const periodLabel =
    filters.dateFrom && filters.dateTo
      ? `${formatDateLabel(filters.dateFrom)} – ${formatDateLabel(filters.dateTo)}`
      : "Semua waktu";

  return (
    <AppShell
      title="Ringkasan kas"
      description="Saring transaksi, baca grafik arus kas, dan bandingkan belanja dengan rencana bulan ini."
    >
      <div className="space-y-8">
        <section className="flex flex-col justify-between gap-5 rounded-2xl bg-[var(--ink)] p-6 text-white shadow-lg shadow-[#315b4930] sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-[#b9dcca]">Selamat datang kembali,</p>
            <h2 className="mt-1 text-3xl font-bold">{accountName}</h2>
            {accountEmail && <p className="mt-2 text-sm text-[#c2d3cb]">{accountEmail}</p>}
            <p className="mt-3 text-sm text-[#b9dcca]">{periodLabel}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/plan" className="inline-flex items-center justify-center rounded-full border border-[#b9dcca] px-5 py-3 text-sm font-semibold text-[#b9dcca] transition hover:bg-white hover:text-[var(--ink)]">
              Rencana keuangan
            </a>
            <a href="/scan" className="inline-flex items-center justify-center rounded-full bg-[#b9dcca] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:bg-white">
              + Catat transaksi
            </a>
          </div>
        </section>

        {loadError && (
          <div role="alert" className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--coral)]/30 bg-[#fff0ed] px-4 py-3 text-sm text-[var(--coral)] sm:flex-row sm:items-center">
            <span>{loadError}</span>
            <button type="button" onClick={() => window.location.reload()} className="font-semibold underline underline-offset-4">
              Coba lagi
            </button>
          </div>
        )}

        <section className="app-panel p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["bulan-ini", "Bulan ini"],
                ["7-hari", "7 hari"],
                ["30-hari", "30 hari"],
                ["semua", "Semua"],
                ["kustom", "Kustom"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyPreset(value)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  preset === value ? "bg-[var(--ink)] text-white" : "bg-[var(--surface-soft)] text-[var(--ink)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Cari
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Merchant, barang, atau kategori"
                className="app-input mt-1 w-full px-3 py-2.5 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Tipe
              <select
                value={filters.type}
                onChange={(event) => updateFilter("type", event.target.value as TransactionFilters["type"])}
                className="app-input mt-1 w-full px-3 py-2.5 text-sm font-normal normal-case tracking-normal"
              >
                <option value="SEMUA">Semua tipe</option>
                <option value="PENGELUARAN">Pengeluaran</option>
                <option value="PENDAPATAN">Pendapatan</option>
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Kategori
              <select
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value as TransactionFilters["category"])}
                className="app-input mt-1 w-full px-3 py-2.5 text-sm font-normal normal-case tracking-normal"
              >
                <option value="SEMUA">Semua kategori</option>
                {ITEM_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Dari
              <input
                type="date"
                max={jakartaToday()}
                value={filters.dateFrom}
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
                className="app-input mt-1 w-full px-3 py-2.5 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              Sampai
              <input
                type="date"
                min={filters.dateFrom || undefined}
                max={jakartaToday()}
                value={filters.dateTo}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
                className="app-input mt-1 w-full px-3 py-2.5 text-sm font-normal normal-case tracking-normal"
              />
            </label>
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

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="app-panel p-5 lg:col-span-2">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Arus kas harian</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Pendapatan dan pengeluaran pada filter aktif</p>
              </div>
            </div>
            {isLoading ? <div className="h-52 animate-pulse rounded-xl bg-[var(--surface-soft)]" /> : <CashflowChart days={cashflowDays} />}
          </article>
          <article className="app-panel p-5">
            <h2 className="text-xl font-semibold">Rencana bulan ini</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {jakartaMonthStart()} – {jakartaToday()}
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Plafon belanja</dt>
                <dd className="font-semibold">{formatCurrency(plan.monthlyExpenseBudget)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Sudah terpakai</dt>
                <dd className="font-semibold">{formatCurrency(monthStats.expense)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Sisa plafon</dt>
                <dd className={budgetLeft < 0 ? "font-semibold text-[var(--coral)]" : "font-semibold text-[var(--mint-dark)]"}>
                  {formatCurrency(budgetLeft)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Vs target tabungan</dt>
                <dd className={savingsGap < 0 ? "font-semibold text-[var(--coral)]" : "font-semibold"}>
                  {formatCurrency(savingsGap)}
                </dd>
              </div>
            </dl>
            <a href="/plan" className="mt-5 inline-flex text-sm font-semibold text-[var(--mint-dark)] underline underline-offset-4">
              Atur anggaran
            </a>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="app-panel p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold">Riwayat transaksi</h2>
              <span className="text-sm text-[var(--muted)]">
                {filteredTransactions.length ? `${filteredTransactions.length} hasil` : "Tidak ada hasil"}
              </span>
            </div>
            <div className="space-y-3" aria-live="polite">
              {isLoading && [1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-[var(--surface-soft)]" />)}
              {!isLoading &&
                pagedTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4"
                  >
                    <div>
                      <a href={`/transactions/${transaction.id}`} className="font-medium text-[var(--ink)] hover:text-[var(--mint-dark)]">
                        {transaction.merchant}
                      </a>
                      <p className="text-sm text-[var(--muted)]">
                        {formatDateLabel(transaction.date)} • {transaction.items[0]?.category ?? "Lain-lain"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          transaction.transaction_type === "PENDAPATAN" ? "text-[var(--mint-dark)]" : "text-[var(--coral)]"
                        }`}
                      >
                        {transaction.transaction_type === "PENDAPATAN" ? "+" : "-"}
                        {formatCurrency(transaction.total_amount)}
                      </p>
                    </div>
                  </div>
                ))}
              {!isLoading && !filteredTransactions.length && (
                <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-5 py-8 text-center">
                  <p className="font-semibold text-[var(--ink)]">Tidak ada transaksi pada filter ini</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Ubah rentang tanggal atau catat transaksi baru.</p>
                  <a href="/scan" className="app-button-primary mt-4 inline-flex px-4 py-2 text-sm font-semibold">
                    Scan struk
                  </a>
                </div>
              )}
            </div>
            {filteredTransactions.length > PAGE_SIZE && (
              <div className="mt-5 flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <span className="text-[var(--muted)]">
                  Halaman {page} dari {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page === pageCount}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            )}
          </div>

          <div className="app-panel p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Pengeluaran per kategori</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Mengikuti filter yang aktif</p>
            </div>
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
            ) : (
              <CategoryPieChart slices={categoryTotals} />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

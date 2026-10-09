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
      description="Lihat arus uang bulanan Anda dan catat transaksi baru dengan cepat."
    >
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-5 rounded-[22px] bg-[#17332f] p-5 text-white shadow-[0_18px_40px_rgba(23,51,47,0.14)] sm:flex-row sm:items-end sm:p-6">
          <div>
            <p className="text-sm text-[#d3ebdf]">Selamat datang kembali,</p>
            <h2 className="mt-1 text-3xl font-bold leading-tight">{accountName}</h2>
            {accountEmail && <p className="mt-2 text-sm text-[#cfe4de]">{accountEmail}</p>}
          </div>
          <a
            href="/scan"
            className="inline-flex items-center justify-center rounded-full bg-[#d9efe4] px-4 py-2.5 text-sm font-semibold text-[#17332f] transition hover:bg-white"
          >
            + Catat transaksi
          </a>
        </section>

        {loadError && (
          <div role="alert" className="rounded-xl border border-[var(--coral)]/30 bg-[#fff0ed] px-4 py-3 text-sm text-[var(--coral)]">
            <span>{loadError}</span>
          </div>
        )}

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
                Bulan ini
              </span>
            </div>
            <p className="mb-4 text-sm text-[var(--muted)]">Periode: {periodLabel}</p>
            {isLoading ? <div className="h-52 animate-pulse rounded-xl bg-[var(--surface-soft)]" /> : <CashflowChart days={cashflowDays} />}
          </article>

          <article className="app-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Pengeluaran per kategori</h2>
              <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">
                Bulan ini
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
            <h2 className="text-xl font-semibold">Riwayat transaksi</h2>
            <button type="button" className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm text-[var(--muted)]">
              Belum ada
            </button>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-[1.6fr_1fr_1fr]">
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Cari merchant atau kategori"
              className="app-input w-full px-3 py-2.5 text-sm"
            />
            <select
              value={filters.type}
              onChange={(event) => updateFilter("type", event.target.value as TransactionFilters["type"])}
              className="app-input w-full px-3 py-2.5 text-sm"
            >
              <option value="SEMUA">Semua tipe</option>
              <option value="PENGELUARAN">Pengeluaran</option>
              <option value="PENDAPATAN">Pendapatan</option>
            </select>
            <select
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value as TransactionFilters["category"])}
              className="app-input w-full px-3 py-2.5 text-sm"
            >
              <option value="SEMUA">Semua kategori</option>
              {ITEM_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="rounded-[18px] border border-dashed border-[var(--line)] bg-[var(--surface-soft)] px-5 py-10 text-center">
            {isLoading ? (
              <div className="mx-auto h-5 w-40 animate-pulse rounded-full bg-white/60" />
            ) : (
              <>
                <p className="text-base font-semibold text-[var(--ink)]">Belum ada transaksi</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Mulai dengan menginput atau scan struk Anda untuk memulai pencatatan.
                </p>
                <a href="/scan" className="app-button-primary mt-5 inline-flex px-4 py-2.5 text-sm font-semibold">
                  Scan struk
                </a>
              </>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

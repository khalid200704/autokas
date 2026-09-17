import type { ItemCategory, TransactionType } from "@/lib/mock-data";
import type { SavedTransaction } from "@/lib/transaction-storage";

export const ITEM_CATEGORIES: ItemCategory[] = [
  "Makanan & Minuman",
  "Kebutuhan Rumah",
  "Kesehatan",
  "Transportasi/BBM",
  "Tagihan",
  "Operasional",
  "Pendapatan",
  "Lain-lain",
];

export const EXPENSE_CATEGORIES: ItemCategory[] = ITEM_CATEGORIES.filter(
  (category) => category !== "Pendapatan"
);

export const CATEGORY_COLORS: Record<ItemCategory, string> = {
  "Makanan & Minuman": "#2f9d78",
  "Kebutuhan Rumah": "#5c8fca",
  "Kesehatan": "#d8645a",
  "Transportasi/BBM": "#d89b3d",
  Tagihan: "#9275b9",
  Operasional: "#4d7c6f",
  Pendapatan: "#23735b",
  "Lain-lain": "#6f817c",
};

export type DatePreset = "bulan-ini" | "7-hari" | "30-hari" | "semua" | "kustom";
export type TypeFilter = "SEMUA" | TransactionType;

export type TransactionFilters = {
  search: string;
  type: TypeFilter;
  category: "SEMUA" | ItemCategory;
  dateFrom: string;
  dateTo: string;
};

export function jakartaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function jakartaMonthStart(today = jakartaToday()): string {
  return `${today.slice(0, 7)}-01`;
}

export function shiftJakartaDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function presetRange(preset: DatePreset): { from: string; to: string } {
  const today = jakartaToday();
  if (preset === "bulan-ini") return { from: jakartaMonthStart(today), to: today };
  if (preset === "7-hari") return { from: shiftJakartaDate(today, -6), to: today };
  if (preset === "30-hari") return { from: shiftJakartaDate(today, -29), to: today };
  if (preset === "semua") return { from: "", to: "" };
  return { from: jakartaMonthStart(today), to: today };
}

export function formatDateLabel(isoDate: string) {
  if (!isoDate) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00`));
}

export function matchesFilters(transaction: SavedTransaction, filters: TransactionFilters) {
  const inDateRange =
    (!filters.dateFrom || transaction.date >= filters.dateFrom) &&
    (!filters.dateTo || transaction.date <= filters.dateTo);
  const matchesType = filters.type === "SEMUA" || transaction.transaction_type === filters.type;
  const matchesCategory =
    filters.category === "SEMUA" ||
    transaction.items.some((item) => item.category === filters.category);
  const needle = filters.search.trim().toLowerCase();
  const matchesSearch =
    !needle ||
    transaction.merchant.toLowerCase().includes(needle) ||
    transaction.description.toLowerCase().includes(needle) ||
    transaction.items.some(
      (item) =>
        item.item_name.toLowerCase().includes(needle) ||
        item.category.toLowerCase().includes(needle)
    );

  return inDateRange && matchesType && matchesCategory && matchesSearch;
}

export function summarizeTransactions(transactions: SavedTransaction[]) {
  const income = transactions
    .filter((transaction) => transaction.transaction_type === "PENDAPATAN")
    .reduce((sum, transaction) => sum + transaction.total_amount, 0);
  const expense = transactions
    .filter((transaction) => transaction.transaction_type === "PENGELUARAN")
    .reduce((sum, transaction) => sum + transaction.total_amount, 0);

  return { income, expense, balance: income - expense };
}

export function categoryExpenseTotals(transactions: SavedTransaction[]) {
  const totals = new Map<ItemCategory, number>();
  transactions
    .filter((transaction) => transaction.transaction_type === "PENGELUARAN")
    .forEach((transaction) => {
      transaction.items.forEach((item) => {
        totals.set(item.category, (totals.get(item.category) ?? 0) + item.price * item.qty);
      });
    });

  return [...totals.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name],
    }));
}

function daySpan(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

export function dailyCashflow(transactions: SavedTransaction[], from: string, to: string) {
  const start = from || [...transactions].sort((a, b) => a.date.localeCompare(b.date))[0]?.date || jakartaToday();
  const end = to || jakartaToday();
  if (start > end) return [];

  const useWeekly = daySpan(start, end) > 45;
  const buckets: { date: string; income: number; expense: number }[] = [];

  if (useWeekly) {
    for (let cursor = start; cursor <= end; cursor = shiftJakartaDate(cursor, 7)) {
      buckets.push({ date: cursor, income: 0, expense: 0 });
    }
  } else {
    for (let cursor = start; cursor <= end; cursor = shiftJakartaDate(cursor, 1)) {
      buckets.push({ date: cursor, income: 0, expense: 0 });
    }
  }

  transactions.forEach((transaction) => {
    if (transaction.date < start || transaction.date > end) return;
    let index = -1;
    if (useWeekly) {
      for (let i = 0; i < buckets.length; i += 1) {
        if (buckets[i].date <= transaction.date) index = i;
      }
    } else {
      index = buckets.findIndex((bucket) => bucket.date === transaction.date);
    }
    if (index < 0) return;
    if (transaction.transaction_type === "PENDAPATAN") buckets[index].income += transaction.total_amount;
    else buckets[index].expense += transaction.total_amount;
  });

  return buckets;
}

export function thisMonthTransactions(transactions: SavedTransaction[]) {
  const from = jakartaMonthStart();
  const to = jakartaToday();
  return transactions.filter((transaction) => transaction.date >= from && transaction.date <= to);
}

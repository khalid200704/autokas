export type TransactionType = "PENGELUARAN" | "PENDAPATAN";

export type ItemCategory =
  | "Makanan & Minuman"
  | "Kebutuhan Rumah"
  | "Kesehatan"
  | "Transportasi/BBM"
  | "Tagihan"
  | "Operasional"
  | "Pendapatan"
  | "Lain-lain";

export interface TransactionItem {
  item_name: string;
  price: number;
  qty: number;
  category: ItemCategory;
}

export interface ExtractedTransaction {
  merchant: string;
  date: string;
  transaction_type: TransactionType;
  total_amount: number;
  description: string;
  items: TransactionItem[];
}

export const emptyTransaction: ExtractedTransaction = {
  merchant: "",
  date: "",
  transaction_type: "PENGELUARAN",
  total_amount: 0,
  description: "",
  items: [],
};

export const defaultExtractedTransaction = emptyTransaction;

export const summaryStats = [
  { label: "Pendapatan", value: 3200000, tone: "emerald" },
  { label: "Pengeluaran", value: 2185000, tone: "rose" },
  { label: "Saldo", value: 1015000, tone: "blue" },
];

export const categoryBreakdown = [
  { name: "Makanan & Minuman", value: 640000, color: "#34d399" },
  { name: "Kebutuhan Rumah", value: 540000, color: "#60a5fa" },
  { name: "Transportasi/BBM", value: 290000, color: "#fbbf24" },
  { name: "Tagihan", value: 420000, color: "#f472b6" },
  { name: "Lain-lain", value: 150000, color: "#a78bfa" },
];

export const recentTransactions = [
  {
    id: "TX-1042",
    merchant: "Warung Pak Manto",
    date: "2026-09-10",
    type: "PENGELUARAN",
    total: 185000,
    category: "Makanan & Minuman",
  },
  {
    id: "TX-1041",
    merchant: "PT. Maju Jaya",
    date: "2026-09-09",
    type: "PENDAPATAN",
    total: 2200000,
    category: "Pendapatan",
  },
  {
    id: "TX-1040",
    merchant: "BPSmart",
    date: "2026-09-08",
    type: "PENGELUARAN",
    total: 95000,
    category: "Kebutuhan Rumah",
  },
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

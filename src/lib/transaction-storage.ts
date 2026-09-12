import type { ExtractedTransaction } from "@/lib/mock-data";

export const TRANSACTIONS_STORAGE_KEY = "autokas.transactions";
export const EXTRACTION_CORRECTIONS_STORAGE_KEY = "autokas.extraction-corrections";

export type SavedTransaction = ExtractedTransaction & {
  id: string;
  savedAt: string;
};

export type SavedExtractionCorrection = {
  id: string;
  sourceFileName: string;
  aiResult: ExtractedTransaction;
  correctedResult: ExtractedTransaction;
  createdAt: string;
};

export function readSavedTransactions(): SavedTransaction[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as SavedTransaction[]) : [];
  } catch {
    return [];
  }
}

export function saveTransaction(transaction: ExtractedTransaction) {
  const savedTransaction: SavedTransaction = {
    ...transaction,
    id: `TX-${Date.now().toString().slice(-6)}`,
    savedAt: new Date().toISOString(),
  };
  const nextTransactions = [savedTransaction, ...readSavedTransactions()];
  window.localStorage.setItem(
    TRANSACTIONS_STORAGE_KEY,
    JSON.stringify(nextTransactions)
  );
  return savedTransaction;
}

export function saveExtractionCorrection(
  sourceFileName: string,
  aiResult: ExtractedTransaction,
  correctedResult: ExtractedTransaction
) {
  const correction: SavedExtractionCorrection = {
    id: `COR-${Date.now().toString().slice(-6)}`,
    sourceFileName,
    aiResult,
    correctedResult,
    createdAt: new Date().toISOString(),
  };
  const stored = window.localStorage.getItem(EXTRACTION_CORRECTIONS_STORAGE_KEY);
  const existing = stored ? (JSON.parse(stored) as SavedExtractionCorrection[]) : [];
  window.localStorage.setItem(
    EXTRACTION_CORRECTIONS_STORAGE_KEY,
    JSON.stringify([correction, ...existing])
  );
  return correction;
}

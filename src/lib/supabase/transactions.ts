import type { ExtractedTransaction } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

export async function uploadReceipt(
  userId: string,
  transactionId: string,
  file: File
) {
  const supabase = createClient();
  const path = `${userId}/${transactionId}.jpg`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, {
    cacheControl: "3600",
    contentType: "image/jpeg",
    upsert: false,
  });

  if (error) throw error;
  return path;
}

export async function createTransactionWithItems({
  transaction,
  transactionId,
  imagePath,
  aiResult,
  sourceFileName,
  consentedForTraining = false,
}: {
  transaction: ExtractedTransaction;
  transactionId: string;
  imagePath: string | null;
  aiResult?: ExtractedTransaction | null;
  sourceFileName?: string | null;
  consentedForTraining?: boolean;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_transaction_with_items", {
    p_id: transactionId,
    p_merchant: transaction.merchant,
    p_description: transaction.description,
    p_total_amount: transaction.total_amount,
    p_date: transaction.date,
    p_transaction_type: transaction.transaction_type,
    p_image_path: imagePath,
    p_items: transaction.items,
    p_ai_result: aiResult ?? null,
    p_source_file_name: sourceFileName ?? null,
    p_consented_for_training: consentedForTraining,
  });

  if (error) throw error;
  return data as string;
}

export async function readOwnTransactions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, transaction_items(*)")
    .order("date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function consumeAiRequest(dailyLimit = 20) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("consume_ai_request", {
    p_daily_limit: dailyLimit,
  });

  if (error) throw error;
  return Boolean(data);
}

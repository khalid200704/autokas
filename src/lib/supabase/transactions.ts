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

export async function readOwnTransaction(transactionId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, transaction_items(*)")
    .eq("id", transactionId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateOwnTransaction(
  transactionId: string,
  transaction: ExtractedTransaction
) {
  const supabase = createClient();
  const { error: headerError } = await supabase
    .from("transactions")
    .update({
      merchant: transaction.merchant,
      description: transaction.description,
      total_amount: transaction.total_amount,
      date: transaction.date,
      transaction_type: transaction.transaction_type,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId);
  if (headerError) throw headerError;

  const { error: deleteError } = await supabase
    .from("transaction_items")
    .delete()
    .eq("transaction_id", transactionId);
  if (deleteError) throw deleteError;

  const { error: itemError } = await supabase.from("transaction_items").insert(
    transaction.items.map((item) => ({
      transaction_id: transactionId,
      item_name: item.item_name,
      price: item.price,
      qty: item.qty,
      category: item.category,
    }))
  );
  if (itemError) throw itemError;
}

export async function deleteOwnTransaction(transactionId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId);
  if (error) throw error;
}

export async function consumeAiRequest(dailyLimit = 20) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("consume_ai_request", {
    p_daily_limit: dailyLimit,
  });

  if (error) throw error;
  return Boolean(data);
}

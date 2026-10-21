"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TransactionDetailPage } from "@/components/transaction-detail-page";

function TransactionQueryRoute() {
  const id = useSearchParams().get("id");
  if (!id) {
    return (
      <main className="p-6 text-center text-sm text-[var(--muted)]">
        Transaksi tidak ditemukan. Kembali ke{" "}
        <a className="font-semibold text-[var(--mint-dark)]" href="/dashboard">
          dashboard
        </a>
        .
      </main>
    );
  }
  return <TransactionDetailPage transactionId={id} />;
}

export default function TransactionPage() {
  return (
    <Suspense fallback={<main className="p-6 text-center">Memuat transaksi…</main>}>
      <TransactionQueryRoute />
    </Suspense>
  );
}

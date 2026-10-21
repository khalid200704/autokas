"use client";

import { useParams } from "next/navigation";
import { TransactionDetailPage } from "@/components/transaction-detail-page";

export default function TransactionRoutePage() {
  const { id } = useParams<{ id: string }>();
  return <TransactionDetailPage transactionId={id} />;
}

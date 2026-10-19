"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  EXPENSE_CATEGORIES,
  categoryExpenseTotals,
  summarizeTransactions,
  thisMonthTransactions,
} from "@/lib/finance";
import {
  emptyFinancePlan,
  readFinancePlan,
  saveFinancePlan,
  type FinancePlan,
} from "@/lib/finance-plan";
import { formatCurrency, type ItemCategory } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { readOwnTransactions } from "@/lib/supabase/transactions";
import type { SavedTransaction } from "@/lib/transaction-storage";

function numberInput(value: number) {
  return value ? String(value) : "";
}

export default function PlanPage() {
  const [plan, setPlan] = useState<FinancePlan>(emptyFinancePlan);
  const [saved, setSaved] = useState(false);
  const [transactions, setTransactions] = useState<SavedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlan(readFinancePlan()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (active) setTransactions([]);
          return;
        }
        const remote = await readOwnTransactions();
        if (!active) return;
        setTransactions(
          remote.map((transaction) => ({
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
          }))
        );
      } catch {
        if (active) setTransactions([]);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const monthActuals = useMemo(() => {
    const monthRows = thisMonthTransactions(transactions);
    const totals = summarizeTransactions(monthRows);
    const byCategory = new Map(categoryExpenseTotals(monthRows).map((row) => [row.name, row.value]));
    return { ...totals, byCategory };
  }, [transactions]);

  const remainingBudget = plan.monthlyExpenseBudget - monthActuals.expense;
  const remainingSavings = monthActuals.balance - plan.savingsTarget;
  const incomeProgress = plan.monthlyIncomeTarget
    ? Math.min((monthActuals.income / plan.monthlyIncomeTarget) * 100, 100)
    : 0;
  const expenseProgress = plan.monthlyExpenseBudget
    ? Math.min((monthActuals.expense / plan.monthlyExpenseBudget) * 100, 100)
    : 0;

  const updateNumber = (field: "monthlyIncomeTarget" | "monthlyExpenseBudget" | "savingsTarget", value: string) => {
    setSaved(false);
    setPlan((current) => ({ ...current, [field]: Number(value) || 0 }));
  };

  const updateCategoryBudget = (category: ItemCategory, value: string) => {
    setSaved(false);
    setPlan((current) => ({
      ...current,
      categoryBudgets: { ...current.categoryBudgets, [category]: Number(value) || 0 },
    }));
  };

  const handleSave = () => {
    const next = saveFinancePlan({
      monthlyIncomeTarget: plan.monthlyIncomeTarget,
      monthlyExpenseBudget: plan.monthlyExpenseBudget,
      savingsTarget: plan.savingsTarget,
      categoryBudgets: plan.categoryBudgets,
    });
    setPlan(next);
    setSaved(true);
  };

  return (
    <AppShell
      title="Perencanaan keuangan"
      description="Tetapkan target pemasukan, plafon belanja, dan tabungan bulan ini, lalu bandingkan dengan catatan nyata."
      backHref="/dashboard"
      backLabel="Ringkasan"
    >
      <div className="space-y-5 sm:space-y-6">
        <section aria-label="Ringkasan anggaran bulan ini" className="grid gap-3 md:grid-cols-3 md:gap-4">
          <article className="app-panel p-5">
            <p className="text-sm font-medium text-[var(--muted)]">Pemasukan bulan ini</p>
            <p className="mt-2 text-2xl font-bold">{isLoading ? "…" : formatCurrency(monthActuals.income)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">dari target {formatCurrency(plan.monthlyIncomeTarget)}</p>
            <div className="mt-3 h-2 rounded-full bg-[var(--surface-soft)]">
              <div className="h-2 rounded-full bg-[var(--mint)]" style={{ width: `${incomeProgress}%` }} />
            </div>
          </article>
          <article className="app-panel p-5">
            <p className="text-sm font-medium text-[var(--muted)]">Pengeluaran bulan ini</p>
            <p className="mt-2 text-2xl font-bold">{isLoading ? "…" : formatCurrency(monthActuals.expense)}</p>
            <p className={`mt-1 text-xs ${remainingBudget < 0 ? "text-[var(--coral)]" : "text-[var(--muted)]"}`}>
              {remainingBudget < 0 ? "Melebihi anggaran " : "Sisa anggaran "}
              {formatCurrency(Math.abs(remainingBudget))}
            </p>
            <div className="mt-3 h-2 rounded-full bg-[var(--surface-soft)]">
              <div
                className={`h-2 rounded-full ${remainingBudget < 0 ? "bg-[var(--coral)]" : "bg-[var(--amber)]"}`}
                style={{ width: `${expenseProgress}%` }}
              />
            </div>
          </article>
          <article className="app-panel p-5">
            <p className="text-sm font-medium text-[var(--muted)]">Saldo bersih</p>
            <p className="mt-2 text-2xl font-bold">{isLoading ? "…" : formatCurrency(monthActuals.balance)}</p>
            <p className={`mt-1 text-xs ${remainingSavings < 0 ? "text-[var(--coral)]" : "text-[var(--mint-dark)]"}`}>
              {remainingSavings < 0 ? "Kurang dari target tabungan " : "Di atas target tabungan "}
              {formatCurrency(Math.abs(remainingSavings))}
            </p>
          </article>
        </section>

        <section className="app-panel p-4 sm:p-6">
          <h2 className="text-xl font-semibold">Target bulan berjalan</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">Masukkan target bulanan Anda dalam rupiah. Target ini dibandingkan dengan transaksi yang sudah dicatat.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
            <label className="text-sm font-medium">
              Target pemasukan (Rp)
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Contoh: 5000000"
                value={numberInput(plan.monthlyIncomeTarget)}
                onChange={(event) => updateNumber("monthlyIncomeTarget", event.target.value)}
                className="app-input mt-1 min-h-11 w-full px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-sm font-medium">
              Batas pengeluaran (Rp)
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Contoh: 3000000"
                value={numberInput(plan.monthlyExpenseBudget)}
                onChange={(event) => updateNumber("monthlyExpenseBudget", event.target.value)}
                className="app-input mt-1 min-h-11 w-full px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-sm font-medium">
              Target tabungan (Rp)
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Contoh: 500000"
                value={numberInput(plan.savingsTarget)}
                onChange={(event) => updateNumber("savingsTarget", event.target.value)}
                className="app-input mt-1 min-h-11 w-full px-3 py-2.5 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="app-panel p-4 sm:p-6">
          <details>
            <summary className="list-none text-sm font-bold text-[var(--ink)]">
              Anggaran per kategori <span className="font-normal text-[var(--muted)]">· opsional</span>
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Atur batas khusus untuk jenis pengeluaran tertentu.</span>
            </summary>
            <div className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
            {EXPENSE_CATEGORIES.map((category) => {
              const spent = monthActuals.byCategory.get(category) ?? 0;
              const budget = plan.categoryBudgets[category] ?? 0;
              const over = budget > 0 && spent > budget;
              const categoryProgress = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
              return (
                <div key={category} className="rounded-xl border border-[var(--line)] bg-white p-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-semibold" htmlFor={`budget-${category}`}>
                      {category}
                    </label>
                    <span className={`text-xs ${over ? "font-semibold text-[var(--coral)]" : "text-[var(--muted)]"}`}>
                      {formatCurrency(spent)} terpakai{budget > 0 ? ` dari ${formatCurrency(budget)}` : ""}
                    </span>
                  </div>
                  <input
                    id={`budget-${category}`}
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="Batas per bulan (Rp)"
                    value={numberInput(plan.categoryBudgets[category] ?? 0)}
                    onChange={(event) => updateCategoryBudget(category, event.target.value)}
                    className="app-input mt-2 min-h-11 w-full px-3 py-2 text-sm"
                  />
                  {budget > 0 && (
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${Math.round(categoryProgress)} persen anggaran terpakai`}>
                      <div className={`h-full rounded-full ${over ? "bg-[var(--coral)]" : "bg-[var(--mint)]"}`} style={{ width: `${categoryProgress}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </details>
          <button type="button" onClick={handleSave} className="app-button-primary mt-5 inline-flex min-h-11 w-full items-center justify-center px-5 py-2.5 text-sm font-semibold sm:w-auto">
            Simpan semua target
          </button>
          {saved && <p role="status" className="mt-3 text-sm text-[var(--mint-dark)]">Target dan anggaran tersimpan di perangkat ini.</p>}
        </section>
      </div>
    </AppShell>
  );
}

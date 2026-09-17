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
    setPlan(readFinancePlan());
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
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <article className="app-panel p-5">
            <p className="text-sm text-[var(--muted)]">Pemasukan vs target</p>
            <p className="mt-2 text-2xl font-bold">{isLoading ? "…" : formatCurrency(monthActuals.income)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Target {formatCurrency(plan.monthlyIncomeTarget)}</p>
            <div className="mt-3 h-2 rounded-full bg-[var(--surface-soft)]">
              <div className="h-2 rounded-full bg-[var(--mint)]" style={{ width: `${incomeProgress}%` }} />
            </div>
          </article>
          <article className="app-panel p-5">
            <p className="text-sm text-[var(--muted)]">Belanja vs plafon</p>
            <p className="mt-2 text-2xl font-bold">{isLoading ? "…" : formatCurrency(monthActuals.expense)}</p>
            <p className={`mt-1 text-xs ${remainingBudget < 0 ? "text-[var(--coral)]" : "text-[var(--muted)]"}`}>
              {remainingBudget < 0 ? "Lewat plafon " : "Sisa "}
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
            <p className="text-sm text-[var(--muted)]">Saldo vs tabungan</p>
            <p className="mt-2 text-2xl font-bold">{isLoading ? "…" : formatCurrency(monthActuals.balance)}</p>
            <p className={`mt-1 text-xs ${remainingSavings < 0 ? "text-[var(--coral)]" : "text-[var(--mint-dark)]"}`}>
              Target {formatCurrency(plan.savingsTarget)}
            </p>
          </article>
        </section>

        <section className="app-panel p-6">
          <h2 className="text-xl font-semibold">Target bulan berjalan</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Angka disimpan di perangkat ini dan dipakai di ringkasan kas.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Target pemasukan
              <input
                type="number"
                min={0}
                value={numberInput(plan.monthlyIncomeTarget)}
                onChange={(event) => updateNumber("monthlyIncomeTarget", event.target.value)}
                className="app-input mt-1 w-full px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-sm font-medium">
              Plafon pengeluaran
              <input
                type="number"
                min={0}
                value={numberInput(plan.monthlyExpenseBudget)}
                onChange={(event) => updateNumber("monthlyExpenseBudget", event.target.value)}
                className="app-input mt-1 w-full px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-sm font-medium">
              Target tabungan
              <input
                type="number"
                min={0}
                value={numberInput(plan.savingsTarget)}
                onChange={(event) => updateNumber("savingsTarget", event.target.value)}
                className="app-input mt-1 w-full px-3 py-2.5 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="app-panel p-6">
          <h2 className="text-xl font-semibold">Anggaran per kategori</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Kosongkan jika kategori itu tidak perlu plafon sendiri.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {EXPENSE_CATEGORIES.map((category) => {
              const spent = monthActuals.byCategory.get(category) ?? 0;
              const budget = plan.categoryBudgets[category] ?? 0;
              const over = budget > 0 && spent > budget;
              return (
                <div key={category} className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium" htmlFor={`budget-${category}`}>
                      {category}
                    </label>
                    <span className={`text-xs ${over ? "text-[var(--coral)]" : "text-[var(--muted)]"}`}>
                      Terpakai {formatCurrency(spent)}
                    </span>
                  </div>
                  <input
                    id={`budget-${category}`}
                    type="number"
                    min={0}
                    value={numberInput(plan.categoryBudgets[category] ?? 0)}
                    onChange={(event) => updateCategoryBudget(category, event.target.value)}
                    className="app-input mt-2 w-full px-3 py-2 text-sm"
                  />
                </div>
              );
            })}
          </div>
          <button type="button" onClick={handleSave} className="app-button-primary mt-6 inline-flex px-5 py-2.5 text-sm font-semibold">
            Simpan rencana
          </button>
          {saved && <p className="mt-3 text-sm text-[var(--mint-dark)]">Rencana tersimpan di perangkat ini.</p>}
        </section>
      </div>
    </AppShell>
  );
}

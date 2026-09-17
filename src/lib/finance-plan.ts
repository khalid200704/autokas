import { EXPENSE_CATEGORIES, type ItemCategory } from "@/lib/finance";

export const FINANCE_PLAN_STORAGE_KEY = "autokas.finance-plan";

export type FinancePlan = {
  monthlyIncomeTarget: number;
  monthlyExpenseBudget: number;
  savingsTarget: number;
  categoryBudgets: Partial<Record<ItemCategory, number>>;
  updatedAt: string;
};

export const emptyFinancePlan: FinancePlan = {
  monthlyIncomeTarget: 0,
  monthlyExpenseBudget: 0,
  savingsTarget: 0,
  categoryBudgets: {},
  updatedAt: "",
};

export function readFinancePlan(): FinancePlan {
  if (typeof window === "undefined") return emptyFinancePlan;
  try {
    const stored = window.localStorage.getItem(FINANCE_PLAN_STORAGE_KEY);
    if (!stored) return emptyFinancePlan;
    return { ...emptyFinancePlan, ...(JSON.parse(stored) as FinancePlan) };
  } catch {
    return emptyFinancePlan;
  }
}

export function saveFinancePlan(plan: Omit<FinancePlan, "updatedAt">) {
  const next: FinancePlan = {
    ...plan,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(FINANCE_PLAN_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function categoryBudgetEntries(plan: FinancePlan) {
  return EXPENSE_CATEGORIES.map((category) => ({
    category,
    budget: plan.categoryBudgets[category] ?? 0,
  }));
}

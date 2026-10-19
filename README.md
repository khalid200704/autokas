# AutoKas

AutoKas is a mobile-first Indonesian personal finance app for recording income and expenses, scanning receipts with AI, reviewing cashflow, setting budgets, and sharing opt-in activities with a small circle.

## Core features

- Scan receipts and review AI-extracted transaction details before saving.
- View and filter cashflow, transactions, and spending categories.
- Set monthly income, expense, savings, and category budgets.
- Create a Sirkel Kas or join one with an invitation code. Transaction details stay private unless a user explicitly selects a transaction to share.
- Create circle challenges, check in once per day, and compare challenge progress rather than personal wealth.
- Split a transaction between manually named participants by assigning receipt items or dividing the total equally. Apportioned receipt charges and remaining amounts are included in the saved breakdown, which can be shared through WhatsApp.

## Local development

```bash
npm install
npm run dev
```

Copy the required environment values into `.env.local`. The AI extraction route requires `GEMINI_API_KEY`; Supabase-backed features require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Supabase migrations

Apply the SQL files under `supabase/migrations` to the project's Supabase database in order. In particular, run `003_circles_challenges_split_bills.sql` before opening Sirkel Kas or the split-bill panel. That migration creates circle, activity, challenge, and split tables, their row-level security policies, and the RPC functions used to create/join circles and record daily challenge check-ins.

Circle activities are visible only to members of the selected circle. Only data explicitly selected on the share form is copied into the circle feed. Split-bill data is visible only to the owner of the original transaction.

## Validation

```bash
npm run lint
npm run build
```

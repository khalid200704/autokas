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

Copy the required environment values into `.env.local`. Supabase-backed features require `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; receipt extraction also requires `GEMINI_API_KEY` on the server.

## Supabase setup

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Wait until the project is ready.
2. In the project dashboard, open **Project Settings → API** (or **Connect**) and copy the **Project URL** and the public **anon/publishable key**. Put them in the root `.env.local` file:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
   ```

   Do not use a `service_role` or secret key here. Never add those keys to `NEXT_PUBLIC_*` variables or the Android app.
3. Open **SQL Editor → New query**. Open each migration file in `supabase/migrations`, paste its contents into a query, and run them in this order: `001_autokas_core.sql`, `002_secure_ai_usage.sql`, then `003_circles_challenges_split_bills.sql`.
4. Configure Google sign-in using the [OAuth setup](#google-and-supabase-oauth-setup) below. Google sign-in must be enabled in Supabase before users can log in.
5. Restart the local Next.js server after editing `.env.local`, then sign in and test. For production, add the same two public Supabase values in **Vercel → Project → Settings → Environment Variables**, then redeploy.
6. To enable receipt scanning, also set `GEMINI_API_KEY` as a server-only Vercel environment variable. It is not a Supabase key and must never be bundled into the Android app.

## Android application

The Android app ships a **bundled static frontend** from `out/`; it does not load the production website in a remote WebView. Android builds require JDK 21 and an Android SDK. Configure the public Supabase URL and anon/publishable key in `.env.local` before creating a mobile bundle:

```bash
npm run build:mobile
npm run sync:android
cd android
.\gradlew.bat assembleDebug
```

`build:mobile` makes an isolated temporary copy of the app, excludes the Next.js middleware and server-only route handlers from that copy, and exports the existing client-side product pages. The website source and its server build stay intact. The app uses a query-based transaction detail route for static compatibility, while the normal web route remains available. Never place the Supabase service-role key or Gemini key in a `NEXT_PUBLIC_*` variable or Android assets. The Gemini key belongs only in the Vercel server environment; mobile scan requests send the signed-in user's Supabase access token to the deployed `/api/extract` route, which verifies the user before applying the existing daily quota.

### Google and Supabase OAuth setup

The Android login opens Supabase-hosted Google OAuth in the system browser and returns to `com.autokas.app://auth/callback` using the PKCE authorization-code flow. Configure all of the following before exercising sign-in:

1. In **Supabase → Authentication → URL Configuration**, keep the production Site URL as `https://autokas-ohuv.vercel.app` and add these exact allowed redirect URLs:
   - `https://autokas-ohuv.vercel.app/auth/callback` (web)
   - `com.autokas.app://auth/callback` (Android)
   - `http://localhost:3000/auth/callback` (local web development, optional)
2. In **Supabase → Authentication → Providers → Google**, enable Google and configure the OAuth web client ID and secret.
3. In Google Cloud Console, add the Supabase callback URI shown by the Supabase Google provider settings—typically `https://<PROJECT_REF>.supabase.co/auth/v1/callback`—to the Google OAuth client's **Authorized redirect URIs**. Add `https://autokas-ohuv.vercel.app` as an authorized JavaScript origin; add `http://localhost:3000` only for local web testing. Google redirects to Supabase, not directly to the Android package.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the mobile build, and set `GEMINI_API_KEY` as a server-only Vercel environment variable. Deploy the updated `/api/extract` route to Vercel so its Bearer-token verification and CORS support are live.
5. Apply `001_autokas_core.sql`, `002_secure_ai_usage.sql` (defines `consume_ai_request`), and `003_circles_challenges_split_bills.sql` in order.

The Android manifest registers the custom-scheme callback, and the runtime exchanges its one-time PKCE code in the bundled Supabase client. OAuth is **not considered verified** until the Google/Supabase project settings are configured and an end-to-end sign-in is exercised on an Android device. Receipt scanning likewise requires the deployed Gemini-backed route and a configured server key. Receipt capture uses the native camera plugin and the Android file picker for gallery images; split details use the Android share sheet. The UI includes Android back handling and safe-area-aware bottom navigation.

## Supabase migrations

Apply the SQL files under `supabase/migrations` to the project's Supabase database in order. In particular, run `003_circles_challenges_split_bills.sql` before opening Sirkel Kas or the split-bill panel. That migration creates circle, activity, challenge, and split tables, their row-level security policies, and the RPC functions used to create/join circles and record daily challenge check-ins.

Circle activities are visible only to members of the selected circle. Only data explicitly selected on the share form is copied into the circle feed. Split-bill data is visible only to the owner of the original transaction.

## Validation

```bash
npm run lint
npm run build
```

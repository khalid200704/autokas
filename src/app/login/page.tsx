import Link from "next/link";
import { headers } from "next/headers";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto") || "https";
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const isLocal = process.env.NODE_ENV !== "production";
  const siteUrl = isLocal
    ? configuredSiteUrl || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : "http://localhost:3000")
    : "https://autokas-ohuv.vercel.app";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const googleLoginUrl = supabaseUrl
    ? `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${siteUrl}/auth/callback`)}`
    : "/auth/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-emerald-950/20">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 font-bold text-slate-950">
            A
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">AutoKas</p>
            <h1 className="text-2xl font-bold">Masuk</h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-slate-300">
          Masuk dengan Google untuk mengakses dashboard finansial Anda.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {decodeURIComponent(error)}
          </div>
        )}

        <a
          href={googleLoginUrl}
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 active:scale-[0.99]"
        >
          Masuk dengan Google
        </a>

        <div className="mt-6 text-center text-sm text-slate-400">
          <Link href="/" className="text-emerald-300 hover:text-emerald-200">
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}

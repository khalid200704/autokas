"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
      setLoading(false);
    }
  };

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
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center rounded-full bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Memproses..." : "Masuk dengan Google"}
        </button>

        <div className="mt-6 text-center text-sm text-slate-400">
          <Link href="/" className="text-emerald-300 hover:text-emerald-200">
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}

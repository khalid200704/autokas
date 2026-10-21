"use client";

import { Suspense } from "react";
import { LoginPanel } from "@/components/login-panel";
import { hasSupabaseConfig } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10 text-[var(--ink)]">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--line)] bg-white p-7 shadow-[0_20px_60px_rgba(23,51,47,0.08)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--ink)] text-lg font-bold text-white">
            A
          </div>
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-[var(--mint-dark)]">AutoKas</p>
            <h1 className="text-2xl font-bold">Masuk</h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-6 text-[var(--muted)]">
          {hasSupabaseConfig()
            ? "Masuk dengan Google untuk menyimpan data ke akun Anda."
            : "Hubungkan proyek Supabase untuk masuk dan menyimpan data ke akun Anda."}
        </p>

        <Suspense fallback={<div className="min-h-12 animate-pulse rounded-full bg-[var(--surface-soft)]" />}>
          <LoginPanel />
        </Suspense>

      </div>
    </main>
  );
}

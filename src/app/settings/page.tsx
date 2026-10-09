"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError(null);
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Anda belum berhasil keluar. Coba lagi.");
      setIsSigningOut(false);
    }
  };

  return (
    <AppShell
      title="Pengaturan"
      description="Kelola preferensi pencatatan dan akun AutoKas Anda."
    >
      <section className="mx-auto max-w-2xl rounded-[26px] border border-[var(--line)] bg-white p-6 shadow-[0_20px_60px_rgba(23,51,47,0.06)] sm:p-8">
        <div className="rounded-[20px] bg-[var(--surface-soft)] p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--mint-dark)]">
            Preferensi keuangan
          </p>
          <h2 className="mt-3 text-2xl font-bold">Atur target sesuai kebutuhan Anda</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Target pemasukan, plafon pengeluaran, dan tabungan dapat Anda kelola di halaman Rencana.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-[var(--coral)]/30 bg-[#fff0ed] px-4 py-3 text-sm text-[var(--coral)]">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/plan"
            className="app-button-primary inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold"
          >
            Kelola rencana keuangan
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
          >
            {isSigningOut ? "Keluar..." : "Keluar dari akun"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}
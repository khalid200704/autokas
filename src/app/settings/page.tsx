"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await createClient().auth.signOut();
    window.location.assign("/");
  };

  return (
    <AppShell
      title="Pengaturan"
      description="Kelola preferensi pencatatan dan akun AutoKas Anda."
    >
      <section className="app-panel p-6">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mint-dark)]">
            Tahap berikutnya
          </p>
          <h2 className="mt-3 text-2xl font-bold">Pengaturan akun segera hadir</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Preferensi kategori, zona waktu, login, dan penghapusan data akan tersedia
            setelah penyimpanan akun tersambung ke Supabase.
          </p>
          <Link
            href="/dashboard"
            className="app-button-primary mt-6 inline-flex px-4 py-2.5 text-sm font-semibold"
          >
            Kembali ke ringkasan
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="mt-3 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50"
          >
            {isSigningOut ? "Keluar..." : "Keluar dari akun"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}
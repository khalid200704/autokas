"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      });
    }
    router.push("/dashboard");
  };

  return (
    <AppShell
      title="Siapkan AutoKas"
      description="Pilih cara utama Anda memakai AutoKas. Preferensi ini bisa diubah nanti."
      backHref="/"
      backLabel="Beranda"
    >
      <section className="mx-auto max-w-2xl rounded-[26px] border border-[var(--line)] bg-white p-6 shadow-[0_20px_60px_rgba(23,51,47,0.06)] sm:p-8">
        <div className="rounded-[20px] bg-[var(--surface-soft)] p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--mint-dark)]">Konfigurasi awal</p>
          <p className="mt-3 text-2xl font-bold">Semua siap untuk mulai.</p>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            AutoKas akan membantu Anda mencatat pemasukan dan pengeluaran. Anda bisa langsung mulai dari dashboard dan mengubah semua detail transaksi kapan saja.
          </p>
        </div>

        <div className="mt-6 space-y-3 text-sm text-[var(--muted)]">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--mint)]" />
            Foto struk dengan AI review sebelum simpan
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--mint)]" />
            Ringkasan pengeluaran dan arus kas yang jelas
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--mint)]" />
            Target keuangan harian dan bulanan dalam satu tempat
          </div>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="app-button-primary mt-7 inline-flex px-5 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Lanjut ke dashboard"}
        </button>
      </section>
    </AppShell>
  );
}
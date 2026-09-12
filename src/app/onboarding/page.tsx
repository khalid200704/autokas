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
      <section className="app-panel max-w-2xl p-6 sm:p-8">
        <div className="rounded-2xl bg-[var(--surface-soft)] p-5">
          <p className="text-lg font-semibold">Semua siap untuk mulai.</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            AutoKas akan membantu Anda mencatat pemasukan dan pengeluaran. Anda bisa langsung mulai dari dashboard dan mengubah semua detail transaksi kapan saja.
          </p>
        </div>
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="app-button-primary mt-7 px-5 py-3 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Lanjut ke dashboard"}
        </button>
      </section>
    </AppShell>
  );
}
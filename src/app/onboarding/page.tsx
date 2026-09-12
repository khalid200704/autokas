"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("PERSONAL_FINANCE");
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        onboarding_goal: goal,
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
        <fieldset>
          <legend className="text-lg font-semibold">Apa yang ingin Anda catat?</legend>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["PERSONAL_FINANCE", "Keuangan pribadi", "Pantau pengeluaran harian dan saldo."],
              ["FREELANCER", "Pekerjaan freelance", "Pisahkan pemasukan proyek dan biaya kerja."],
            ].map(([value, label, description]) => (
              <label
                key={value}
                className={`cursor-pointer rounded-xl border p-4 transition ${
                  goal === value
                    ? "border-[var(--mint)] bg-[var(--surface-soft)]"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="goal"
                  value={value}
                  checked={goal === value}
                  onChange={(event) => setGoal(event.target.value)}
                  className="sr-only"
                />
                <span className="block font-semibold">{label}</span>
                <span className="mt-1 block text-sm text-[var(--muted)]">{description}</span>
              </label>
            ))}
          </div>
        </fieldset>
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
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { formatCurrency, type ItemCategory } from "@/lib/mock-data";
import { jakartaToday, shiftJakartaDate } from "@/lib/finance";
import { createClient } from "@/lib/supabase/client";
import { readOwnTransactions } from "@/lib/supabase/transactions";

type Circle = {
  id: string;
  name: string;
  invite_code: string;
  role: "OWNER" | "MEMBER";
};

type Activity = {
  id: string;
  circle_id: string;
  user_id: string;
  author_name: string;
  message: string;
  merchant: string | null;
  category: ItemCategory | null;
  amount: number | string | null;
  created_at: string;
  kudos: number;
  reacted: boolean;
};

type Challenge = {
  id: string;
  title: string;
  description: string;
  target_count: number;
  starts_on: string;
  ends_on: string;
  created_by: string;
  progress: { user_id: string; display_name: string; check_ins: number; last_check_in: string | null }[];
};

type TransactionOption = {
  id: string;
  merchant: string;
  date: string;
  total_amount: number;
  transaction_type: "PENGELUARAN" | "PENDAPATAN";
  items: { category: ItemCategory }[];
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function CirclePage() {
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("Anggota");
  const [circles, setCircles] = useState<Circle[]>([]);
  const [activeCircleId, setActiveCircleId] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [transactions, setTransactions] = useState<TransactionOption[]>([]);
  const [newCircleName, setNewCircleName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [shareTransactionId, setShareTransactionId] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDescription, setChallengeDescription] = useState("");
  const [challengeTarget, setChallengeTarget] = useState("5");
  const [challengeDays, setChallengeDays] = useState("7");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadCircles = useCallback(async (preferredId?: string) => {
    const { data, error: queryError } = await supabase
      .from("circle_members")
      .select("circle_id, role, circles(id, name, invite_code)")
      .order("joined_at", { ascending: false });
    if (queryError) throw queryError;
    const nextCircles = (data ?? []).flatMap((membership) => {
      const circle = Array.isArray(membership.circles) ? membership.circles[0] : membership.circles;
      if (!circle) return [];
      return [{
        id: circle.id,
        name: circle.name,
        invite_code: circle.invite_code,
        role: membership.role,
      } as Circle];
    });
    setCircles(nextCircles);
    setActiveCircleId((current) => {
      if (preferredId && nextCircles.some((circle) => circle.id === preferredId)) return preferredId;
      if (current && nextCircles.some((circle) => circle.id === current)) return current;
      return nextCircles[0]?.id ?? "";
    });
  }, [supabase]);

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      setIsLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError?.message === "Auth session missing!") {
          if (active) setError(null);
          return;
        }

        if (authError) throw authError;
        if (!authData.user) {
          if (active) setError(null);
          return;
        }
        if (!active) return;
        setUserId(authData.user.id);
        setDisplayName(
          authData.user.user_metadata?.full_name ||
          authData.user.user_metadata?.name ||
          authData.user.email?.split("@")[0] ||
          "Anggota"
        );
        const [transactionRows] = await Promise.all([
          readOwnTransactions(),
          loadCircles(),
        ]);
        if (!active) return;
        setTransactions(transactionRows.map((row) => ({
          id: row.id,
          merchant: row.merchant,
          date: row.date,
          total_amount: Number(row.total_amount),
          transaction_type: row.transaction_type,
          items: (row.transaction_items ?? []).map((item: { category: ItemCategory }) => ({ category: item.category })),
        })));
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError, "Data Sirkel Kas gagal dimuat."));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadInitialData();
    return () => {
      active = false;
    };
  }, [loadCircles, supabase]);

  const loadCircleContent = useCallback(async (circleId: string) => {
    const [activityResult, challengeResult] = await Promise.all([
      supabase.from("circle_activities").select("*").eq("circle_id", circleId).order("created_at", { ascending: false }).limit(50),
      supabase.from("circle_challenges").select("*").eq("circle_id", circleId).order("ends_on", { ascending: true }),
    ]);
    if (activityResult.error) throw activityResult.error;
    if (challengeResult.error) throw challengeResult.error;

    const activityRows = activityResult.data ?? [];
    const challengeRows = challengeResult.data ?? [];
    const activityIds = activityRows.map((activity) => activity.id);
    const challengeIds = challengeRows.map((challenge) => challenge.id);
    const [reactionResult, progressResult] = await Promise.all([
      activityIds.length
        ? supabase.from("circle_reactions").select("activity_id,user_id").in("activity_id", activityIds)
        : Promise.resolve({ data: [], error: null }),
      challengeIds.length
        ? supabase.from("circle_challenge_progress").select("challenge_id,user_id,display_name,check_ins,last_check_in").in("challenge_id", challengeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (reactionResult.error) throw reactionResult.error;
    if (progressResult.error) throw progressResult.error;

    const reactions = reactionResult.data ?? [];
    const progress = progressResult.data ?? [];
    const nextActivities = activityRows.map((activity) => ({
      ...activity,
      kudos: reactions.filter((reaction) => reaction.activity_id === activity.id).length,
      reacted: reactions.some((reaction) => reaction.activity_id === activity.id && reaction.user_id === userId),
    }));
    const nextChallenges = challengeRows.map((challenge) => ({
      ...challenge,
      progress: progress
        .filter((entry) => entry.challenge_id === challenge.id)
        .sort((first, second) => second.check_ins - first.check_ins)
        .map(({ user_id, display_name, check_ins, last_check_in }) => ({ user_id, display_name, check_ins, last_check_in })),
    }));
    return { activities: nextActivities, challenges: nextChallenges };
  }, [supabase, userId]);

  const refreshCircleContent = useCallback(async (circleId: string) => {
    const content = await loadCircleContent(circleId);
    setActivities(content.activities);
    setChallenges(content.challenges);
  }, [loadCircleContent]);

  useEffect(() => {
    if (!activeCircleId || !userId) return;
    let active = true;
    async function load() {
      try {
        const content = await loadCircleContent(activeCircleId);
        if (active) {
          setActivities(content.activities);
          setChallenges(content.challenges);
        }
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError, "Aktivitas sirkel gagal dimuat."));
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [activeCircleId, loadCircleContent, userId]);

  const activeCircle = circles.find((circle) => circle.id === activeCircleId);
  const availableTransactions = transactions.filter((transaction) => transaction.transaction_type === "PENGELUARAN");

  const runAction = async (action: () => Promise<void>, successMessage?: string) => {
    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (actionError) {
      setError(getErrorMessage(actionError, "Permintaan gagal diproses."));
    } finally {
      setIsBusy(false);
    }
  };

  const createCircle = () => runAction(async () => {
    const { data, error: rpcError } = await supabase.rpc("create_circle", { p_name: newCircleName });
    if (rpcError) throw rpcError;
    const created = Array.isArray(data) ? data[0] : data;
    setNewCircleName("");
    await loadCircles(created?.id);
  }, "Sirkel berhasil dibuat. Bagikan kode undangan kepada teman.");

  const joinCircle = () => runAction(async () => {
    const { data, error: rpcError } = await supabase.rpc("join_circle", { p_invite_code: inviteCode });
    if (rpcError) throw rpcError;
    setInviteCode("");
    await loadCircles(data);
  }, "Anda berhasil bergabung ke sirkel.");

  const copyInviteCode = () => runAction(async () => {
    if (!activeCircle) return;
    await navigator.clipboard.writeText(activeCircle.invite_code);
  }, "Kode undangan berhasil disalin.");

  const shareActivity = () => runAction(async () => {
    if (!activeCircle || !userId || !shareMessage.trim()) throw new Error("Tulis pesan sebelum membagikan aktivitas.");
    const selectedTransaction = availableTransactions.find((transaction) => transaction.id === shareTransactionId);
    const { error: insertError } = await supabase.from("circle_activities").insert({
      circle_id: activeCircle.id,
      user_id: userId,
      author_name: displayName,
      message: shareMessage.trim(),
      merchant: selectedTransaction?.merchant ?? null,
      amount: selectedTransaction?.total_amount ?? null,
      category: selectedTransaction?.items[0]?.category ?? null,
    });
    if (insertError) throw insertError;
    setShareMessage("");
    setShareTransactionId("");
    await refreshCircleContent(activeCircle.id);
  }, "Aktivitas berhasil dibagikan.");

  const toggleReaction = (activity: Activity) => runAction(async () => {
    if (activity.reacted) {
      const { error: deleteError } = await supabase.from("circle_reactions").delete()
        .eq("activity_id", activity.id).eq("user_id", userId);
      if (deleteError) throw deleteError;
    } else {
      const { error: insertError } = await supabase.from("circle_reactions").insert({
        activity_id: activity.id,
        user_id: userId,
      });
      if (insertError) throw insertError;
    }
    await refreshCircleContent(activeCircleId);
  });

  const createChallenge = () => runAction(async () => {
    if (!activeCircle || !challengeTitle.trim()) throw new Error("Nama tantangan wajib diisi.");
    const startDate = jakartaToday();
    const { error: insertError } = await supabase.from("circle_challenges").insert({
      circle_id: activeCircle.id,
      title: challengeTitle.trim(),
      description: challengeDescription.trim(),
      target_count: Number(challengeTarget),
      starts_on: startDate,
      ends_on: shiftJakartaDate(startDate, Number(challengeDays) - 1),
      created_by: userId,
    });
    if (insertError) throw insertError;
    setChallengeTitle("");
    setChallengeDescription("");
    await refreshCircleContent(activeCircle.id);
  }, "Tantangan baru berhasil dibuat.");

  const checkIn = (challengeId: string) => runAction(async () => {
    const { error: rpcError } = await supabase.rpc("check_in_circle_challenge", {
      p_challenge_id: challengeId,
    });
    if (rpcError) throw rpcError;
    await refreshCircleContent(activeCircleId);
  }, "Progres tantangan diperbarui.");

  const formatActivityDate = (date: string) => new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

  return (
    <AppShell
      title="Sirkel Kas"
      description="Bangun kebiasaan finansial bersama teman, dengan aktivitas yang hanya dibagikan atas pilihan Anda."
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {(error || notice) && (
          <div role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {error ?? notice}
          </div>
        )}

        {!userId && !isLoading && (
          <section className="app-panel p-6">
            <h2 className="text-lg font-bold">Sirkel Kas memerlukan akun</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Masuk terlebih dahulu untuk membuat sirkel, bergabung dengan teman, dan mengikuti tantangan bersama.</p>
            <a href="/login" className="app-button-primary mt-4 inline-flex px-5 py-2.5 text-sm font-semibold">Masuk ke AutoKas</a>
          </section>
        )}

        {isLoading ? (
          <div className="app-panel h-48 animate-pulse" />
        ) : userId && (
          <>
            <details className="app-panel p-4" open={circles.length === 0}>
              <summary className="cursor-pointer list-none text-sm font-bold text-[var(--ink)] marker:hidden">
                Buat sirkel atau gabung dengan kode
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Kelola keanggotaan sirkel Anda</span>
              </summary>
              <div className="mt-4 grid gap-4 border-t border-[var(--line)] pt-4 md:grid-cols-2">
                <form
                  className="space-y-3 rounded-xl bg-slate-50 p-4"
                  onSubmit={(event) => { event.preventDefault(); void createCircle(); }}
                >
                  <div>
                    <h2 className="font-bold">Buat sirkel</h2>
                    <p className="mt-1 text-xs text-[var(--muted)]">Buat ruang kecil untuk saling menyemangati.</p>
                  </div>
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Nama sirkel
                    <input required maxLength={60} value={newCircleName} onChange={(event) => setNewCircleName(event.target.value)} className="app-input mt-1 min-h-11 w-full px-3 py-2.5 text-sm" placeholder="Contoh: Teman Hemat" />
                  </label>
                  <button disabled={isBusy} className="app-button-primary min-h-11 w-full px-4 py-2 text-sm font-semibold disabled:opacity-50">Buat sirkel baru</button>
                </form>

                <form
                  className="space-y-3 rounded-xl bg-slate-50 p-4"
                  onSubmit={(event) => { event.preventDefault(); void joinCircle(); }}
                >
                  <div>
                    <h2 className="font-bold">Gabung dengan kode</h2>
                    <p className="mt-1 text-xs text-[var(--muted)]">Minta kode undangan dari anggota sirkel.</p>
                  </div>
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Kode undangan
                    <input required maxLength={10} value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} className="app-input mt-1 min-h-11 w-full px-3 py-2.5 text-sm uppercase tracking-[0.15em]" placeholder="KODE SIRKEL" />
                  </label>
                  <button disabled={isBusy} className="min-h-11 w-full rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-50">Gabung sirkel</button>
                </form>
              </div>
            </details>

            {circles.length > 0 && (
              <>
                <section className="app-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <label className="min-w-0 flex-1 text-xs font-semibold text-[var(--muted)]">
                    Pilih sirkel
                    <select value={activeCircleId} onChange={(event) => setActiveCircleId(event.target.value)} className="app-input mt-1 w-full px-3 py-2.5 text-sm text-[var(--ink)]">
                      {circles.map((circle) => <option key={circle.id} value={circle.id}>{circle.name}</option>)}
                    </select>
                  </label>
                  {activeCircle && (
                    <button type="button" onClick={() => void copyInviteCode()} disabled={isBusy} className="min-h-11 rounded-full bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--mint-dark)] disabled:opacity-50">
                      Salin kode undangan
                    </button>
                  )}
                </section>
                {activeCircle && <p className="-mt-3 px-1 text-xs text-[var(--muted)]">Kode sirkel <span className="font-bold tracking-wider text-[var(--ink)]">{activeCircle.invite_code}</span> · ketuk tombol untuk menyalin.</p>}

                <section className="app-panel p-5">
                  <h2 className="text-lg font-bold">Bagikan aktivitas</h2>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Transaksi bersifat pribadi secara default. Hanya transaksi yang Anda pilih di sini yang akan dibagikan ke anggota sirkel.</p>
                  <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void shareActivity(); }}>
                    <input required maxLength={240} value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} className="app-input min-h-11 px-3 py-2.5 text-sm" placeholder="Contoh: Berhasil bawa bekal hari ini!" />
                    <select value={shareTransactionId} onChange={(event) => setShareTransactionId(event.target.value)} className="app-input min-h-11 px-3 py-2.5 text-sm">
                      <option value="">Jangan lampirkan transaksi</option>
                      {availableTransactions.map((transaction) => (
                        <option key={transaction.id} value={transaction.id}>{transaction.merchant} · {formatCurrency(transaction.total_amount)}</option>
                      ))}
                    </select>
                    <button disabled={isBusy} className="app-button-primary min-h-11 px-5 py-2.5 text-sm font-semibold disabled:opacity-50">Bagikan</button>
                  </form>
                </section>

                <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mint-dark)]">Aktivitas sirkel</p>
                      <h2 className="mt-1 text-xl font-bold">Kabar dan dukungan</h2>
                      <p className="mt-1 text-xs text-[var(--muted)]">Aktivitas terbaru dari anggota sirkel Anda.</p>
                    </div>
                    {activities.length === 0 ? (
                      <div className="app-panel p-6 text-sm text-[var(--muted)]">Belum ada aktivitas. Bagikan pencapaian kecil pertama Anda.</div>
                    ) : activities.map((activity) => (
                      <article key={activity.id} className="app-panel p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold">{activity.author_name}</p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">{formatActivityDate(activity.created_at)}</p>
                          </div>
                          {activity.category && <span className="shrink-0 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--mint-dark)]">{activity.category}</span>}
                        </div>
                        <p className="mt-4 text-sm leading-6">{activity.message}</p>
                        {activity.merchant && (
                          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                            <span className="text-[var(--muted)]">{activity.merchant}</span>
                            {activity.amount !== null && <span className="font-semibold">{formatCurrency(Number(activity.amount))}</span>}
                          </div>
                        )}
                        <button type="button" disabled={isBusy} onClick={() => void toggleReaction(activity)} className={`mt-4 min-h-10 rounded-full px-3.5 py-2 text-xs font-semibold ${activity.reacted ? "bg-[var(--surface-soft)] text-[var(--mint-dark)]" : "border border-[var(--line)] text-[var(--muted)]"}`}>
                          {activity.reacted ? "✓ Disemangati" : "Kirim semangat"} · {activity.kudos}
                        </button>
                      </article>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mint-dark)]">Tantangan & progres</p>
                      <h2 className="mt-1 text-xl font-bold">Kebiasaan baik, bareng-bareng</h2>
                    </div>
                    <details className="app-panel p-5">
                      <summary className="cursor-pointer list-none text-sm font-bold text-[var(--ink)] marker:hidden">
                        Buat tantangan baru
                        <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Ajak anggota membangun kebiasaan baik</span>
                      </summary>
                      <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void createChallenge(); }}>
                        <label className="block text-xs font-medium text-[var(--muted)]">
                          Nama tantangan
                          <input required maxLength={80} value={challengeTitle} onChange={(event) => setChallengeTitle(event.target.value)} className="app-input mt-1 w-full px-3 py-2.5 text-sm" placeholder="Contoh: Bawa bekal" />
                        </label>
                        <label className="block text-xs font-medium text-[var(--muted)]">
                          Aturan singkat
                          <input maxLength={240} value={challengeDescription} onChange={(event) => setChallengeDescription(event.target.value)} className="app-input mt-1 w-full px-3 py-2.5 text-sm" placeholder="Catat setiap hari berhasil" />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block text-xs font-medium text-[var(--muted)]">
                            Target check-in
                            <input type="number" min="1" max="100" required value={challengeTarget} onChange={(event) => setChallengeTarget(event.target.value)} className="app-input mt-1 w-full px-3 py-2.5 text-sm" />
                          </label>
                          <label className="block text-xs font-medium text-[var(--muted)]">
                            Durasi (hari)
                            <input type="number" min="1" max="100" required value={challengeDays} onChange={(event) => setChallengeDays(event.target.value)} className="app-input mt-1 w-full px-3 py-2.5 text-sm" />
                          </label>
                        </div>
                        <button disabled={isBusy} className="app-button-primary min-h-11 w-full px-4 py-2 text-sm font-semibold disabled:opacity-50">Buat tantangan</button>
                      </form>
                    </details>

                    {challenges.map((challenge) => {
                      const myCheckIns = challenge.progress.find((entry) => entry.user_id === userId)?.check_ins ?? 0;
                      const checkedInToday = challenge.progress.find((entry) => entry.user_id === userId)?.last_check_in === jakartaToday();
                      const isActive = jakartaToday() >= challenge.starts_on && jakartaToday() <= challenge.ends_on;
                      return (
                        <article key={challenge.id} className="app-panel p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-bold">{challenge.title}</h3>
                              {challenge.description && <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{challenge.description}</p>}
                            </div>
                            <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">{challenge.target_count} kali</span>
                          </div>
                          <p className="mt-2 text-xs text-[var(--muted)]">Sampai {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(`${challenge.ends_on}T00:00:00`))}</p>
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">Progres Anda: {myCheckIns}/{challenge.target_count}</p>
                              <p className="mt-1 text-[10px] text-[var(--muted)]">Peringkat berdasarkan check-in, bukan saldo atau kekayaan.</p>
                            </div>
                            <button type="button" disabled={isBusy || !isActive || checkedInToday || myCheckIns >= challenge.target_count} onClick={() => void checkIn(challenge.id)} className="min-h-10 shrink-0 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold disabled:opacity-40">{checkedInToday ? "Sudah check-in" : "Check-in"}</button>
                          </div>
                          <ol className="mt-4 space-y-2 border-t border-[var(--line)] pt-3">
                            {challenge.progress.slice(0, 5).map((entry, index) => (
                              <li key={entry.user_id} className="flex items-center justify-between text-xs">
                                <span className="text-[var(--muted)]">{index + 1}. {entry.display_name}</span>
                                <span className="font-semibold">{entry.check_ins}/{challenge.target_count}</span>
                              </li>
                            ))}
                            {challenge.progress.length === 0 && <li className="text-xs text-[var(--muted)]">Jadilah yang pertama check-in.</li>}
                          </ol>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

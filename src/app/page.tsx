import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, ScanLine, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function redirectIfAuthenticated() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;

  let authenticated = false;
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    authenticated = Boolean(user);
  } catch {
    // The public landing page remains available when auth is not configured yet.
  }

  if (authenticated) redirect("/dashboard");
}

export default async function Home() {
  await redirectIfAuthenticated();

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f7f2] text-[var(--ink)]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <nav className="flex items-center justify-between border-b border-[var(--line)] py-5">
          <Link href="/" className="flex items-center gap-3" aria-label="AutoKas beranda">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ink)] text-lg font-bold text-white">A</span>
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.25em] text-[var(--mint-dark)]">AutoKas</span>
              <span className="hidden text-xs text-[var(--muted)] sm:block">Catat tanpa ribet</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-white hover:text-[var(--ink)] sm:inline-flex">Masuk</Link>
            <Link href="/login" className="app-button-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">Coba AutoKas <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </nav>

        <section className="grid items-center gap-12 pb-20 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:pb-28 lg:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#b9dcca] bg-[#e8f4eb] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--mint-dark)]"><Sparkles size={14} aria-hidden="true" /> Pembukuan yang terasa ringan</p>
            <h1 className="mt-7 max-w-2xl text-5xl font-bold leading-[1.04] sm:text-6xl lg:text-7xl">Foto struknya. <span className="text-[var(--mint-dark)]">AutoKas</span> yang merapikan.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted)]">Catat pemasukan dan pengeluaran tanpa membuka spreadsheet. Foto struk, periksa hasil AI, lalu simpan transaksi Anda dengan rapi.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="app-button-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 font-semibold">Mulai gratis <ArrowRight size={18} aria-hidden="true" /></Link>
              <a href="#cara-kerja" className="inline-flex items-center justify-center rounded-full border border-[var(--line)] bg-white px-6 py-3.5 font-semibold text-[var(--ink)] transition hover:border-[var(--mint)]">Lihat cara kerja</a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--muted)]"><span className="inline-flex items-center gap-2"><Check size={16} className="text-[var(--mint)]" aria-hidden="true" /> Review sebelum simpan</span><span className="inline-flex items-center gap-2"><Check size={16} className="text-[var(--mint)]" aria-hidden="true" /> Mata uang IDR</span></div>
          </div>

          <div className="relative lg:pl-8">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#d8ebdd] blur-3xl" aria-hidden="true" />
            <div className="relative rounded-[28px] border border-[#c9ded0] bg-white p-3 shadow-2xl shadow-[#315b4930] sm:p-5">
              <div className="rounded-[20px] border border-[var(--line)] bg-[#f7faf6] p-4 sm:p-6">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--mint-dark)]">AutoKas / Scan</p><p className="mt-1 text-lg font-semibold">Periksa transaksi</p></div><span className="rounded-full bg-[#e8f4eb] px-3 py-1 text-xs font-bold text-[var(--mint-dark)]">AI selesai</span></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
                  <div className="min-h-64 rounded-xl border border-dashed border-[#9bc9ad] bg-[#e8f4eb] p-4"><div className="flex items-center gap-2 text-xs font-bold text-[var(--mint-dark)]"><ScanLine size={15} aria-hidden="true" /> FOTO STRUK</div><div className="mx-auto mt-6 max-w-36 rotate-[-3deg] bg-white p-4 shadow-lg"><div className="space-y-2 text-[8px] text-[#7e9189]"><div className="mx-auto h-2 w-16 bg-[#dce6df]" /><div className="mx-auto h-1.5 w-10 bg-[#dce6df]" /><div className="mt-5 h-px bg-[#dce6df]" /><div className="h-1.5 w-full bg-[#edf1ed]" /><div className="h-1.5 w-4/5 bg-[#edf1ed]" /><div className="h-1.5 w-full bg-[#edf1ed]" /><div className="mt-5 h-px bg-[#dce6df]" /><div className="ml-auto h-2 w-12 bg-[#b9dcca]" /></div></div><p className="mt-6 text-center text-xs text-[var(--muted)]">220 KB setelah kompresi</p></div>
                  <div className="space-y-3"><label className="block text-xs font-bold text-[var(--muted)]">MERCHANT<span className="app-input mt-1 block px-3 py-2 text-sm font-normal">Indomaret</span></label><label className="block text-xs font-bold text-[var(--muted)]">TOTAL<span className="app-input mt-1 block px-3 py-2 text-sm font-normal">Rp 125.000</span></label><label className="block text-xs font-bold text-[var(--muted)]">KETERANGAN<span className="app-input mt-1 block min-h-16 px-3 py-2 text-sm font-normal">Belanja kebutuhan rumah</span></label><div className="flex items-center gap-2 rounded-xl border border-[#b9dcca] bg-[#e8f4eb] p-3 text-xs text-[var(--mint-dark)]"><ShieldCheck size={16} aria-hidden="true" /> Anda tetap memeriksa sebelum menyimpan.</div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="cara-kerja" className="border-t border-[var(--line)] py-20"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mint-dark)]">Cara kerja</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Dari foto sampai rapi, tanpa menebak-nebak.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3"><article className="app-panel p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4eb] text-[var(--mint-dark)]"><ScanLine size={20} aria-hidden="true" /></span><h3 className="mt-5 text-xl font-bold">1. Foto</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Ambil foto struk dari kamera atau pilih dari galeri. Gambar otomatis diperkecil sebelum diproses.</p></article><article className="app-panel p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4dc] text-[var(--amber)]"><Sparkles size={20} aria-hidden="true" /></span><h3 className="mt-5 text-xl font-bold">2. Periksa</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">AI membaca merchant, tanggal, total, item, dan kategori. Anda tetap bisa mengoreksi semuanya.</p></article><article className="app-panel p-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8edf7] text-[#496b9c]"><WalletCards size={20} aria-hidden="true" /></span><h3 className="mt-5 text-xl font-bold">3. Pahami</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Lihat arus kas dan pengeluaran per kategori di dashboard yang mudah dipindai.</p></article></div></section>

        <section className="grid gap-8 border-t border-[var(--line)] py-20 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--mint-dark)]">Pencatatan kas harian</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Uang masuk tercatat, kondisi kas lebih jelas.</h2></div><div className="rounded-2xl bg-[var(--ink)] p-6 text-white"><p className="text-sm font-bold text-[#b9dcca]">Semua transaksi di satu tempat</p><p className="mt-3 max-w-xl text-lg font-semibold">Catat uang masuk dan pengeluaran dengan cara yang sederhana, lalu lihat ringkasannya kapan pun dibutuhkan.</p></div></section>

        <section className="mb-10 rounded-[24px] bg-[var(--ink)] px-6 py-12 text-center text-white sm:px-12"><h2 className="text-3xl font-bold sm:text-4xl">Mulai mencatat dengan lebih tenang.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#c2d3cb]">AutoKas dibuat untuk membantu Anda melihat kondisi uang tanpa pekerjaan administratif yang panjang.</p><Link href="/login" className="app-button-primary mt-7 inline-flex items-center gap-2 bg-[#b9dcca] px-6 py-3.5 font-semibold text-[var(--ink)] hover:bg-white">Mulai gratis <ArrowRight size={18} aria-hidden="true" /></Link></section>
      </div>
    </main>
  );
}

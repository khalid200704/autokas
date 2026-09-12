import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-bold text-slate-950">
              A
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">
                AutoKas
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-slate-700 bg-slate-900/70 px-5 py-2.5 text-sm font-medium text-slate-100 transition hover:border-emerald-400 hover:text-emerald-300"
          >
            Masuk dashboard
          </Link>
        </nav>

        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
              MVP internal
            </span>
            <h1 className="mt-6 text-5xl font-black leading-tight tracking-tight md:text-6xl">
              Foto struk, lalu langsung tercatat otomatis.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              AutoKas membantu UMKM, freelancer, dan personal finance mencatat transaksi dari foto receipt tanpa entry manual yang membosankan.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/scan"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                Mulai scan
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 px-6 py-3 font-semibold text-white transition hover:border-slate-500"
              >
                Lihat demo dashboard
              </Link>
            </div>

            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              <li>• OCR dari foto struk dengan AI Vision</li>
              <li>• Verifikasi cepat sebelum simpan</li>
              <li>• Dashboard ringkas: pendapatan, pengeluaran, saldo</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-emerald-950/30">
            <div className="rounded-2xl border border-dashed border-emerald-500/40 bg-slate-950 p-6">
              <div className="mb-6 flex items-center justify-between text-sm text-slate-300">
                <span>Preview scan</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">
                  AI ready
                </span>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6">
                <div className="mb-5 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
                  <span>Receipt</span>
                  <span>3.1MB → 220KB</span>
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-2/3 rounded-full bg-slate-700" />
                  <div className="h-3 w-1/2 rounded-full bg-slate-700" />
                  <div className="h-3 w-full rounded-full bg-slate-700" />
                  <div className="h-3 w-4/5 rounded-full bg-slate-700" />
                  <div className="h-3 w-2/3 rounded-full bg-slate-700" />
                </div>
                <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-sm">
                  <span className="text-slate-400">Teridentifikasi</span>
                  <span className="font-semibold text-emerald-300">Indomaret</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

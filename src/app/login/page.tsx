import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
          Masuk dengan Google untuk mengakses dashboard finansial Anda.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-[var(--coral)]/30 bg-[#fff0ed] px-4 py-3 text-sm text-[var(--coral)]">
            {decodeURIComponent(error)}
          </div>
        )}

        <a
          href="/auth/login"
          className="app-button-primary flex min-h-12 w-full items-center justify-center px-6 py-3 text-sm font-semibold"
        >
          Masuk dengan Google
        </a>

        <div className="mt-6 text-center text-sm text-[var(--muted)]">
          <Link href="/" className="font-medium text-[var(--mint-dark)] hover:text-[var(--ink)]">
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  );
}

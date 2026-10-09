import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, LayoutDashboard, PiggyBank, Plus, ReceiptText, Settings } from "lucide-react";

type AppShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/plan", label: "Rencana", icon: PiggyBank },
  { href: "/scan", label: "Scan struk", icon: ReceiptText },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export function AppShell({
  eyebrow = "AutoKas",
  title,
  description,
  backHref,
  backLabel = "Kembali",
  children,
}: AppShellProps) {
  return (
    <main className="app-shell min-h-screen px-4 py-5 text-[var(--ink)] sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="app-header -mx-4 -mt-5 mb-6 px-4 sm:-mt-8">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 py-4">
            <Link href="/dashboard" className="flex items-center gap-3" aria-label="Buka ringkasan AutoKas">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f2d2b] text-sm font-bold text-white shadow-sm shadow-[rgba(15,45,43,0.15)]">
                <img src="/icon.svg" alt="" className="h-6 w-6 object-contain" />
              </span>
              <span className="text-[0.72rem] font-black uppercase tracking-[0.18em] text-[var(--mint-dark)]">
                AutoKas
              </span>
            </Link>

            <nav aria-label="Navigasi utama" className="hidden items-center gap-2 md:flex">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[0.8rem] text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
                >
                  <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </nav>

            <Link
              href="/scan"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-[0.76rem] font-medium text-[var(--ink)] shadow-sm"
            >
              <Plus size={13} strokeWidth={2.2} aria-hidden="true" />
              <span className="hidden sm:inline">Catat transaksi</span>
              <span className="sm:hidden">Baru</span>
            </Link>
          </div>

          <div className="mx-auto flex max-w-5xl items-end justify-between gap-5 border-t border-[var(--line)] py-5">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--mint-dark)]">{eyebrow}</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h1>
              {description && <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">{description}</p>}
            </div>
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--mint)]"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            )}
          </div>
        </header>

        <div className="pb-20">{children}</div>

        <nav
          aria-label="Navigasi mobile"
          className="fixed inset-x-4 bottom-4 z-10 flex items-center justify-around rounded-2xl border border-[var(--line)] bg-white/95 p-2 shadow-xl shadow-[rgba(35,72,61,0.12)] backdrop-blur md:hidden"
        >
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]"
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}

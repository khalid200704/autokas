"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  House,
  List,
  PiggyBank,
  ScanLine,
  UserRound,
  UsersRound,
} from "lucide-react";

type AppShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Beranda", icon: House },
  { href: "/dashboard#transactions", label: "Transaksi", icon: List },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/plan", label: "Anggaran", icon: PiggyBank },
  { href: "/sirkel", label: "Sirkel", icon: UsersRound },
  { href: "/settings", label: "Akun", icon: UserRound },
];

export function AppShell({
  eyebrow = "AutoKas",
  title,
  description,
  backHref,
  backLabel = "Kembali",
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [selection, setSelection] = useState<{ pathname: string; href: string } | null>(null);

  const isActive = (href: string) => {
    if (selection?.pathname === pathname) return selection.href === href;
    if (href === "/dashboard#transactions") {
      return pathname === "/transactions" || pathname.startsWith("/transactions/");
    }
    return pathname === href;
  };

  return (
    <main className="app-shell min-h-screen px-3 py-3 text-[var(--ink)] sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <header className="app-header -mx-3 -mt-3 mb-5 px-3 sm:-mx-6 sm:-mt-6 sm:mb-6 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 py-3.5">
            <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5" aria-label="Buka beranda AutoKas">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d1fae5]">
                <Image src="/icon.svg" alt="" width={26} height={26} className="h-6 w-6 object-contain" />
              </span>
              <span className="text-xl font-bold tracking-tight text-[var(--ink)]">AutoKas</span>
            </Link>

            <nav aria-label="Navigasi utama" className="hidden items-center gap-1 lg:flex">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                const isScan = href === "/scan";
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSelection({ pathname, href })}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition ${
                      isScan
                        ? "bg-[var(--mint)] font-semibold text-white hover:bg-[#059669]"
                        : active
                          ? "bg-[var(--surface-soft)] font-semibold text-[var(--mint-dark)]"
                          : "font-medium text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--ink)]"
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}
            </nav>

          </div>

          <div className="mx-auto flex max-w-7xl items-end justify-between gap-5 border-t border-[var(--line)] py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--mint-dark)]">{eyebrow}</p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>}
            </div>
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--mint)]"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Link>
            )}
          </div>
        </header>

        <div className="app-shell-content">{children}</div>

        <nav
          aria-label="Navigasi utama mobile"
          className="fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-6 items-end rounded-2xl border border-[var(--line)] bg-white/95 px-1.5 pb-1.5 pt-2 shadow-[0_12px_36px_rgba(15,23,42,0.14)] backdrop-blur lg:hidden"
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            const isScan = href === "/scan";
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSelection({ pathname, href })}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] leading-tight transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint-dark)] ${
                  isScan
                    ? "text-[var(--mint-dark)]"
                    : active
                      ? "font-semibold text-[var(--mint-dark)]"
                      : "text-[var(--muted)]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    isScan
                      ? "-mt-5 h-12 w-12 border-4 border-white bg-[var(--mint)] text-white shadow-lg shadow-emerald-900/20"
                      : active
                        ? "bg-[var(--surface-soft)]"
                        : ""
                  }`}
                >
                  <Icon size={isScan ? 24 : 19} strokeWidth={isScan ? 2.1 : 1.8} aria-hidden="true" />
                </span>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </main>
  );
}

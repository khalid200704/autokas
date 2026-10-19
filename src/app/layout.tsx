import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoKas — Asisten Keuangan",
  description: "Catat transaksi dari struk dan pahami arus kas Anda dengan AutoKas.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="h-full antialiased" data-scroll-behavior="smooth">
      <body className="min-h-full bg-[var(--background)] text-[var(--ink)]">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoKas MVP",
  description: "SaaS pembukuan berbasis foto struk dengan AI vision.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full bg-slate-950 text-white">{children}</body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

const NATIVE_REDIRECT = "com.autokas.app://auth/callback";

export function LoginPanel() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let browserFinishedListener: { remove: () => Promise<void> } | undefined;

    const handleAuthError = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      setError(message || "Login Google gagal. Silakan coba lagi.");
      setIsLoading(false);
    };
    window.addEventListener("autokas:auth-error", handleAuthError);

    if (Capacitor.isNativePlatform()) {
      void Browser.addListener("browserFinished", () => {
        if (active) setIsLoading(false);
      }).then((listener) => {
        if (active) browserFinishedListener = listener;
        else void listener.remove();
      });
    }

    return () => {
      active = false;
      window.removeEventListener("autokas:auth-error", handleAuthError);
      void browserFinishedListener?.remove();
    };
  }, []);

  const beginNativeLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      if (!hasSupabaseConfig()) {
        throw new Error("Supabase belum dikonfigurasi. Periksa URL dan anon key aplikasi.");
      }
      const { data, error: authError } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: NATIVE_REDIRECT,
          skipBrowserRedirect: true,
          queryParams: { access_type: "offline", prompt: "select_account" },
        },
      });
      if (authError) throw authError;
      if (!data.url) throw new Error("Alamat login Google tidak tersedia.");
      await Browser.open({ url: data.url });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login Google gagal.");
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-[var(--coral)]/30 bg-[#fff0ed] px-4 py-3 text-sm text-[var(--coral)]">
          {error}
        </div>
      )}
      {!error && searchParams.get("error") && (
        <div role="alert" className="mb-4 rounded-xl border border-[var(--coral)]/30 bg-[#fff0ed] px-4 py-3 text-sm text-[var(--coral)]">
          {searchParams.get("error")}
        </div>
      )}

      <a
        href="/auth/login"
        onClick={(event) => {
          if (!Capacitor.isNativePlatform()) return;
          event.preventDefault();
          void beginNativeLogin();
        }}
        aria-disabled={isLoading}
        className="app-button-primary flex min-h-12 w-full items-center justify-center px-6 py-3 text-sm font-semibold"
      >
        {isLoading ? "Menghubungkan ke Google..." : "Masuk dengan Google"}
      </a>

      <div className="mt-6 text-center text-sm text-[var(--muted)]">
        <Link href="/" className="font-medium text-[var(--mint-dark)] hover:text-[var(--ink)]">
          Kembali ke beranda
        </Link>
      </div>
    </>
  );
}

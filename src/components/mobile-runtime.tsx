"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

const OAUTH_CALLBACK = "com.autokas.app://auth/callback";

function notifyAuthError(message: string) {
  window.dispatchEvent(new CustomEvent("autokas:auth-error", { detail: message }));
}

export function MobileRuntime() {
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  const processedCallbacks = useRef(new Set<string>());

  useEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || pathname !== "/") return;
    if (!hasSupabaseConfig()) {
      router.replace("/dashboard");
      return;
    }
    let active = true;
    const supabase = createClient();

    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (active) router.replace(profile?.onboarding_completed ? "/dashboard" : "/onboarding");
    });

    return () => {
      active = false;
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let disposed = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];

    const handleOAuthCallback = async (rawUrl: string) => {
      if (!rawUrl.startsWith(OAUTH_CALLBACK) || processedCallbacks.current.has(rawUrl)) return;
      processedCallbacks.current.add(rawUrl);

      try {
        if (!hasSupabaseConfig()) {
          throw new Error("Supabase belum dikonfigurasi. Periksa URL dan anon key aplikasi.");
        }
        const supabase = createClient();
        const callbackUrl = new URL(rawUrl);
        const providerError =
          callbackUrl.searchParams.get("error_description") ??
          callbackUrl.searchParams.get("error");
        if (providerError) throw new Error(providerError);

        const code = callbackUrl.searchParams.get("code");
        if (!code) throw new Error("Kode masuk tidak ditemukan. Silakan coba lagi.");

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (!data.user) throw new Error("Akun Google belum berhasil diverifikasi.");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        await Browser.close().catch(() => undefined);
        router.replace(profile?.onboarding_completed ? "/dashboard" : "/onboarding");
      } catch (error) {
        await Browser.close().catch(() => undefined);
        const message = error instanceof Error ? error.message : "Login Google gagal.";
        notifyAuthError(message);
        router.replace(`/login?error=${encodeURIComponent(message)}`);
      }
    };

    const registerListeners = async () => {
      const urlListener = await App.addListener("appUrlOpen", ({ url }) => {
        void handleOAuthCallback(url);
      });
      if (disposed) await urlListener.remove();
      else listeners.push(urlListener);

      const backListener = await App.addListener("backButton", ({ canGoBack }) => {
        const path = currentPath.current;
        if (canGoBack && path !== "/") {
          router.back();
        } else if (!["/", "/login", "/dashboard"].includes(path)) {
          router.replace("/dashboard");
        } else {
          void App.exitApp();
        }
      });
      if (disposed) await backListener.remove();
      else listeners.push(backListener);

      const launch = await App.getLaunchUrl();
      if (launch?.url) void handleOAuthCallback(launch.url);

      await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
      await StatusBar.setBackgroundColor({ color: "#f5f7f2" }).catch(() => undefined);
    };

    void registerListeners().catch((error: unknown) => {
      notifyAuthError(error instanceof Error ? error.message : "Fitur Android belum tersedia.");
    });

    return () => {
      disposed = true;
      listeners.forEach((listener) => void listener.remove());
    };
  }, [router]);

  return null;
}

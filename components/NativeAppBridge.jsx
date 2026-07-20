"use client";

import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Network } from "@capacitor/network";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativeApp } from "../lib/nativeRuntime";

function routeFromNativeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const productMatch = url.pathname.match(/^\/product\/([^/]+)/);
    if (productMatch) {
      return `/?product=${encodeURIComponent(decodeURIComponent(productMatch[1]))}`;
    }

    if (url.pathname === "/join") {
      return `/join${url.search}`;
    }

    if (url.protocol === "envantra:") {
      return `${url.pathname || "/"}${url.search || ""}`;
    }
  } catch (error) {
    console.error("Android bağlantısı çözümlenemedi:", error);
  }
  return "/";
}

function openNativeUrl(rawUrl) {
  const route = routeFromNativeUrl(rawUrl);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== route) window.location.assign(route);
}

export default function NativeAppBridge() {
  useEffect(() => {
    if (!isNativeApp()) return undefined;

    const listenerHandles = [];
    let active = true;

    const setup = async () => {
      await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
      await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
      await StatusBar.setBackgroundColor({ color: "#F8F9FF" }).catch(() => undefined);

      listenerHandles.push(
        await CapacitorApp.addListener("appUrlOpen", ({ url }) => openNativeUrl(url)),
        await CapacitorApp.addListener("backButton", async () => {
          const backEvent = new CustomEvent("envantra:native-back", { cancelable: true });
          const shouldUseDefault = window.dispatchEvent(backEvent);
          if (!shouldUseDefault) return;
          if (window.history.length > 1) window.history.back();
          else await CapacitorApp.exitApp();
        }),
        await Network.addListener("networkStatusChange", (status) => {
          window.dispatchEvent(new CustomEvent("envantra:network-change", { detail: status }));
        }),
        await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
          void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
          const target = notification?.data?.url;
          if (target) openNativeUrl(new URL(target, "https://envantra.vercel.app").toString());
        })
      );

      if (active) await SplashScreen.hide().catch(() => undefined);
    };

    void setup();
    return () => {
      active = false;
      listenerHandles.forEach((handle) => void handle.remove());
    };
  }, []);

  return null;
}

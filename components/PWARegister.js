"use client";

import { useEffect } from "react";
import { registerFirebaseServiceWorker } from "../lib/firebaseMessaging";
import { isNativeApp } from "../lib/nativeRuntime";

export default function PWARegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      isNativeApp() ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await registerFirebaseServiceWorker();

        console.log(
          "PWA Service Worker kayıtlı:",
          registration.scope
        );
      } catch (error) {
        console.error(
          "PWA Service Worker kayıt hatası:",
          error
        );
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}

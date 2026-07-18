"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration =
          await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });

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

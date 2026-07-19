"use client";

import { useEffect } from "react";
import { registerFirebaseServiceWorker } from "../lib/firebaseMessaging";

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

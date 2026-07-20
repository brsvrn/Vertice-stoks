"use client";

import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
} from "firebase/messaging";

import { app } from "./firebase";

/*
 * Firebase Messaging nesnesini güvenli şekilde oluşturur.
 * Bazı tarayıcılar FCM Web Push desteklemeyebilir.
 */
export async function getFirebaseMessaging() {
  try {
    const supported = await isSupported();

    if (!supported) {
      console.log(
        "Bu tarayıcı Firebase Cloud Messaging desteklemiyor."
      );

      return null;
    }

    return getMessaging(app);
  } catch (error) {
    console.error(
      "Firebase Messaging başlatma hatası:",
      error
    );

    return null;
  }
}

/*
 * SERVICE WORKER KAYDI
 *
 * Dinamik oluşturduğumuz:
 * /firebase-messaging-sw.js
 *
 * adresini kaydeder.
 */
export async function registerFirebaseServiceWorker() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator)
  ) {
    throw new Error(
      "SERVICE_WORKER_NOT_SUPPORTED"
    );
  }

  try {
    const registration =
      await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        {
          scope: "/",
        }
      );

    await navigator.serviceWorker.ready;

    console.log(
      "Stockera Service Worker hazır."
    );

    return registration;
  } catch (error) {
    console.error(
      "Service Worker kayıt hatası:",
      error
    );

    throw error;
  }
}

/*
 * BİLDİRİM İZNİ İSTE
 *
 * Bu fonksiyon çağrıldığında Android/Chrome
 * bildirim izin penceresi gösterilir.
 */
export async function requestNotificationPermission() {
  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    throw new Error(
      "NOTIFICATION_NOT_SUPPORTED"
    );
  }

  /*
   * Daha önce izin verilmişse
   * tekrar izin penceresi açmaya çalışma.
   */
  if (
    Notification.permission === "granted"
  ) {
    return "granted";
  }

  /*
   * Kullanıcı daha önce engellediyse
   * tarayıcı tekrar otomatik izin soramaz.
   */
  if (
    Notification.permission === "denied"
  ) {
    throw new Error(
      "NOTIFICATION_PERMISSION_DENIED"
    );
  }

  const permission =
    await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error(
      "NOTIFICATION_PERMISSION_DENIED"
    );
  }

  return permission;
}

/*
 * FCM TOKEN AL
 *
 * Her telefon/tarayıcı kurulumu için
 * Firebase bir FCM token üretir.
 *
 * Bu token daha sonra Firestore'a
 * kaydedilecek.
 */
export async function getFCMToken() {
  try {
    const permission =
      await requestNotificationPermission();

    if (permission !== "granted") {
      return null;
    }

    const messaging =
      await getFirebaseMessaging();

    if (!messaging) {
      throw new Error(
        "MESSAGING_NOT_SUPPORTED"
      );
    }

    const serviceWorkerRegistration =
      await registerFirebaseServiceWorker();

    const vapidKey =
      process.env
        .NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      throw new Error(
        "VAPID_KEY_MISSING"
      );
    }

    const token = await getToken(
      messaging,
      {
        vapidKey,
        serviceWorkerRegistration,
      }
    );

    if (!token) {
      throw new Error(
        "FCM_TOKEN_NOT_CREATED"
      );
    }

    console.log(
      "Stockera FCM cihaz tokenı oluşturuldu."
    );

    return token;
  } catch (error) {
    console.error(
      "FCM token oluşturma hatası:",
      error
    );

    throw error;
  }
}

/*
 * UYGULAMA AÇIKKEN GELEN
 * FCM BİLDİRİMLERİNİ DİNLE
 *
 * Arka plandaki bildirimleri
 * Service Worker yönetir.
 */
export async function listenForegroundMessages(
  callback
) {
  try {
    const messaging =
      await getFirebaseMessaging();

    if (!messaging) {
      return () => {};
    }

    const unsubscribe =
      onMessage(
        messaging,
        (payload) => {
          console.log(
            "Ön plan FCM bildirimi:",
            payload
          );

          if (
            typeof callback ===
            "function"
          ) {
            callback(payload);
          }
        }
      );

    return unsubscribe;
  } catch (error) {
    console.error(
      "FCM mesaj dinleme hatası:",
      error
    );

    return () => {};
  }
  }

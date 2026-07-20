"use client";

import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { PushNotifications } from "@capacitor/push-notifications";
import { app } from "./firebase";
import {
  isNativeApp,
  requestNativeNotificationPermission,
} from "./nativeRuntime";

export async function getFirebaseMessaging() {
  try {
    if (isNativeApp() || !(await isSupported())) return null;
    return getMessaging(app);
  } catch (error) {
    console.error("Firebase Messaging başlatma hatası:", error);
    return null;
  }
}

export async function registerFirebaseServiceWorker() {
  if (isNativeApp()) return null;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("SERVICE_WORKER_NOT_SUPPORTED");
  }

  const registration = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
    { scope: "/" }
  );
  await navigator.serviceWorker.ready;
  return registration;
}

export async function requestNotificationPermission() {
  if (isNativeApp()) {
    const permission = await requestNativeNotificationPermission();
    if (permission !== "granted") throw new Error("NOTIFICATION_PERMISSION_DENIED");
    return permission;
  }

  if (typeof window === "undefined" || !("Notification" in window)) {
    throw new Error("NOTIFICATION_NOT_SUPPORTED");
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") {
    throw new Error("NOTIFICATION_PERMISSION_DENIED");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("NOTIFICATION_PERMISSION_DENIED");
  return permission;
}

async function getNativePushToken() {
  await requestNotificationPermission();

  return new Promise(async (resolve, reject) => {
    const handles = [];
    let finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      handles.forEach((handle) => void handle.remove());
      callback(value);
    };
    const timeoutId = window.setTimeout(
      () => finish(reject, new Error("FCM_TOKEN_TIMEOUT")),
      20000
    );

    try {
      handles.push(
        await PushNotifications.addListener("registration", ({ value }) => {
          if (value) finish(resolve, value);
          else finish(reject, new Error("FCM_TOKEN_EMPTY"));
        }),
        await PushNotifications.addListener("registrationError", (error) => {
          finish(reject, new Error(error?.error || "FCM_REGISTRATION_FAILED"));
        })
      );
      await PushNotifications.register();
    } catch (error) {
      finish(reject, error);
    }
  });
}

export async function getFCMToken() {
  try {
    if (isNativeApp()) return await getNativePushToken();

    await requestNotificationPermission();
    const messaging = await getFirebaseMessaging();
    if (!messaging) throw new Error("MESSAGING_NOT_SUPPORTED");

    const serviceWorkerRegistration = await registerFirebaseServiceWorker();
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) throw new Error("VAPID_KEY_MISSING");

    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
    if (!token) throw new Error("FCM_TOKEN_NOT_CREATED");
    return token;
  } catch (error) {
    console.error("FCM token oluşturma hatası:", error);
    throw error;
  }
}

export async function listenForegroundMessages(callback) {
  try {
    if (isNativeApp()) {
      const handle = await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
          if (typeof callback === "function") {
            callback({
              notification: {
                title: notification.title,
                body: notification.body,
              },
              data: notification.data || {},
            });
          }
        }
      );
      return () => void handle.remove();
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) return () => {};
    return onMessage(messaging, (payload) => {
      if (typeof callback === "function") callback(payload);
    });
  } catch (error) {
    console.error("FCM mesaj dinleme hatası:", error);
    return () => {};
  }
}

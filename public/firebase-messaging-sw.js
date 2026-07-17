/* Vertice Stok - Firebase Cloud Messaging Service Worker */

importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js"
);

/*
 * BURADAKİ DEĞERLERİ
 * KENDİ FIREBASE PROJENDEN DOLDURACAĞIZ.
 *
 * Firebase Console:
 * Project Settings > General > Your apps > Web app
 */

firebase.initializeApp({
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID"
});

const messaging = firebase.messaging();

/*
 * UYGULAMA ARKA PLANDA VEYA KAPALIYKEN
 * GELEN FCM MESAJINI YAKALA
 */
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Arka plan bildirimi:",
    payload
  );

  const notificationTitle =
    payload.notification?.title ||
    payload.data?.title ||
    "Vertice Stok";

  const notificationBody =
    payload.notification?.body ||
    payload.data?.body ||
    "Yeni bir stok bildiriminiz var.";

  const notificationOptions = {
    body: notificationBody,

    icon: "/icon-192.png",

    badge: "/icon-192.png",

    tag:
      payload.data?.notificationId ||
      "vertice-stok-notification",

    renotify: true,

    requireInteraction:
      payload.data?.priority === "critical",

    vibrate: [
      300,
      100,
      300,
      100,
      500
    ],

    data: {
      url:
        payload.data?.url ||
        "/",

      productId:
        payload.data?.productId ||
        "",

      type:
        payload.data?.type ||
        "GENERAL"
    }
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

/*
 * KULLANICI BİLDİRİME DOKUNDUĞUNDA
 * VERTICE STOK'U AÇ
 */
self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      event.notification.data?.url ||
      "/";

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then((clientList) => {
          /*
           * VERTICE STOK ZATEN AÇIKSA
           * O PENCEREYİ ÖNE GETİR
           */
          for (const client of clientList) {
            if (
              "focus" in client
            ) {
              return client.focus();
            }
          }

          /*
           * UYGULAMA AÇIK DEĞİLSE
           * YENİ PENCEREDE AÇ
           */
          if (
            clients.openWindow
          ) {
            return clients.openWindow(
              targetUrl
            );
          }

          return null;
        })
    );
  }
);

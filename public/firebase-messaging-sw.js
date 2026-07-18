/* Vertice Stok - Firebase Cloud Messaging Service Worker */

importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js"
);

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
 * FCM MESAJLARI
 *
 * Sunucu mesajı "notification" alanı ile gönderdiği için
 * tarayıcı bildirimi otomatik olarak gösterir.
 *
 * Burada showNotification() ÇAĞRILMAZ.
 * Böylece aynı bildirimin iki kez görünmesi engellenir.
 */
messaging.onBackgroundMessage((payload) => {
  console.log(
    "[firebase-messaging-sw.js] Arka plan FCM mesajı:",
    payload
  );

  // Bildirimi manuel olarak göstermiyoruz.
  // FCM notification payload'ını otomatik gösterecek.
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
          for (const client of clientList) {
            if ("focus" in client) {
              return client.focus();
            }
          }

          if (clients.openWindow) {
            return clients.openWindow(
              targetUrl
            );
          }

          return null;
        })
    );
  }
);

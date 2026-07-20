export async function GET() {
  const firebaseConfig = {
    apiKey:
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",

    authDomain:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",

    projectId:
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",

    storageBucket:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",

    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",

    appId:
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };

  const serviceWorkerCode = `
importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js"
);

firebase.initializeApp(
  ${JSON.stringify(firebaseConfig)}
);

const messaging = firebase.messaging();

/* PWA cache and Firebase messaging must share a single root worker. */
const CACHE_NAME = "vertice-stok-v4";
const APP_SHELL = ["/", "/offline.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || caches.match("/offline.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request)
        .then((response) => {
          const url = new URL(event.request.url);
          if (response.ok && url.origin === self.location.origin && !url.pathname.startsWith("/api/")) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match("/offline.html"));
    })
  );
});

/*
 * ARKA PLAN BİLDİRİMLERİ
 */
messaging.onBackgroundMessage((payload) => {

  console.log(
    "[Vertice Stok] Arka plan bildirimi:",
    payload
  );

  const notificationTitle =
    payload.notification?.title ||
    payload.data?.title ||
    "Vertice Stok";

  const notificationBody =
    payload.notification?.body ||
    payload.data?.body ||
    "Yeni bir bildiriminiz var.";

  const notificationOptions = {

    body: notificationBody,

    icon: "/icon-192.png",

    badge: "/icon-192.png",

    tag:
      payload.data?.notificationId ||
      "vertice-stok",

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

      batchId:
        payload.data?.batchId ||
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
 * BİLDİRİME TIKLANDIĞINDA
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
           * UYGULAMA ZATEN AÇIKSA
           */
          for (
            const client
            of clientList
          ) {

            if (
              "navigate" in client &&
              "focus" in client
            ) {

              return client
                .navigate(targetUrl)
                .then(() =>
                  client.focus()
                );

            }

          }

          /*
           * UYGULAMA KAPALIYSA
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
`;

  return new Response(
    serviceWorkerCode,
    {
      headers: {
        "Content-Type":
          "application/javascript; charset=utf-8",

        "Cache-Control":
          "no-store, no-cache, must-revalidate",

        "Service-Worker-Allowed":
          "/",
      },
    }
  );
}

/* eslint-disable no-undef */
// Firebase Cloud Messaging service worker for background push notifications.
//
// The Firebase config is injected at registration time via the URL query string.
// All values are public keys (safe to embed in client-side code).

importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

// Parse config from the SW URL query string (set during registration)
const params = new URL(self.location).searchParams;
const config = {
  apiKey: params.get("apiKey") || "",
  authDomain: params.get("authDomain") || "",
  projectId: params.get("projectId") || "",
  storageBucket: params.get("storageBucket") || "",
  messagingSenderId: params.get("messagingSenderId") || "",
  appId: params.get("appId") || "",
};

firebase.initializeApp(config);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Trellis";
  const options = {
    body: payload.notification?.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: "trellis-reminder",
    renotify: true,
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes("/client/") && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow("/client/appointments");
    })
  );
});

/* eslint-disable */
// Background service worker for Firebase Cloud Messaging.
//
// IMPORTANT: this file is served as a static asset, so it CANNOT read
// process.env at runtime. Fill the values below with your Firebase web app
// config (the SAME values you put in .env.local with NEXT_PUBLIC_ prefixes).
// These values are public — they identify the project, they are not secrets.

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "REPLACE_ME_API_KEY",
  authDomain: "REPLACE_ME_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_ME_PROJECT_ID",
  storageBucket: "REPLACE_ME_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_ME_SENDER_ID",
  appId: "REPLACE_ME_APP_ID",
});

const messaging = firebase.messaging();

// Fires when a push lands while the page is closed/backgrounded.
messaging.onBackgroundMessage((payload) => {
  const title =
    (payload.notification && payload.notification.title) || "Bus update";
  const body = (payload.notification && payload.notification.body) || "";
  const data = payload.data || {};
  self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});

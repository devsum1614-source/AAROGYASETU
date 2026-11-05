/**
 * AAROGYASETU (आरोग्यसेतु) Service Worker — Milestone 1
 * Privacy & Security Rule:
 *   Caches ONLY the static application shell (HTML, CSS, JS, manifest, and app icons).
 *   NEVER caches /api/* requests, medical reports, patient profiles, or consultation messages.
 */

const CACHE_NAME = 'aarogyasetu-app-shell-v1';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // STRICT PRIVACY GUARD: Never cache any API route, medical report, profile, or message
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/reports/') ||
    url.pathname.includes('/messages') ||
    url.pathname.includes('/profile') ||
    url.pathname.includes('/consultations')
  ) {
    return;
  }

  // Only handle same-origin static assets & navigation requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests fall back to cached /index.html when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets (JS, CSS, icons, manifest): Network-first with static cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic'
        ) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

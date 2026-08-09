const CACHE = 'beacon-v2'
// Relative to this script's own URL (e.g. /beacon/sw.js on a GitHub Pages
// project site), not the domain root, so this still works under any subpath.
const APP_SHELL = ['./', './index.html', './manifest.json', './favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})

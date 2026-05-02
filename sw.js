// ============================================================
//  PENSÉE IA — sw.js (Service Worker PWA)
//  Stratégie : Cache-First pour assets statiques, Network-First pour l'API
// ============================================================

const CACHE_NAME = 'pensee-ia-v1';

// Assets statiques à pré-mettre en cache au premier chargement
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/ia.js'
];

// ── INSTALLATION : Pré-cache des assets critiques ─────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch(() => {
                // Silencieux : si un asset échoue, on ne bloque pas l'install
            });
        }).then(() => self.skipWaiting()) // Activation immédiate sans attendre
    );
});

// ── ACTIVATION : Suppression des vieux caches ─────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys
                .filter((key) => key !== CACHE_NAME)
                .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim()) // Prend le contrôle des pages ouvertes
    );
});

// ── FETCH : Routage intelligent ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // ① Requêtes API → toujours réseau (pas de cache pour les réponses IA)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // ② Supabase & CDNs externes → réseau pur, pas de cache
    if (url.hostname.includes('supabase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('cdn.jsdelivr') ||
        url.hostname.includes('cdnjs')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // ③ Assets statiques propres → Cache-First avec fallback réseau
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request).then((response) => {
                // On ne cache que les réponses valides
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const toCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, toCache);
                });
                return response;
            });
        })
    );
});

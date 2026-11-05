// ============================================================
//  PENSÉE IA — sw.js (Service Worker PWA)
//  Stratégie : Network-First pour tout (le cache ne sert que hors ligne),
//  pour qu'un déploiement atteigne immédiatement tous les utilisateurs.
// ============================================================

const CACHE_NAME = 'pensee-ia-v4'; // changer de nom purge les anciens caches

// Assets statiques à pré-mettre en cache au premier chargement
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/src/main.js',
    '/src/styles/agent.css'
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

    // ① Requêtes API, Supabase & CDNs externes → le service worker ne s'en mêle PAS.
    //    Relayer via respondWith(fetch()) mettait en mémoire tampon le flux de /api/chat
    //    sur mobile (Safari iOS, certains Chrome Android) : réponse affichée d'un bloc,
    //    très tard, ou jamais. Sans respondWith, le navigateur gère la requête lui-même.
    if (url.pathname.startsWith('/api/') ||
        url.origin !== self.location.origin) {
        return;
    }

    // ③ Assets statiques propres → Network-First, cache en secours hors ligne.
    //    (Cache-First servait l'ancien code indéfiniment après chaque déploiement.)
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request).then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
                const toCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
            }
            return response;
        }).catch(() => caches.match(event.request))
    );
});

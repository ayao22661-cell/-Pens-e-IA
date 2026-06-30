// ============================================================
//  PENSÉE IA — api/search.js
//  SearXNG — Rotation + Course parallèle + Tavily fallback
//  Supporte 100+ utilisateurs simultanés
// ============================================================

export const config = { runtime: 'edge' };

// ✅ Instances classées par fiabilité historique
const INSTANCES = [
    "https://search.inetol.net",
    "https://searx.be",
    "https://searxng.world",
    "https://search.bus-hit.me",
    "https://searx.tiekoetter.com",
];

// ── Requête vers une instance SearXNG ─────────────────────
async function fetchFromInstance(instance, params) {
    const res = await fetch(`${instance}/search?${params}`, {
        headers: {
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; PenseeIA/1.0)"
        },
        signal: AbortSignal.timeout(6000) // ⬇️ Réduit de 8s à 6s
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const results = (data.results || []).slice(0, 5).map(r => ({
        title:        r.title    || '',
        url:          r.url      || '',
        snippet:      r.content  || '',
        source:       'searxng'
    }));

    if (results.length === 0) throw new Error('Aucun résultat');

    return {
        results,
        directAnswer: data.infoboxes?.[0]?.content || null,
        source:       instance
    };
}

// ============================================================
//  FONCTION RÉUTILISABLE — performWebSearch(query, count)
//  Logique de recherche pure, sans dépendance à Request/Response.
//  Utilisée par le endpoint HTTP ci-dessous ET importée directement
//  par chat.js pour injecter du contexte web dans les prompts,
//  y compris pour les modèles Gemma qui ne supportent pas le tool
//  googleSearch natif.
//
//  Retourne : { results: [...], directAnswer: string|null, source: string }
//  Lève une erreur si toutes les stratégies échouent.
// ============================================================
export async function performWebSearch(query, count = 5) {
    if (!query?.trim()) {
        throw new Error('Requête vide.');
    }

    const params = new URLSearchParams({
        q:        query.trim(),
        format:   "json",
        language: "fr",
        count:    String(count)
    });

    // ── STRATÉGIE 1 : Course entre les 3 meilleures instances ──
    const top3 = INSTANCES.slice(0, 3)
        .sort(() => Math.random() - 0.5); // Mélange pour répartir la charge

    try {
        return await Promise.any(
            top3.map(instance => fetchFromInstance(instance, params))
        );
    } catch (_) {
        console.warn('[Search] Top 3 échouées, tentative sur instances de secours...');
    }

    // ── STRATÉGIE 2 : Instances de secours (séquentiel) ────────
    for (const instance of INSTANCES.slice(3)) {
        try {
            return await fetchFromInstance(instance, params);
        } catch (e) {
            console.warn(`[Search] Instance échouée (${instance}):`, e.message);
        }
    }

    // ── STRATÉGIE 3 : Fallback Tavily si clé disponible ────────
    const TAVILY_KEY = process.env.TAVILY_API_KEY;
    if (TAVILY_KEY) {
        try {
            const res = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key:      TAVILY_KEY,
                    query:        query.trim(),
                    search_depth: "basic",
                    max_results:  Math.min(count, 5),
                    include_answer: true
                }),
                signal: AbortSignal.timeout(8000)
            });

            if (res.ok) {
                const data = await res.json();
                const results = (data.results || []).slice(0, count).map(r => ({
                    title:   r.title   || '',
                    url:     r.url     || '',
                    snippet: r.content || '',
                    source:  'tavily'
                }));

                if (results.length > 0) {
                    return {
                        results,
                        directAnswer: data.answer || null,
                        source: 'tavily'
                    };
                }
            }
        } catch (e) {
            console.warn('[Search] Tavily échoué :', e.message);
        }
    }

    // ── TOUT A ÉCHOUÉ ──────────────────────────────────────────
    throw new Error('Recherche temporairement indisponible.');
}

// ============================================================
//  ENDPOINT HTTP — conservé pour compatibilité avec le frontend
//  (appels directs depuis le client, ex: recherche manuelle dans l'UI)
// ============================================================
export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { query, count = 5 } = body;

    try {
        const result = await performWebSearch(query, count);
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        const status = e.message === 'Requête vide.' ? 400 : 502;
        return new Response(JSON.stringify({
            error: status === 400
                ? 'Requête vide.'
                : 'Recherche temporairement indisponible. Réessaie dans quelques secondes.'
        }), { status });
    }
}

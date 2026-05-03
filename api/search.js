// ============================================================
//  PENSÉE IA — api/search.js
//  Tavily Search API (1000 req/mois gratuit) → fallback DuckDuckGo
// ============================================================

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { query, count = 5 } = body;

    if (!query || !query.trim()) {
        return new Response(JSON.stringify({ error: 'Requête vide.' }), { status: 400 });
    }

    const TAVILY_KEY = process.env.TAVILY_API_KEY;

    // ── TENTATIVE 1 : Tavily Search (1000 req/mois gratuit, sans CB) ──
    if (TAVILY_KEY) {
        try {
            const res = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key:        TAVILY_KEY,
                    query:          query,
                    search_depth:   "basic",       // 1 crédit/req (vs 2 pour "advanced")
                    max_results:    Math.min(count, 5),
                    include_answer: true,           // Retourne une réponse directe si dispo
                    include_raw_content: false
                }),
                signal: AbortSignal.timeout(8000)
            });

            if (!res.ok) throw new Error(`Tavily ${res.status}`);

            const data = await res.json();

            const items = (data.results || []).slice(0, count).map(r => ({
                title:   r.title   || '',
                url:     r.url     || '',
                snippet: r.content || '',
                source:  'tavily'
            }));

            return new Response(JSON.stringify({
                results:     items,
                directAnswer: data.answer || null,
                source:      'tavily'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (e) {
            console.warn('[Search] Tavily échoué :', e.message);
        }
    }

    // ── FALLBACK : DuckDuckGo Instant Answer API (sans clé) ──
    try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&skip_disambig=1&kl=fr-fr`;
        const res = await fetch(ddgUrl, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) throw new Error(`DDG ${res.status}`);

        const data = await res.json();
        const results = [];

        if (data.AbstractText && data.AbstractURL) {
            results.push({
                title:   data.Heading || query,
                url:     data.AbstractURL,
                snippet: data.AbstractText.slice(0, 300),
                source:  'duckduckgo'
            });
        }

        (data.RelatedTopics || []).slice(0, count - results.length).forEach(t => {
            if (t.Text && t.FirstURL) {
                results.push({
                    title:   t.Text.slice(0, 80),
                    url:     t.FirstURL,
                    snippet: t.Text.slice(0, 300),
                    source:  'duckduckgo'
                });
            }
        });

        return new Response(JSON.stringify({
            results,
            directAnswer: null,
            source: results.length > 0 ? 'duckduckgo' : 'none'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e) {
        return new Response(JSON.stringify({
            error: 'Recherche impossible : ' + e.message
        }), { status: 502 });
    }
}

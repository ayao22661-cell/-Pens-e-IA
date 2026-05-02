// ============================================================
//  PENSÉE IA — api/search.js
//  Recherche web : Serper.dev (Google réel) → fallback DuckDuckGo
//  Retourne jusqu'à 5 résultats {title, url, snippet}
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

    const SERPER_KEY = process.env.SERPER_API_KEY;

    // ── TENTATIVE 1 : Serper.dev (résultats Google réels, sans restriction) ──
    if (SERPER_KEY) {
        try {
            const res = await fetch("https://google.serper.dev/search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-KEY": SERPER_KEY
                },
                body: JSON.stringify({
                    q:   query,
                    gl:  "ci",
                    hl:  "fr",
                    num: Math.min(count, 5)
                }),
                signal: AbortSignal.timeout(7000)
            });

            if (!res.ok) throw new Error(`Serper ${res.status}`);

            const data = await res.json();

            const items = (data.organic || []).slice(0, count).map(r => ({
                title:   r.title   || '',
                url:     r.link    || '',
                snippet: r.snippet || '',
                source:  'serper'
            }));

            let directAnswer = null;
            if (data.answerBox?.answer)           directAnswer = data.answerBox.answer;
            else if (data.answerBox?.snippet)     directAnswer = data.answerBox.snippet;
            else if (data.knowledgeGraph?.description) directAnswer = data.knowledgeGraph.description;

            return new Response(JSON.stringify({
                results: items,
                directAnswer,
                source: 'serper'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (e) {
            console.warn('[Search] Serper échoué :', e.message);
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

// ============================================================
//  PENSÉE IA — api/fetch-url.js (Web Reader Tool)
//  Scrape une URL distante, nettoie le HTML, retourne le texte pur
//  Appelé automatiquement par ia.js quand un prompt contient une URL
// ============================================================

export const config = { runtime: 'edge' };

// Balises à supprimer complètement (contenu inclus)
const STRIP_TAGS = ['script', 'style', 'noscript', 'nav', 'footer', 'header',
                    'aside', 'iframe', 'svg', 'form', 'button', 'input',
                    'select', 'textarea', 'img', 'video', 'audio', 'canvas'];

// Nettoie le HTML brut → texte lisible sans bruit
function htmlToText(html) {
    // 1. Supprime les balises indésirables et leur contenu
    let text = html;
    for (const tag of STRIP_TAGS) {
        const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi');
        text = text.replace(re, ' ');
        // Auto-fermantes
        text = text.replace(new RegExp(`<${tag}[^>]*\\/?>`, 'gi'), ' ');
    }

    // 2. Préserve les sauts de ligne sémantiques avant de strip
    text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, ' | ')
        .replace(/<\/th>/gi, ' | ');

    // 3. Strip toutes les balises restantes
    text = text.replace(/<[^>]+>/g, '');

    // 4. Décode les entités HTML courantes
    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '…');

    // 5. Nettoyage des espaces parasites
    text = text
        .replace(/[ \t]+/g, ' ')        // Espaces multiples → un seul
        .replace(/\n{3,}/g, '\n\n')     // 3+ sauts de ligne → 2 max
        .trim();

    return text;
}

// Tente d'extraire le titre de la page
function extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { url } = body;

    if (!url) {
        return new Response(JSON.stringify({ error: 'URL manquante.' }), { status: 400 });
    }

    // Validation de l'URL — sécurité contre les SSRF
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        return new Response(JSON.stringify({ error: "URL invalide." }), { status: 400 });
    }

    // Blocage des adresses internes (SSRF protection)
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.', '10.', '192.168.'];
    if (blocked.some(b => parsedUrl.hostname.startsWith(b))) {
        return new Response(JSON.stringify({ error: "URL non autorisée." }), { status: 403 });
    }

    // Seuls HTTP/HTTPS sont acceptés
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return new Response(JSON.stringify({ error: "Protocole non supporté." }), { status: 400 });
    }

    try {
        const response = await fetch(parsedUrl.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PenseeIA/1.0; +https://pensee-ia.vercel.app)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            },
            // Timeout : 8 secondes max
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
            return new Response(
                JSON.stringify({ error: `La page a retourné une erreur ${response.status}.` }),
                { status: 502 }
            );
        }

        const contentType = response.headers.get('content-type') || '';

        // Gestion du texte brut (JSON, Markdown, etc.)
        if (!contentType.includes('html')) {
            const text = await response.text();
            return new Response(
                JSON.stringify({
                    url: parsedUrl.toString(),
                    title: parsedUrl.pathname.split('/').pop() || parsedUrl.hostname,
                    text: text.slice(0, 20000) // Troncature de sécurité
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const html = await response.text();
        const title = extractTitle(html) || parsedUrl.hostname;
        const text = htmlToText(html);

        // Troncature à ~15000 caractères (~3750 tokens) pour rester dans la fenêtre de contexte
        const truncated = text.length > 15000
            ? text.slice(0, 15000) + '\n\n[... Contenu tronqué — page trop longue]'
            : text;

        return new Response(
            JSON.stringify({ url: parsedUrl.toString(), title, text: truncated }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        return new Response(
            JSON.stringify({
                error: isTimeout
                    ? "La page a mis trop longtemps à répondre (timeout 8s)."
                    : `Impossible d'accéder à cette URL : ${err.message}`
            }),
            { status: 502 }
        );
    }
}

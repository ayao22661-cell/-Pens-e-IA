// ============================================================
//  PENSÉE IA — api/_lib/web.js
//  Lecture d'une page web → texte propre. Partagé entre
//  /api/fetch-url et l'outil fetch_url de l'agent.
// ============================================================

const STRIP_TAGS = ['script', 'style', 'noscript', 'nav', 'footer', 'header',
                    'aside', 'iframe', 'svg', 'form', 'button', 'input',
                    'select', 'textarea', 'img', 'video', 'audio', 'canvas'];

export function htmlToText(html) {
    let text = html;
    for (const tag of STRIP_TAGS) {
        text = text.replace(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
        text = text.replace(new RegExp(`<${tag}[^>]*\\/?>`, 'gi'), ' ');
    }
    text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/tr>/gi, '\n')
        .replace(/<\/td>/gi, ' | ')
        .replace(/<\/th>/gi, ' | ')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '…')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return text;
}

function extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
}

// Protection SSRF : refuse les hôtes internes / privés / métadonnées cloud.
function isBlockedHost(hostname) {
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
    if (h === '::1' || h === '::' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
    const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return false;
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
        || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export class FetchUrlError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

/**
 * @returns {Promise<{url: string, title: string, text: string}>}
 * @throws {FetchUrlError}
 */
export async function fetchUrlText(rawUrl, maxChars = 15000) {
    let parsed;
    try { parsed = new URL(rawUrl); } catch { throw new FetchUrlError(400, 'URL invalide.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new FetchUrlError(400, 'Protocole non supporté.');
    if (isBlockedHost(parsed.hostname)) throw new FetchUrlError(403, 'URL non autorisée.');

    let response;
    try {
        response = await fetch(parsed.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PenseeIA/1.0; +https://pensee-ia.vercel.app)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            },
            signal: AbortSignal.timeout(8000),
        });
    } catch (err) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        throw new FetchUrlError(502, isTimeout
            ? 'La page a mis trop longtemps à répondre (timeout 8s).'
            : `Impossible d'accéder à cette URL : ${err.message}`);
    }

    // Une redirection peut mener vers un hôte interne : on revérifie l'URL finale.
    try {
        if (response.url && isBlockedHost(new URL(response.url).hostname)) {
            throw new FetchUrlError(403, 'Redirection vers une URL non autorisée.');
        }
    } catch (e) { if (e instanceof FetchUrlError) throw e; }

    if (!response.ok) throw new FetchUrlError(502, `La page a retourné une erreur ${response.status}.`);

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();
    const isHtml = contentType.includes('html');
    const title = (isHtml && extractTitle(raw)) || parsed.pathname.split('/').pop() || parsed.hostname;
    const text = isHtml ? htmlToText(raw) : raw;

    return {
        url: parsed.toString(),
        title,
        text: text.length > maxChars ? text.slice(0, maxChars) + '\n\n[... Contenu tronqué — page trop longue]' : text,
    };
}

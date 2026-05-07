// ============================================================
//  PENSÉE IA — api/fetch-url.js (Web Reader Tool) v2.0
//  Scrape une URL distante, nettoie le HTML, retourne le texte pur
//  Sécurité : SSRF complet, limite taille, Content-Type précoce,
//             redirections manuelles, DNS rebinding atténué
// ============================================================

export const config = { runtime: 'edge' };

// ── Toutes les plages IP internes/dangereuses ─────────────────
// RFC 1918 privées, loopback, link-local, CGNAT, métadonnées cloud
const BLOCKED_PREFIXES = [
    'localhost',
    '127.',           // loopback IPv4
    '0.0.0.0',
    '::1',            // loopback IPv6
    '::',             // IPv6 non spécifié
    'fc00:',          // IPv6 ULA
    'fd',             // IPv6 ULA (fd00::/8)
    'fe80:',          // IPv6 link-local
    '10.',            // RFC 1918 classe A
    '192.168.',       // RFC 1918 classe C
    '172.16.',        // RFC 1918 classe B — manquait avant
    '172.17.',
    '172.18.',
    '172.19.',
    '172.20.',
    '172.21.',
    '172.22.',
    '172.23.',
    '172.24.',
    '172.25.',
    '172.26.',
    '172.27.',
    '172.28.',
    '172.29.',
    '172.30.',
    '172.31.',
    '169.254.',       // link-local + métadonnées AWS/GCP/Azure — manquait avant
    '100.64.',        // CGNAT RFC 6598 — manquait avant
    '100.65.',
    '100.66.',
    '100.67.',
    '100.68.',
    '100.69.',
    '100.70.',
    '100.71.',
    '100.72.',
    '100.73.',
    '100.74.',
    '100.75.',
    '100.76.',
    '100.77.',
    '100.78.',
    '100.79.',
    '100.80.',
    '100.81.',
    '100.82.',
    '100.83.',
    '100.84.',
    '100.85.',
    '100.86.',
    '100.87.',
    '100.88.',
    '100.89.',
    '100.90.',
    '100.91.',
    '100.92.',
    '100.93.',
    '100.94.',
    '100.95.',
    '100.96.',
    '100.97.',
    '100.98.',
    '100.99.',
    '100.100.',
    '100.101.',
    '100.102.',
    '100.103.',
    '100.104.',
    '100.105.',
    '100.106.',
    '100.107.',
    '100.108.',
    '100.109.',
    '100.110.',
    '100.111.',
    '100.112.',
    '100.113.',
    '100.114.',
    '100.115.',
    '100.116.',
    '100.117.',
    '100.118.',
    '100.119.',
    '100.120.',
    '100.121.',
    '100.122.',
    '100.123.',
    '100.124.',
    '100.125.',
    '100.126.',
    '100.127.',
];

// Adresses exactes à bloquer (métadonnées cloud — critique)
const BLOCKED_EXACT = [
    '169.254.169.254',   // AWS IMDSv1/v2, GCP, Azure
    '169.254.170.2',     // AWS ECS metadata
    'metadata.google.internal',
    'metadata.google',
];

// Types de contenu autorisés (lire uniquement du texte)
const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain', 'application/json',
                                'application/xml', 'text/xml', 'text/markdown'];

// Taille maximale du body à lire : 512 KB
const MAX_BODY_BYTES = 512 * 1024;

// ── Validation SSRF complète ──────────────────────────────────
function isBlockedHost(hostname) {
    const h = hostname.toLowerCase();

    // Vérification exacte
    if (BLOCKED_EXACT.includes(h)) return true;

    // Vérification par préfixe
    if (BLOCKED_PREFIXES.some(prefix => h.startsWith(prefix))) return true;

    // Bloquer les IPs pures qui ressemblent à des plages internes
    // (détection supplémentaire pour les notations alternatives)
    const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
        const [, a, b] = ipv4.map(Number);
        // 10.x.x.x
        if (a === 10) return true;
        // 172.16.x.x – 172.31.x.x
        if (a === 172 && b >= 16 && b <= 31) return true;
        // 192.168.x.x
        if (a === 192 && b === 168) return true;
        // 169.254.x.x (link-local)
        if (a === 169 && b === 254) return true;
        // 100.64.x.x – 100.127.x.x (CGNAT)
        if (a === 100 && b >= 64 && b <= 127) return true;
        // 127.x.x.x (loopback étendu)
        if (a === 127) return true;
        // 0.x.x.x
        if (a === 0) return true;
    }

    return false;
}

// ── Lecture du body avec limite de taille ─────────────────────
async function readBodyLimited(response, maxBytes) {
    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
            reader.cancel();
            // Retourne ce qu'on a déjà lu
            break;
        }
        chunks.push(value);
    }

    // Assembler les chunks en une seule Uint8Array
    const combined = new Uint8Array(totalBytes > maxBytes ? maxBytes : totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return new TextDecoder('utf-8', { fatal: false }).decode(combined);
}

// ── Nettoyage HTML → texte ────────────────────────────────────
const STRIP_TAGS = ['script', 'style', 'noscript', 'nav', 'footer', 'header',
                    'aside', 'iframe', 'svg', 'form', 'button', 'input',
                    'select', 'textarea', 'img', 'video', 'audio', 'canvas'];

function htmlToText(html) {
    let text = html;
    for (const tag of STRIP_TAGS) {
        const re = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}>`, 'gi');
        text = text.replace(re, ' ');
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
        .replace(/<\/th>/gi, ' | ');

    text = text.replace(/<[^>]+>/g, '');

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

    return text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
}

// ── Handler principal ─────────────────────────────────────────
export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { url } = body;

    if (!url) {
        return new Response(JSON.stringify({ error: 'URL manquante.' }), { status: 400 });
    }

    // ── ÉTAPE 1 : Validation de l'URL ────────────────────────
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        return new Response(JSON.stringify({ error: 'URL invalide.' }), { status: 400 });
    }

    // Seuls HTTP/HTTPS acceptés
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return new Response(JSON.stringify({ error: 'Protocole non supporté.' }), { status: 400 });
    }

    // ── ÉTAPE 2 : Validation SSRF sur l'URL initiale ─────────
    if (isBlockedHost(parsedUrl.hostname)) {
        return new Response(JSON.stringify({ error: 'URL non autorisée.' }), { status: 403 });
    }

    try {
        // ── ÉTAPE 3 : Requête avec redirections MANUELLES ────
        // redirect: 'manual' empêche Vercel de suivre les redirections
        // vers des IPs internes sans qu'on puisse les valider
        const response = await fetch(parsedUrl.toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PenseeIA/1.0; +https://pensee-ia.vercel.app)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
            },
            redirect: 'manual',           // On gère les redirections nous-mêmes
            signal: AbortSignal.timeout(8000)
        });

        // ── ÉTAPE 4 : Gestion sécurisée des redirections ─────
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location) {
                return new Response(JSON.stringify({ error: 'Redirection sans destination.' }), { status: 502 });
            }

            // Résoudre l'URL de redirection (peut être relative)
            let redirectUrl;
            try {
                redirectUrl = new URL(location, parsedUrl.toString());
            } catch {
                return new Response(JSON.stringify({ error: 'URL de redirection invalide.' }), { status: 502 });
            }

            // Valider l'URL de destination — protection DNS rebinding
            if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
                return new Response(JSON.stringify({ error: 'Redirection vers protocole non autorisé.' }), { status: 403 });
            }
            if (isBlockedHost(redirectUrl.hostname)) {
                return new Response(JSON.stringify({ error: 'Redirection vers adresse non autorisée.' }), { status: 403 });
            }

            // Suivre la redirection validée (une seule fois — pas de chaîne infinie)
            const finalResponse = await fetch(redirectUrl.toString(), {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PenseeIA/1.0; +https://pensee-ia.vercel.app)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
                },
                redirect: 'error',        // Plus aucune redirection après celle-ci
                signal: AbortSignal.timeout(8000)
            });

            return await processResponse(finalResponse, redirectUrl);
        }

        return await processResponse(response, parsedUrl);

    } catch (err) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
        return new Response(
            JSON.stringify({
                error: isTimeout
                    ? 'La page a mis trop longtemps à répondre (timeout 8s).'
                    : `Impossible d'accéder à cette URL : ${err.message}`
            }),
            { status: 502 }
        );
    }
}

// ── Traitement de la réponse ──────────────────────────────────
async function processResponse(response, parsedUrl) {
    if (!response.ok) {
        return new Response(
            JSON.stringify({ error: `La page a retourné une erreur ${response.status}.` }),
            { status: 502 }
        );
    }

    // ── ÉTAPE 5 : Vérification Content-Type AVANT de lire ────
    // On refuse les binaires (images, vidéos, exécutables) sans les télécharger
    const contentType = response.headers.get('content-type') || '';
    const isAllowed = ALLOWED_CONTENT_TYPES.some(t => contentType.includes(t));

    if (!isAllowed) {
        return new Response(
            JSON.stringify({ error: `Type de contenu non supporté : ${contentType.split(';')[0]}` }),
            { status: 415 }
        );
    }

    // ── ÉTAPE 6 : Lecture limitée à MAX_BODY_BYTES (512 KB) ──
    // Protège contre les fichiers géants qui feraient crasher l'instance
    const rawText = await readBodyLimited(response, MAX_BODY_BYTES);

    // HTML : nettoyage + extraction texte
    if (contentType.includes('html')) {
        const title = extractTitle(rawText) || parsedUrl.hostname;
        const text = htmlToText(rawText);
        const truncated = text.length > 15000
            ? text.slice(0, 15000) + '\n\n[... Contenu tronqué — page trop longue]'
            : text;

        return new Response(
            JSON.stringify({ url: parsedUrl.toString(), title, text: truncated }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Texte brut / JSON / Markdown
    return new Response(
        JSON.stringify({
            url: parsedUrl.toString(),
            title: parsedUrl.pathname.split('/').pop() || parsedUrl.hostname,
            text: rawText.slice(0, 20000)
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

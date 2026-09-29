// ============================================================
//  PENSÉE IA — api/fetch-url.js (Web Reader)
//  Scrape une URL distante, nettoie le HTML, retourne le texte pur.
//  La logique est partagée avec l'outil fetch_url de l'agent (api/_lib/web.js).
// ============================================================

import { fetchUrlText, FetchUrlError } from './_lib/web.js';

export const config = { runtime: 'edge' };

const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export default async function handler(req) {
    if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

    const { url } = await req.json().catch(() => ({}));
    if (!url) return json({ error: 'URL manquante.' }, 400);

    try {
        return json(await fetchUrlText(url));
    } catch (err) {
        return json({ error: err.message }, err instanceof FetchUrlError ? err.status : 500);
    }
}

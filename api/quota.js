// ============================================================
//  PENSÉE IA — api/quota.js
//  État du quota de l'utilisateur (fenêtre glissante) pour l'affichage.
//  { mode: 'quota', quota: { used, limit, resetAt, hours } } ou { mode: 'legacy' }
// ============================================================

import { authenticate, quotaStatus } from './_lib/auth.js';

export const config = { runtime: 'edge' };

const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export default async function handler(req) {
    try {
        const { userId } = await authenticate(req);
        const quota = await quotaStatus(userId);
        return json(quota ? { mode: 'quota', quota } : { mode: 'legacy' });
    } catch (e) {
        return json({ error: e.message }, e.status || 500);
    }
}

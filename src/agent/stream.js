// ============================================================
//  PENSÉE IA — src/agent/stream.js
//  Client du flux NDJSON de /api/chat : une ligne = un événement.
// ============================================================

import { getAccessToken } from '../supabase.js';

export class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

/**
 * @param {object} body
 * @param {object} o
 * @param {AbortSignal} o.signal
 * @param {(event: object) => void} o.onEvent
 */
export async function streamChat(body, { signal, onEvent }) {
    const token = await getAccessToken();
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
        signal,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new ApiError(res.status, err.error || `Erreur HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const flushLine = (line) => {
        if (!line.trim()) return;
        let ev;
        try { ev = JSON.parse(line); } catch { return; }
        onEvent(ev);
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
            flushLine(buf.slice(0, nl));
            buf = buf.slice(nl + 1);
        }
    }
    flushLine(buf + decoder.decode());
}

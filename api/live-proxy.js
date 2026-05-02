// ============================================================
//  PENSÉE IA — api/live-proxy.js
//  Proxy WebSocket sécurisé → Gemini Live API
//  Masque la clé GEMINI_API_KEY côté serveur
//  Compatible Vercel Edge Runtime (Node.js WebSocket)
// ============================================================

// Vercel Edge ne supporte pas les WebSockets natifs.
// Ce fichier tourne en Node.js runtime standard avec le package 'ws'.
// Il agit comme un proxy WebSocket : Client ↔ Ce proxy ↔ Gemini Live API

export const config = { runtime: 'nodejs' };

import { WebSocketServer, WebSocket } from 'ws';

// Modèle recommandé — mai 2026
// gemini-3.1-flash-live-preview = le plus récent, low-latency, thinking intégré
// Fallback : gemini-2.5-flash-native-audio
const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`;

// Cache du serveur WebSocket pour éviter de le recréer à chaque invocation
let wss = null;

export default function handler(req, res) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        res.status(401).json({ error: 'Clé API absente.' });
        return;
    }

    // Upgrade HTTP → WebSocket
    if (!res.socket?.server) {
        res.status(400).json({ error: 'Connexion WebSocket requise.' });
        return;
    }

    if (!wss) {
        wss = new WebSocketServer({ noServer: true });

        wss.on('connection', (clientWs, request) => {
            console.log('[LiveProxy] Client connecté');

            // Connexion vers Gemini Live API avec la clé sécurisée
            const geminiWs = new WebSocket(
                `${GEMINI_WS_URL}?key=${GEMINI_API_KEY}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            geminiWs.on('open', () => {
                console.log('[LiveProxy] Gemini connecté');
                // Signal au client que la connexion Gemini est prête
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: 'proxy_ready' }));
                }
            });

            // Gemini → Client : retransmet tous les messages
            geminiWs.on('message', (data) => {
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(data);
                }
            });

            // Client → Gemini : retransmet tous les messages
            clientWs.on('message', (data) => {
                if (geminiWs.readyState === WebSocket.OPEN) {
                    geminiWs.send(data);
                }
            });

            // Gestion des fermetures propres
            geminiWs.on('close', (code, reason) => {
                console.log(`[LiveProxy] Gemini fermé (${code})`);
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.close(code, reason);
                }
            });

            clientWs.on('close', () => {
                console.log('[LiveProxy] Client déconnecté');
                if (geminiWs.readyState === WebSocket.OPEN) {
                    geminiWs.close();
                }
            });

            geminiWs.on('error', (err) => {
                console.error('[LiveProxy] Erreur Gemini :', err.message);
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                        type: 'proxy_error',
                        message: `Erreur Gemini : ${err.message}`
                    }));
                }
            });

            clientWs.on('error', (err) => {
                console.error('[LiveProxy] Erreur client :', err.message);
            });
        });
    }

    // Upgrade de la connexion HTTP → WebSocket
    res.socket.server.on('upgrade', (request, socket, head) => {
        if (request.url === '/api/live-proxy') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        }
    });

    res.end();
}

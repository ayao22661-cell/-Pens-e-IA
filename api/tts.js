// ============================================================
//  PENSÉE IA — api/tts.js
//  TTS : ElevenLabs → Google WaveNet → Web Speech (fallback client)
// ============================================================

export const config = { runtime: 'edge' };

export default async function handler(req) {
    if (req.method !== "POST") {
        return new Response("Méthode non autorisée", { status: 405 });
    }

    const body = await req.json().catch(() => ({}));
    const { text } = body;

    if (!text || !text.trim()) {
        return new Response(JSON.stringify({ error: "Texte manquant." }), { status: 400 });
    }

    // Tronque à 5000 chars pour éviter les coûts excessifs
    const cleanText = text.slice(0, 5000);

    const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;
    const GOOGLE_TTS_KEY = process.env.GOOGLE_TTS_API_KEY;

    // ── TENTATIVE 1 : ElevenLabs (voix la plus naturelle) ─────
    if (ELEVENLABS_KEY) {
        try {
            const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
            const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "xi-api-key": ELEVENLABS_KEY
                },
                body: JSON.stringify({
                    text: cleanText,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                }),
                signal: AbortSignal.timeout(15000)
            });

            if (res.ok) {
                const audioBuffer = await res.arrayBuffer();
                return new Response(audioBuffer, {
                    status: 200,
                    headers: {
                        "Content-Type": "audio/mpeg",
                        "X-TTS-Source": "elevenlabs",
                        "Cache-Control": "no-cache"
                    }
                });
            }
        } catch (e) {
            console.warn("ElevenLabs indisponible :", e.message);
        }
    }

    // ── TENTATIVE 2 : Google Cloud TTS WaveNet FR ─────────────
    if (GOOGLE_TTS_KEY) {
        try {
            const res = await fetch(
                `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        input: { text: cleanText },
                        voice: { languageCode: "fr-FR", name: "fr-FR-Wavenet-D" },
                        audioConfig: { audioEncoding: "MP3", speakingRate: 1.05 }
                    }),
                    signal: AbortSignal.timeout(10000)
                }
            );

            if (res.ok) {
                const data = await res.json();
                const binary = atob(data.audioContent);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                return new Response(bytes.buffer, {
                    status: 200,
                    headers: {
                        "Content-Type": "audio/mpeg",
                        "X-TTS-Source": "google-wavenet"
                    }
                });
            }
        } catch (e) {
            console.warn("Google TTS indisponible :", e.message);
        }
    }

    // ── FALLBACK : Signal au client d'utiliser Web Speech API ─
    return new Response(JSON.stringify({ fallback: true, text: cleanText }), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "X-TTS-Source": "webspeech-fallback"
        }
    });
}

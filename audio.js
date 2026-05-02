// ============================================================
//  PENSÉE IA — audio-live.js
//  Extension Audio Native — Gemini Live API (WebSocket)
//  Pipeline : Micro PCM16 → WebSocket → Gemini → PCM24kHz → Haut-parleurs
//  Architecture : module autonome, zéro modification de ia.js
//  Modèle : gemini-3.1-flash-live-preview (recommandé mai 2026)
// ============================================================

// -- CONFIGURATION -----------------------------------------
const LIVE_CONFIG = {
    // Modèle Live API — le plus récent et recommandé
    model: 'gemini-3.1-flash-live-preview',

    // Proxy WebSocket local (masque la clé API)
    // En mode direct (dev local sans backend), basculer sur l'URL Gemini directe
    proxyUrl: (() => {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${location.host}/api/live-proxy`;
    })(),

    // Audio I/O
    inputSampleRate: 16000,   // PCM16 → Gemini (natif)
    outputSampleRate: 24000,  // PCM → haut-parleurs (Gemini répond en 24kHz)
    chunkDurationMs: 100,     // Taille des chunks envoyés (100ms = bon équilibre)

    // Voix Gemini disponibles
    voices: ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck'],
    defaultVoice: 'Aoede',   // Voix féminine, qualité studio

    // Thinking
    thinkingLevel: 'minimal', // minimal | low | medium | high (minimal = latence minimale)

    // Langue de la transcription
    outputTranscriptLang: 'fr-FR',

    storageKey: 'pensee_live_prefs',
    version: '2.0.0'
};

// -- ÉTAT GLOBAL ------------------------------------------
const LiveState = {
    // Connexion
    ws: null,
    isConnected: false,
    isSetupDone: false,

    // UI
    isOpen: false,
    isListening: false,

    // Audio entrée
    audioContext: null,
    mediaStream: null,
    sourceNode: null,
    processorNode: null,

    // Audio sortie
    outputContext: null,
    audioQueue: [],
    isPlaying: false,
    nextPlayTime: 0,

    // Transcriptions
    inputTranscript: '',
    outputTranscript: '',

    // Préférences
    voice: LIVE_CONFIG.defaultVoice,
    thinkingLevel: LIVE_CONFIG.thinkingLevel,
};

// ============================================================
//  INJECTION CSS
// ============================================================
function injectLiveStyles() {
    if (document.getElementById('pensee-live-styles')) return;
    const style = document.createElement('style');
    style.id = 'pensee-live-styles';
    style.textContent = `
        /* -- Bouton header -- */
        #liveAudioBtn {
            background: none;
            border: 1px solid var(--border2);
            color: var(--text2);
            border-radius: 8px;
            padding: 5px 10px;
            font-size: 12px;
            cursor: pointer;
            font-family: 'Syne', sans-serif;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        #liveAudioBtn:hover { border-color: var(--accent); color: var(--accent); }
        #liveAudioBtn.active {
            background: var(--accent-dim);
            border-color: var(--accent);
            color: var(--accent);
        }
        #liveAudioBtn .live-dot {
            width: 7px; height: 7px;
            border-radius: 50%;
            background: currentColor;
        }
        #liveAudioBtn.active .live-dot {
            animation: live-blink 1s ease-in-out infinite;
        }

        /* -- Overlay -- */
        #liveOverlay {
            position: fixed; inset: 0; z-index: 8900;
            display: flex; align-items: center; justify-content: center;
            background: rgba(8,10,15,0.94);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            opacity: 0; pointer-events: none;
            transition: opacity 0.3s cubic-bezier(0.2,0.8,0.2,1);
        }
        #liveOverlay.open { opacity: 1; pointer-events: all; }

        /* -- Carte -- */
        .live-card {
            width: 100%; max-width: 440px; margin: 16px;
            background: var(--bg2);
            border: 1px solid var(--border2);
            border-radius: 28px;
            padding: 36px 28px 28px;
            text-align: center;
            box-shadow: 0 48px 120px rgba(0,0,0,0.85),
                        0 0 0 1px rgba(0,229,160,0.05) inset;
            transform: translateY(20px) scale(0.97);
            transition: transform 0.4s cubic-bezier(0.2,0.8,0.2,1);
            position: relative;
        }
        #liveOverlay.open .live-card {
            transform: translateY(0) scale(1);
        }
        .live-card::before {
            content: '';
            position: absolute; top: 0; left: 12%; right: 12%;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--accent), transparent);
            opacity: 0.7;
        }

        /* -- Bouton fermeture -- */
        .live-close {
            position: absolute; top: 14px; right: 14px;
            width: 28px; height: 28px;
            background: none; border: 1px solid var(--border);
            border-radius: 7px; color: var(--text3); font-size: 13px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
        }
        .live-close:hover { border-color: var(--text2); color: var(--text2); }

        /* -- Titre -- */
        .live-title {
            font-family: 'Fraunces', serif;
            font-size: 22px; font-weight: 300;
            color: var(--text); margin-bottom: 4px; letter-spacing: 0.01em;
        }
        .live-title em { color: var(--accent); font-style: italic; }
        .live-subtitle {
            font-size: 11px; color: var(--text3);
            font-family: 'JetBrains Mono', monospace;
            letter-spacing: 0.1em; margin-bottom: 6px;
            text-transform: uppercase;
        }

        /* -- Badge modèle -- */
        .live-model-badge {
            display: inline-block;
            font-size: 10px; font-family: 'JetBrains Mono', monospace;
            color: var(--accent); background: var(--accent-dim);
            border: 1px solid rgba(0,229,160,0.2);
            border-radius: 5px; padding: 2px 8px;
            margin-bottom: 28px;
        }

        /* -- Visualiseur central -- */
        .live-viz-wrapper {
            position: relative; width: 140px; height: 140px;
            margin: 0 auto 20px;
        }

        /* Canvas pour les barres audio */
        #liveCanvas {
            position: absolute; inset: 0;
            border-radius: 50%;
            pointer-events: none;
        }

        /* Bouton orbe */
        .live-orb {
            position: absolute;
            inset: 18px;
            border-radius: 50%;
            background: radial-gradient(circle at 32% 30%, #00e5a0, #006644);
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.18s, box-shadow 0.3s;
            z-index: 2;
        }
        .live-orb:hover { transform: scale(1.05); }
        .live-orb:active { transform: scale(0.95); }

        .live-orb svg {
            width: 36px; height: 36px; fill: #060810;
            position: absolute; transition: opacity 0.2s;
        }
        .live-orb .icon-mic { opacity: 1; }
        .live-orb .icon-stop { opacity: 0; }
        .live-orb.active .icon-mic { opacity: 0; }
        .live-orb.active .icon-stop { opacity: 1; }

        /* Anneaux animés (état actif) */
        .live-ring {
            position: absolute; inset: 0; border-radius: 50%;
            border: 1.5px solid rgba(0,229,160,0);
            transition: border-color 0.4s;
        }
        .live-orb-wrapper-active .live-ring {
            border-color: rgba(0,229,160,0.3);
            animation: live-ring-expand 2s ease-out infinite;
        }
        .live-orb-wrapper-active .live-ring:nth-child(2) { animation-delay: 0.65s; }
        .live-orb-wrapper-active .live-ring:nth-child(3) { animation-delay: 1.3s; }

        /* -- Status -- */
        .live-status {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px; text-transform: uppercase;
            letter-spacing: 0.12em; color: var(--text3);
            min-height: 16px; margin-bottom: 18px;
            transition: color 0.3s;
        }
        .live-status.listening { color: var(--accent); }
        .live-status.speaking  { color: #7eb8f7; }
        .live-status.connecting { color: var(--yellow); }
        .live-status.error      { color: var(--red); }

        /* -- Zone de transcription -- */
        .live-transcript-area {
            display: grid; grid-template-columns: 1fr 1fr;
            gap: 10px; margin-bottom: 16px;
        }

        .live-transcript-box {
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: 12px; padding: 12px;
            font-size: 12px; line-height: 1.65;
            color: var(--text2); text-align: left;
            min-height: 72px; max-height: 120px;
            overflow-y: auto; position: relative;
            transition: border-color 0.3s;
            font-family: 'Syne', sans-serif;
        }
        .live-transcript-box.active-in {
            border-color: rgba(0,229,160,0.3);
        }
        .live-transcript-box.active-out {
            border-color: rgba(126,184,247,0.3);
            background: linear-gradient(135deg, rgba(0,229,160,0.025), transparent);
        }
        .live-transcript-box::-webkit-scrollbar { width: 2px; }
        .live-transcript-box::-webkit-scrollbar-thumb { background: var(--border2); }

        .live-box-label {
            font-size: 9px; text-transform: uppercase;
            letter-spacing: 0.1em; color: var(--text3);
            font-family: 'JetBrains Mono', monospace;
            margin-bottom: 6px; display: block;
        }

        .live-transcript-text {
            color: var(--text2);
        }
        .live-transcript-text.empty {
            color: var(--text3); font-style: italic; font-size: 11px;
        }

        /* -- Contrôles -- */
        .live-controls {
            display: flex; gap: 8px; align-items: center;
            justify-content: center; flex-wrap: wrap;
        }

        .live-ctrl {
            background: var(--bg3); border: 1px solid var(--border2);
            color: var(--text2); border-radius: 9px;
            padding: 7px 12px; font-size: 11px;
            font-family: 'Syne', sans-serif; cursor: pointer;
            transition: all 0.2s; display: flex; align-items: center; gap: 5px;
        }
        .live-ctrl:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
        .live-ctrl.danger:hover { border-color: var(--red); color: var(--red); background: rgba(255,95,95,0.07); }
        .live-ctrl.active { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }

        /* -- Sélecteur de voix -- */
        .live-voice-select {
            background: var(--bg3); border: 1px solid var(--border2);
            color: var(--text2); border-radius: 9px;
            padding: 7px 10px; font-size: 11px;
            font-family: 'Syne', sans-serif; cursor: pointer;
            outline: none; transition: border-color 0.2s;
        }
        .live-voice-select:hover { border-color: var(--accent); }
        .live-voice-select option { background: var(--bg2); }

        /* -- Indicateur connexion -- */
        .live-conn-indicator {
            position: absolute; top: 14px; left: 14px;
            display: flex; align-items: center; gap: 6px;
            font-size: 10px; font-family: 'JetBrains Mono', monospace;
            color: var(--text3);
        }
        .live-conn-dot {
            width: 6px; height: 6px; border-radius: 50%;
            background: var(--text3); transition: background 0.3s;
        }
        .live-conn-dot.connected { background: var(--accent); animation: live-blink 2s ease-in-out infinite; }
        .live-conn-dot.error { background: var(--red); }

        /* -- ANIMATIONS -- */
        @keyframes live-ring-expand {
            0%   { transform: scale(1); opacity: 0.6; }
            100% { transform: scale(2); opacity: 0; }
        }
        @keyframes live-blink {
            0%,100% { opacity: 1; }
            50%      { opacity: 0.3; }
        }
        @keyframes live-orb-pulse {
            0%,100% { box-shadow: 0 0 16px 4px rgba(0,229,160,0.2); }
            50%      { box-shadow: 0 0 36px 12px rgba(0,229,160,0.42); }
        }
        .live-orb.active { animation: live-orb-pulse 1.8s ease-in-out infinite; }
    `;
    document.head.appendChild(style);
}

// ============================================================
//  CONSTRUCTION DU DOM
// ============================================================
function buildLiveOverlay() {
    // Bouton dans le header
    const headerRight = document.querySelector('.header-right');
    if (headerRight && !document.getElementById('liveAudioBtn')) {
        const btn = document.createElement('button');
        btn.id = 'liveAudioBtn';
        btn.title = 'Mode vocal natif Gemini Live';
        btn.innerHTML = `<span class="live-dot"></span> Live`;
        headerRight.insertBefore(btn, headerRight.firstChild);
        btn.addEventListener('click', toggleLiveOverlay);
    }

    // Overlay
    if (document.getElementById('liveOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'liveOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
        <div class="live-card">

            <!-- Indicateur de connexion -->
            <div class="live-conn-indicator">
                <div class="live-conn-dot" id="liveConnDot"></div>
                <span id="liveConnLabel">Déconnecté</span>
            </div>

            <!-- Fermeture -->
            <button class="live-close" id="liveCloseBtn">✕</button>

            <!-- En-tête -->
            <div class="live-title"><em>Pensée</em> Live</div>
            <div class="live-subtitle">Audio natif · Gemini Live API</div>
            <div class="live-model-badge" id="liveModelBadge">gemini-3.1-flash-live-preview</div>

            <!-- Visualiseur audio -->
            <div class="live-viz-wrapper" id="liveVizWrapper">
                <canvas id="liveCanvas" width="140" height="140"></canvas>
                <div class="live-ring"></div>
                <div class="live-ring"></div>
                <div class="live-ring"></div>
                <div class="live-orb" id="liveOrb" role="button" tabindex="0">
                    <!-- Micro -->
                    <svg class="icon-mic" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    <!-- Stop -->
                    <svg class="icon-stop" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                </div>
            </div>

            <!-- Status -->
            <div class="live-status" id="liveStatus">Clique pour démarrer</div>

            <!-- Transcriptions -->
            <div class="live-transcript-area">
                <div class="live-transcript-box" id="liveInputBox">
                    <span class="live-box-label">🎤 Toi</span>
                    <div class="live-transcript-text empty" id="liveInputText">…</div>
                </div>
                <div class="live-transcript-box" id="liveOutputBox">
                    <span class="live-box-label">🤖 Pensée</span>
                    <div class="live-transcript-text empty" id="liveOutputText">…</div>
                </div>
            </div>

            <!-- Contrôles -->
            <div class="live-controls">
                <select class="live-voice-select" id="liveVoiceSelect" title="Voix Gemini">
                    ${LIVE_CONFIG.voices.map(v =>
                        `<option value="${v}" ${v === LIVE_CONFIG.defaultVoice ? 'selected' : ''}>${v}</option>`
                    ).join('')}
                </select>

                <button class="live-ctrl" id="liveMuteBtn" title="Couper le micro">
                    🎤 Micro
                </button>
                <button class="live-ctrl danger" id="liveDisconnectBtn" title="Terminer la session" style="display:none">
                    ⏹ Fin
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeLiveOverlay(); });
}

// ============================================================
//  CONNEXION WEBSOCKET → GEMINI LIVE API
// ============================================================
async function connectToGeminiLive() {
    if (LiveState.ws && LiveState.isConnected) return;

    setStatus('Connexion…', 'connecting');
    updateConnIndicator('connecting');

    return new Promise((resolve, reject) => {
        const ws = new WebSocket(LIVE_CONFIG.proxyUrl);
        LiveState.ws = ws;

        ws.onopen = () => {
            console.log('[Live] WebSocket connecté');
        };

        ws.onmessage = (event) => {
            handleGeminiMessage(event.data);

            // La première fois : attendre le signal proxy_ready puis envoyer le setup
            if (!LiveState.isSetupDone) {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'proxy_ready') {
                        sendSetupMessage();
                        resolve();
                    }
                } catch (_) {}
            }
        };

        ws.onerror = (err) => {
            console.error('[Live] Erreur WS :', err);
            setStatus('Erreur de connexion', 'error');
            updateConnIndicator('error');
            reject(err);
        };

        ws.onclose = (event) => {
            console.log(`[Live] WS fermé (${event.code})`);
            LiveState.isConnected = false;
            LiveState.isSetupDone = false;
            LiveState.ws = null;

            if (LiveState.isOpen) {
                setStatus('Déconnecté — Reconnexion auto…', 'error');
                updateConnIndicator('disconnected');
                setTimeout(() => {
                    if (LiveState.isOpen) connectToGeminiLive().catch(console.warn);
                }, 2000);
            }
        };
    });
}

// -- Message de configuration Gemini Live -----------------
function sendSetupMessage() {
    const agentSystemPrompt = buildVoiceSystemPrompt();

    const setupMsg = {
        setup: {
            model: LIVE_CONFIG.model,
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: LiveState.voice
                        }
                    }
                },
                // Transcription de la sortie audio
                outputAudioTranscription: {}
            },
            systemInstruction: {
                parts: [{ text: agentSystemPrompt }]
            },
            // Paramètres de thinking (gemini-3.1)
            thinkingConfig: {
                thinkingLevel: LiveState.thinkingLevel
            },
            // Détection vocale automatique (VAD) — Gemini gère le silence
            realtimeInputConfig: {
                automaticActivityDetection: {
                    disabled: false
                }
            }
        }
    };

    LiveState.ws.send(JSON.stringify(setupMsg));
    LiveState.isSetupDone = true;
    LiveState.isConnected = true;

    setStatus('Prêt · Parle maintenant', 'listening');
    updateConnIndicator('connected');
    updateOrbActive(true);
    showDisconnectBtn(true);
}

// -- Prompt système adapté au mode vocal -----------------
function buildVoiceSystemPrompt() {
    const basePrompt = typeof window.CONFIG?.systemPrompt === 'string'
        ? window.CONFIG.systemPrompt
        : `Tu es PENSÉE — intelligence artificielle de précision, conçue par Yao Baba Ange Emmanuel.`;

    const agentId = typeof window.activeAgentId !== 'undefined'
        ? window.activeAgentId
        : null;

    const agentLayer = agentId && typeof window.AGENTS_CONFIG !== 'undefined'
        ? (window.AGENTS_CONFIG[agentId]?.systemOverride || '')
        : '';

    const today = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return `[DATE : ${today}]

${basePrompt}${agentLayer}

--- MODE VOCAL NATIF ---
Tu opères en conversation vocale temps réel via Gemini Live API.
RÈGLES ABSOLUES POUR CE MODE :
- Réponses orales : 2 à 5 phrases maximum, sauf si on te demande explicitement plus.
- ZÉRO markdown, ZÉRO astérisque, ZÉRO puces. Tu parles, tu n'écris pas.
- Commence immédiatement avec la réponse — aucune introduction.
- Prononce les chiffres, les formules et les abréviations en toutes lettres.
- Adapte ton débit : questions simples = réponse rapide ; questions complexes = structurée mais concise.
- Si une réponse complète nécessite du code ou un long développement, résume oralement l'essentiel et propose de continuer en mode texte.
- Ton ton reste expert, tranchant, humain.`;
}

// ============================================================
//  GESTION DES MESSAGES GEMINI ENTRANTS
// ============================================================
function handleGeminiMessage(rawData) {
    let msg;
    try {
        msg = JSON.parse(rawData);
    } catch (_) { return; }

    // Message de setup confirmé
    if (msg.setupComplete) {
        console.log('[Live] Setup Gemini confirmé');
        return;
    }

    // Contenu du modèle (audio + transcription)
    const serverContent = msg.serverContent;
    if (!serverContent) return;

    // -- Audio PCM16 de Gemini → lecture ------------------
    const parts = serverContent.modelTurn?.parts || [];
    for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('audio/')) {
            const audioBase64 = part.inlineData.data;
            const pcmData = base64ToPCM(audioBase64);
            enqueueAudio(pcmData);
            setStatus('Pensée parle…', 'speaking');
        }
    }

    // -- Transcription de la sortie (ce que Gemini dit) --
    if (serverContent.outputTranscription?.text) {
        appendOutputTranscript(serverContent.outputTranscription.text);
    }

    // -- Transcription de l'entrée (ce que l'utilisateur dit) --
    if (serverContent.inputTranscription?.text) {
        appendInputTranscript(serverContent.inputTranscription.text);
    }

    // -- Fin du tour de parole de Gemini ------------------
    if (serverContent.turnComplete) {
        console.log('[Live] Tour Gemini terminé');
        if (!LiveState.isPlaying) {
            setStatus('Parle maintenant', 'listening');
        }
    }

    // -- Interruption (barge-in) ---------------------------
    if (serverContent.interrupted) {
        console.log('[Live] Barge-in détecté');
        clearAudioQueue();
        setStatus('Écoute…', 'listening');
    }
}

// ============================================================
//  CAPTURE MICRO → STREAM PCM16 VERS GEMINI
// ============================================================
async function startMicCapture() {
    if (LiveState.mediaStream) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: LIVE_CONFIG.inputSampleRate,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        LiveState.mediaStream = stream;
        LiveState.isListening = true;

        // AudioContext pour traitement PCM
        LiveState.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: LIVE_CONFIG.inputSampleRate
        });

        LiveState.sourceNode = LiveState.audioContext.createMediaStreamSource(stream);

        // ScriptProcessor pour extraire les samples raw
        // Note : AudioWorklet serait mieux en prod, ScriptProcessor fonctionne partout
        const bufferSize = Math.round(LIVE_CONFIG.inputSampleRate * LIVE_CONFIG.chunkDurationMs / 1000);
        LiveState.processorNode = LiveState.audioContext.createScriptProcessor(4096, 1, 1);

        let accumulator = new Float32Array(0);
        const targetChunkSize = bufferSize;

        LiveState.processorNode.onaudioprocess = (e) => {
            if (!LiveState.isListening || !LiveState.isConnected) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const combined = new Float32Array(accumulator.length + inputData.length);
            combined.set(accumulator);
            combined.set(inputData, accumulator.length);

            // Envoie par chunks de la bonne taille
            let offset = 0;
            while (offset + targetChunkSize <= combined.length) {
                const chunk = combined.slice(offset, offset + targetChunkSize);
                sendAudioChunk(chunk);
                offset += targetChunkSize;
            }
            accumulator = combined.slice(offset);
        };

        LiveState.sourceNode.connect(LiveState.processorNode);
        LiveState.processorNode.connect(LiveState.audioContext.destination);

        // Démarrer le canvas visualiseur
        startVisualizer(stream);

        setStatus('Écoute…', 'listening');
        updateOrbActive(true);

    } catch (err) {
        console.error('[Live] Micro refusé :', err);
        setStatus('Micro non autorisé', 'error');
    }
}

function stopMicCapture() {
    if (LiveState.processorNode) {
        LiveState.processorNode.disconnect();
        LiveState.processorNode = null;
    }
    if (LiveState.sourceNode) {
        LiveState.sourceNode.disconnect();
        LiveState.sourceNode = null;
    }
    if (LiveState.mediaStream) {
        LiveState.mediaStream.getTracks().forEach(t => t.stop());
        LiveState.mediaStream = null;
    }
    if (LiveState.audioContext) {
        LiveState.audioContext.close().catch(() => {});
        LiveState.audioContext = null;
    }
    LiveState.isListening = false;
    stopVisualizer();
    updateOrbActive(false);
}

// -- Envoi d'un chunk audio PCM16 à Gemini ----------------
function sendAudioChunk(float32Chunk) {
    if (!LiveState.ws || LiveState.ws.readyState !== WebSocket.OPEN) return;

    const pcm16 = float32ToPCM16(float32Chunk);
    const base64 = pcm16ToBase64(pcm16);

    const msg = {
        realtimeInput: {
            mediaChunks: [{
                mimeType: `audio/pcm;rate=${LIVE_CONFIG.inputSampleRate}`,
                data: base64
            }]
        }
    };

    LiveState.ws.send(JSON.stringify(msg));
}

// ============================================================
//  LECTURE AUDIO PCM24kHz (sortie Gemini)
// ============================================================
function initOutputAudioContext() {
    if (LiveState.outputContext) return;
    LiveState.outputContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: LIVE_CONFIG.outputSampleRate
    });
    LiveState.nextPlayTime = LiveState.outputContext.currentTime;
}

function enqueueAudio(pcm16Data) {
    initOutputAudioContext();

    // Convertit PCM16 → Float32 pour Web Audio API
    const float32 = pcm16ToFloat32(pcm16Data);

    // Crée un AudioBuffer
    const buffer = LiveState.outputContext.createBuffer(
        1,
        float32.length,
        LIVE_CONFIG.outputSampleRate
    );
    buffer.getChannelData(0).set(float32);

    // Planifie la lecture en séquence gapless
    const source = LiveState.outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(LiveState.outputContext.destination);

    const startTime = Math.max(
        LiveState.outputContext.currentTime,
        LiveState.nextPlayTime
    );
    source.start(startTime);
    LiveState.nextPlayTime = startTime + buffer.duration;

    LiveState.isPlaying = true;
    source.onended = () => {
        if (LiveState.nextPlayTime <= LiveState.outputContext.currentTime + 0.05) {
            LiveState.isPlaying = false;
            if (LiveState.isOpen && LiveState.isConnected) {
                setStatus('Parle maintenant', 'listening');
            }
        }
    };
}

function clearAudioQueue() {
    if (LiveState.outputContext) {
        // Crée un nouveau contexte pour annuler tous les sons en cours
        LiveState.outputContext.close().catch(() => {});
        LiveState.outputContext = null;
        LiveState.isPlaying = false;
        LiveState.nextPlayTime = 0;
    }
}

// ============================================================
//  VISUALISEUR CANVAS (barres de niveaux micro)
// ============================================================
let vizAnimId = null;
let analyser = null;

function startVisualizer(stream) {
    const canvas = document.getElementById('liveCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const vizContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = vizContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;

    const source = vizContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = 52;
    const barCount = 36;

    function draw() {
        vizAnimId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < barCount; i++) {
            const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
            const value = data[Math.floor(i * data.length / barCount)] / 255;
            const barLen = 6 + value * 28;

            const x1 = cx + Math.cos(angle) * radius;
            const y1 = cy + Math.sin(angle) * radius;
            const x2 = cx + Math.cos(angle) * (radius + barLen);
            const y2 = cy + Math.sin(angle) * (radius + barLen);

            const alpha = 0.35 + value * 0.65;
            ctx.strokeStyle = `rgba(0, 229, 160, ${alpha})`;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
    }

    draw();
}

function stopVisualizer() {
    if (vizAnimId) {
        cancelAnimationFrame(vizAnimId);
        vizAnimId = null;
    }
    const canvas = document.getElementById('liveCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// ============================================================
//  GESTION DE L'OVERLAY
// ============================================================
function toggleLiveOverlay() {
    if (LiveState.isOpen) {
        closeLiveOverlay();
    } else {
        openLiveOverlay();
    }
}

async function openLiveOverlay() {
    LiveState.isOpen = true;

    const overlay = document.getElementById('liveOverlay');
    const btn = document.getElementById('liveAudioBtn');
    overlay?.classList.add('open');
    btn?.classList.add('active');

    // Connexion + capture micro en parallèle
    try {
        await connectToGeminiLive();
        await startMicCapture();
    } catch (err) {
        console.error('[Live] Erreur ouverture :', err);
        setStatus('Erreur — vérifie la console', 'error');
    }
}

function closeLiveOverlay() {
    LiveState.isOpen = false;

    // Arrêt propre
    stopMicCapture();
    clearAudioQueue();

    if (LiveState.ws) {
        LiveState.ws.close();
        LiveState.ws = null;
    }
    LiveState.isConnected = false;
    LiveState.isSetupDone = false;

    const overlay = document.getElementById('liveOverlay');
    const btn = document.getElementById('liveAudioBtn');
    overlay?.classList.remove('open');
    btn?.classList.remove('active');

    updateConnIndicator('disconnected');
    updateOrbActive(false);
    showDisconnectBtn(false);
}

// -- Toggle micro (mute/unmute) ----------------------------
let isMuted = false;
function toggleMicMute() {
    isMuted = !isMuted;
    if (LiveState.mediaStream) {
        LiveState.mediaStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
    }
    const btn = document.getElementById('liveMuteBtn');
    if (btn) {
        btn.textContent = isMuted ? '🔇 Muet' : '🎤 Micro';
        btn.classList.toggle('active', isMuted);
    }
}

// -- Barge-in : l'utilisateur interrompt Gemini -----------
function handleBargeIn() {
    if (LiveState.isPlaying) {
        clearAudioQueue();
        // Signal à Gemini d'arrêter
        if (LiveState.ws?.readyState === WebSocket.OPEN) {
            LiveState.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
        }
    }
}

// ============================================================
//  UTILITAIRES UI
// ============================================================
function setStatus(text, cssClass) {
    const el = document.getElementById('liveStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'live-status' + (cssClass ? ' ' + cssClass : '');
}

function updateConnIndicator(state) {
    const dot = document.getElementById('liveConnDot');
    const label = document.getElementById('liveConnLabel');
    if (!dot || !label) return;

    dot.className = 'live-conn-dot';
    const map = {
        connected:    { cls: 'connected', text: 'Connecté' },
        connecting:   { cls: '',          text: 'Connexion…' },
        error:        { cls: 'error',     text: 'Erreur' },
        disconnected: { cls: '',          text: 'Déconnecté' }
    };
    const s = map[state] || map.disconnected;
    dot.classList.add(s.cls);
    label.textContent = s.text;
}

function updateOrbActive(active) {
    const orb = document.getElementById('liveOrb');
    const wrapper = document.getElementById('liveVizWrapper');
    orb?.classList.toggle('active', active);
    wrapper?.classList.toggle('live-orb-wrapper-active', active);
}

function showDisconnectBtn(show) {
    const btn = document.getElementById('liveDisconnectBtn');
    if (btn) btn.style.display = show ? 'flex' : 'none';
}

function appendInputTranscript(text) {
    LiveState.inputTranscript += ' ' + text;
    const el = document.getElementById('liveInputText');
    if (el) {
        el.textContent = LiveState.inputTranscript.trim();
        el.classList.remove('empty');
        document.getElementById('liveInputBox')?.classList.add('active-in');
        el.parentElement.scrollTop = el.parentElement.scrollHeight;
    }
}

function appendOutputTranscript(text) {
    LiveState.outputTranscript += ' ' + text;
    const el = document.getElementById('liveOutputText');
    if (el) {
        el.textContent = LiveState.outputTranscript.trim();
        el.classList.remove('empty');
        document.getElementById('liveOutputBox')?.classList.add('active-out');
        el.parentElement.scrollTop = el.parentElement.scrollHeight;
    }
}

function clearTranscripts() {
    LiveState.inputTranscript = '';
    LiveState.outputTranscript = '';
    ['liveInputText', 'liveOutputText'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '…'; el.classList.add('empty'); }
    });
    document.getElementById('liveInputBox')?.classList.remove('active-in');
    document.getElementById('liveOutputBox')?.classList.remove('active-out');
}

// ============================================================
//  CONVERSIONS AUDIO
// ============================================================

// Float32 [-1,1] → Int16 PCM
function float32ToPCM16(float32Array) {
    const int16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
}

// Int16 PCM → Base64
function pcm16ToBase64(int16Array) {
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Base64 → Int16 PCM
function base64ToPCM(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
}

// Int16 PCM → Float32 [-1,1] pour Web Audio
function pcm16ToFloat32(int16Array) {
    const float32 = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        float32[i] = int16Array[i] / 32768.0;
    }
    return float32;
}

// ============================================================
//  BINDING DES ÉVÉNEMENTS
// ============================================================
function bindLiveEvents() {
    document.getElementById('liveCloseBtn')?.addEventListener('click', closeLiveOverlay);
    document.getElementById('liveOverlay')?.addEventListener('click', e => {
        if (e.target.id === 'liveOverlay') closeLiveOverlay();
    });

    // Clic sur l'orbe : barge-in si Gemini parle
    document.getElementById('liveOrb')?.addEventListener('click', () => {
        if (LiveState.isPlaying) handleBargeIn();
    });
    document.getElementById('liveOrb')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (LiveState.isPlaying) handleBargeIn();
        }
    });

    // Mute micro
    document.getElementById('liveMuteBtn')?.addEventListener('click', toggleMicMute);

    // Déconnexion
    document.getElementById('liveDisconnectBtn')?.addEventListener('click', closeLiveOverlay);

    // Changement de voix (nécessite reconnexion)
    document.getElementById('liveVoiceSelect')?.addEventListener('change', (e) => {
        LiveState.voice = e.target.value;
        savePrefs();
        if (LiveState.isConnected) {
            // Reconnexion pour appliquer la nouvelle voix
            closeLiveOverlay();
            setTimeout(() => openLiveOverlay(), 400);
        }
    });

    // Touche Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && LiveState.isOpen) closeLiveOverlay();
    });
}

// ============================================================
//  PERSISTANCE
// ============================================================
function savePrefs() {
    try {
        localStorage.setItem(LIVE_CONFIG.storageKey, JSON.stringify({
            voice: LiveState.voice,
            thinkingLevel: LiveState.thinkingLevel
        }));
    } catch (_) {}
}

function loadPrefs() {
    try {
        const raw = localStorage.getItem(LIVE_CONFIG.storageKey);
        if (raw) {
            const p = JSON.parse(raw);
            if (p.voice && LIVE_CONFIG.voices.includes(p.voice)) {
                LiveState.voice = p.voice;
                const sel = document.getElementById('liveVoiceSelect');
                if (sel) sel.value = p.voice;
            }
            if (p.thinkingLevel) LiveState.thinkingLevel = p.thinkingLevel;
        }
    } catch (_) {}
}

// ============================================================
//  INIT
// ============================================================
function initLiveAudio() {
    injectLiveStyles();
    buildLiveOverlay();
    bindLiveEvents();
    loadPrefs();

    // API publique pour interopérabilité
    window.PenseeLive = {
        open: openLiveOverlay,
        close: closeLiveOverlay,
        isOpen: () => LiveState.isOpen,
        isConnected: () => LiveState.isConnected,
        version: LIVE_CONFIG.version,
        model: LIVE_CONFIG.model
    };

    console.log(`[Pensée Live] v${LIVE_CONFIG.version} · Modèle: ${LIVE_CONFIG.model}`);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLiveAudio);
} else {
    initLiveAudio();
}

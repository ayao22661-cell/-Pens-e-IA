// ============================================================
//  PENSEE IA - audio.js
//  Mode vocal : Web Speech API (reconnaissance) + TTS (synthese)
//  Pipeline : Micro -> Texte -> /api/chat -> Lecture vocale
//  Aucun backend supplementaire requis
// ============================================================

const AUDIO_CONFIG = {
    lang: 'fr-FR',
    voiceRate: 1.05,
    voicePitch: 1.0,
    voiceVolume: 1.0,
    version: '3.0.1'
};

const AudioState = {
    isOpen: false,
    isListening: false,
    isSpeaking: false,
    recognition: null,
    synth: window.speechSynthesis,
    currentUtterance: null,
    voices: [],
    selectedVoice: null,
    finalTranscript: ''
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const supported = !!SpeechRecognition && !!window.speechSynthesis;

// ============================================================
//  CSS
// ============================================================
function injectStyles() {
    if (document.getElementById('pensee-audio-styles')) return;
    const style = document.createElement('style');
    style.id = 'pensee-audio-styles';
    style.textContent = `
        #liveAudioBtn { background:none; border:1px solid var(--border2); color:var(--text2); border-radius:8px; padding:5px 10px; font-size:12px; cursor:pointer; font-family:'Syne',sans-serif; transition:all 0.2s; display:flex; align-items:center; gap:6px; }
        #liveAudioBtn:hover { border-color:var(--accent); color:var(--accent); }
        #liveAudioBtn.active { background:var(--accent-dim); border-color:var(--accent); color:var(--accent); }
        #liveAudioBtn .live-dot { width:7px; height:7px; border-radius:50%; background:currentColor; }
        #liveAudioBtn.active .live-dot { animation:audio-blink 1s ease-in-out infinite; }

        #audioOverlay { position:fixed; inset:0; z-index:8900; display:flex; align-items:center; justify-content:center; background:rgba(8,10,15,0.94); backdrop-filter:blur(24px); opacity:0; pointer-events:none; transition:opacity 0.3s; }
        #audioOverlay.open { opacity:1; pointer-events:all; }

        .audio-card { width:100%; max-width:420px; margin:16px; background:var(--bg2); border:1px solid var(--border2); border-radius:28px; padding:36px 28px 28px; text-align:center; box-shadow:0 48px 120px rgba(0,0,0,0.85); transform:translateY(20px) scale(0.97); transition:transform 0.4s cubic-bezier(0.2,0.8,0.2,1); position:relative; }
        #audioOverlay.open .audio-card { transform:translateY(0) scale(1); }
        .audio-card::before { content:''; position:absolute; top:0; left:12%; right:12%; height:1px; background:linear-gradient(90deg,transparent,var(--accent),transparent); opacity:0.7; }

        .audio-close { position:absolute; top:14px; right:14px; width:28px; height:28px; background:none; border:1px solid var(--border); border-radius:7px; color:var(--text3); font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s; }
        .audio-close:hover { border-color:var(--text2); color:var(--text2); }

        .audio-title { font-family:'Fraunces',serif; font-size:22px; font-weight:300; color:var(--text); margin-bottom:4px; }
        .audio-title em { color:var(--accent); font-style:italic; }
        .audio-subtitle { font-size:11px; color:var(--text3); font-family:'JetBrains Mono',monospace; letter-spacing:0.1em; margin-bottom:24px; text-transform:uppercase; }

        .audio-orb-wrapper { position:relative; width:120px; height:120px; margin:0 auto 16px; }
        .audio-ring { position:absolute; inset:0; border-radius:50%; border:1.5px solid rgba(0,229,160,0); transition:border-color 0.4s; pointer-events:none; }
        .audio-orb-wrapper.active .audio-ring { border-color:rgba(0,229,160,0.3); animation:ring-expand 2s ease-out infinite; }
        .audio-orb-wrapper.active .audio-ring:nth-child(2) { animation-delay:0.65s; }
        .audio-orb-wrapper.active .audio-ring:nth-child(3) { animation-delay:1.3s; }
        .audio-orb-wrapper.speaking .audio-ring { border-color:rgba(126,184,247,0.3); animation:ring-expand 2s ease-out infinite; }

        .audio-orb { position:absolute; inset:10px; border-radius:50%; background:radial-gradient(circle at 32% 30%,#00e5a0,#006644); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:transform 0.18s,box-shadow 0.3s; z-index:2; border:none; }
        .audio-orb:hover { transform:scale(1.05); }
        .audio-orb:active { transform:scale(0.95); }
        .audio-orb svg { width:32px; height:32px; fill:#060810; transition:opacity 0.2s; position:absolute; }
        .audio-orb .icon-mic { opacity:1; }
        .audio-orb .icon-stop { opacity:0; }
        .audio-orb.listening .icon-mic { opacity:0; }
        .audio-orb.listening .icon-stop { opacity:1; }
        .audio-orb.listening { animation:orb-pulse 1.8s ease-in-out infinite; }
        .audio-orb.speaking { background:radial-gradient(circle at 32% 30%,#7eb8f7,#1a4a8a); animation:orb-pulse-blue 1.8s ease-in-out infinite; }
        .audio-orb.speaking .icon-mic { opacity:0; }
        .audio-orb.speaking .icon-stop { opacity:1; }
        .audio-orb.thinking { opacity:0.6; cursor:default; }

        .audio-status { font-family:'JetBrains Mono',monospace; font-size:11px; text-transform:uppercase; letter-spacing:0.12em; color:var(--text3); min-height:16px; margin-bottom:16px; transition:color 0.3s; }
        .audio-status.listening { color:var(--accent); }
        .audio-status.speaking { color:#7eb8f7; }
        .audio-status.thinking { color:var(--yellow); }
        .audio-status.error { color:var(--red); }

        .audio-transcript-area { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
        .audio-transcript-box { background:var(--bg3); border:1px solid var(--border); border-radius:12px; padding:12px; font-size:12px; line-height:1.65; color:var(--text2); text-align:left; min-height:72px; max-height:120px; overflow-y:auto; transition:border-color 0.3s; font-family:'Syne',sans-serif; }
        .audio-transcript-box.active-in { border-color:rgba(0,229,160,0.3); }
        .audio-transcript-box.active-out { border-color:rgba(126,184,247,0.3); }
        .audio-box-label { font-size:9px; text-transform:uppercase; letter-spacing:0.1em; color:var(--text3); font-family:'JetBrains Mono',monospace; margin-bottom:6px; display:block; }
        .audio-transcript-text { color:var(--text2); }
        .audio-transcript-text.empty { color:var(--text3); font-style:italic; font-size:11px; }
        .audio-transcript-text.interim { color:var(--text3); font-style:italic; }

        .audio-controls { display:flex; gap:8px; align-items:center; justify-content:center; flex-wrap:wrap; }
        .audio-ctrl { background:var(--bg3); border:1px solid var(--border2); color:var(--text2); border-radius:9px; padding:7px 12px; font-size:11px; font-family:'Syne',sans-serif; cursor:pointer; transition:all 0.2s; }
        .audio-ctrl:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-dim); }
        .audio-ctrl.danger:hover { border-color:var(--red); color:var(--red); background:rgba(255,95,95,0.07); }

        .audio-unsupported { color:var(--red); font-size:12px; font-family:'JetBrains Mono',monospace; padding:16px; line-height:1.6; }

        @keyframes ring-expand { 0% { transform:scale(1); opacity:0.6; } 100% { transform:scale(1.9); opacity:0; } }
        @keyframes audio-blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes orb-pulse { 0%,100% { box-shadow:0 0 16px 4px rgba(0,229,160,0.2); } 50% { box-shadow:0 0 36px 12px rgba(0,229,160,0.42); } }
        @keyframes orb-pulse-blue { 0%,100% { box-shadow:0 0 16px 4px rgba(126,184,247,0.2); } 50% { box-shadow:0 0 36px 12px rgba(126,184,247,0.42); } }
    `;
    document.head.appendChild(style);
}

// ============================================================
//  DOM
// ============================================================
function buildOverlay() {
    const existingBtn = document.getElementById('liveAudioBtn');
    if (existingBtn) existingBtn.addEventListener('click', toggleOverlay);

    if (document.getElementById('audioOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'audioOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    if (!supported) {
        overlay.innerHTML = `
            <div class="audio-card">
                <button class="audio-close" id="audioCloseBtn">x</button>
                <div class="audio-title"><em>Pensee</em> Vocal</div>
                <div class="audio-unsupported">
                    Navigateur non compatible.<br><br>
                    Utilise <strong>Chrome</strong> ou <strong>Edge</strong>.
                </div>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('audioCloseBtn')?.addEventListener('click', closeOverlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
        return;
    }

    overlay.innerHTML = `
        <div class="audio-card">
            <button class="audio-close" id="audioCloseBtn">x</button>
            <div class="audio-title"><em>Pensee</em> Vocal</div>
            <div class="audio-subtitle">Parle · Pensee repond a voix haute</div>

            <div class="audio-orb-wrapper" id="audioOrbWrapper">
                <div class="audio-ring"></div>
                <div class="audio-ring"></div>
                <div class="audio-ring"></div>
                <button class="audio-orb" id="audioOrb">
                    <svg class="icon-mic" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
                    <svg class="icon-stop" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                </button>
            </div>

            <div class="audio-status" id="audioStatus">Appuie pour parler</div>

            <div class="audio-transcript-area">
                <div class="audio-transcript-box" id="audioInputBox">
                    <span class="audio-box-label">Toi</span>
                    <div class="audio-transcript-text empty" id="audioInputText">...</div>
                </div>
                <div class="audio-transcript-box" id="audioOutputBox">
                    <span class="audio-box-label">Pensee</span>
                    <div class="audio-transcript-text empty" id="audioOutputText">...</div>
                </div>
            </div>

            <div class="audio-controls">
                <button class="audio-ctrl" id="audioStopBtn">Couper la voix</button>
                <button class="audio-ctrl danger" id="audioCloseBtn2">Fermer</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    document.getElementById('audioCloseBtn')?.addEventListener('click', closeOverlay);
    document.getElementById('audioCloseBtn2')?.addEventListener('click', closeOverlay);
    document.getElementById('audioOrb')?.addEventListener('click', toggleListening);
    document.getElementById('audioStopBtn')?.addEventListener('click', stopSpeaking);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && AudioState.isOpen) closeOverlay(); });
}

// ============================================================
//  RECONNAISSANCE VOCALE
// ============================================================
function startListening() {
    if (AudioState.isListening) return;
    stopSpeaking();

    const recognition = new SpeechRecognition();
    recognition.lang = AUDIO_CONFIG.lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    recognition.continuous = true;

    AudioState.recognition = recognition;
    AudioState.isListening = true;
    AudioState.finalTranscript = '';

    setOrbState('listening');
    setStatus('Ecoute...', 'listening');
    clearInput();

    // Timer silence : envoie après 2.5s sans parole
    let _silenceTimer = null;
    let _sent = false;

    const _commit = () => {
        if (_sent || !AudioState.isListening) return;
        clearTimeout(_silenceTimer);
        recognition.stop(); // déclenche onend une seule fois
    };

    recognition.onresult = (event) => {
        if (_sent) return;
        clearTimeout(_silenceTimer);
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) final += t;
            else interim += t;
        }
        AudioState.finalTranscript += final;
        const display = AudioState.finalTranscript + (interim ? ' ' + interim : '');
        setInputText(display, !!interim && !AudioState.finalTranscript);
        // Relance le timer après chaque mot détecté
        _silenceTimer = setTimeout(_commit, 2500);
    };

    recognition.onend = () => {
        clearTimeout(_silenceTimer);
        AudioState.isListening = false;
        if (_sent) return;
        const text = AudioState.finalTranscript.trim();
        if (text) {
            _sent = true;
            setInputText(text, false);
            sendToAI(text);
        } else {
            setOrbState('idle');
            setStatus('Appuie pour parler', '');
        }
    };

    recognition.onerror = (event) => {
        AudioState.isListening = false;
        setOrbState('idle');
        const msgs = {
            'no-speech': 'Rien entendu - reessaie',
            'not-allowed': 'Micro refuse - autorise le micro',
            'network': 'Erreur reseau'
        };
        setStatus(msgs[event.error] || 'Erreur : ' + event.error, 'error');
    };

    recognition.start();
}

function stopListening() {
    AudioState.recognition?.stop();
    AudioState.recognition = null;
    AudioState.isListening = false;
    setOrbState('idle');
    setStatus('Appuie pour parler', '');
}

function toggleListening() {
    if (AudioState.isSpeaking) { stopSpeaking(); return; }
    if (AudioState.isListening) stopListening();
    else startListening();
}

// ============================================================
//  APPEL API
// ============================================================
async function sendToAI(text) {
    setStatus('Pensee reflechit...', 'thinking');
    setOrbState('thinking');

    const base = typeof window.CONFIG?.systemPrompt === 'string' ? window.CONFIG.systemPrompt : '';
    const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const systemInstruction = `[DATE : ${today}]\n\n${base}\n\n--- MODE VOCAL ---\nReponds en 3 a 5 phrases maximum. Zero markdown, zero asterisques, zero listes. Tu parles, tu n'ecris pas. Si la reponse necessite du code, resume en 2 phrases.`;

    const agentId = (typeof window.activeAgentId !== 'undefined' && window.activeAgentId) ? window.activeAgentId : 'default';

    try {
        // FIX : Token Supabase via localStorage (indépendant de l'ordre de chargement des scripts)
        let token = "";
        try {
            const raw = localStorage.getItem('sb-uhrdoxllxqtvucxmzcww-auth-token');
            if (raw) token = JSON.parse(raw)?.access_token || "";
        } catch (_) {}
        // Fallback si l'objet supabase est déjà disponible
        if (!token && typeof supabase !== 'undefined') {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                token = session?.access_token || "";
            } catch (_) {}
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            body: JSON.stringify({ prompt: text, systemInstruction, agentId })
        });

        if (!response.ok) {
            const msg = response.status === 503 ? 'Serveurs satures - reessaie'
                      : response.status === 401 ? 'Non authentifie'
                      : response.status === 403 ? 'Quota epuise (20/20)'
                      : `Erreur API (${response.status})`;
            setStatus(msg, 'error');
            setOrbState('idle');
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullReply = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullReply += decoder.decode(value, { stream: true });
        }

        const clean = cleanForSpeech(fullReply);
        if (!clean) { setStatus('Reponse vide', 'error'); setOrbState('idle'); return; }
        setOutputText(clean);
        speak(clean);

    } catch (err) {
        console.error('[Audio] Erreur:', err);
        setStatus('Erreur reseau', 'error');
        setOrbState('idle');
    }
}

function cleanForSpeech(text) {
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`{1,3}[\s\S]*?`{1,3}/g, '')
        .replace(/^\s*[-*+]\s/gm, '')
        .replace(/^\s*\d+\.\s/gm, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// ============================================================
//  SYNTHESE VOCALE — TTS API (ElevenLabs / Google WaveNet / Web Speech)
// ============================================================
function loadVoices() {
    AudioState.voices = AudioState.synth.getVoices();
    AudioState.selectedVoice = AudioState.voices.find(v => v.lang.startsWith('fr') && v.localService)
        || AudioState.voices.find(v => v.lang.startsWith('fr'))
        || null;
}

async function speak(text) {
    if (!text) return;
    stopSpeaking();

    AudioState.isSpeaking = true;
    setOrbState('speaking');
    setStatus('Pensee parle...', 'speaking');

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        const ct = response.headers.get('Content-Type') || '';

        if (ct.includes('audio/mpeg')) {
            // Lecture via Web Audio API (ElevenLabs ou Google WaveNet)
            const buf = await response.arrayBuffer();
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const decoded = await ctx.decodeAudioData(buf);
            const src = ctx.createBufferSource();
            src.buffer = decoded;
            src.connect(ctx.destination);
            AudioState.currentSource = src;
            src.onended = () => {
                AudioState.isSpeaking = false;
                AudioState.currentSource = null;
                if (AudioState.isOpen) { setOrbState('idle'); setStatus('Appuie pour parler', ''); }
            };
            src.start(0);
            return;
        }

        // Fallback Web Speech demandé par le serveur
        const data = await response.json().catch(() => ({ fallback: true, text }));
        speakWebSpeech(data.text || text);

    } catch (err) {
        console.warn('[Audio] TTS API indisponible, fallback Web Speech:', err.message);
        speakWebSpeech(text);
    }
}

function speakWebSpeech(text) {
    if (!AudioState.synth) return;

    // Normalisation : s'assurer que le texte se termine bien par un séparateur
    const normalized = text.trim().replace(/([^.!?])$/, '$1.');
    const sentences = normalized.match(/[^.!?]+[.!?]+/g) || [normalized];
    let index = 0;
    let cancelled = false;

    function next() {
        if (cancelled || index >= sentences.length || !AudioState.isOpen) {
            if (!cancelled) {
                AudioState.isSpeaking = false;
                setOrbState('idle');
                setStatus('Appuie pour parler', '');
            }
            return;
        }
        const chunk = sentences[index].trim();
        if (!chunk) { index++; next(); return; }

        const utt = new SpeechSynthesisUtterance(chunk);
        utt.lang   = AUDIO_CONFIG.lang;
        utt.rate   = AUDIO_CONFIG.voiceRate;
        utt.pitch  = AUDIO_CONFIG.voicePitch;
        utt.volume = AUDIO_CONFIG.voiceVolume;
        if (AudioState.selectedVoice) utt.voice = AudioState.selectedVoice;
        utt.onstart = () => { AudioState.isSpeaking = true; setOrbState('speaking'); setStatus('Pensee parle...', 'speaking'); };
        utt.onend   = () => { if (!cancelled) { index++; next(); } };
        utt.onerror = (e) => {
            // 'interrupted' = stopSpeaking() appelé volontairement, pas une vraie erreur
            if (e.error === 'interrupted') { cancelled = true; return; }
            index++; next();
        };
        AudioState.currentUtterance = utt;

        // Garde anti-bug Chrome : synth peut se bloquer silencieusement
        if (AudioState.synth.speaking) AudioState.synth.cancel();
        AudioState.synth.speak(utt);
    }

    // Stocker le cancel pour stopSpeaking()
    AudioState._cancelSpeech = () => { cancelled = true; };
    next();
}

function stopSpeaking() {
    // Annuler la boucle interne de speakWebSpeech
    if (AudioState._cancelSpeech) { AudioState._cancelSpeech(); AudioState._cancelSpeech = null; }
    // Stop Web Audio (ElevenLabs / Google)
    if (AudioState.currentSource) {
        try { AudioState.currentSource.stop(); } catch(e) {}
        AudioState.currentSource = null;
    }
    // Stop Web Speech
    AudioState.synth?.cancel();
    AudioState.isSpeaking = false;
    AudioState.currentUtterance = null;
    if (!AudioState.isListening) { setOrbState('idle'); setStatus('Appuie pour parler', ''); }
}

// ============================================================
//  OVERLAY
// ============================================================
function toggleOverlay() { AudioState.isOpen ? closeOverlay() : openOverlay(); }

function openOverlay() {
    AudioState.isOpen = true;
    document.getElementById('audioOverlay')?.classList.add('open');
    document.getElementById('liveAudioBtn')?.classList.add('active');
    setStatus('Appuie pour parler', '');
    loadVoices();
    if (AudioState.voices.length === 0) AudioState.synth.addEventListener('voiceschanged', loadVoices, { once: true });
}

function closeOverlay() {
    AudioState.isOpen = false;
    stopListening();
    stopSpeaking();
    document.getElementById('audioOverlay')?.classList.remove('open');
    document.getElementById('liveAudioBtn')?.classList.remove('active');
}

// ============================================================
//  UI HELPERS
// ============================================================
function setStatus(text, cls) {
    const el = document.getElementById('audioStatus');
    if (el) { el.textContent = text; el.className = 'audio-status' + (cls ? ' ' + cls : ''); }
}

function setOrbState(state) {
    const orb = document.getElementById('audioOrb');
    const wrapper = document.getElementById('audioOrbWrapper');
    if (!orb || !wrapper) return;
    orb.className = 'audio-orb' + (state !== 'idle' ? ' ' + state : '');
    wrapper.className = 'audio-orb-wrapper' + (state === 'listening' ? ' active' : state === 'speaking' ? ' speaking' : '');
}

function setInputText(text, isInterim) {
    const el = document.getElementById('audioInputText');
    const box = document.getElementById('audioInputBox');
    if (el) { el.textContent = text || '...'; el.className = 'audio-transcript-text' + (isInterim ? ' interim' : text ? '' : ' empty'); }
    if (text) box?.classList.add('active-in');
}

function clearInput() {
    const el = document.getElementById('audioInputText');
    if (el) { el.textContent = '...'; el.className = 'audio-transcript-text empty'; }
    document.getElementById('audioInputBox')?.classList.remove('active-in');
}

function setOutputText(text) {
    const el = document.getElementById('audioOutputText');
    const box = document.getElementById('audioOutputBox');
    if (el) { el.textContent = text || '...'; el.className = 'audio-transcript-text' + (text ? '' : ' empty'); }
    if (text) box?.classList.add('active-out');
}

// ============================================================
//  INIT
// ============================================================
function initAudio() {
    injectStyles();
    buildOverlay();
    window.PenseeAudio = { open: openOverlay, close: closeOverlay, version: AUDIO_CONFIG.version };
    console.log('[Pensee Audio] v' + AUDIO_CONFIG.version + ' ready - supported: ' + supported);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudio);
} else {
    initAudio();
}

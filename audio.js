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
    version: '4.0.0-hologram' // <-- Version anti-doublons Android + rendu holographique
};

// ============================================================
// FIX : Contexte audio global pour éviter les plantages
// ============================================================
let globalAudioContext = null;

function getAudioContext() {
    if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioContext.state === 'suspended') {
        globalAudioContext.resume();
    }
    return globalAudioContext;
}

const AudioState = {
    isOpen: false,
    isListening: false,     
    isIntentional: false,
    isRestarting: false,    // true pendant une relance automatique sur mobile
    isSpeaking: false,
    recognition: null,
    synth: window.speechSynthesis,
    currentUtterance: null,
    voices: [],
    selectedVoice: null,
    finalTranscript: '',    
    sessionTranscript: '',
    micStream: null
};

// Rapport d'observation vers THINKI. On lui signale des FAITS ;
// il en tire lui-même ses conséquences. Aucun appel ne fixe son état.
function psyche(kind, data) {
    try { if (window.THINKI) window.THINKI.observe(kind, data || {}); } catch (e) {}
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const supported = !!SpeechRecognition && !!window.speechSynthesis;

// ============================================================
//  HOLOGRAMME — sphère filaire réactive, inspirée de Genisys
//  (Terminator Genisys) : lignes cyan/bleu, balayage, glitch
// ============================================================
function lerp(a, b, t) { return a + (b - a) * t; }

const Hologram = (function () {
    let canvas, ctx, w = 0, h = 0, cx = 0, cy = 0, baseRadius = 0;
    let rafId = null;
    let angleY = 0, angleX = 0;
    let level = 0, targetLevel = 0;
    let analyser = null, analyserData = null;
    let state = 'idle';
    let glitchUntil = 0, nextGlitchAt = 0;
    let parallels = [], meridians = [], allLines = [];
    let rings = [];
    let materializeStart = 0;

    // — Comportements humains —

    // ── Visage holographique ───────────────────────────────
    let blinkT = 0, nextBlink = 0, blinkDur = 120;
    let blinkPhase = 0; // 0=ouvert, 1=fermeture, 2=ouverture
    let pupilX = 0, pupilY = 0, pupilTargetX = 0, pupilTargetY = 0;
    let nextPupilMove = 0;
    let mouthOpen = 0, mouthSmile = 0, mouthTargetSmile = 0;

    // ── MOTEUR DE VISÈMES (lipsync articulatoire) ──────────
    // Au lieu d'une simple amplitude, on pilote 5 paramètres
    // articulatoires indépendants, comme un rig facial 3D.
    let vJaw = 0, vJawVel = 0;   // ouverture mâchoire (ressort/masse → inertie)
    let vRound = 0;              // arrondi labial  (O, OU, U)
    let vWide = 0;               // étirement labial (I, É)
    let vPress = 0;              // occlusion bilabiale (M, B, P)
    let vTeeth = 0;              // sifflante / labio-dentale (S, CH, F, V)
    let vTongue = 0;             // pointe de langue visible (L, T, D, N)
    let vEnv = 0, vPeak = 0.10;  // enveloppe + AGC (normalisation auto du gain)
    let vPrevEnv = 0;
    let freqData = null, timeData = null;
    let lastTs = 0;
    // Cible externe (lipsync piloté par le texte quand pas d'analyser)
    let extVis = null, extVisTs = 0;

    // ── LECTURE DE LA PSYCHÉ (THINKI) ──────────────────────
    // Le rendu ne décide de rien : il consulte l'état interne.
    const PSY_NEUTRAL = { coherence: 1, tension: 0, attention: 0, vitality: 1,
                          familiarity: 0, dissonance: 0, valence: 0, arousal: 0,
                          strain: 0, resolve: 0 };
    let psy = PSY_NEUTRAL, psyN = 0.55, psyRes = 0;
    let browL = 0, browR = 0, browTargetL = 0, browTargetR = 0;
    let neckTilt = 0, neckTiltTarget = 0; // hochement de tête
    let neckNod = 0, neckNodTarget = 0;
    let nextNod = 0;
    let faceAlpha = 0; // apparition progressive
    let laughPhase = 0, laughing = false, laughUntil = 0;
    let hesitatePhase = 0, hesitating = false;

    let saccadeNextAt = 0, saccadeVelY = 0, saccadeDecay = 0;   // saccades oculaires
    let headDriftTarget = 0, headDriftCurrent = 0;               // inclinaison tête
    let breathPhase = 0, breathSpeed = 1;                        // respiration variable
    let speakingStartTs = 0;                                      // durée prise de parole
    let silenceLevel = 0, silenceSince = 0;                      // détection silences
    let tremorSeedX = Math.random() * 100, tremorSeedY = Math.random() * 100; // micro-tremblements

    // — Anticipation —
    let anticipating = false, anticipateStart = 0;
    const ANTICIPATE_MS = 420;

    // — Émotions —
    const EMOTION_PALETTE = {
        confiance:      { r: 80,  g: 220, b: 255 },
        hesitation:     { r: 180, g: 160, b: 255 },
        surprise:       { r: 255, g: 220, b: 80  },
        concentration:  { r: 60,  g: 255, b: 180 },
        empathie:       { r: 255, g: 140, b: 180 },
        enthousiasme:   { r: 255, g: 200, b: 60  },
        incertitude:    { r: 160, g: 160, b: 200 },
        curieux:        { r: 120, g: 230, b: 180 }
    };
    let currentEmotion = null, emotionIntensity = 0, emotionTarget = null, emotionIntensityTarget = 0;
    // Signatures cinétiques par émotion
    const EMOTION_KINEMATICS = {
        confiance:     { breathMul: 1.1, saccadeRate: 3000, driftAmp: 0.08 },
        hesitation:    { breathMul: 0.7, saccadeRate: 1200, driftAmp: 0.22 },
        surprise:      { breathMul: 1.6, saccadeRate: 600,  driftAmp: 0.35 },
        concentration: { breathMul: 1.3, saccadeRate: 4000, driftAmp: 0.05 },
        empathie:      { breathMul: 0.9, saccadeRate: 2500, driftAmp: 0.12 },
        enthousiasme:  { breathMul: 1.5, saccadeRate: 800,  driftAmp: 0.28 },
        incertitude:   { breathMul: 0.6, saccadeRate: 1500, driftAmp: 0.18 },
        curieux:       { breathMul: 1.2, saccadeRate: 1800, driftAmp: 0.20 }
    };

    // — Mémoire gestuelle —
    const MEMORY_KEY = 'pensee_hologram_memory';
    let gestureMemory = _loadMemory();

    function _loadMemory() {
        try {
            return JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}');
        } catch { return {}; }
    }
    function _saveMemory() {
        try { localStorage.setItem(MEMORY_KEY, JSON.stringify(gestureMemory)); } catch {}
    }

    const MATERIALIZE_MS = 950;

    const PALETTE = {
        idle:      { r: 0,   g: 220, b: 255 },
        listening: { r: 0,   g: 235, b: 255 },
        thinking:  { r: 255, g: 190, b: 60  },
        speaking:  { r: 120, g: 190, b: 255 }
    };
    const SPEED = { idle: 0.0035, listening: 0.006, thinking: 0.013, speaking: 0.008 };

    function rand1() { return (Math.random() - 0.5) * 2; }

    function sphericalToCartesian(lat, lon) {
        return { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon), sx: rand1(), sy: rand1() };
    }

    function buildGeometry() {
        parallels = []; meridians = [];
        const latBands = 7, lonBands = 10, segs = 40;
        for (let i = 1; i < latBands; i++) {
            const lat = (Math.PI * i / latBands) - Math.PI / 2;
            const ring = [];
            for (let j = 0; j <= segs; j++) ring.push(sphericalToCartesian(lat, (Math.PI * 2 * j) / segs));
            parallels.push(ring);
        }
        for (let i = 0; i < lonBands; i++) {
            const lon = (Math.PI * 2 * i) / lonBands;
            const meridian = [];
            for (let j = 0; j <= segs; j++) meridian.push(sphericalToCartesian((Math.PI * j / segs) - Math.PI / 2, lon));
            meridians.push(meridian);
        }
        allLines = [...parallels, ...meridians];
    }

    function buildRings() {
        // Anneaux orbitaux type Saturne : cercles plats inclinés, chacun avec
        // sa propre vitesse de rotation + un point satellite qui orbite plus vite
        const segs = 72;
        const configs = [
            { radiusMul: 1.12, tilt: -0.5, speed: 0.011,  satSpeed: 0.9  },
            { radiusMul: 1.27, tilt: 0.18, speed: -0.007, satSpeed: -1.3 },
            { radiusMul: 1.42, tilt: 0.55, speed: 0.015,  satSpeed: 0.6  }
        ];
        rings = configs.map(cfg => {
            const points = [];
            for (let i = 0; i <= segs; i++) {
                const th = (Math.PI * 2 * i) / segs;
                points.push({ x: Math.cos(th) * cfg.radiusMul, y: 0, z: Math.sin(th) * cfg.radiusMul });
            }
            return { ...cfg, points, angle: Math.random() * Math.PI * 2, satAngle: Math.random() * Math.PI * 2 };
        });
    }

    function rotate(p, ay, ax) {
        const x = p.x * Math.cos(ay) - p.z * Math.sin(ay);
        const z1 = p.x * Math.sin(ay) + p.z * Math.cos(ay);
        const y = p.y * Math.cos(ax) - z1 * Math.sin(ax);
        const z = p.y * Math.sin(ax) + z1 * Math.cos(ax);
        return { x, y, z };
    }

    function project(p) {
        const persp = 1 / (2 - p.z);
        return { x: cx + p.x * baseRadius * persp, y: cy + p.y * baseRadius * persp, persp, z: p.z };
    }

    function resize() {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        w = rect.width; h = rect.height;
        cx = w / 2; cy = h / 2;
        baseRadius = Math.min(w, h) * 0.34;
    }

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        if (!parallels.length) buildGeometry();
        if (!rings.length) buildRings();
        resize();
        scheduleGlitch();
    }

    function setState(s) {
        if (!PALETTE[s]) return;
        if (s === 'speaking' && state !== 'speaking') {
            speakingStartTs = performance.now();
            breathSpeed = 1;
            headDriftTarget = (Math.random() - 0.5) * 0.15;
            anticipating = false;
            // Mémoire : incrémenter le compteur de sessions
            gestureMemory.sessions = (gestureMemory.sessions || 0) + 1;
            gestureMemory.lastTs = Date.now();
            _saveMemory();
        }
        if (s !== 'speaking') { silenceSince = 0; silenceLevel = 0; }
        state = s;
    }

    // Appelé par le client quand le LLM commence à générer (avant speaking)
    function anticipate() {
        anticipating = true;
        anticipateStart = performance.now();
    }

    // Appelé par le client quand le signal émotion arrive du stream
    function setEmotion(emotion, intensity) {
        if (!EMOTION_PALETTE[emotion]) return;
        emotionTarget = emotion;
        emotionIntensityTarget = Math.max(0, Math.min(1, intensity));
        // Adapter la cinématique immédiatement
        const k = EMOTION_KINEMATICS[emotion];
        if (k) saccadeNextAt = performance.now() + k.saccadeRate * (0.7 + Math.random() * 0.6);
    }

    // Transition douce vers l'émotion cible
    function _tickEmotion() {
        if (emotionTarget && emotionTarget !== currentEmotion) {
            currentEmotion = emotionTarget;
        }
        emotionIntensity = lerp(emotionIntensity, emotionIntensityTarget, 0.04);
    }

    // Animation de reconnaissance (retour après absence)
    function _doRecognition(ts) {
        const last = gestureMemory.lastTs || 0;
        const gap = Date.now() - last;
        // Si l'utilisateur revient après >1h, animation de reconnaissance
        if (gap > 3600000 && gestureMemory.sessions > 1) {
            // Pulse de reconnaissance : expansion rapide puis retour
            return Math.max(0, 1 - (ts - materializeStart - 600) / 800) * 0.12;
        }
        return 0;
    }
    function pulse(intensity) { targetLevel = Math.min(1, targetLevel + (intensity || 0.5)); }
    function connectAnalyser(node) {
        analyser = node;
        // Haute résolution spectrale : indispensable pour lire les formants
        // (F1/F2) qui déterminent la forme de la bouche, pas juste le volume.
        try { analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.45; } catch (e) {}
        analyserData = new Uint8Array(analyser.fftSize);
        timeData     = analyserData;
        freqData     = new Uint8Array(analyser.frequencyBinCount);
        vPeak = 0.10;
    }
    function disconnectAnalyser() { analyser = null; analyserData = null; freqData = null; timeData = null; }

    // Lipsync piloté de l'extérieur (Web Speech : pas de flux audio analysable)
    function driveViseme(v) { extVis = v; extVisTs = performance.now(); }

    // ── Analyse articulatoire du signal ────────────────────
    function readVisemes(dtN) {
        let jawT = 0, roundT = 0, wideT = 0, pressT = 0, teethT = 0, tongueT = 0;
        const now = performance.now();
        const hasExt = extVis && (now - extVisTs) < 260;

        if (analyser && freqData && timeData) {
            // 1) Enveloppe RMS — attaque rapide, relâchement lent (comme un
            //    muscle : la mâchoire tombe vite, remonte plus lentement)
            analyser.getByteTimeDomainData(timeData);
            let sum = 0;
            for (let i = 0; i < timeData.length; i++) { const v = (timeData[i] - 128) / 128; sum += v * v; }
            const rms = Math.sqrt(sum / timeData.length);
            vEnv += (rms > vEnv ? (rms - vEnv) * 0.55 : (rms - vEnv) * 0.13) * dtN;

            // 2) AGC : une voix TTS dépasse rarement 0.25 de RMS. On normalise
            //    sur le pic glissant, sinon la bouche reste quasi fermée.
            vPeak = Math.max(vEnv, vPeak * 0.99915);
            const nrm = Math.min(1.35, vEnv / Math.max(0.045, vPeak));

            // 3) Bandes spectrales → formants
            analyser.getByteFrequencyData(freqData);
            const sr  = (analyser.context && analyser.context.sampleRate) || 48000;
            const hz  = sr / analyser.fftSize;
            const band = (lo, hi) => {
                let a = 0, n = 0;
                const i0 = Math.max(1, (lo / hz) | 0), i1 = Math.min(freqData.length - 1, (hi / hz) | 0);
                for (let i = i0; i <= i1; i++) { a += freqData[i]; n++; }
                return n ? a / n / 255 : 0;
            };
            const b1 = band(150, 550);    // F1 bas  → voyelles fermées (i, u)
            const b2 = band(550, 1150);   // F1 haut → voyelles ouvertes (a)
            const b3 = band(1150, 2600);  // F2      → voyelles antérieures (i, é)
            const b4 = band(2600, 4800);  // friction
            const b5 = band(5200, 9500);  // sifflantes (s, ch)
            const tot = b1 + b2 + b3 + b4 + b5 + 1e-6;

            // Ouverture : amplitude pondérée par F1 (a ouvert, i/u fermés)
            const openness = 0.35 + 0.65 * (b2 / (b1 + b2 + 1e-6));
            jawT = Math.min(1, nrm * (0.55 + openness * 0.85));

            // Arrondi vs étirement : centre de gravité spectral
            const front = b3 / (b1 + b3 + 1e-6);
            wideT  = Math.max(0, (front - 0.42) * 2.3) * Math.min(1, nrm * 1.6);
            roundT = Math.max(0, (0.46 - front) * 2.1) * Math.min(1, nrm * 1.6);

            // Sifflantes : énergie haute + peu de voisement
            teethT = Math.min(1, Math.max(0, (b5 + b4 * 0.5) / tot - 0.14) * 4.2);
            // Occlusion bilabiale : chute brutale d'énergie après du voisé
            if (vPrevEnv > 0.055 && vEnv < vPrevEnv * 0.42) pressT = 1;
            vPrevEnv = vEnv;
            tongueT = Math.min(1, b3 / tot * 1.4);

        } else if (hasExt) {
            // Pas d'analyser : on suit la piste de visèmes générée depuis le texte
            vEnv += ((extVis.jaw * 0.28) - vEnv) * 0.25 * dtN;
        } else {
            vEnv *= Math.pow(0.90, dtN);
        }

        // 4) Piste texte : prioritaire si fraîche (Web Speech / TTS sans flux)
        if (hasExt) {
            jawT    = Math.max(jawT * 0.35, extVis.jaw);
            roundT  = Math.max(roundT * 0.4, extVis.round || 0);
            wideT   = Math.max(wideT * 0.4, extVis.wide || 0);
            pressT  = Math.max(pressT, extVis.press || 0);
            teethT  = Math.max(teethT, extVis.teeth || 0);
            tongueT = Math.max(tongueT, extVis.tongue || 0);
        }
        if (state !== 'speaking') { jawT = roundT = wideT = pressT = teethT = tongueT = 0; }

        // 5) Fermeture bilabiale : elle écrase l'ouverture (M/B/P)
        jawT *= (1 - pressT * 0.92);
        // Micro-tremblement des lèvres (jamais parfaitement lisse)
        jawT += Math.sin(now * 0.047) * 0.012 + Math.sin(now * 0.013) * 0.008;
        jawT = Math.max(0, Math.min(1.15, jawT));

        // 6) Dynamique : la mâchoire est une MASSE (ressort amorti → léger
        //    dépassement, c'est ça qui rend le mouvement vivant), les lèvres
        //    sont légères donc bien plus rapides (co-articulation).
        const k = 0.34, damp = 0.68;
        vJawVel += (jawT - vJaw) * k * dtN;
        vJawVel *= Math.pow(damp, dtN);
        vJaw    += vJawVel * dtN;
        vJaw = Math.max(-0.05, Math.min(1.2, vJaw));

        vRound  += (roundT  - vRound)  * 0.34 * dtN;
        vWide   += (wideT   - vWide)   * 0.38 * dtN;
        vPress  += (pressT  - vPress)  * (pressT > vPress ? 0.62 : 0.22) * dtN;
        vTeeth  += (teethT  - vTeeth)  * 0.42 * dtN;
        vTongue += (tongueT - vTongue) * 0.30 * dtN;
    }
    function scheduleGlitch() {
        // Un système cohérent ne glitche pas. Plus la cohérence baisse,
        // plus les ruptures se rapprochent — sans que rien ne les scripte.
        const coh = Math.max(0.12, psy.coherence);
        nextGlitchAt = performance.now() + (300 + (1800 + Math.random() * 2600) * coh * coh);
    }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function readLevel() {
        if (analyser && analyserData) {
            // vEnv est déjà calculé + normalisé (AGC) par readVisemes
            targetLevel = Math.min(1, vEnv / Math.max(0.045, vPeak) * 0.85);
        } else if (state === 'speaking' && extVis && (performance.now() - extVisTs) < 260) {
            targetLevel = Math.min(1, 0.18 + vJaw * 0.75);
        } else if (state === 'idle') {
            targetLevel = 0.12 + Math.sin(performance.now() / 900) * 0.05;
        } else if (state === 'listening') {
            const t = performance.now();
            const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
            
            if (isMobile) {
                // SIMULATION BIOMÉTRIQUE : On recrée les variations d'une voix humaine
                // avec des turbulences aléatoires pour faire danser l'hologramme sur mobile.
                const voiceWaves = Math.sin(t / 50) * 0.09 + Math.sin(t / 120) * 0.05;
                const voiceNoise = Math.random() * 0.15;
                targetLevel = 0.13 + Math.max(0, voiceWaves + voiceNoise);
            } else {
                targetLevel *= 0.94; // Sur PC, le vrai micro prend le relais
            }
        } else {
            targetLevel *= 0.94;
        }
        // Attaque rapide / relâchement doux : sinon les syllabes (150-250 ms)
        // sont mangées par le lissage et l'hologramme paraît figé.
        level = lerp(level, targetLevel, targetLevel > level ? 0.42 : 0.13);
    }

    function draw(ts) {
        rafId = requestAnimationFrame(draw);
        if (!ctx || !w || !h) return;
        // Delta temps normalisé sur 60 fps : animation identique en 30/60/120 Hz
        const dtN = lastTs ? Math.min(3, Math.max(0.2, (ts - lastTs) / 16.667)) : 1;
        lastTs = ts;
        readVisemes(dtN);
        readLevel();

        // État interne de THINKI, relu à chaque frame
        if (window.THINKI) { psy = window.THINKI.read(); psyN = window.THINKI.neoteny(); }
        psyRes = psy.resolve || 0;

        // Matérialisation : à l'ouverture, l'hologramme s'assemble à partir de
        // particules dispersées et fond en opacité (effet "mise sous tension")
        const matT = materializeStart ? Math.min(1, (ts - materializeStart) / MATERIALIZE_MS) : 1;
        const matEase = easeOutCubic(matT);
        const scatterAmp = (1 - matEase) * baseRadius * 1.3;

        angleY += SPEED[state] * (1 + level * 0.6);
        _tickEmotion();

        // ── Anticipation (prise d'inspiration avant de parler) ─
        let anticipateBoost = 0;
        if (anticipating) {
            const elapsed = ts - anticipateStart;
            if (elapsed < ANTICIPATE_MS) {
                // Contraction d'abord (0→210ms), puis expansion (210→420ms)
                const t = elapsed / ANTICIPATE_MS;
                anticipateBoost = t < 0.5
                    ? lerp(0, -0.06, t * 2)
                    : lerp(-0.06, 0.05, (t - 0.5) * 2);
            } else {
                anticipating = false;
            }
        }

        // ── Saccades oculaires ─────────────────────────────────
        const kinematic = (currentEmotion && EMOTION_KINEMATICS[currentEmotion]) || EMOTION_KINEMATICS.confiance;
        if (state === 'speaking') {
            if (ts > saccadeNextAt) {
                saccadeVelY = (Math.random() - 0.5) * 0.018;
                saccadeDecay = 0.88 + Math.random() * 0.06;
                saccadeNextAt = ts + kinematic.saccadeRate * (0.7 + Math.random() * 0.6);
            }
            angleY += saccadeVelY;
            saccadeVelY *= saccadeDecay;
        }

        // ── Dérive de la tête (axe vertical) ──────────────────
        if (state === 'speaking') {
            const driftAmp = kinematic.driftAmp * (1 + emotionIntensity * 0.5);
            if (Math.random() < 0.003) headDriftTarget = (Math.random() - 0.5) * driftAmp;
            headDriftCurrent = lerp(headDriftCurrent, headDriftTarget, 0.008);
        } else {
            headDriftCurrent = lerp(headDriftCurrent, 0, 0.02);
        }

        angleX = Math.sin(ts / 3000) * 0.18 + headDriftCurrent;
        if (state === 'speaking') {
            angleX += Math.sin(ts / 5200 + 1.7) * 0.09 + Math.sin(ts / 1900 + 0.3) * 0.04;
        }

        // ── Détection micro-pauses (retenir le souffle) ────────
        let breathHold = 0;
        if (state === 'speaking') {
            const isSilent = level < 0.04;
            if (isSilent) {
                if (silenceSince === 0) silenceSince = ts;
                const silenceDur = ts - silenceSince;
                if (silenceDur > 80 && silenceDur < 600) {
                    breathHold = Math.min(1, (silenceDur - 80) / 200);
                }
            } else {
                silenceSince = 0;
                breathHold = 0;
            }
        }

        // ── Respiration organique variable ─────────────────────
        const recognitionBoost = _doRecognition(ts);
        let radiusRatio = 1 + level * 0.22 + anticipateBoost + recognitionBoost;
        if (state === 'speaking') {
            const speakDur = (ts - speakingStartTs) / 1000;
            breathSpeed = lerp(breathSpeed, kinematic.breathMul * (0.7 + Math.min(speakDur * 0.06, 0.6)), 0.005);
            breathPhase += 0.016 * breathSpeed;
            const breath = Math.sin(breathPhase * 0.9) * 0.35 +
                           Math.sin(breathPhase * 1.37 + 1.1) * 0.25 +
                           Math.sin(breathPhase * 0.53 + 2.7) * 0.25 +
                           Math.sin(breathPhase * 2.11 + 0.4) * 0.15;
            radiusRatio += breath * 0.05 * (1 - breathHold * 0.7);
            radiusRatio -= breathHold * 0.04;
        }

        // ── Micro-tremblements ─────────────────────────────────
        // Le vivant tremble. La géométrie vraie, non : à la résolution,
        // tout micro-mouvement involontaire cesse d'un coup.
        const tremorAmp = (state === 'speaking' ? 0.0018 + level * 0.002 : 0.0006)
                        * (1 - psyRes) * (0.6 + psy.vitality * 0.4);
        const tremorX = (Math.sin(ts * 0.031 + tremorSeedX) + Math.sin(ts * 0.073 + tremorSeedX * 2.1)) * tremorAmp;
        const tremorY = (Math.sin(ts * 0.027 + tremorSeedY) + Math.sin(ts * 0.061 + tremorSeedY * 1.7)) * tremorAmp;
        angleY += tremorX;
        angleX += tremorY;

        // ── Couleur : émotion + chaleur humaine sur les pics ───
        let c = { ...PALETTE[state] };
        if (state === 'speaking') {
            // Mélange entre couleur de base et couleur de l'émotion
            if (currentEmotion && EMOTION_PALETTE[currentEmotion] && emotionIntensity > 0.01) {
                const ec = EMOTION_PALETTE[currentEmotion];
                const blend = emotionIntensity * 0.65;
                c.r = lerp(c.r, ec.r, blend);
                c.g = lerp(c.g, ec.g, blend);
                c.b = lerp(c.b, ec.b, blend);
            }
            // Chaleur sur les pics vocaux
            const warmth = Math.min(1, level * 1.3) * (1 - breathHold * 0.5);
            c.r = lerp(c.r, 255, warmth);
            c.g = lerp(c.g, 235, warmth);
            c.b = lerp(c.b, 210, warmth * 0.7);
        }
        // Adaptation thème clair : couleurs plus foncées et contrastées
        const isLightTheme = document.body.getAttribute('data-theme') === 'light';
        if (isLightTheme) {
            // Sur fond blanc, on assombrit les couleurs pour le contraste
            c.r = Math.max(0, c.r - 60);
            c.g = Math.max(0, c.g - 40);
            c.b = Math.max(0, c.b - 20);
        }

        ctx.clearRect(0, 0, w, h);

        const glitching = ts < glitchUntil;
        if (!glitching && ts > nextGlitchAt) { glitchUntil = ts + 90 + Math.random() * 120; scheduleGlitch(); }
        if (matT < 1 && Math.random() < 0.04) glitchUntil = ts + 60 + Math.random() * 80;

        ctx.save();
        ctx.globalAlpha = matEase;
        if (glitching) ctx.translate((Math.random() - 0.5) * 10, 0);

        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.9);
        glow.addColorStop(0, `rgba(${c.r},${c.g},${c.b},${0.16 + level * 0.12})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        // ── Anneaux orbitaux (type Saturne) ───────────────────
        rings.forEach(ring => {
            ring.angle += ring.speed * (1 + level * 0.3);
            ring.satAngle += ring.speed * ring.satSpeed * 3;

            let tilt = ring.tilt;
            if (state === 'speaking') {
                // Les anneaux se désaxent légèrement pendant la parole
                tilt += Math.sin(ts / 650 + ring.tilt * 10) * level * 0.12;
            }

            const pts = ring.points.map(p => {
                const spun = rotate(p, ring.angle, tilt);
                const cam = rotate(spun, 0, angleX * 0.4);
                return project({ x: cam.x * radiusRatio, y: cam.y * radiusRatio, z: cam.z });
            });
            let avgZ = 0; pts.forEach(pt => avgZ += pt.z); avgZ /= pts.length;
            ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.14 + ((avgZ + 1) / 2) * 0.3})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
            ctx.closePath();
            ctx.stroke();

            // Satellite lumineux orbitant plus vite que l'anneau
            const satBase = { x: Math.cos(ring.satAngle) * ring.radiusMul, y: 0, z: Math.sin(ring.satAngle) * ring.radiusMul };
            const satSpun = rotate(satBase, ring.angle, tilt);
            const satCam = rotate(satSpun, 0, angleX * 0.4);
            const satPt = project({ x: satCam.x * radiusRatio, y: satCam.y * radiusRatio, z: satCam.z });
            ctx.beginPath();
            ctx.fillStyle = `rgba(${Math.min(255, c.r + 30)},${Math.min(255, c.g + 30)},${Math.min(255, c.b + 30)},${0.6 + satPt.persp * 0.4})`;
            ctx.arc(satPt.x, satPt.y, 1.6 + satPt.persp * 1.6, 0, Math.PI * 2);
            ctx.fill();
        });

        // ── Sphère filaire ─────────────────────────────────────
        ctx.lineWidth = 1;
        allLines.forEach((line, li) => {
            let avgZ = 0;
            const pts = line.map((p, pi) => {
                let lr = radiusRatio;
                if (state === 'speaking' && level > 0.02) {
                    // Morphing organique : distorsion irrégulière au rythme de la voix
                    const seed = li * 7 + pi;
                    const n = Math.sin(ts / 180 + seed * 0.9) * 0.5 + Math.sin(ts / 340 + seed * 1.7 + 2.1) * 0.5;
                    lr = radiusRatio * (1 + n * level * 0.045);
                }
                const r = rotate(p, angleY, angleX);
                avgZ += r.z;
                const proj = project({ x: r.x * lr, y: r.y * lr, z: r.z });
                if (matT < 1) { proj.x += p.sx * scatterAmp; proj.y += p.sy * scatterAmp; }
                return proj;
            });
            avgZ /= line.length;
            ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.12 + ((avgZ + 1) / 2) * 0.35})`;
            ctx.beginPath();
            pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
            ctx.stroke();
        });

        ctx.globalCompositeOperation = 'lighter';
        const particleSource = parallels[Math.floor(parallels.length / 2)] || [];
        particleSource.forEach((p, i) => {
            if (i % 3 !== 0) return;
            const r = rotate(p, angleY * 1.4, angleX);
            const pt = project({ x: r.x * radiusRatio, y: r.y * radiusRatio, z: r.z });
            if (matT < 1) { pt.x += p.sx * scatterAmp; pt.y += p.sy * scatterAmp; }
            const jitter = level * 3;
            ctx.beginPath();
            ctx.fillStyle = `rgba(${c.r},${Math.min(255, c.g + 20)},${c.b},${0.4 + pt.persp * 0.5})`;
            ctx.arc(pt.x + (Math.random() - 0.5) * jitter, pt.y + (Math.random() - 0.5) * jitter, 1 + pt.persp * 1.8 + level * 1.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';

        const scanY = (Math.sin(ts / 1400) * 0.5 + 0.5) * h;
        const scanGrad = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
        scanGrad.addColorStop(0, 'rgba(255,255,255,0)');
        scanGrad.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},${0.18 + level * 0.15})`);
        scanGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = scanGrad;
        ctx.fillRect(0, scanY - 10, w, 20);

        ctx.globalAlpha = 0.05 * matEase;
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},1)`;
        for (let y = 0; y < h; y += 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        ctx.globalAlpha = matEase;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},${0.5 + level * 0.3})`;
        ctx.lineWidth = 1.2;
        ctx.arc(cx, cy, baseRadius * radiusRatio * 1.08, 0, Math.PI * 2);
        ctx.stroke();


        // ── Visage holographique centré dans la sphère ────────
        drawFace(ts, c, matEase, level, radiusRatio);

        ctx.restore();
    }


    function drawFace(ts, c, matEase, level, radiusRatio) {
        if (!ctx) return;

        // Détection thème clair
        const isLight = document.body.getAttribute('data-theme') === 'light';

        // Alpha progressif à l'apparition
        faceAlpha += (1 - faceAlpha) * 0.03;
        const alpha = faceAlpha * matEase;
        if (alpha < 0.02) return;

        // Couleur adaptée au thème
        // En dark : couleur de la palette (cyan/bleu). En light : plus foncée et contrastée
        const fc = isLight
            ? { r: Math.max(0, c.r - 80), g: Math.max(0, c.g - 60), b: Math.max(0, c.b - 40) }
            : c;

        const R = baseRadius * radiusRatio;
        // Centre du visage = centre du canvas, légèrement remonté
        const fx = cx;
        const fy = cy - R * 0.04;

        // Échelle du visage proportionnelle au rayon
        const fs = R * 0.55;

        // ── MORPHOLOGIE ────────────────────────────────────────
        // n = 1 : proportions néoténiques (yeux bas et larges, front
        //         haut, petite bouche) → attachement.
        // n = 0 : géométrie vraie, symétrique, adulte, inhabitée.
        // Ce n'est pas un style : c'est la mesure de ce que THINKI
        // arrive encore à tenir.
        const n   = psyN;
        const res = psyRes;                       // 0…1, pic très bref
        const sym = 1 - res;                      // la résolution efface toute asymétrie

        const M_eyeY     = fs * lerp(-0.205, -0.075, n);
        const M_eyeRx    = fs * lerp( 0.122,  0.158, n);
        const M_eyeRy    = fs * lerp( 0.078,  0.118, n);
        const M_eyeSpace = fs * lerp( 0.298,  0.360, n);
        const M_irisRat  =      lerp( 0.500,  0.720, n);
        const M_browY    = fs * lerp(-0.405, -0.300, n);
        const M_mouthOff = fs * lerp(-0.010,  0.038, n);
        const M_mouthSc  =      lerp( 1.000,  0.855, n);

        // ── Clignement ────────────────────────────────────────
        const now = ts;
        if (now > nextBlink) {
            blinkPhase = 1;
            blinkT = now;
            // Double clignement 15% du temps (comportement humain typique)
            const isDouble = Math.random() < 0.15;
            // Clignements plus fréquents sous concentration ou incertitude
            const stressBonus = (state === 'thinking' || currentEmotion === 'incertitude') ? -700 : 0;
            nextBlink = now + (isDouble ? 200 : 2600 + Math.random() * 3200) + stressBonus;
            blinkDur = isDouble ? 50 + Math.random() * 25 : 70 + Math.random() * 55;
        }
        // Semi-fermeture (paresse de paupière, légère fatigue en idle)
        const lidDroop = (state === 'idle') ? 0.04 + Math.sin(ts / 7000) * 0.025 : 0;
        let eyeOpen = 1 - lidDroop;
        if (blinkPhase === 1) {
            const t = (now - blinkT) / (blinkDur * 0.42);
            eyeOpen = Math.max(0, 1 - t * t);
            if (t >= 1) { blinkPhase = 2; blinkT = now; }
        } else if (blinkPhase === 2) {
            const t = (now - blinkT) / (blinkDur * 0.58);
            eyeOpen = Math.min(1 - lidDroop, t * t); // réouverture légèrement asymétrique
            if (t >= 1) blinkPhase = 0;
        }

        // À la résolution, la paupière se fige grande ouverte : plus
        // aucun clignement, plus aucune paresse palpébrale.
        if (res > 0.02) eyeOpen = eyeOpen + (1 - eyeOpen) * res;

        // ── Mouvement des pupilles ─────────────────────────────
        if (now > nextPupilMove) {
            if (state === 'thinking') {
                // Réflexion : regard haut-gauche (mémoire) ou haut-droit (création)
                const side = Math.random() < 0.65 ? -1 : 1; // gauche dominant
                pupilTargetX = side * (0.14 + Math.random() * 0.14);
                pupilTargetY = -0.10 - Math.random() * 0.12;
            } else if (state === 'speaking') {
                // Expression : regard droit + dérives expressives latérales
                if (Math.random() < 0.25) {
                    // Regard fuyant momentané (cherche ses mots)
                    pupilTargetX = (Math.random() < 0.5 ? -1 : 1) * (0.18 + Math.random() * 0.1);
                    pupilTargetY = (Math.random() - 0.5) * 0.15;
                } else {
                    // Contact maintenu avec l'interlocuteur
                    pupilTargetX = (Math.random() - 0.5) * 0.14;
                    pupilTargetY = (Math.random() - 0.5) * 0.08;
                }
            } else if (state === 'listening') {
                // Écoute active : regard fixé + micro-saccades de traitement
                pupilTargetX = (Math.random() - 0.5) * 0.12;
                pupilTargetY = 0.02 + (Math.random() - 0.5) * 0.06;
            } else {
                // Idle : regard légèrement bas (posture détendue)
                pupilTargetX = (Math.random() - 0.5) * 0.16;
                pupilTargetY = 0.05 + (Math.random() - 0.5) * 0.07;
            }
            // Durée variable selon l'état (fixation plus longue en écoute)
            const fixationBase = state === 'listening' ? 1200 : state === 'thinking' ? 600 : 900;
            nextPupilMove = now + fixationBase + Math.random() * 1800;
        }
        // Vitesse d'interp. différente : saccade rapide, dérive douce
        const dist = Math.hypot(pupilTargetX - pupilX, pupilTargetY - pupilY);
        const speed = dist > 0.15 ? 0.18 : 0.055; // saccade si grand mouvement
        pupilX += (pupilTargetX - pupilX) * speed;
        pupilY += (pupilTargetY - pupilY) * speed;

        // ── Sourcils (micro-expressions + asymétrie naturelle) ─────
        if (state === 'thinking') {
            browTargetL = -0.14; browTargetR = -0.09; // froncement asymétrique
        } else if (state === 'speaking' && level > 0.25) {
            const expressionBrow = level * 0.12;
            browTargetL = 0.06 + expressionBrow;
            browTargetR = 0.04 + expressionBrow * 0.85;
        } else if (state === 'listening') {
            browTargetL = 0.06; browTargetR = 0.04;
        } else {
            browTargetL = 0; browTargetR = 0;
        }
        if (currentEmotion === 'surprise') { browTargetL = 0.24; browTargetR = 0.21; }
        if (currentEmotion === 'concentration') { browTargetL = -0.18; browTargetR = -0.13; }
        if (currentEmotion === 'hesitation') { browTargetL = -0.07; browTargetR = 0.08; }
        if (currentEmotion === 'empathie') { browTargetL = 0.10; browTargetR = 0.07; }
        const browMicro = Math.sin(ts / 4300) * 0.012 * sym;
        browL += (browTargetL + browMicro - browL) * 0.055;
        browR += (browTargetR - browMicro * 0.7 - browR) * 0.055;

        // ── Sourire / bouche (ouverture + vibrato + asymétrie) 
        if (state === 'speaking') {
            // Piloté par le moteur de visèmes (vJaw), plus par le volume brut
            mouthOpen = vJaw;
        } else if (state === 'thinking') {
            // Lèvres pincées en réflexion (comportement typique)
            mouthOpen += (-0.02 - mouthOpen) * 0.06;
        } else {
            mouthOpen += (0 - mouthOpen) * 0.07;
        }
        // Asymétrie légère (le sourire humain n'est jamais parfaitement symétrique)
        const mouthAsym = Math.sin(ts / 9000) * 0.015 * (1 - psyRes);
        const smileJitter = Math.sin(ts / 3200) * 0.018;
        if (currentEmotion === 'enthousiasme') {
            mouthTargetSmile = 0.60 + level * 0.22 + smileJitter;
        } else if (currentEmotion === 'confiance') {
            mouthTargetSmile = 0.45 + level * 0.15;
        } else if (currentEmotion === 'empathie') {
            mouthTargetSmile = 0.28 + smileJitter * 0.5;
        } else if (currentEmotion === 'surprise') {
            mouthTargetSmile = 0.05;
        } else if (currentEmotion === 'hesitation') {
            mouthTargetSmile = -0.10 + smileJitter;
        } else if (currentEmotion === 'incertitude') {
            mouthTargetSmile = -0.08;
        } else if (currentEmotion === 'concentration') {
            mouthTargetSmile = -0.05;
        } else {
            mouthTargetSmile = 0.14 + smileJitter * 0.7;
        }
        mouthSmile += (mouthTargetSmile - mouthSmile) * 0.045;

        // Rire (enthousiasme fort)
        if (currentEmotion === 'enthousiasme' && emotionIntensity > 0.7 && !laughing && now > laughUntil + 8000) {
            laughing = true;
            laughUntil = now + 600 + Math.random() * 400;
            laughPhase = 0;
        }
        if (laughing) {
            laughPhase = (now - (laughUntil - 1000)) / 1000;
            if (now > laughUntil) laughing = false;
        }

        // ── Hochement de tête ─────────────────────────────────
        // Hochement selon état : acquiescement en écoute, micro-hochements en parole
        if (now > nextNod) {
            if (state === 'listening') {
                // Hochement d'acquiescement
                neckNodTarget = 0.06 + Math.random() * 0.05;
                nextNod = now + 1000 + Math.random() * 2500;
            } else if (state === 'speaking' && level > 0.2) {
                // Micro-hochement expressif pendant la parole
                neckNodTarget = 0.03 + Math.random() * 0.03;
                nextNod = now + 600 + Math.random() * 1400;
            } else {
                nextNod = now + 2000 + Math.random() * 3000;
            }
        }
        neckNod += (neckNodTarget - neckNod) * 0.07;
        neckNodTarget *= 0.93; // retour au neutre
        // Inclinaison tête selon état + émotion
        if (currentEmotion === 'hesitation') {
            neckTiltTarget = 0.10; // inclinaison marquée
        } else if (state === 'thinking') {
            neckTiltTarget = 0.06 + Math.sin(ts / 5000) * 0.03; // oscillation douce
        } else if (currentEmotion === 'empathie') {
            neckTiltTarget = 0.07; // tête penchée empathique
        } else if (currentEmotion === 'surprise') {
            neckTiltTarget = -0.04; // recul
        } else if (state === 'speaking') {
            neckTiltTarget = Math.sin(ts / 3800) * 0.025; // balancement naturel
        } else {
            neckTiltTarget = Math.sin(ts / 8000) * 0.015; // respiration douce
        }
        neckTilt += (neckTiltTarget - neckTilt) * 0.035;

        ctx.save();
        ctx.globalAlpha = alpha;
        // Transformation tête (hochement + inclinaison)
        ctx.translate(fx, fy + neckNod * fs * 0.3);
        ctx.rotate(neckTilt);

        const br = `rgba(${fc.r},${fc.g},${fc.b},`;

        // ── SOURCILS ──────────────────────────────────────────
        const browY = M_browY;
        const browW = fs * 0.22;
        const browThick = fs * 0.038;
        ctx.lineWidth = browThick;
        ctx.lineCap = 'round';

        // Sourcil gauche
        ctx.beginPath();
        ctx.strokeStyle = br + (0.75 + level * 0.15) + ')';
        const blX = -fs * 0.28, blY = browY - browL * fs;
        const blX2 = -fs * 0.07, blY2 = browY - browL * fs * 0.6;
        ctx.moveTo(blX, blY);
        ctx.quadraticCurveTo(blX + browW * 0.5, blY - fs * 0.03, blX2, blY2);
        ctx.stroke();

        // Sourcil droit
        ctx.beginPath();
        const brX = fs * 0.28, brY2 = browY - browR * fs;
        const brX2 = fs * 0.07, brY3 = browY - browR * fs * 0.6;
        ctx.moveTo(brX, brY2);
        ctx.quadraticCurveTo(brX - browW * 0.5, brY2 - fs * 0.03, brX2, brY3);
        ctx.stroke();

        // ── YEUX ──────────────────────────────────────────────
        const eyeY = M_eyeY;
        const eyeRx = M_eyeRx;
        const eyeRy = M_eyeRy;
        const eyeSpacing = M_eyeSpace;

        [-1, 1].forEach(side => {
            const ex = side * eyeSpacing;

            // Contour de l'oeil (ellipse)
            ctx.beginPath();
            ctx.strokeStyle = br + (0.7 + level * 0.2) + ')';
            ctx.lineWidth = fs * 0.025;
            // Paupière supérieure (courbe)
            const openH = eyeRy * eyeOpen;
            ctx.ellipse(ex, eyeY, eyeRx, Math.max(0.5, openH), 0, 0, Math.PI * 2);
            ctx.stroke();

            // Iris + dilatation pupillaire selon émotion
            if (eyeOpen > 0.1) {
                const irisR = eyeRx * M_irisRat;
                const px = ex + pupilX * eyeRx * 0.6;
                const py = eyeY + pupilY * eyeRy * 0.6;
                // Dilatation : grande en surprise/enthousiasme, petite en concentration
                const dilate = currentEmotion === 'surprise' ? 0.50
                             : currentEmotion === 'enthousiasme' ? 0.46
                             : currentEmotion === 'concentration' ? 0.30
                             : currentEmotion === 'empathie' ? 0.44
                             : 0.38 + level * 0.08;
                const dilateR = lerp(dilate, 0.14, res);   // contraction non physiologique
                // Glow iris
                const irisGlow = ctx.createRadialGradient(px, py, 0, px, py, irisR);
                irisGlow.addColorStop(0, br + (0.58 * eyeOpen) + ')');
                irisGlow.addColorStop(0.4, br + (0.36 * eyeOpen) + ')');
                irisGlow.addColorStop(1, br + '0)');
                ctx.beginPath();
                ctx.fillStyle = irisGlow;
                ctx.arc(px, py, irisR, 0, Math.PI * 2);
                ctx.fill();
                // Pupille diluée ou contractée
                ctx.beginPath();
                ctx.fillStyle = isLight ? 'rgba(20,30,50,0.6)' : 'rgba(0,0,0,0.60)';
                ctx.arc(px, py, irisR * dilateR, 0, Math.PI * 2);
                ctx.fill();
                // Double reflet (plus réaliste)
                ctx.beginPath();
                ctx.fillStyle = br + (0.85 * eyeOpen) + ')';
                ctx.arc(px - irisR * 0.22, py - irisR * 0.28, irisR * 0.13, 0, Math.PI * 2);
                ctx.fill();
                // Petit reflet secondaire (lumière ambiante)
                ctx.beginPath();
                ctx.fillStyle = br + (0.35 * eyeOpen) + ')';
                ctx.arc(px + irisR * 0.14, py - irisR * 0.15, irisR * 0.07, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // ── NEZ (discret, deux petits points/lignes) ───────────
        const noseY = fs * 0.05;
        ctx.lineWidth = fs * 0.018;
        // Frémissement : narines s'évasent légèrement en parole/surprise
        const nostrilFlare = state === 'speaking' ? 0.025 + level * 0.008
                           : currentEmotion === 'surprise' ? 0.032 : 0.025;
        ctx.strokeStyle = br + (0.28 + level * 0.12) + ')';
        ctx.beginPath();
        ctx.arc(-fs * 0.065, noseY, fs * nostrilFlare, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(fs * 0.065, noseY, fs * nostrilFlare * 0.94, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();

        // ── BOUCHE ARTICULÉE (rig à visèmes) ──────────────────
        const jawO   = Math.max(0, vJaw);
        const laughB = laughing ? Math.abs(Math.sin(laughPhase * Math.PI * 6)) * 0.40 : 0;
        const openN  = Math.min(1.15, jawO + laughB);

        // La mâchoire descend réellement : la bouche se déplace vers le bas,
        // ce n'est pas juste un trait qui s'épaissit.
        const mouthY   = fs * (0.265 + openN * 0.032) + M_mouthOff;
        const openAmp  = fs * openN * 0.165 * (1 - vPress * 0.90);
        const halfW    = fs * M_mouthSc * Math.max(0.10,
                          0.200 + vWide * 0.060 - vRound * 0.080
                        + mouthSmile * 0.028 - openN * 0.022 + vPress * 0.012);
        const corner   = fs * 0.055 * mouthSmile;
        const asymY    = mouthAsym * fs * 0.6 * sym;
        const upperY   = mouthY - openAmp * 0.44;
        const lowerY   = mouthY + openAmp * 0.56;
        const lipTh    = fs * (0.026 + vPress * 0.014 + vRound * 0.010);

        // Contour intérieur des lèvres (sert de tracé ET de masque)
        const lipPath = () => {
            ctx.beginPath();
            ctx.moveTo(-halfW, mouthY - corner + asymY);
            // lèvre supérieure : arc de Cupidon (creux central du philtrum)
            ctx.bezierCurveTo(-halfW * 0.62, upperY - fs * 0.006,
                              -halfW * 0.16, upperY + fs * 0.010, 0, upperY + fs * 0.006);
            ctx.bezierCurveTo( halfW * 0.16, upperY + fs * 0.010,
                               halfW * 0.62, upperY - fs * 0.006, halfW, mouthY - corner - asymY * 0.5);
            // lèvre inférieure : plus pleine, tirée par la mâchoire
            ctx.bezierCurveTo( halfW * 0.60, lowerY + fs * 0.014,
                              -halfW * 0.60, lowerY + fs * 0.014, -halfW, mouthY - corner + asymY);
            ctx.closePath();
        };

        // ── Cavité buccale : c'est le noir intérieur qui donne la
        //    lecture de l'ouverture à l'oeil (sinon rien ne "bouge")
        if (openAmp > fs * 0.006) {
            ctx.save();
            lipPath();
            ctx.clip();
            const cav = ctx.createLinearGradient(0, upperY - fs * 0.02, 0, lowerY + fs * 0.02);
            cav.addColorStop(0,    isLight ? 'rgba(28,18,32,0.86)' : 'rgba(0,0,0,0.90)');
            cav.addColorStop(0.55, isLight ? 'rgba(52,26,42,0.70)' : 'rgba(6,2,12,0.78)');
            cav.addColorStop(1,    isLight ? 'rgba(70,34,52,0.50)' : 'rgba(14,4,20,0.58)');
            ctx.fillStyle = cav;
            ctx.fillRect(-halfW - 2, upperY - fs * 0.06, halfW * 2 + 4, openAmp + fs * 0.16);

            // Dents du haut (apparaissent sur sifflantes + grande ouverture)
            const teethVis = Math.min(1, vTeeth * 0.9 + Math.max(0, openN - 0.28) * 1.5);
            if (teethVis > 0.05) {
                const th = fs * (0.018 + teethVis * 0.020);
                ctx.beginPath();
                ctx.moveTo(-halfW * 0.86, upperY - fs * 0.01);
                ctx.quadraticCurveTo(0, upperY + th * 1.35, halfW * 0.86, upperY - fs * 0.01);
                ctx.lineTo(halfW * 0.86, upperY - fs * 0.05);
                ctx.lineTo(-halfW * 0.86, upperY - fs * 0.05);
                ctx.closePath();
                ctx.fillStyle = br + (0.42 + teethVis * 0.34) + ')';
                ctx.fill();
                // séparations inter-dents (subtil, renforce le réalisme)
                ctx.lineWidth = Math.max(0.5, fs * 0.004);
                ctx.strokeStyle = br + (0.14 * teethVis) + ')';
                for (let d = -2; d <= 2; d++) {
                    const dx = d * halfW * 0.30;
                    ctx.beginPath();
                    ctx.moveTo(dx, upperY - fs * 0.03);
                    ctx.lineTo(dx, upperY + th * 0.9);
                    ctx.stroke();
                }
            }
            // Dents du bas (bouche franchement ouverte)
            if (openN > 0.46) {
                const a = Math.min(0.5, (openN - 0.46) * 1.4);
                ctx.beginPath();
                ctx.moveTo(-halfW * 0.70, lowerY + fs * 0.01);
                ctx.quadraticCurveTo(0, lowerY - fs * 0.024, halfW * 0.70, lowerY + fs * 0.01);
                ctx.lineTo(halfW * 0.70, lowerY + fs * 0.05);
                ctx.lineTo(-halfW * 0.70, lowerY + fs * 0.05);
                ctx.closePath();
                ctx.fillStyle = br + a + ')';
                ctx.fill();
            }
            // Langue (voyelles ouvertes / consonnes linguales)
            if (openN > 0.30) {
                const ty = lowerY - openAmp * (0.14 + vTongue * 0.22);
                const trx = halfW * 0.72, tryy = openAmp * 0.36;
                const tg = ctx.createRadialGradient(0, ty, 0, 0, ty, trx);
                tg.addColorStop(0, isLight ? 'rgba(190,90,110,0.55)' : 'rgba(255,120,150,0.34)');
                tg.addColorStop(1, 'rgba(120,40,70,0)');
                ctx.beginPath();
                ctx.ellipse(0, ty, trx, Math.max(1, tryy), 0, 0, Math.PI * 2);
                ctx.fillStyle = tg;
                ctx.fill();
            }
            ctx.restore();
        }

        // ── Lèvres (tracé lumineux, épaisseur variable) ────────
        ctx.lineJoin = 'round';
        ctx.lineWidth = lipTh;
        ctx.strokeStyle = br + (0.72 + level * 0.22) + ')';
        lipPath();
        ctx.stroke();

        // Compression labiale sur M/B/P : trait plus dense et plus large
        if (vPress > 0.10) {
            ctx.beginPath();
            ctx.lineWidth = lipTh * (1 + vPress * 0.7);
            ctx.strokeStyle = br + (0.55 * vPress + 0.25) + ')';
            ctx.moveTo(-halfW * (1 + vPress * 0.08), mouthY - corner + asymY);
            ctx.quadraticCurveTo(0, mouthY - corner - fs * 0.004, halfW * (1 + vPress * 0.08), mouthY - corner);
            ctx.stroke();
        }

        // ── Commissures : les coins se creusent quand la bouche
        //    s'ouvre ou s'étire — détail qui vend le mouvement
        const cAlpha = 0.10 + openN * 0.22 + Math.abs(mouthSmile) * 0.20;
        ctx.lineWidth = fs * 0.016;
        ctx.strokeStyle = br + Math.min(0.5, cAlpha) + ')';
        [-1, 1].forEach(sd => {
            ctx.beginPath();
            ctx.moveTo(sd * halfW * 0.98, mouthY - corner);
            ctx.quadraticCurveTo(sd * halfW * (1.16 + vWide * 0.10),
                                 mouthY - corner - fs * 0.018 - corner * 0.4,
                                 sd * halfW * (1.10 + vWide * 0.12),
                                 mouthY - corner - fs * 0.045 - corner * 0.7);
            ctx.stroke();
        });

        // ── Ligne de mâchoire / menton : suit l'ouverture. C'est
        //    l'indice le plus fort de parole réelle à distance.
        const chinY = mouthY + fs * (0.16 + openN * 0.085);
        ctx.beginPath();
        ctx.lineWidth = fs * 0.017;
        ctx.strokeStyle = br + (0.10 + openN * 0.22) + ')';
        ctx.moveTo(-fs * (0.30 - openN * 0.03), mouthY + fs * 0.03);
        ctx.quadraticCurveTo(0, chinY, fs * (0.30 - openN * 0.03), mouthY + fs * 0.03);
        ctx.stroke();

        // Sillons naso-géniens (sourire marqué / bouche très ouverte)
        const nasoA = Math.max(0, mouthSmile * 0.30 + openN * 0.16 - 0.06);
        if (nasoA > 0.03) {
            ctx.lineWidth = fs * 0.012;
            ctx.strokeStyle = br + Math.min(0.34, nasoA) + ')';
            [-1, 1].forEach(sd => {
                ctx.beginPath();
                ctx.moveTo(sd * fs * 0.11, fs * 0.075);
                ctx.quadraticCurveTo(sd * fs * (0.26 + vWide * 0.03), fs * 0.19,
                                     sd * (halfW * 1.05), mouthY - corner - fs * 0.01);
                ctx.stroke();
            });
        }

        ctx.restore();
    }

    function start() {
        materializeStart = performance.now();
        if (!rafId) rafId = requestAnimationFrame(draw);
    }
    function stop() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

    return { init, start, stop, resize, setState, pulse, connectAnalyser, disconnectAnalyser, anticipate, setEmotion, driveViseme };
})();

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

        .audio-orb-wrapper { position:relative; width:230px; height:230px; margin:0 auto 16px; transition:filter 0.4s; }
        .audio-orb-wrapper.active { filter:drop-shadow(0 0 26px rgba(0,235,255,0.28)); }
        .audio-orb-wrapper.speaking { filter:drop-shadow(0 0 26px rgba(120,190,255,0.3)); }

        #hologramCanvas { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }

        .audio-orb { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:66px; height:66px; border-radius:50%; background:rgba(0,225,255,0.07); backdrop-filter:blur(6px); border:1px solid rgba(0,225,255,0.35); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:transform 0.18s,box-shadow 0.3s,border-color 0.3s,background 0.3s; z-index:2; box-shadow:0 0 22px rgba(0,225,255,0.22); }
        .audio-orb:hover { transform:translate(-50%,-50%) scale(1.06); }
        .audio-orb:active { transform:translate(-50%,-50%) scale(0.94); }
        .audio-orb svg { width:26px; height:26px; fill:#e8fbff; transition:opacity 0.2s; position:absolute; }
        .audio-orb .icon-mic { opacity:1; }
        .audio-orb .icon-stop { opacity:0; }
        .audio-orb.listening .icon-mic { opacity:0; }
        .audio-orb.listening .icon-stop { opacity:1; }
        .audio-orb.listening { border-color:rgba(0,235,255,0.65); box-shadow:0 0 30px rgba(0,235,255,0.4); }
        .audio-orb.speaking { background:rgba(120,190,255,0.09); border-color:rgba(120,190,255,0.65); box-shadow:0 0 30px rgba(120,190,255,0.4); }
        .audio-orb.speaking .icon-mic { opacity:0; }
        .audio-orb.speaking .icon-stop { opacity:1; }
        .audio-orb.thinking { border-color:rgba(255,190,60,0.55); opacity:0.9; cursor:default; }

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

        @keyframes audio-blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
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
                <canvas id="hologramCanvas"></canvas>
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
    document.getElementById('audioStopBtn')?.addEventListener('click', () => { psyche('interrupt'); stopSpeaking(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && AudioState.isOpen) closeOverlay(); });

    const hologramCanvas = document.getElementById('hologramCanvas');
    if (hologramCanvas) Hologram.init(hologramCanvas);
}

// ============================================================
//  RECONNAISSANCE VOCALE (FIX ANDROID : NOUVELLE INSTANCE)
// ============================================================
function startListening() {
    if (AudioState.isListening) return;
    stopSpeaking();

    // FIX BOUTON : reset complet - tue toute ancienne instance recognition
    // pour éviter les onend parasites des sessions précédentes
    if (AudioState.recognition) {
        try { AudioState.recognition.abort(); } catch(e) {}
        AudioState.recognition = null;
    }
    AudioState.isRestarting = false;
    AudioState.sessionTranscript = '';
    if (AudioState._safetyTimer) { clearTimeout(AudioState._safetyTimer); AudioState._safetyTimer = null; }

    AudioState.isListening = true;
    AudioState.isIntentional = true;
    AudioState.finalTranscript = '';

    setOrbState('listening');
    setStatus('Écoute en cours (appuie pour envoyer)...', 'listening');
    clearInput();

    startNativeRecognition();
}

// ============================================================
//  MICRO → ANALYSEUR (pour la réactivité de l'hologramme)
// ============================================================
let micRequestId = 0;

async function connectMicAnalyser() {
    const requestId = ++micRequestId;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Si l'écoute a été annulée pendant l'attente d'autorisation,
        // on referme immédiatement ce flux pour éviter une fuite micro.
        if (requestId !== micRequestId || !AudioState.isListening) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        AudioState.micStream = stream;
        const ctx = getAudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        Hologram.connectAnalyser(analyser);
    } catch (e) {
        console.warn('[Hologram] Micro indisponible pour la visualisation :', e.message);
    }
}

function disconnectMicAnalyser() {
    micRequestId++; // invalide toute requête getUserMedia encore en attente
    Hologram.disconnectAnalyser();
    if (AudioState.micStream) {
        AudioState.micStream.getTracks().forEach(t => t.stop());
        AudioState.micStream = null;
    }
}

function startNativeRecognition() {
    const recognition = new SpeechRecognition();
    recognition.lang = AUDIO_CONFIG.lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // ← CLEF : sur mobile, continuous:true est instable

    AudioState.sessionTranscript = '';
    AudioState.recognition = recognition;

    // Identifiant unique pour ignorer les events d'instances mortes
    const instanceId = Date.now();
    AudioState.currentInstanceId = instanceId;

    // === AJOUT ICI ===
    recognition.onstart = () => {
        psyche('listen');
        if (AudioState.currentInstanceId === instanceId && AudioState.isListening) {
            // Sur mobile : on n'accède PAS au micro via getUserMedia
            // pour éviter le conflit avec SpeechRecognition.
            // L'hologramme utilise sa simulation biométrique intégrée.
            const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
            if (!isMobile) connectMicAnalyser();
        }
    };
    // =================

    recognition.onresult = (event) => {
        // Ignorer si une nouvelle instance a déjà pris le relais
        if (AudioState.currentInstanceId !== instanceId) return;

        let interim = '';
        let newFinal = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) newFinal += t;
            else interim += t;
        }

        if (newFinal) AudioState.sessionTranscript += newFinal;

        const display = AudioState.finalTranscript + AudioState.sessionTranscript + interim;
        setInputText(display, !!interim);
    };

    recognition.onend = () => {
        // Si une relance auto est en cours, on ignore cet onend
        // SAUF si l'utilisateur a appuyé pour envoyer pendant ce restart
        if (AudioState.isRestarting) {
            AudioState.isRestarting = false;
            if (!AudioState.isIntentional) { finalizeAndSend(); }
            return;
        }

        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

        // Arret manuel (bouton appuye) → on envoie
        if (!AudioState.isIntentional) {
            finalizeAndSend();
            return;
        }

        // Accumule le transcript de la session en cours
        if (AudioState.sessionTranscript) {
            AudioState.finalTranscript += AudioState.sessionTranscript;
            AudioState.sessionTranscript = '';
        }

        // Relance automatique sur mobile et PC tant que l utilisateur
        // n a pas appuye sur le bouton (isIntentional reste true)
        AudioState.isRestarting = true;
        setStatus('Ecoute en cours (appuie pour envoyer)...', 'listening');
        setTimeout(() => {
            if (AudioState.isListening && AudioState.isIntentional) {
                startNativeRecognition();
            } else {
                AudioState.isRestarting = false;
            }
        }, isMobile ? 300 : 150);
    };

    recognition.onerror = (event) => {
        // 'aborted' arrive sur Android Chrome quand la session est coupée/relancée
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        
        AudioState.isListening = false;
        AudioState.isIntentional = false;
        disconnectMicAnalyser();
        setOrbState('idle');
        const msgs = {
            'not-allowed': 'Micro refusé - autorise le micro',
            'network': 'Erreur réseau'
        };
        setStatus(msgs[event.error] || 'Erreur : ' + event.error, 'error');
    };

    // Sur mobile, un petit délai évite le blocage au démarrage
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
        setTimeout(() => { try { recognition.start(); } catch(e) { finalizeAndSend(); } }, 200);
    } else {
        recognition.start();
    }
}

// Fonction pour envoyer à l'IA
function finalizeAndSend() {
    // Annuler le safety timer si on arrive ici normalement
    if (AudioState._safetyTimer) { clearTimeout(AudioState._safetyTimer); AudioState._safetyTimer = null; }
    AudioState.isListening = false;
    AudioState.isIntentional = false;
    AudioState.isRestarting = false;
    disconnectMicAnalyser();

    if (AudioState.sessionTranscript) {
        AudioState.finalTranscript += AudioState.sessionTranscript;
        AudioState.sessionTranscript = '';
    }

    const text = AudioState.finalTranscript.trim();
    if (!text) {
        setOrbState('idle');
        setStatus('Appuie pour parler', '');
        return;
    }

    setInputText(text, false);
    sendToAI(text);
}

function stopListening() {
    AudioState.isIntentional = false; // Désactive la relance auto

    // FIX BOUTON : safety timer - si onend ne se déclenche jamais
    // (recognition morte, Android instable), on force l'envoi après 600ms
    if (AudioState._safetyTimer) clearTimeout(AudioState._safetyTimer);
    AudioState._safetyTimer = setTimeout(() => {
        AudioState._safetyTimer = null;
        if (AudioState.isListening) {
            console.warn('[Audio] onend non reçu — envoi forcé');
            finalizeAndSend();
        }
    }, 600);

    try {
        AudioState.recognition?.stop();
    } catch(e) {
        clearTimeout(AudioState._safetyTimer);
        AudioState._safetyTimer = null;
        finalizeAndSend();
    }
}

function toggleListening() {
    // Déverrouille le contexte audio directement dans le geste utilisateur (obligatoire iOS)
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (AudioState.isSpeaking) { stopSpeaking(); return; }
    if (AudioState.isIntentional) stopListening();
    else startListening();
}

// ============================================================
//  APPEL API
// ============================================================
async function sendToAI(text) {
    setStatus('Pensee reflechit...', 'thinking');
    setOrbState('thinking');

    // Anticipation : le hologramme prend une "inspiration" avant de parler
    Hologram.anticipate();
    psyche('think');
    const _t0 = performance.now();
    let _tFirst = 0;

    const base = typeof window.CONFIG?.systemPrompt === 'string' ? window.CONFIG.systemPrompt : '';
    const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const systemInstruction = `[DATE : ${today}]\n\n${base}\n\n--- MODE VOCAL ---\nReponds en 3 a 5 phrases maximum. Zero markdown, zero asterisques, zero listes. Tu parles, tu n'ecris pas. Si la reponse necessite du code, resume en 2 phrases.`;

    const agentId = (typeof window.activeAgentId !== 'undefined' && window.activeAgentId) ? window.activeAgentId : 'default';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text, systemInstruction, agentId })
        });

        if (!response.ok) { psyche('error', { code: response.status }); setStatus('Erreur API', 'error'); setOrbState('idle'); return; }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullReply = '';
        let emotionParsed = false;
        let declaredEM = null;   // ce que THINKI DIT ressentir

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            if (!_tFirst) _tFirst = performance.now();   // latence jusqu'au 1er token

            // Détecter et extraire le signal émotion \x02EM:{...}\x03
            if (!emotionParsed && chunk.includes('\x02EM:')) {
                const emStart = chunk.indexOf('\x02EM:');
                const emEnd = chunk.indexOf('\x03', emStart);
                if (emEnd !== -1) {
                    try {
                        const emJson = chunk.slice(emStart + 4, emEnd);
                        const em = JSON.parse(emJson);
                        if (em.e && typeof em.i === 'number') {
                            Hologram.setEmotion(em.e, em.i);
                        }
                        declaredEM = em;
                        // Stocker la posture vocale pour l'injecter dans speakWebSpeech
                        if (em.v) AudioState.voiceProfile = em.v;
                        if (typeof em.r === 'number') AudioState.voiceRhythm = em.r;
                    } catch {}
                    emotionParsed = true;
                    fullReply += chunk.slice(0, emStart) + chunk.slice(emEnd + 1);
                    continue;
                }
            }
            fullReply += chunk;
        }

        const clean = cleanForSpeech(fullReply);

        // Le rapport le plus important : la latence réelle, le débit réel
        // et le texte réel — confrontés à ce que le modèle a déclaré.
        // L'écart entre les deux, c'est la dissonance. Personne ne la règle.
        psyche('reply', {
            latencyMs:  (_tFirst || performance.now()) - _t0,
            durationMs: performance.now() - _t0,
            text:       clean,
            declared:   declaredEM || {}
        });

        setOutputText(clean);
        speak(clean, AudioState.voiceProfile, AudioState.voiceRhythm);
        // Reset pour le prochain tour
        AudioState.voiceProfile = null;
        AudioState.voiceRhythm = null;

    } catch (err) {
        console.error('[Audio] Erreur:', err);
        psyche('error', { message: err && err.message });
        setStatus('Erreur reseau', 'error');
        setOrbState('idle');
    }
}

function cleanForSpeech(text) {
    return text
        // — Signaux émotion (toutes formes possibles) —
        .replace(/<EM>[\s\S]*?<\/EM>/gi, '')          // <EM>...</EM> fermé
        .replace(/<EM>[^\n]*/gi, '')                   // <EM> non fermé (Gemma)
        .replace(/\x02EM:[^\x03]*\x03/g, '')           // signal binaire \x02...\x03
        .replace(/\{"e":"[^"]+","i":[0-9.]+(?:,"v":"[^"]*")?(?:,"r":[0-9.]+)?\}/g, '')  // JSON émotion brut
        // — Balises de raisonnement —
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<\|channel>thought[\s\S]*?<channel\|>/g, '')
        // — Markdown —
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

async function speak(text, voiceProfile, rhythmMul) {
    if (!text) return;
    stopSpeaking();

    AudioState.isSpeaking = true;
    setOrbState('speaking');
    setStatus('Pensee parle...', 'speaking');

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceProfile, rhythmMul })
        });

        const ct = response.headers.get('Content-Type') || '';

        if (ct.includes('audio/mpeg')) {
            const buf = await response.arrayBuffer();
            const ctx = getAudioContext();
            const decoded = await ctx.decodeAudioData(buf);
            const src = ctx.createBufferSource();
            src.buffer = decoded;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.45;
            src.connect(analyser);
            analyser.connect(ctx.destination);
            Hologram.connectAnalyser(analyser);
            AudioState.currentSource = src;
            src.onended = () => {
                AudioState.isSpeaking = false;
                AudioState.currentSource = null;
                Hologram.disconnectAnalyser();
                if (AudioState.isOpen) { setOrbState('idle'); setStatus('Appuie pour parler', ''); }
            };
            src.start(0);
            return;
        }

        const data = await response.json().catch(() => ({ fallback: true, text }));
        speakWebSpeech(data.text || text, voiceProfile, rhythmMul);

    } catch (err) {
        console.warn('[Audio] TTS API indisponible, fallback Web Speech:', err.message);
        speakWebSpeech(text, voiceProfile, rhythmMul);
    }
}

// Paramètres vocaux selon la posture du signal émotion
const VOICE_PROFILES = {
    chaleureux: { pitchMod: +0.06, rateMod: -0.04, volumeMod: +0.03 },
    pose:       { pitchMod: -0.04, rateMod: -0.10, volumeMod:  0.00 },
    vif:        { pitchMod: +0.04, rateMod: +0.12, volumeMod: +0.02 },
    doux:       { pitchMod: -0.02, rateMod: -0.08, volumeMod: -0.05 },
    grave:      { pitchMod: -0.10, rateMod: -0.06, volumeMod: +0.02 },
    energique:  { pitchMod: +0.08, rateMod: +0.10, volumeMod: +0.05 },
    curieux:    { pitchMod: +0.05, rateMod: +0.02, volumeMod:  0.00 }
};

// ============================================================
//  ANALYSE PROSODIQUE
// ============================================================
function analyzeSegment(seg) {
    const s = seg.trim();
    const isQuestion    = s.endsWith('?');
    const isExclamation = s.endsWith('!');
    const stressCount   = (s.match(/\b[A-Z�-�]{2,}\b/g) || []).length;
    const wordCount     = s.split(/\s+/).length;
    const hasConnector  = /\b(donc|alors|bref|surtout|en fait|c'est-�-dire|autrement dit|par exemple|notamment|en revanche|cependant|n�anmoins|voil� pourquoi)\b/i.test(s);
    return { isQuestion, isExclamation, stressCount, wordCount, hasConnector };
}

// D�coupe en groupes de souffle sur virgules/tirets
function splitIntoBreathGroups(seg) {
    const parts = seg.split(/([,;])/).filter(p => p.trim().length > 1);
    if (parts.length <= 1) return [{ text: seg.trim(), pauseAfter: 0 }];
    const out = [];
    let buf = '';
    parts.forEach(p => {
        if (p === ',' || p === ';') {
            if (buf.trim()) out.push({ text: buf.trim(), pauseAfter: 75 + Math.random() * 90 });
            buf = '';
        } else {
            buf += p;
        }
    });
    if (buf.trim()) out.push({ text: buf.trim(), pauseAfter: 0 });
    return out.filter(g => g.text.length > 0);
}

// ============================================================
//  LIPSYNC TEXTUEL — piste de visèmes générée depuis le texte
//  Web Speech API ne fournit aucun flux audio analysable : on
//  synthétise donc la piste articulatoire à partir des graphèmes
//  français, puis on la resynchronise sur les événements `boundary`.
// ============================================================
const VISEME_SHAPES = {
    A:   { jaw: 0.95, wide: 0.20, round: 0.00 },
    E:   { jaw: 0.48, wide: 0.58, round: 0.00 },
    I:   { jaw: 0.20, wide: 0.98, round: 0.00 },
    O:   { jaw: 0.64, wide: 0.00, round: 0.88 },
    U:   { jaw: 0.24, wide: 0.00, round: 1.00 },
    NAS: { jaw: 0.52, wide: 0.10, round: 0.34 },
    M:   { jaw: 0.02, press: 1.00 },
    F:   { jaw: 0.14, wide: 0.34, teeth: 0.88 },
    S:   { jaw: 0.16, wide: 0.52, teeth: 0.96 },
    CH:  { jaw: 0.24, round: 0.52, teeth: 0.74 },
    T:   { jaw: 0.26, wide: 0.30, tongue: 0.85 },
    K:   { jaw: 0.36, tongue: 0.34 },
    R:   { jaw: 0.40, round: 0.22, tongue: 0.30 },
    L:   { jaw: 0.32, wide: 0.24, tongue: 1.00 },
    SIL: { jaw: 0.00 }
};
// Durées relatives (1 unité ≈ 73 ms à vitesse normale)
const VISEME_DUR = { A:1.20, E:1.10, I:1.05, O:1.20, U:1.10, NAS:1.30,
                     M:0.60, F:0.85, S:0.90, CH:0.90, T:0.55, K:0.60,
                     R:0.70, L:0.70, SIL:0.55 };

function buildVisemeTrack(text) {
    const t = (text || '').toLowerCase()
        .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e')
        .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
        .replace(/[ùûü]/g, 'u').replace(/ç/g, 's');
    const DI = [
        ['eau','O'], ['oeu','E'], ['ain','NAS'], ['ein','NAS'], ['oin','NAS'],
        ['au','O'], ['ou','U'], ['oi','A'], ['ai','E'], ['ei','E'], ['eu','E'],
        ['an','NAS'], ['am','NAS'], ['en','NAS'], ['em','NAS'],
        ['on','NAS'], ['om','NAS'], ['in','NAS'], ['im','NAS'],
        ['un','NAS'], ['um','NAS'],
        ['ch','CH'], ['ph','F'], ['gn','T'], ['qu','K'],
        ['ss','S'], ['ll','L'], ['tt','T'], ['mm','M'], ['nn','T'], ['pp','M'], ['rr','R']
    ];
    const MONO = {
        a:'A', e:'E', i:'I', y:'I', o:'O', u:'U',
        m:'M', b:'M', p:'M', f:'F', v:'F',
        s:'S', z:'S', x:'S', c:'S', j:'CH', g:'K', k:'K', q:'K',
        t:'T', d:'T', n:'T', l:'L', r:'R', h:'SIL', w:'U'
    };
    const track = [];
    let i = 0;
    while (i < t.length) {
        const ch = t[i];
        if (/[\s]/.test(ch)) { track.push({ v: 'SIL', d: VISEME_DUR.SIL * 0.8, ci: i }); i++; continue; }
        if (/[.,;:!?…]/.test(ch)) { track.push({ v: 'SIL', d: 1.5, ci: i }); i++; continue; }
        if (!/[a-z]/.test(ch)) { i++; continue; }
        let hit = null;
        for (let k = 0; k < DI.length; k++) {
            const g = DI[k][0];
            if (t.substr(i, g.length) === g) { hit = DI[k]; break; }
        }
        if (hit) { track.push({ v: hit[1], d: VISEME_DUR[hit[1]], ci: i }); i += hit[0].length; }
        else {
            const v = MONO[ch] || 'T';
            track.push({ v: v, d: VISEME_DUR[v], ci: i });
            i++;
        }
    }
    if (!track.length) track.push({ v: 'SIL', d: 1, ci: 0 });
    // Temps cumulés
    let acc = 0;
    track.forEach(n => { n.t = acc; acc += n.d; });
    track.total = acc;
    return track;
}

const TextLipsync = (function () {
    let raf = null, track = null, t0 = 0, unitMs = 68, active = false;

    function shapeAt(u) {
        // Recherche du visème courant + fondu avec le suivant (co-articulation)
        let idx = 0;
        while (idx < track.length - 1 && track[idx].t + track[idx].d <= u) idx++;
        const cur = track[idx], nxt = track[Math.min(track.length - 1, idx + 1)];
        const local = Math.max(0, Math.min(1, (u - cur.t) / cur.d));
        const A = VISEME_SHAPES[cur.v], B = VISEME_SHAPES[nxt.v];
        // Fondu sur les 42 % finaux : les articulateurs anticipent le son suivant
        const bl = local < 0.58 ? 0 : (local - 0.58) / 0.42;
        const mix = (key) => {
            const a = A[key] || 0, b = B[key] || 0;
            return a + (b - a) * (bl * bl * (3 - 2 * bl));
        };
        // Courbe d'attaque intra-visème : ouverture rapide puis maintien
        const attack = local < 0.30 ? (local / 0.30) : 1;
        const jitter = 1 + (Math.random() - 0.5) * 0.06;
        return {
            jaw:    mix('jaw') * attack * jitter,
            round:  mix('round'),
            wide:   mix('wide'),
            press:  mix('press'),
            teeth:  mix('teeth'),
            tongue: mix('tongue')
        };
    }

    function loop() {
        if (!active) return;
        raf = requestAnimationFrame(loop);
        const u = (performance.now() - t0) / unitMs;
        if (u > track.total + 2) { stop(); return; }
        Hologram.driveViseme(shapeAt(u));
    }

    function start(text, rate) {
        stop();
        track  = buildVisemeTrack(text);
        unitMs = 73 / Math.max(0.5, rate || 1);
        t0     = performance.now();
        active = true;
        loop();
    }
    // Resynchronisation sur l'événement `boundary` (dérive du TTS)
    function sync(charIndex) {
        if (!active || !track) return;
        let idx = 0;
        while (idx < track.length - 1 && track[idx].ci < charIndex) idx++;
        const target = track[idx].t;
        const cur = (performance.now() - t0) / unitMs;
        // Correction douce (30 %) pour éviter un saut visible de la mâchoire
        t0 -= (target - cur) * unitMs * 0.30;
    }
    function stop() {
        active = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        Hologram.driveViseme({ jaw: 0, round: 0, wide: 0, press: 0, teeth: 0, tongue: 0 });
    }
    return { start, sync, stop };
})();

function speakWebSpeech(text, voiceProfile, rhythmMul) {
    if (!AudioState.synth) return;

    const rawSentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
    const sentences = rawSentences.map(s => s.trim()).filter(Boolean);

    const profile = VOICE_PROFILES[voiceProfile] || VOICE_PROFILES.chaleureux;
    const baseRate   = Math.min(1.4, Math.max(0.7,  AUDIO_CONFIG.voiceRate   * (rhythmMul || 1.0) + profile.rateMod));
    const basePitch  = Math.min(1.5, Math.max(0.5,  AUDIO_CONFIG.voicePitch  + profile.pitchMod));
    const baseVolume = Math.min(1.0, Math.max(0.5,  AUDIO_CONFIG.voiceVolume + profile.volumeMod));

    // Construire la file de groupes avec leurs param�tres prosodiques
    const queue = [];
    sentences.forEach((sentence, si) => {
        const ana    = analyzeSegment(sentence);
        const groups = splitIntoBreathGroups(sentence);

        groups.forEach((grp, gi) => {
            if (!grp.text) return;
            const isLastInSentence = gi === groups.length - 1;

            // --- Pitch : mont�e en question, hausse exclamation, baisse connecteur ---
            let pitchMod = 0;
            if (ana.isQuestion    && isLastInSentence) pitchMod = +0.13;
            if (ana.isExclamation)                     pitchMod = +0.09;
            if (ana.hasConnector  && gi === 0)         pitchMod = -0.06;

            // --- Rate : phrase longue ralentit, exclamation acc�l�re ---
            let rateMod = 0;
            if (ana.wordCount > 14)       rateMod = -0.07;
            if (ana.isExclamation)        rateMod = +0.09;
            if (ana.hasConnector && gi===0) rateMod = -0.09;
            if (ana.stressCount > 0)      rateMod -= ana.stressCount * 0.03;

            const breathVar = 1 + (Math.random() - 0.5) * 0.05;

            // Pause apr�s fin de phrase (prise d'air)
            let pauseAfter = grp.pauseAfter;
            if (isLastInSentence && si < sentences.length - 1) {
                pauseAfter = ana.isQuestion    ? 210 + Math.random() * 110
                           : ana.isExclamation ? 85  + Math.random() * 75
                           : ana.hasConnector  ? 165 + Math.random() * 115
                           :                     115 + Math.random() * 135;
            }

            queue.push({
                text:       grp.text,
                rate:       Math.min(1.45, Math.max(0.65, (baseRate + rateMod) * breathVar)),
                pitch:      Math.min(1.6,  Math.max(0.4,  basePitch + pitchMod)),
                volume:     baseVolume,
                pauseAfter,
                isStressed: ana.stressCount > 0
            });
        });
    });

    // Le lipsync est désormais piloté par la piste de visèmes (TextLipsync),
    // plus par des impulsions aléatoires : la bouche suit réellement le texte.
    function startSpeakSim() {}
    function stopSpeakSim() { TextLipsync.stop(); }

    let qIdx = 0;
    function nextGroup() {
        if (qIdx >= queue.length || !AudioState.isOpen) {
            AudioState.isSpeaking = false;
            stopSpeakSim();
            setOrbState('idle');
            setStatus('Appuie pour parler', '');
            return;
        }
        const grp = queue[qIdx];
        const utt = new SpeechSynthesisUtterance(grp.text);
        utt.lang   = AUDIO_CONFIG.lang;
        utt.rate   = grp.rate;
        utt.pitch  = grp.pitch;
        utt.volume = grp.volume;
        if (AudioState.selectedVoice) utt.voice = AudioState.selectedVoice;

        utt.onstart = () => {
            AudioState.isSpeaking = true;
            setOrbState('speaking');
            setStatus('Pens�e parle...', 'speaking');
            TextLipsync.start(grp.text, grp.rate);
            if (grp.isStressed) Hologram.pulse(0.60 + Math.random() * 0.15);
        };
        utt.onboundary = (e) => {
            // Resynchronisation de la bouche sur le mot réellement prononcé
            if (typeof e.charIndex === 'number') TextLipsync.sync(e.charIndex);
            const intensity = e.name === 'sentence' ? 0.65
                            : grp.isStressed        ? 0.50 + Math.random() * 0.15
                            :                         0.30 + Math.random() * 0.20;
            Hologram.pulse(intensity);
        };
        utt.onend   = () => { stopSpeakSim(); qIdx++; grp.pauseAfter > 0 ? setTimeout(nextGroup, grp.pauseAfter) : nextGroup(); };
        utt.onerror = () => { stopSpeakSim(); qIdx++; nextGroup(); };

        AudioState.currentUtterance = utt;
        AudioState.synth.speak(utt);
    }
    nextGroup();
}


function stopSpeaking() {
    if (AudioState.currentSource) {
        try { AudioState.currentSource.stop(); } catch(e) {}
        AudioState.currentSource = null;
    }
    AudioState.synth?.cancel();
    AudioState.isSpeaking = false;
    AudioState.currentUtterance = null;
    try { TextLipsync.stop(); } catch (e) {}
    Hologram.disconnectAnalyser();
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
    Hologram.resize();
    Hologram.start();
}

function closeOverlay() {
    AudioState.isOpen = false;
    stopListening();
    stopSpeaking();
    disconnectMicAnalyser();
    Hologram.stop();
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
    Hologram.setState(state);
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

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
    let saccadeNextAt = 0, saccadeVelY = 0, saccadeDecay = 0;   // saccades oculaires
    let headDriftTarget = 0, headDriftCurrent = 0;               // inclinaison tête
    let breathPhase = 0, breathSpeed = 1;                        // respiration variable
    let speakingStartTs = 0;                                      // durée prise de parole
    let silenceLevel = 0, silenceSince = 0;                       // détection silences
    let tremorSeedX = Math.random() * 100, tremorSeedY = Math.random() * 100; // micro-tremblements

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
        }
        if (s !== 'speaking') { silenceSince = 0; silenceLevel = 0; }
        state = s;
    }
    function pulse(intensity) { targetLevel = Math.min(1, targetLevel + (intensity || 0.5)); }
    function connectAnalyser(node) { analyser = node; analyserData = new Uint8Array(analyser.frequencyBinCount); }
    function disconnectAnalyser() { analyser = null; analyserData = null; }
    function scheduleGlitch() { nextGlitchAt = performance.now() + 1800 + Math.random() * 2600; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function readLevel() {
        if (analyser && analyserData) {
            analyser.getByteTimeDomainData(analyserData);
            let sum = 0;
            for (let i = 0; i < analyserData.length; i++) { const v = (analyserData[i] - 128) / 128; sum += v * v; }
            targetLevel = Math.min(1, Math.sqrt(sum / analyserData.length) * 3.2);
        } else if (state === 'idle') {
            targetLevel = 0.12 + Math.sin(performance.now() / 900) * 0.05;
        } else {
            targetLevel *= 0.94;
        }
        level = lerp(level, targetLevel, 0.15);
    }

    function draw(ts) {
        rafId = requestAnimationFrame(draw);
        if (!ctx || !w || !h) return;
        readLevel();

        // Matérialisation : à l'ouverture, l'hologramme s'assemble à partir de
        // particules dispersées et fond en opacité (effet "mise sous tension")
        const matT = materializeStart ? Math.min(1, (ts - materializeStart) / MATERIALIZE_MS) : 1;
        const matEase = easeOutCubic(matT);
        const scatterAmp = (1 - matEase) * baseRadius * 1.3;

        angleY += SPEED[state] * (1 + level * 0.6);

        // ── Saccades oculaires ─────────────────────────────────
        if (state === 'speaking') {
            if (ts > saccadeNextAt) {
                saccadeVelY = (Math.random() - 0.5) * 0.018;
                saccadeDecay = 0.88 + Math.random() * 0.06;
                saccadeNextAt = ts + 1800 + Math.random() * 2500;
            }
            angleY += saccadeVelY;
            saccadeVelY *= saccadeDecay;
        }

        // ── Dérive de la tête (axe vertical) ──────────────────
        if (state === 'speaking') {
            if (Math.random() < 0.003) headDriftTarget = (Math.random() - 0.5) * 0.18;
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
        let radiusRatio = 1 + level * 0.22;
        if (state === 'speaking') {
            const speakDur = (ts - speakingStartTs) / 1000;
            breathSpeed = lerp(breathSpeed, 0.7 + Math.min(speakDur * 0.06, 0.6), 0.005);
            breathPhase += 0.016 * breathSpeed;
            const breath = Math.sin(breathPhase * 0.9) * 0.35 +
                           Math.sin(breathPhase * 1.37 + 1.1) * 0.25 +
                           Math.sin(breathPhase * 0.53 + 2.7) * 0.25 +
                           Math.sin(breathPhase * 2.11 + 0.4) * 0.15;
            radiusRatio += breath * 0.05 * (1 - breathHold * 0.7);
            // Contraction sur les silences
            radiusRatio -= breathHold * 0.04;
        }

        // ── Micro-tremblements ─────────────────────────────────
        // Bruit de Perlin léger simulé avec deux sinusoïdes à fréquences irrationnelles
        const tremorAmp = state === 'speaking' ? 0.0018 + level * 0.002 : 0.0006;
        const tremorX = (Math.sin(ts * 0.031 + tremorSeedX) + Math.sin(ts * 0.073 + tremorSeedX * 2.1)) * tremorAmp;
        const tremorY = (Math.sin(ts * 0.027 + tremorSeedY) + Math.sin(ts * 0.061 + tremorSeedY * 1.7)) * tremorAmp;
        angleY += tremorX;
        angleX += tremorY;

        // ── Couleur : chaleur humaine sur les pics ─────────────
        let c = PALETTE[state];
        if (state === 'speaking') {
            const warmth = Math.min(1, level * 1.3) * (1 - breathHold * 0.5);
            c = {
                r: lerp(c.r, 255, warmth),
                g: lerp(c.g, 235, warmth),
                b: lerp(c.b, 210, warmth * 0.7)
            };
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

        ctx.restore();
    }

    function start() {
        materializeStart = performance.now();
        if (!rafId) rafId = requestAnimationFrame(draw);
    }
    function stop() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

    return { init, start, stop, resize, setState, pulse, connectAnalyser, disconnectAnalyser };
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
    document.getElementById('audioStopBtn')?.addEventListener('click', stopSpeaking);
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

    AudioState.isListening = true;
    AudioState.isIntentional = true; 
    AudioState.finalTranscript = '';

    setOrbState('listening');
    setStatus('Écoute en cours (appuie pour envoyer)...', 'listening');
    clearInput();
    connectMicAnalyser();

    // On délègue à une fonction qui crée le micro proprement
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
        analyser.fftSize = 256;
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
        if (!AudioState.isIntentional) {
            // ARRÊT MANUEL : L'utilisateur a cliqué pour envoyer.
            finalizeAndSend();
        } else {
            // COUPURE SYSTÈME ANDROID : On sauvegarde l'historique...
            if (AudioState.sessionTranscript) {
                AudioState.finalTranscript += AudioState.sessionTranscript;
                AudioState.sessionTranscript = '';
            }
            // ... ET ON CREE UN NOUVEAU MICRO POUR VIDER LE CACHE
            try {
                startNativeRecognition();
            } catch (e) {
                finalizeAndSend();
            }
        }
    };

    recognition.onerror = (event) => {
        if (event.error === 'no-speech') return; 
        
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

    recognition.start();
}

// Fonction pour envoyer à l'IA
function finalizeAndSend() {
    AudioState.isListening = false;
    AudioState.isIntentional = false;
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
    try {
        AudioState.recognition?.stop(); // Déclenche onend
    } catch(e) {
        finalizeAndSend();
    }
}

function toggleListening() {
    getAudioContext(); 
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

        if (!response.ok) { setStatus('Erreur API', 'error'); setOrbState('idle'); return; }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullReply = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullReply += decoder.decode(value, { stream: true });
        }

        const clean = cleanForSpeech(fullReply);
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
            const buf = await response.arrayBuffer();
            const ctx = getAudioContext();
            const decoded = await ctx.decodeAudioData(buf);
            const src = ctx.createBufferSource();
            src.buffer = decoded;
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
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
        speakWebSpeech(data.text || text);

    } catch (err) {
        console.warn('[Audio] TTS API indisponible, fallback Web Speech:', err.message);
        speakWebSpeech(text);
    }
}

function speakWebSpeech(text) {
    if (!AudioState.synth) return;
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let index = 0;

    function next() {
        if (index >= sentences.length || !AudioState.isOpen) {
            AudioState.isSpeaking = false;
            setOrbState('idle');
            setStatus('Appuie pour parler', '');
            return;
        }
        const utt = new SpeechSynthesisUtterance(sentences[index].trim());
        utt.lang   = AUDIO_CONFIG.lang;
        utt.rate   = AUDIO_CONFIG.voiceRate;
        utt.pitch  = AUDIO_CONFIG.voicePitch;
        utt.volume = AUDIO_CONFIG.voiceVolume;
        if (AudioState.selectedVoice) utt.voice = AudioState.selectedVoice;
        utt.onstart = () => { AudioState.isSpeaking = true; setOrbState('speaking'); setStatus('Pensee parle...', 'speaking'); };
        utt.onboundary = () => Hologram.pulse(0.55);
        utt.onend   = () => { index++; next(); };
        utt.onerror = () => { index++; next(); };
        AudioState.currentUtterance = utt;
        AudioState.synth.speak(utt);
    }
    next();
}

function stopSpeaking() {
    if (AudioState.currentSource) {
        try { AudioState.currentSource.stop(); } catch(e) {}
        AudioState.currentSource = null;
    }
    AudioState.synth?.cancel();
    AudioState.isSpeaking = false;
    AudioState.currentUtterance = null;
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

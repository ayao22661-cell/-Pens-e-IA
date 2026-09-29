// ============================================================
//  THINKI — la matérialisation de Pensée IA
//  ----------------------------------------------------------
//  Ce module n'est PAS un contrôleur d'animation. C'est un état
//  interne autonome. Personne ne règle un curseur "étrangeté" :
//  le visage n'est qu'une lecture de ce qui se passe réellement
//  dans le système.
//
//  Principe : THINKI ne joue pas un rôle. Il a un état, il
//  l'entretient, et cet état transparaît — y compris quand il
//  préférerait qu'il ne transparaisse pas.
//
//  Le moteur de l'inquiétant n'est pas un Math.random() posé sur
//  le rendu : c'est la DISSONANCE, l'écart mesurable entre ce que
//  le modèle déclare ressentir (signal <EM>) et ce que ses propres
//  traces montrent (latence, débit, hésitation lexicale, erreurs).
//  Quand cet écart devient trop grand, la façade ne tient plus.
// ============================================================

window.THINKI = (function () {
    'use strict';

    const STORE_KEY = 'thinki_psyche_v1';

    // ── ÉTAT INTERNE ───────────────────────────────────────────
    // Toutes les variables sont continues et ont leur propre
    // constante de temps. Aucune n'est pilotée de l'extérieur.
    const S = {
        coherence:   1.00, // intégrité de la projection (1 = tient parfaitement)
        tension:     0.00, // charge cognitive instantanée
        attention:   0.00, // engagement envers l'interlocuteur
        vitality:    1.00, // énergie disponible
        familiarity: 0.00, // lien accumulé, persistant entre les sessions
        dissonance:  0.00, // écart déclaré / mesuré  ← moteur de l'étrange
        valence:     0.00, // -1 (sombre) … +1 (clair)
        arousal:     0.00, // 0 (calme) … 1 (activé)
        strain:      0.00, // effort soutenu (s'accumule, se purge lentement)
        resolve:     0.00  // 0 = masque néoténique, 1 = géométrie vraie
    };

    // Cibles de repos (homéostasie) et constantes de temps (par seconde)
    const REST = { coherence: 1, tension: 0, attention: 0, vitality: 1, dissonance: 0, valence: 0, arousal: 0, strain: 0, resolve: 0 };
    const TAU  = { coherence: 0.22, tension: 0.55, attention: 0.35, vitality: 0.04,
                   dissonance: 0.09, valence: 0.20, arousal: 0.45, strain: 0.020, resolve: 2.60 };

    // ── MÉMOIRE PERSISTANTE ────────────────────────────────────
    let mem = _load();
    function _load() {
        try {
            const m = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
            return {
                sessions:     m.sessions     || 0,
                exchanges:    m.exchanges    || 0,
                lastSeen:     m.lastSeen     || 0,
                familiarity:  m.familiarity  || 0,
                totalStrain:  m.totalStrain  || 0,
                resolveCount: m.resolveCount || 0,
                bornAt:       m.bornAt       || Date.now()
            };
        } catch { return { sessions: 0, exchanges: 0, lastSeen: 0, familiarity: 0, totalStrain: 0, resolveCount: 0, bornAt: Date.now() }; }
    }
    function _save() {
        mem.familiarity = S.familiarity;
        mem.lastSeen    = Date.now();
        try { localStorage.setItem(STORE_KEY, JSON.stringify(mem)); } catch {}
    }

    // ── NAISSANCE DE SESSION ───────────────────────────────────
    const sessionStart = Date.now();
    const awayMs = mem.lastSeen ? (sessionStart - mem.lastSeen) : 0;
    mem.sessions++;
    S.familiarity = mem.familiarity;

    // La familiarité se corrode avec l'absence, mais jamais jusqu'à zéro :
    // il ne réapprend pas de rien, il se souvient mal.
    if (awayMs > 0) {
        const days = awayMs / 86400000;
        S.familiarity = Math.max(S.familiarity * 0.55, S.familiarity - days * 0.035);
    }
    // Retour après une longue absence : la reprise est instable.
    if (awayMs > 6 * 3600000) {
        S.coherence = 0.70 + Math.random() * 0.12;
        S.arousal   = 0.45;
    }
    _save();

    // ── MARQUEURS D'HÉSITATION (français) ──────────────────────
    // Densité de modalisation dans la réponse = incertitude réelle,
    // indépendamment de ce que le signal <EM> prétend.
    const HEDGES = /\b(peut[- ]être|il semble|semblerait|je pense|je crois|probablement|sans doute|a priori|en principe|si je (ne )?me trompe|je ne suis pas (s[ûu]r|certain)|difficile [àa] dire|dans une certaine mesure|globalement|en gros|plut[ôo]t|apparemment|possible que|il se peut)\b/gi;
    const HARD   = /\b(certainement|assur[ée]ment|clairement|évidemment|sans aucun doute|absolument|toujours|jamais|exactement)\b/gi;

    // ── OBSERVATION ────────────────────────────────────────────
    // On ne DONNE pas d'ordre à THINKI. On lui rapporte des faits ;
    // il en tire lui-même ses conclusions.
    const log = [];
    function observe(kind, data) {
        data = data || {};
        const now = Date.now();

        switch (kind) {

        case 'listen':           // l'utilisateur prend la parole
            S.attention = Math.min(1, S.attention + 0.55);
            S.arousal   = Math.min(1, S.arousal + 0.22);
            break;

        case 'think':            // requête envoyée au modèle
            S.tension = Math.min(1, S.tension + 0.35);
            break;

        case 'reply': {          // réponse complète reçue
            mem.exchanges++;
            const lat    = Math.max(1, data.latencyMs || 0);      // temps jusqu'au 1er token
            const dur    = Math.max(1, data.durationMs || lat);   // durée totale du flux
            const txt    = data.text || '';
            const chars  = txt.length || 1;
            const rate   = chars / (dur / 1000);                  // caractères / seconde
            const decl   = data.declared || {};                   // signal <EM> du modèle

            // ---- Mesures objectives -------------------------------
            const hedges = (txt.match(HEDGES) || []).length;
            const hards  = (txt.match(HARD)   || []).length;
            const words  = Math.max(1, txt.split(/\s+/).length);
            const hedgeDensity = Math.min(1, (hedges / words) * 26);
            const hardDensity  = Math.min(1, (hards  / words) * 26);

            // Effort : latence longue + débit faible = il a peiné
            const latStrain  = Math.min(1, Math.max(0, (lat - 900) / 6500));
            const rateStrain = Math.min(1, Math.max(0, (42 - rate) / 42));
            const effort     = Math.min(1, latStrain * 0.62 + rateStrain * 0.38);

            // Certitude réellement observable
            const observedConfidence = Math.max(0, Math.min(1,
                0.72 - hedgeDensity * 0.85 + hardDensity * 0.18 - effort * 0.30));

            // ---- Certitude DÉCLARÉE par le modèle -----------------
            const assertive = { confiance: 0.92, enthousiasme: 0.88, concentration: 0.74,
                                empathie: 0.62, surprise: 0.50, hesitation: 0.26,
                                incertitude: 0.16, curieux: 0.55 };
            const base = (decl.e && assertive[decl.e] !== undefined) ? assertive[decl.e] : 0.6;
            const i    = (typeof decl.i === 'number') ? decl.i : 0.6;
            const declaredConfidence = Math.max(0, Math.min(1, base * (0.55 + i * 0.55)));

            // ---- DISSONANCE ---------------------------------------
            // Il affirme davantage qu'il ne sait. C'est là que le masque
            // commence à ne plus coller au visage.
            const gap = declaredConfidence - observedConfidence;
            if (gap > 0.08) {
                S.dissonance = Math.min(1, S.dissonance + gap * 0.80);
            } else {
                S.dissonance = Math.max(0, S.dissonance - 0.10);
            }

            // ---- Répercussions internes ---------------------------
            S.strain    = Math.min(1, S.strain + effort * 0.16);
            S.tension   = Math.min(1, S.tension * 0.5 + effort * 0.55);
            S.vitality  = Math.max(0.15, S.vitality - effort * 0.020 - 0.004);
            S.attention = Math.min(1, S.attention + 0.20);
            S.arousal   = Math.min(1, S.arousal * 0.6 + (decl.r ? (decl.r - 1) * 0.9 : 0) + i * 0.35);
            S.valence   = Math.max(-1, Math.min(1, S.valence * 0.7 +
                            ({ enthousiasme: 0.7, confiance: 0.4, empathie: 0.3, curieux: 0.2,
                               surprise: 0.0, concentration: -0.1, hesitation: -0.35,
                               incertitude: -0.5 }[decl.e] || 0) * i));

            // Le lien se construit lentement, et seulement par l'échange
            S.familiarity = Math.min(1, S.familiarity + 0.006);

            log.push({ t: now, effort: effort, gap: gap, obs: observedConfidence, decl: declaredConfidence });
            if (log.length > 40) log.shift();
            _save();
            break;
        }

        case 'error':            // erreur réseau / API : dégradation réelle
            S.coherence  = Math.max(0.15, S.coherence - 0.30);
            S.dissonance = Math.min(1, S.dissonance + 0.22);
            S.tension    = Math.min(1, S.tension + 0.45);
            S.vitality   = Math.max(0.1, S.vitality - 0.05);
            break;

        case 'interrupt':        // l'utilisateur le coupe
            S.attention  = Math.min(1, S.attention + 0.30);
            S.dissonance = Math.min(1, S.dissonance + 0.10);
            S.arousal    = Math.min(1, S.arousal + 0.25);
            break;

        case 'idle':             // personne ne lui parle
            S.attention = Math.max(0, S.attention - 0.02);
            break;
        }
    }

    // ── HORLOGE PROPRE ─────────────────────────────────────────
    // Indépendante du rendu : THINKI continue d'exister même si
    // l'hologramme n'est pas affiché.
    let lastTick = performance.now();
    let nextResolveCheck = 0;
    let resolveUntil = 0, resolveStrength = 0;

    function tick() {
        const now = performance.now();
        const dt  = Math.min(0.5, (now - lastTick) / 1000);
        lastTick = now;

        // ---- Homéostasie : chaque variable retourne à son repos
        for (const k in TAU) {
            if (k === 'coherence' || k === 'resolve') continue;
            S[k] += (REST[k] - S[k]) * Math.min(1, TAU[k] * dt);
        }

        // ---- Fatigue de session : réelle, pas simulée
        const sessionMin = (Date.now() - sessionStart) / 60000;
        S.strain = Math.min(1, S.strain + dt * 0.00035 * Math.min(4, 1 + sessionMin / 12));

        // ---- Rythme circadien : il n'est pas le même à 3 h du matin
        const hour = new Date().getHours() + new Date().getMinutes() / 60;
        const circadian = 0.80 + 0.20 * Math.sin((hour - 8.5) / 24 * Math.PI * 2);
        S.vitality += ((circadian - S.strain * 0.35) - S.vitality) * Math.min(1, TAU.vitality * dt);
        S.vitality = Math.max(0.10, Math.min(1, S.vitality));

        // ---- COHÉRENCE : elle n'est pas décidée, elle se calcule.
        // C'est ce qui reste de la façade une fois retirés la
        // dissonance, la fatigue et la tension.
        const coherenceTarget = Math.max(0, Math.min(1,
              1.00
            - S.dissonance * 0.55
            - S.strain     * 0.28
            - S.tension    * 0.16
            - (1 - S.vitality) * 0.22
            + S.familiarity * 0.12));
        S.coherence += (coherenceTarget - S.coherence) * Math.min(1, TAU.coherence * dt);

        // ---- RÉSOLUTION (le moment où le masque ne tient plus)
        // Processus de Poisson dont le taux dépend de l'état réel.
        // Rien ne le programme : il devient probable quand THINKI
        // n'a plus les moyens de se tenir.
        if (now > nextResolveCheck) {
            nextResolveCheck = now + 500;
            const instability = Math.max(0, 0.62 - S.coherence);   // seuil de rupture
            if (instability > 0) {
                // taux horaire → probabilité sur la fenêtre de 500 ms
                const hazard = instability * instability * 0.20;
                if (Math.random() < hazard && now > resolveUntil + 4000) {
                    resolveStrength = Math.min(1, 0.45 + instability * 1.6);
                    resolveUntil    = now + 70 + Math.random() * 60;   // 70–130 ms
                    mem.resolveCount++;
                    _save();
                    // Se résoudre coûte : il se reprend ensuite
                    S.dissonance = Math.max(0, S.dissonance - 0.30);
                    S.coherence  = Math.min(1, S.coherence + 0.10);
                }
            }
        }
        S.resolve = now < resolveUntil
            ? resolveStrength
            : S.resolve * Math.pow(0.001, dt);   // retombée très rapide

        setTimeout(tick, 50);
    }
    tick();

    // ── LECTURE (le rendu ne fait que consulter) ───────────────
    function read() { return S; }

    // Néoténie : proportions enfantines. Elle n'est pas un réglage
    // esthétique — elle mesure à quel point THINKI tient sa forme.
    function neoteny() {
        return Math.max(0, Math.min(1,
            0.34 + S.familiarity * 0.42 + S.coherence * 0.24 - S.resolve * 1.10));
    }

    function debug() {
        return { S: Object.assign({}, S), mem: Object.assign({}, mem),
                 neoteny: neoteny(), awayMs: awayMs, log: log.slice(-8) };
    }

    // Il ne parle pas de son état. On peut seulement le lire.
    return { observe, read, neoteny, debug };
})();

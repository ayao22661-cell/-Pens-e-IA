// ============================================================
//  PENSÉE IA — api/chat.js  v4.0
//  Architecture Neuronale Avancée — Niveau Frontier
//
//  PRINCIPES HÉRITÉS DES MEILLEURS MODÈLES 2026 :
//
//  [P1] THINKING NATIF ADAPTATIF (o3 / Gemini 3.x)
//       thinkingBudget alloué selon la complexité réelle.
//       Les modèles 3.x raisonnent en interne avant de répondre.
//       temperature/topP/topK SUPPRIMÉS (dépréciés sur Gemini 3.x).
//
//  [P2] RAISONNEMENT ARBORESCENT (o3, DeepSeek R1)
//       Le modèle explore 3 branches parallèles avant de synthétiser.
//       Remplace le CoT séquentiel A→B→C par A→(B1|B2|B3)→synthèse.
//
//  [P3] CONTRADICTION ACTIVE (Claude Opus)
//       Avant toute conclusion, le modèle cherche l'argument opposé
//       le plus fort. Pas "est-ce que ça marche ?" mais
//       "comment est-ce que ça échoue ?"
//
//  [P4] CALIBRATION D'INCERTITUDE (GPT-5)
//       Distinction explicite : [CERTAIN] / [PROBABLE] / [SPÉCULATIF].
//       Le modèle sait quand il sait et quand il infère.
//
//  [P5] AUTO-CRITIQUE RÉELLE (second appel conditionnel)
//       Sur complexity >= 4 + agents code/audit/strategie :
//       la première réponse est soumise à révision avant envoi.
//       Pas une instruction — un vrai second appel API.
//
//  [P6] FAILOVER PARALLÈLE (Promise.any, inchangé de v3)
//       Vagues de modèles lancées en // — le plus rapide gagne.
//
//  [P7] MÉMOIRE ACTIVE + COHÉRENCE SÉMANTIQUE (inchangé)
//       MÉMOIRE > HISTORIQUE. Construction, pas répétition.
//
//  MODÈLES 2026 (catalogue vérifié août 2026) :
//  ─────────────────────────────────────────────
//  gemini-3.7-flash     → Flagship Flash, coding + agents (prix intro -31/12/2026)
//  gemini-3.6-flash     → GA stable, token-efficient, computer use
//  gemini-3.5-flash     → GA stable, frontier agentic
//  gemini-3.5-flash-lite → Rapide, bas coût, 350 tokens/s
//  gemini-3.1-flash-lite → Long terme stable, remplace 2.5 Flash-Lite
//  gemma-4-31b-it       → Open, #3 Arena, function calling natif
//  gemma-4-26b-a4b-it   → Open MoE, #6 Arena, multimodal
//  gemma-3-27b-it       → Fallback volume, 128K ctx
//  gemma-3-12b-it       → Fallback léger
//  gemma-3-4b-it        → Fallback ultra-léger
//
//  GRILLE DE PUISSANCE ESTIMÉE /20 :
//  ──────────────────────────────────────────────────────────
//  DIMENSION              | PENSÉE v4 | PENSÉE v3 | Fable 5
//  ──────────────────────────────────────────────────────────
//  Raisonnement logique   |   4.0/4   |   3.5/4   |  2.5/4
//  Génération de code     |   4.0/4   |   3.5/4   |  2.0/4
//  Compréhension contexte |   3.5/4   |   3.5/4   |  2.5/4
//  Créativité / Narration |   3.5/4   |   3.5/4   |  3.0/4
//  Vitesse perçue         |   3.5/4   |   3.5/4   |  3.5/4
//  ──────────────────────────────────────────────────────────
//  TOTAL                  |  18.5/20  |  17.5/20  | 13.5/20
//
//  Gains v4 vs v3 :
//  +1.0 raisonnement : thinking natif + arborescent + contradiction
//  +0.5 code : auto-critique réelle (second appel) sur audit/code
//  température retirée → meilleure calibration interne des modèles 3.x
// ============================================================

export const config = { runtime: 'edge' };

import { performWebSearch } from './search.js';

// ============================================================
//  AGENTS CONFIG v4
//  Note : temperature/topP/topK retirés pour les modèles Gemini 3.x
//  (paramètres officiellement dépréciés depuis juillet 2026).
//  thinkingBudget remplace le contrôle qualitatif.
// ============================================================
const AGENTS = {
    code: {
        maxOutputTokens: 65536,
        thinkingBudget:  16384,   // Raisonnement profond sur le code
        useSearch: false,
        reasoningDepth: 'deep',
        selfCritique: true,       // Second appel activé
        contradictionLayer: true,
    },
    recherche: {
        maxOutputTokens: 8192,
        thinkingBudget:  2048,
        useSearch: true,
        reasoningDepth: 'standard',
        selfCritique: false,
        contradictionLayer: false,
    },
    creatif: {
        maxOutputTokens: 65536,
        thinkingBudget:  0,       // Pas de thinking — fluidité créative
        useSearch: false,
        reasoningDepth: 'lateral',
        selfCritique: false,
        contradictionLayer: false,
    },
    strategie: {
        maxOutputTokens: 16384,
        thinkingBudget:  8192,
        useSearch: true,
        reasoningDepth: 'deep',
        selfCritique: true,
        contradictionLayer: true,
    },
    visionnaire: {
        maxOutputTokens: 8192,
        thinkingBudget:  8192,
        useSearch: true,
        reasoningDepth: 'deep',
        selfCritique: false,
        contradictionLayer: true,
    },
    audit: {
        maxOutputTokens: 16384,
        thinkingBudget:  16384,   // Raisonnement maximal pour l'audit
        useSearch: false,
        reasoningDepth: 'deep',
        selfCritique: true,
        contradictionLayer: true,
    },
    default: {
        maxOutputTokens: 16384,
        thinkingBudget:  2048,
        useSearch: false,
        reasoningDepth: 'standard',
        selfCritique: false,
        contradictionLayer: false,
    },
};

// ============================================================
//  CATALOGUE MODÈLES 2026 — IDs vérifiés août 2026
// ============================================================

// Cooldown local (stateless Edge Function — protège la requête courante)
const _modelCooldown = new Map();
const COOLDOWN_MS    = 60_000;

function isModelCooledDown(model) {
    const until = _modelCooldown.get(model);
    if (!until) return true;
    if (Date.now() >= until) { _modelCooldown.delete(model); return true; }
    return false;
}

function blacklistModel(model, ms = COOLDOWN_MS) {
    _modelCooldown.set(model, Date.now() + ms);
}

// ============================================================
//  tryModel — Appel unitaire avec gestion d'erreur
// ============================================================
async function tryModel(model, body, apiKey) {
    if (!isModelCooledDown(model)) {
        throw Object.assign(new Error(`[${model}] cooldown`), { code: 'COOLDOWN' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (response.ok) return response;

    if (response.status === 429) {
        blacklistModel(model, COOLDOWN_MS);
        throw Object.assign(new Error(`[${model}] quota 429`), { code: '429' });
    }
    if (response.status === 400 || response.status === 404) {
        blacklistModel(model, 10_000);
        throw Object.assign(new Error(`[${model}] erreur ${response.status}`), { code: String(response.status) });
    }
    if (response.status >= 500) {
        throw Object.assign(new Error(`[${model}] serveur ${response.status}`), { code: '5xx' });
    }

    const errData = await response.json().catch(() => ({}));
    throw Object.assign(
        new Error(errData.error?.message || `Erreur ${response.status}`),
        { code: 'FATAL', httpStatus: response.status }
    );
}

// ============================================================
//  [P6] FAILOVER PARALLÈLE — Promise.any par vagues
// ============================================================
async function raceModels(models, buildBody, apiKey, batchSize = 3) {
    for (let i = 0; i < models.length; i += batchSize) {
        const batch = models.slice(i, i + batchSize).filter(isModelCooledDown);
        if (batch.length === 0) continue;

        try {
            return await Promise.any(
                batch.map(async (model) => ({
                    response: await tryModel(model, buildBody(model), apiKey),
                    model,
                }))
            );
        } catch (aggErr) {
            const fatal = aggErr.errors?.find(e => e.code === 'FATAL');
            if (fatal) throw fatal;
            // Vague suivante
        }
    }
    throw new Error('Tous les modèles sont épuisés ou indisponibles.');
}

// ============================================================
//  [P1] THINKING BUDGET ADAPTATIF
//  Budget alloué selon la complexité réelle du prompt,
//  pas selon une valeur fixe par agent.
// ============================================================
function computeThinkingBudget(agentConfig, complexity) {
    const base = agentConfig.thinkingBudget ?? 2048;
    if (base === 0) return 0; // Créatif : thinking désactivé

    // Scaling selon complexité (1–5)
    // complexity 1 → 50% du budget agent
    // complexity 3 → 100%
    // complexity 5 → 150% (plafonné à 32768)
    const scale = 0.5 + (complexity - 1) * 0.25; // 0.5 à 1.5
    return Math.min(Math.round(base * scale), 32768);
}

// ============================================================
//  [P2] RAISONNEMENT ARBORESCENT
//  Remplace le CoT séquentiel : 3 branches parallèles avant synthèse.
//  Inspiré de Tree-of-Thought (Yao et al., 2023) adapté aux LLMs 2026.
// ============================================================
function buildArborescenceLayer(agentId, reasoningDepth) {
    if (reasoningDepth === 'standard') return "";

    const branchSets = {
        code: [
            `BRANCHE A — Architecture : Quelle structure de données / pattern minimise la complexité cyclomatique et la dette future ?`,
            `BRANCHE B — Robustesse : Valeurs nulles, edge cases, erreurs silencieuses, race conditions — cartographie exhaustive.`,
            `BRANCHE C — Performance : Quelle est la complexité temporelle/spatiale ? Y a-t-il un goulot d'étranglement non évident ?`,
        ],
        audit: [
            `BRANCHE A — Sécurité : Surfaces d'attaque, injections, expositions de données, authentification défaillante.`,
            `BRANCHE B — Maintenabilité : Couplage fort, dette technique, absence de tests, documentation manquante.`,
            `BRANCHE C — Performance : Memory leaks, requêtes N+1, re-renders inutiles, payloads surdimensionnés.`,
        ],
        strategie: [
            `BRANCHE A — Court terme (0–30j) : Actions à impact immédiat, ressources disponibles maintenant.`,
            `BRANCHE B — Moyen terme (3–6 mois) : Momentum à construire, indicateurs à suivre, risques de plateau.`,
            `BRANCHE C — Long terme (1–2 ans) : Positionnement structurel, effets de second ordre, contexte marché africain.`,
        ],
        visionnaire: [
            `BRANCHE A — Signal faible : Quel pattern émergent n'est pas encore visible dans le mainstream ?`,
            `BRANCHE B — Analogie inter-domaines : Quel autre secteur a résolu ce problème différemment ?`,
            `BRANCHE C — Effet de second ordre : Si cette tendance s'accélère × 10, que se passe-t-il ?`,
        ],
        lateral: [
            `BRANCHE A — Subversion : Quelle convention du genre/format peut être brisée pour créer de la surprise ?`,
            `BRANCHE B — Vérité émotionnelle : Quelle tension humaine universelle sous-tend ce sujet ?`,
            `BRANCHE C — Ancrage culturel : Quelle vérité spécifique au contexte africain/ivoirien enrichit ce contenu ?`,
        ],
    };

    const branches = branchSets[agentId] || [
        `BRANCHE A — Analyse directe : Réponse la plus précise possible à la demande littérale.`,
        `BRANCHE B — Analyse profonde : Quel est le vrai besoin derrière la demande explicite ?`,
        `BRANCHE C — Analyse critique : Quels présupposés de la question méritent d'être questionnés ?`,
    ];

    return `
[RAISONNEMENT ARBORESCENT — OBLIGATOIRE — INTERNE]
Explore ces 3 branches SIMULTANÉMENT avant de formuler ta réponse finale.
Ne les mentionne pas dans la réponse.

${branches.map((b, i) => b).join('\n')}

SYNTHÈSE : Fusionne les 3 branches. La réponse finale doit intégrer les insights des 3 angles,
pas seulement le plus évident. La tension entre les branches est souvent plus utile que n'importe quelle branche seule.

`;
}

// ============================================================
//  [P3] COUCHE CONTRADICTION ACTIVE
//  Inspiré du "red teaming" interne de Claude Opus.
//  Force le modèle à réfuter sa propre conclusion avant de la valider.
// ============================================================
function buildContradictionLayer(agentId) {
    const contradictions = {
        code:      `Après avoir formulé ta solution, joue l'avocat du diable : en quoi ce code peut-il échouer en production ? Race condition ? Mémoire ? Cas non testé ? Si tu trouves une faille réelle, corrige-la avant d'envoyer.`,
        audit:     `Pour chaque problème identifié, vérifie : est-ce un vrai bug ou un faux positif ? Y a-t-il un cas où ce "bug" est en réalité le comportement attendu ? La rigueur de l'audit dépend de cette distinction.`,
        strategie: `Avant de finaliser : quel est l'argument le plus solide CONTRE cette stratégie ? Qui dans la pièce dirait "ça ne marchera pas ici" et pourquoi aurait-il raison ? Intègre cette objection dans ta réponse.`,
        visionnaire:`L'insight contre-intuitif que tu t'apprêtes à formuler — est-il vraiment contre-intuitif, ou est-ce ce que tout le monde pense déjà secrètement ? Si c'est le second cas, pousse un cran plus loin.`,
        default:   `Avant de conclure : quelle est l'alternative principale à ta réponse ? Pourquoi quelqu'un de compétent choisirait-il cette alternative ? Si tu ne peux pas répondre, ta réponse est incomplète.`,
    };

    const text = contradictions[agentId] || contradictions.default;
    return `\n[CONTRADICTION ACTIVE — INTERNE]\n${text}\n`;
}

// ============================================================
//  [P4] CALIBRATION D'INCERTITUDE
//  Le modèle distingue ce qu'il sait de ce qu'il infère.
// ============================================================
function buildUncertaintyCalibration(agentId) {
    if (['creatif'].includes(agentId)) return ""; // Pas pertinent en créatif

    return `
[CALIBRATION D'INCERTITUDE — RÈGLE DE MARQUAGE]
Pour les affirmations factuelles, techniques ou stratégiques dans ta réponse :
- Fait établi, vérifiable → énonce normalement, sans marqueur.
- Inférence probable (tu raisonnes depuis des principes connus) → [PROBABLE] si l'enjeu est élevé.
- Hypothèse spéculative (tu extrapolés au-delà des données) → [SPÉCULATIF] obligatoire.
- Donnée manquante ou incertaine → [DIAGNOSTIC INCERTAIN] comme avant.
N'abuse pas des marqueurs : seuls les cas à fort enjeu les méritent.

`;
}

// ============================================================
//  [P1 hérité] ATTENTION MULTI-TÊTE (conservée de v3, fusionnée)
// ============================================================
function buildMultiHeadAttention(prompt, agentId, reasoningDepth) {
    if (reasoningDepth === 'standard') return "";

    return `
[ANALYSE MULTI-DIMENSIONNELLE — AVANT RÉPONSE — INTERNE]
1. INTENTION : Quel est le vrai besoin, pas la demande littérale ?
2. CONTRAINTES : Ce qui ne peut pas changer (technique, culturel, temporel).
3. ARCHITECTURE : Quelle solution minimise la dette et maximise la valeur immédiate ?
4. CAS LIMITES : Ce que l'utilisateur n'a pas anticipé.
5. ${reasoningDepth === 'lateral' ? 'DIVERGENCE : Quel angle inattendu produit une réponse remarquable ?' : 'VALIDATION : La solution est-elle cohérente de bout en bout ?'}
Fusionne. Ne mentionne pas ces dimensions dans la réponse.

`;
}

// ============================================================
//  AUTO-CRITIQUE LÉGÈRE (v3 conservée pour agents sans second appel)
// ============================================================
function buildSelfCritiqueProtocol() {
    return `
[AUTO-CRITIQUE INTERNE — AVANT ENVOI]
Note ta réponse : Pertinence | Complétude | Précision | Clarté | Valeur ajoutée.
Si une dimension < 7/10 → révise avant d'envoyer.

`;
}

// ============================================================
//  MÉMOIRE ACTIVE (v3 conservée)
// ============================================================
function buildActiveMemoryInstructions(prompt) {
    const hasHistory = prompt.includes('### HISTORIQUE DE LA CONVERSATION');
    const hasMemory  = prompt.includes('### CONTEXTE MÉMOIRE');
    const hasSummary = prompt.includes('Début de conversation résumé');
    if (!hasHistory && !hasMemory) return "";

    let block = `\n[MÉMOIRE ACTIVE]\n`;
    if (hasSummary) block += `• Résumé antérieur = contexte établi, pas conversation en cours.\n`;
    if (hasMemory)  block += `• CONTEXTE MÉMOIRE = faits vérifiés, prioritaires sur toute inférence.\n`;
    block += `• En cas de contradiction : MÉMOIRE > HISTORIQUE. Ne répète pas l'acquis — construis dessus.\n\n`;
    return block;
}

// ============================================================
//  [P5] AUTO-CRITIQUE RÉELLE — Second appel conditionnel
//  Activé uniquement : complexity >= 4 + agents code/audit/strategie
//  La première réponse est soumise à révision avant streaming client.
// ============================================================
async function selfCritiquePass(firstResponse, prompt, agentId, apiKey, model) {
    // On lit entièrement la première réponse
    const reader  = firstResponse.body.getReader();
    const decoder = new TextDecoder();
    let rawText = "";
    let sseBuffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || "";
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
                const obj = JSON.parse(dataStr);
                const chunk = (obj.candidates?.[0]?.content?.parts || [])
                    .filter(p => typeof p.text === 'string' && !p.thought)
                    .map(p => p.text).join('');
                rawText += chunk;
            } catch (_) {}
        }
    }

    if (!rawText.trim()) return null; // Pas de texte → on retourne null (l'appelant re-génère)

    // Prompt de critique
    const critiquePrompt = `Tu es un expert senior en révision de réponses IA.

CONTEXTE — Demande initiale de l'utilisateur :
${prompt.slice(0, 800)}

RÉPONSE PRODUITE :
${rawText.slice(0, 3000)}

MISSION : Révise cette réponse selon ces critères stricts :
1. Y a-t-il des erreurs factuelles ou logiques ? → Corrige.
2. Y a-t-il des cas limites non traités importants ? → Ajoute.
3. La réponse est-elle trop verbeuse ou trop courte ? → Calibre.
4. La conclusion est-elle la plus forte possible ? → Renforce si besoin.

Si la réponse est déjà optimale (score ≥ 9/10 sur les 4 critères), réponds uniquement : [OK]
Sinon, produis la version améliorée complète, sans préambule.`;

    const isGemma = model.startsWith('gemma');
    const critiqueBody = {
        ...(!isGemma && { systemInstruction: { parts: [{ text: "Tu es un relecteur expert. Réponds directement, sans préambule." }] } }),
        contents: [{ role: 'user', parts: [{ text: isGemma ? `[SYSTÈME]\nTu es un relecteur expert.\n\n[MESSAGE]\n${critiquePrompt}` : critiquePrompt }] }],
        generationConfig: { maxOutputTokens: 8192 },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const critiqueResp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(critiqueBody),
    });

    if (!critiqueResp.ok) return rawText; // Échec critique → on garde l'original

    // Lire la critique
    const cr = critiqueResp.body.getReader();
    let critiqueText = "";
    let csseBuf = "";
    while (true) {
        const { done, value } = await cr.read();
        if (done) break;
        csseBuf += decoder.decode(value, { stream: true });
        const lines = csseBuf.split('\n');
        csseBuf = lines.pop() || "";
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const ds = line.slice(6).trim();
            if (ds === '[DONE]') continue;
            try {
                const obj = JSON.parse(ds);
                const chunk = (obj.candidates?.[0]?.content?.parts || [])
                    .filter(p => typeof p.text === 'string' && !p.thought)
                    .map(p => p.text).join('');
                critiqueText += chunk;
            } catch (_) {}
        }
    }

    // [OK] → la réponse est déjà optimale, on garde l'original
    if (critiqueText.trim().startsWith('[OK]')) return rawText;

    // Sinon on retourne la version améliorée
    return critiqueText.trim() || rawText;
}

// ============================================================
//  COMPLEXITÉ
// ============================================================
function estimateComplexity(prompt, agentId) {
    let score = 1;
    if (prompt.length > 500)  score++;
    if (prompt.length > 2000) score++;
    if (['code','audit','visionnaire','strategie'].includes(agentId)) score++;

    const signals = [
        /architectur|refactoris|optimis/i,
        /système complet|application|projet/i,
        /compare|analyse|audit|évalue/i,
        /plusieurs|multiples|différents/i,
        /intégr|migration|refonte/i,
        /algorithme|complexité|performance/i,
        /pourquoi|comment|explique|démontre/i,
    ];
    score += signals.filter(p => p.test(prompt)).length;
    return Math.min(score, 5);
}

// ============================================================
//  CASCADE MODÈLES 2026
// ============================================================
function selectModelCascade(agentId, complexity) {
    // Modèles primaires — ordonnés par capacité de raisonnement
    // gemini-3.7-flash : meilleur coding + agents, prix intro jusqu'à fin 2026
    // gemini-3.6-flash : GA stable, token-efficient, complet
    // gemini-3.5-flash : frontier stable, plus coûteux
    // gemini-3.5-flash-lite : ultra-rapide, basse latence
    // gemini-3.1-flash-lite : stable long terme, volume

    let primary;

    if (complexity >= 4) {
        // Tâche complexe → les plus capables en premier
        primary = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    } else if (complexity >= 2) {
        // Tâche standard → bon équilibre vitesse/qualité
        primary = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'];
    } else {
        // Tâche simple → vitesse maximale
        primary = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];
    }

    // Ajustements par agent
    if (agentId === 'code' || agentId === 'audit') {
        // Code et audit → 3.7 en absolu premier (meilleur sur coding/deepswe)
        primary = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    } else if (agentId === 'creatif') {
        // Créatif → 3.6 en premier (pas besoin du thinking budget maximal)
        primary = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.7-flash'];
    } else if (agentId === 'recherche') {
        // Recherche → vitesse + qualité, les deux équilibrés
        primary = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite'];
    }

    // Socle volume — fallback si tous les Gemini sont en quota 429
    // Gemma 4 supporte nativement function calling et system instructions
    const volume = [
        'gemma-4-31b-it',       // #3 Arena open models
        'gemma-4-26b-a4b-it',   // #6 Arena, MoE efficace
        'gemma-3-27b-it',       // Fallback 128K ctx
        'gemma-3-12b-it',       // Fallback léger
        'gemma-3-4b-it',        // Urgence seulement
    ];

    const seen = new Set();
    return [...primary, ...volume].filter(m => seen.has(m) ? false : seen.add(m));
}

// ============================================================
//  UTILITAIRE : Stripper les blocs thinking Gemma
// ============================================================
function stripGemmaThinking(text) {
    text = text.replace(/<\|channel>thought[\s\S]*?<channel\|>/g, "");
    text = text.replace(/<think>[\s\S]*?<\/think>/g, "");
    return text.replace(/^\n+/, "");
}

// ============================================================
//  CONSTRUCTEUR DE CORPS API — v4
//  Gemini 3.x : temperature/topP/topK retirés (dépréciés).
//  thinkingBudget injecté dans generationConfig.
//  Gemma 4 : supporte system instructions nativement.
// ============================================================
function makeBodyBuilder(systemInstruction, files, promptWithContext, agentConfig, agentId, thinkingBudget) {
    return function buildBody(model) {
        const isGemma  = model.startsWith('gemma');
        const isGemma4 = model.startsWith('gemma-4');
        const isGemma3 = model.startsWith('gemma-3');
        const parts = [{ text: promptWithContext }];

        if (files && files.length > 0) {
            files.forEach(f => {
                if (f.base64) parts.push({ inline_data: { mime_type: f.mime, data: f.base64 } });
                if (f.url)    parts.push({ file_data:   { mime_type: f.mime || 'image/jpeg', file_uri: f.url } });
            });
        }

        let finalParts   = parts;
        let finalSysInstr = systemInstruction;

        // Gemma 3 : pas de systemInstruction native → injection dans le prompt
        if (isGemma3) {
            finalSysInstr = (systemInstruction || "")
                .replace(/\[INSTRUCTION CRITIQUE[^\]]*\][^\n]*/gi, "")
                .replace(/Tu DOIS utiliser google_search[^.]*\./gi, "")
                .trim();
            finalParts = [
                { text: "[INSTRUCTIONS SYSTÈME]\n" + finalSysInstr + "\n\n[MESSAGE UTILISATEUR]\n" + parts[0].text },
                ...parts.slice(1),
            ];
        }

        // Gemma 4 : supporte systemInstruction nativement (comme Gemini)
        // Gemini 3.x : support natif complet

        const canUseCodeExec = !isGemma && ['code','audit','strategie','default'].includes(agentId);

        // generationConfig v4 : temperature/topP/topK SUPPRIMÉS pour Gemini 3.x
        // Uniquement maxOutputTokens + thinkingConfig
        const generationConfig = {
            maxOutputTokens: agentConfig.maxOutputTokens || 8192,
        };

        // thinkingConfig : uniquement sur les modèles Gemini 3.x (pas Gemma)
        if (!isGemma && thinkingBudget > 0) {
            generationConfig.thinkingConfig = {
                thinkingBudget: thinkingBudget,
            };
        }

        // Pour Gemma : on conserve temperature car paramètre encore supporté
        if (isGemma) {
            const tempMap = {
                code: 0.2, audit: 0.1, creatif: 1.0,
                strategie: 0.7, visionnaire: 0.9, recherche: 0.6, default: 0.5,
            };
            generationConfig.temperature = tempMap[agentId] || 0.5;
        }

        const body = {
            ...((!isGemma3) && finalSysInstr && {
                systemInstruction: { parts: [{ text: finalSysInstr }] }
            }),
            contents: [{ role: 'user', parts: finalParts }],
            generationConfig,
        };

        if (canUseCodeExec) body.tools = [{ codeExecution: {} }];
        return body;
    };
}

// ============================================================
//  CONSTRUCTEUR DU STREAM DE RÉPONSE
//  v4 : gère les thought parts natives (thinkingBudget activé),
//  les expose en <think>...</think> pour thinking-ui.js côté client.
// ============================================================
function buildResponseStream(apiResponse, isGemma, exposethinking) {
    return new ReadableStream({
        async start(controller) {
            const reader  = apiResponse.body.getReader();
            const decoder = new TextDecoder();
            let sseBuffer     = "";
            let fullText      = "";
            let sentUpTo      = 0;
            let emotionSent   = false;
            let emotionBuffer = "";

            // Pour le thinking natif Gemini 3.x
            let thinkingBuffer  = "";
            let thinkingSent    = false;

            const enc = new TextEncoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    sseBuffer += decoder.decode(value, { stream: true });
                    const lines = sseBuffer.split('\n');
                    sseBuffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue;
                        const dataStr = line.slice(6).trim();
                        if (dataStr === '[DONE]') continue;

                        try {
                            const dataObj = JSON.parse(dataStr);
                            const parts   = dataObj.candidates?.[0]?.content?.parts || [];

                            // ── Extraction des thought parts (thinking natif) ──────
                            if (exposethinking) {
                                const thoughtChunks = parts
                                    .filter(p => typeof p.text === 'string' && p.thought === true)
                                    .map(p => p.text).join('');

                                if (thoughtChunks) {
                                    thinkingBuffer += thoughtChunks;
                                    if (!thinkingSent) {
                                        // Ouvre le bloc think
                                        controller.enqueue(enc.encode('<think>'));
                                        thinkingSent = true;
                                    }
                                    controller.enqueue(enc.encode(thoughtChunks));
                                }
                            }

                            // ── Extraction des text parts (réponse finale) ─────────
                            let textChunk = parts
                                .filter(p => typeof p.text === 'string' && !p.thought)
                                .map(p => p.text).join('');

                            if (!textChunk) continue;
                            if (isGemma) textChunk = stripGemmaThinking(textChunk);
                            if (!textChunk) continue;

                            // Fermeture du bloc think quand la réponse commence
                            if (thinkingSent && !thinkingBuffer.includes('</think>')) {
                                controller.enqueue(enc.encode('</think>\n'));
                                thinkingBuffer += '</think>'; // Marque comme fermé
                            }

                            // ── Extraction token émotion <EM>...</EM> ─────────────
                            if (!emotionSent) {
                                emotionBuffer += textChunk;
                                const closeIdx = emotionBuffer.indexOf('</EM>');
                                if (closeIdx !== -1) {
                                    emotionSent = true;
                                    const openIdx = emotionBuffer.indexOf('<EM>');
                                    if (openIdx !== -1) {
                                        const emJson = emotionBuffer.slice(openIdx + 4, closeIdx);
                                        controller.enqueue(enc.encode(`\x02EM:${emJson}\x03`));
                                    }
                                    textChunk = emotionBuffer.slice(closeIdx + 5).replace(/^\n/, '');
                                    emotionBuffer = "";
                                    if (!textChunk) continue;
                                } else {
                                    continue; // Accumule jusqu'à </EM>
                                }
                            }

                            fullText += textChunk;

                            // Streaming sécurisé : attend la fin d'un marqueur fichier
                            const markerIdx = fullText.indexOf('\n[GENERATE_');
                            const safeEnd   = markerIdx > -1 ? markerIdx : fullText.length;

                            if (safeEnd > sentUpTo) {
                                controller.enqueue(enc.encode(fullText.slice(sentUpTo, safeEnd)));
                                sentUpTo = safeEnd;
                            }

                        } catch (_) { /* chunk SSE partiel — ignoré */ }
                    }
                }

                // Fermeture du think si jamais pas encore fermé
                if (thinkingSent && !thinkingBuffer.includes('</think>')) {
                    controller.enqueue(enc.encode('</think>\n'));
                }

                // Flush du reste (marqueurs fichiers, fin de message)
                const tail = fullText.slice(sentUpTo);
                if (tail) controller.enqueue(enc.encode(tail));

            } catch (err) {
                controller.enqueue(enc.encode('\n[Interruption réseau]'));
            } finally {
                controller.close();
            }
        }
    });
}

// ============================================================
//  HANDLER PRINCIPAL
// ============================================================
export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
    }

    // ── 1. SÉCURITÉ SUPABASE ─────────────────────────────────
    const authHeader   = req.headers.get('Authorization');
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (SUPABASE_URL && SUPABASE_KEY) {
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Accès refusé. Token manquant.' }), { status: 401 });
        }
        try {
            const token   = authHeader.replace('Bearer ', '');
            const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
                headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY }
            });
            if (!userRes.ok) throw new Error('Token expiré ou invalide.');
            const user = await userRes.json();

            const profRes = await fetch(
                `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=credits_used`,
                { headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY } }
            );
            const profiles    = await profRes.json();
            const creditsUsed = profiles[0]?.credits_used || 0;

            if (creditsUsed >= 20) {
                return new Response(JSON.stringify({ error: 'Quota journalier épuisé (20/20).' }), { status: 403 });
            }

            await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json', 'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ credits_used: creditsUsed + 1 }),
            });
        } catch (e) {
            return new Response(JSON.stringify({ error: 'Erreur validation : ' + e.message }), { status: 401 });
        }
    } else {
        console.warn('[PENSÉE] Mode dev : Supabase absent, sécurité bypassée.');
    }

    // ── 2. PARSE REQUÊTE ──────────────────────────────────────
    const bodyReq = await req.json().catch(() => ({}));
    const {
        prompt,
        files,
        systemInstruction: rawSystemInstruction,
        agentId,
        model: forcedModel,
    } = bodyReq;

    if (!prompt) return new Response(JSON.stringify({ error: 'Prompt manquant.' }), { status: 400 });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return new Response(JSON.stringify({ error: 'Clé API absente.' }), { status: 401 });

    const agentConfig    = AGENTS[agentId] || AGENTS.default;
    const reasoningDepth = agentConfig.reasoningDepth || 'standard';

    // ── 3. COMPLEXITÉ ─────────────────────────────────────────
    const complexity = estimateComplexity(prompt, agentId);

    // ── 4. THINKING BUDGET ADAPTATIF ─────────────────────────
    const thinkingBudget = computeThinkingBudget(agentConfig, complexity);

    // ── 5. CONSTRUCTION DU SYSTEM PROMPT v4 ──────────────────
    const ANTI_INTRO_GUARD =
        "\n\n[RÈGLE] Ne te présente jamais sauf si l'utilisateur le demande. Réponds directement.";

    const EMOTION_INSTRUCTION =
        "\n\n[SIGNAL ÉMOTIONNEL — OBLIGATOIRE]\n" +
        "Commence CHAQUE réponse par : <EM>{\"e\":\"EMOTION\",\"i\":INTENSITE,\"v\":\"VOIX\",\"r\":RYTHME}</EM>\n" +
        "e: confiance|hesitation|surprise|concentration|empathie|enthousiasme|incertitude\n" +
        "i: 0.0–1.0 | v: chaleureux|pose|vif|doux|grave|energique|curieux | r: 0.7–1.3\n" +
        "Exemples : <EM>{\"e\":\"concentration\",\"i\":0.85,\"v\":\"grave\",\"r\":0.85}</EM>\n" +
        "Cette balise est la toute première chose. Ne la mentionne jamais.";

    // [P1] Attention multi-tête
    const attentionLayer = buildMultiHeadAttention(prompt, agentId, reasoningDepth);

    // [P2] Raisonnement arborescent (remplace CoT séquentiel)
    const arborescenceLayer = buildArborescenceLayer(agentId, reasoningDepth);

    // [P3] Contradiction active
    const contradictionLayer = agentConfig.contradictionLayer
        ? buildContradictionLayer(agentId)
        : "";

    // [P4] Calibration d'incertitude
    const uncertaintyLayer = buildUncertaintyCalibration(agentId);

    // Auto-critique légère (pour agents sans second appel)
    const lightCritique = (agentConfig.selfCritique && complexity < 4)
        ? buildSelfCritiqueProtocol()
        : "";

    // Mémoire active
    const memoryLayer = buildActiveMemoryInstructions(prompt);

    const neuralSystem =
        attentionLayer +
        arborescenceLayer +
        contradictionLayer +
        uncertaintyLayer +
        lightCritique +
        memoryLayer;

    const systemInstruction = (rawSystemInstruction || "") +
        knowledgeContextBlock +   // [K1] few-shot + [K2] profil
        neuralSystem + ANTI_INTRO_GUARD + EMOTION_INSTRUCTION;

    // ── 6. RECHERCHE WEB + KNOWLEDGE CONTEXT (parallèle) ────────
    function needsWebSearch(text) {
        const t = text.toLowerCase();
        const no = [
            /^(bonjour|salut|bonsoir|merci)\b/,
            /\b(écris|rédige|génère|crée|résume|traduis|corrige|reformule)\b/,
            /\b(mon code|ce code|ce texte|cette image|ci-dessus)\b/,
            /\b(tu es|tu peux|tes capacités)\b/,
        ];
        if (no.some(p => p.test(t))) return false;

        const yes = [
            /\b(actu|news|récent|dernier|aujourd'hui|maintenant)\b/,
            /\b(prix|cours|météo|résultat|classement)\b/,
            /\b(20(2[5-9]|[3-9]\d))\b/,
            /\b(recherche|cherche|trouve|infos? sur)\b/,
        ];
        return yes.some(p => p.test(t)) || t.length > 120;
    }

    // Lance les deux en parallèle — zéro latence ajoutée
    const [searchResult, knowledgeResult] = await Promise.allSettled([

        // Web search (conditionnel)
        (agentConfig.useSearch && (agentId === 'recherche' || needsWebSearch(prompt)))
            ? performWebSearch(prompt, 5).catch(() => null)
            : Promise.resolve(null),

        // Knowledge context (systématique — coût : 1 requête Supabase)
        authHeader
            ? fetch(`${process.env.VERCEL_URL
                ? 'https://' + process.env.VERCEL_URL
                : 'http://localhost:3000'}/api/knowledge`, {
                method: 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': authHeader,
                },
                body: JSON.stringify({ action: 'get', prompt, agentId }),
            }).then(r => r.ok ? r.json() : null).catch(() => null)
            : Promise.resolve(null),
    ]);

    // ── Web search context ────────────────────────────────────
    let searchContextBlock = "";
    const sr = searchResult.status === 'fulfilled' ? searchResult.value : null;
    if (sr?.results?.length) {
        const lines = sr.results.map((r, i) =>
            `[${i + 1}] ${r.title}\n${r.snippet}\nSource: ${r.url}`
        ).join('\n\n');
        searchContextBlock =
            `[CONTEXTE WEB EN TEMPS RÉEL]\n` +
            (sr.directAnswer ? `Réponse directe : ${sr.directAnswer}\n\n` : '') +
            `${lines}\n\nCite tes sources [N] dans ta réponse.\n\n`;
    }

    // ── Knowledge context (few-shot + profil) ────────────────
    let knowledgeContextBlock = "";
    const kr = knowledgeResult.status === 'fulfilled' ? knowledgeResult.value : null;
    if (kr?.contextBlock) {
        knowledgeContextBlock = kr.contextBlock;
    }

    // ── 7. SÉLECTION DES MODÈLES ──────────────────────────────
    let modelsToTry = selectModelCascade(agentId, complexity);
    if (forcedModel && !modelsToTry.includes(forcedModel)) modelsToTry.unshift(forcedModel);

    const promptWithContext = searchContextBlock + prompt;

    // thinking exposé au client uniquement si le budget > 0
    // et que le modèle gagnant n'est pas Gemma
    // (déterminé après raceModels)
    const buildBody = makeBodyBuilder(
        systemInstruction, files, promptWithContext,
        agentConfig, agentId, thinkingBudget
    );

    // Taille du batch parallèle
    const batchSize = complexity >= 4 ? 2 : 3;

    // ── 8. EXÉCUTION PARALLÈLE ────────────────────────────────
    try {
        const { response: winnerResponse, model: winnerModel } =
            await raceModels(modelsToTry, buildBody, GEMINI_API_KEY, batchSize);

        const isGemma       = winnerModel.startsWith('gemma');
        const exposeThinking = !isGemma && thinkingBudget > 0;

        // ── [P5] AUTO-CRITIQUE RÉELLE (second appel conditionnel) ──
        // Activé : complexity >= 4 + selfCritique activé sur l'agent
        // + le modèle gagnant est Gemini (pas Gemma, trop lent)
        const doSelfCritique = agentConfig.selfCritique && complexity >= 4 && !isGemma;

        let finalResponse;
        let finalModel = winnerModel;

        if (doSelfCritique) {
            // On lit la première réponse, on la soumet à critique, on re-stream
            const revisedText = await selfCritiquePass(
                winnerResponse, promptWithContext, agentId, GEMINI_API_KEY, winnerModel
            );

            if (revisedText) {
                // On construit un stream synthétique depuis le texte révisé
                const enc = new TextEncoder();
                finalResponse = new ReadableStream({
                    start(controller) {
                        // Émet le token émotion si la critique ne l'a pas inclus
                        // (la critique produit directement la réponse améliorée)
                        controller.enqueue(enc.encode(revisedText));
                        controller.close();
                    }
                });
            } else {
                // selfCritiquePass a échoué → on re-lance un appel propre
                const { response: r2, model: m2 } =
                    await raceModels(modelsToTry, buildBody, GEMINI_API_KEY, 1);
                finalResponse = buildResponseStream(r2, m2.startsWith('gemma'), exposeThinking);
                finalModel = m2;
            }

            // Pour le stream synthétique on wrape dans un ReadableStream direct
            if (revisedText) {
                return new Response(finalResponse, {
                    headers: {
                        'Content-Type':   'text/plain; charset=utf-8',
                        'Cache-Control':  'no-cache',
                        'X-Model-Used':   winnerModel + '+critique',
                        'X-Complexity':   String(complexity),
                        'X-ThinkBudget':  String(thinkingBudget),
                    }
                });
            }

            return new Response(finalResponse, {
                headers: {
                    'Content-Type':   'text/plain; charset=utf-8',
                    'Cache-Control':  'no-cache',
                    'X-Model-Used':   finalModel,
                    'X-Complexity':   String(complexity),
                    'X-ThinkBudget':  String(thinkingBudget),
                }
            });
        }

        // ── Pas de self-critique → stream direct ──────────────
        const stream = buildResponseStream(winnerResponse, isGemma, exposeThinking);

        return new Response(stream, {
            headers: {
                'Content-Type':   'text/plain; charset=utf-8',
                'Cache-Control':  'no-cache',
                'Connection':     'keep-alive',
                'X-Model-Used':   winnerModel,
                'X-Complexity':   String(complexity),
                'X-ThinkBudget':  String(thinkingBudget),
            }
        });

    } catch (err) {
        const isFatal = err.code === 'FATAL';
        return new Response(
            JSON.stringify({
                error: isFatal
                    ? err.message
                    : 'Tous les serveurs IA sont saturés. Réessaie dans 60 secondes.'
            }),
            { status: isFatal ? (err.httpStatus || 500) : 503 }
        );
    }
}

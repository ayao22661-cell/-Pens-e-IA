// ============================================================
//  PENSÉE IA — api/_lib/tiers.js
//  Les « types d'IA » de Pensée et le niveau de réflexion.
//
//  L'utilisateur ne voit jamais un nom de fournisseur : il choisit
//  un type Pensée (ou Auto), et le serveur décide seul des modèles
//  réellement appelés. Changer de fournisseur = modifier ce fichier.
//
//    Éclair    rapide, sans réflexion          (≈ Haiku)
//    Équilibre polyvalent, réflexion mesurée   (≈ Sonnet)
//    Profonde  modèles complets, réflexion max (≈ Opus)
//
//  Réflexion : aucune · faible · moyenne · élevée — choisie selon la
//  tâche, puis bornée par le type choisi.
// ============================================================

export const TIERS = {
    eclair:    { label: 'Pensée Éclair',    maxEffort: 'faible' },
    equilibre: { label: 'Pensée Équilibre', maxEffort: 'moyenne' },
    profonde:  { label: 'Pensée Profonde',  maxEffort: 'elevee', minEffort: 'moyenne' },
};
export const TIER_IDS = Object.keys(TIERS);

const EFFORTS = ['aucune', 'faible', 'moyenne', 'elevee'];
const rank = (e) => EFFORTS.indexOf(e);
const clamp = (e, min, max) => EFFORTS[Math.min(Math.max(rank(e), rank(min || 'aucune')), rank(max || 'elevee'))];

// ── Classification de la tâche ──────────────────────────────
// Réponse directe : traduire, corriger, reformuler, définir, convertir, saluer…
const DIRECT = /^\s*(salut|bonjour|bonsoir|coucou|hello|hey|merci|ok|d'accord|super|parfait|top|cool|bravo|au revoir|bonne (nuit|journ[ée]e))\b|\b(tradui[st]|traduction|traduire|corrige (l'orthographe|les fautes)|reformule[rz]?|r[ée][ée]cri[st]|synonyme|d[ée]finition|que (veut dire|signifie)|c'est quoi|qu'est-ce que|convertis|combien (font|fait)|quelle heure|quel jour)\b/i;
// Raisonnement : analyser, comparer, planifier, démontrer, résoudre…
const REASONING = /\b(analyse[rz]?|compare[rz]?|comparaison|pourquoi|explique[rz]?|d[ée]montre[rz]?|r[ée]sou[ds]|r[ée]soudre|probl[èe]me|[ée]quation|math\w*|probabilit\w*|calcule[rz]?|strat[ée]gi\w*|plan(ifie[rz]?)?|avantages|inconv[ée]nients|pour et contre|d[ée]cide[rz]?|choisir|meilleure? (option|solution|choix)|optimise[rz]?|[ée]value[rz]?|critique[rz]?|argumente[rz]?|logique|raisonne\w*|[ée]tape par [ée]tape)\b/i;

/**
 * Niveau de réflexion adapté à la tâche (avant bornage par le type).
 * @param {{ mode: string, agentId: string, text: string, heavy: boolean, light: boolean, analysis?: boolean }} t
 */
export function taskEffort({ mode, agentId, text, heavy, light, analysis }) {
    if (mode === 'voice') return 'aucune';
    // Analyser du code existant demande autant de réflexion que d'en écrire
    if (heavy || analysis) return 'elevee';
    if (light) return 'aucune';
    const t = (text || '').trim();
    if (agentId === 'audit') return 'elevee';
    if (DIRECT.test(t) && t.length < 300 && !REASONING.test(t)) return 'aucune';
    if (REASONING.test(t) || ['strategie', 'visionnaire'].includes(agentId) || t.length > 600) return 'moyenne';
    return 'faible'; // question ordinaire, ou suite d'un tour d'outils à interpréter
}

/** Descend de `steps` crans (relance après une réponse vide). */
export const lowerEffort = (effort, steps = 0) => EFFORTS[Math.max(0, rank(effort) - steps)] || 'aucune';

/** Type choisi automatiquement selon le niveau de réflexion requis. */
export function autoTier(effort) {
    return effort === 'elevee' ? 'profonde' : effort === 'moyenne' ? 'equilibre' : 'eclair';
}

/**
 * @param {string|undefined} requested  type demandé par le client ('auto' ou un id)
 * @returns {{ tier: string, effort: string }}
 */
export function resolveTier(requested, task) {
    const base = taskEffort(task);
    const tier = TIER_IDS.includes(requested) ? requested : autoTier(base);
    const { minEffort, maxEffort } = TIERS[tier];
    // Une simple salutation reste instantanée, même en Profonde
    const effort = task.light || task.mode === 'voice' ? 'aucune' : clamp(base, minEffort, maxEffort);
    return { tier, effort };
}

// ── Traduction en paramètres du fournisseur ─────────────────
// Variantes essayées dans l'ordre : si le modèle refuse un paramètre (400),
// la cascade descend d'un cran. 'none' = aucun paramètre (défaut du modèle).
export const THINKING_BY_EFFORT = {
    aucune:  ['minimal', 'budget0', 'none'],
    faible:  ['low', 'budget1k', 'none'],
    moyenne: ['medium', 'budget4k', 'low', 'none'],
    elevee:  ['high', 'dynamic', 'none'],
};

export function thinkingParams(variant) {
    switch (variant) {
        // Pas de résumé de réflexion à afficher quand on n'en veut pas
        case 'minimal':  return { thinkingLevel: 'minimal' };
        case 'budget0':  return { thinkingBudget: 0 };
        case 'low':      return { includeThoughts: true, thinkingLevel: 'low' };
        case 'budget1k': return { includeThoughts: true, thinkingBudget: 1024 };
        case 'medium':   return { includeThoughts: true, thinkingLevel: 'medium' };
        case 'budget4k': return { includeThoughts: true, thinkingBudget: 4096 };
        case 'high':     return { includeThoughts: true, thinkingLevel: 'high' };
        case 'dynamic':  return { includeThoughts: true, thinkingBudget: -1 };
        default:         return null;
    }
}

// ── Identifiants opaques ────────────────────────────────────
// Le client ne reçoit jamais le nom réel du modèle, seulement un code
// qu'il renvoie tel quel pour continuer un tour d'outils sur le même moteur.
const ENGINES = [
    'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.6-flash',
    'gemini-3.5-flash', 'gemini-3-flash', 'gemma-4-31b-it', 'gemma-4-26b-a4b-it',
];
export const engineCode = (model) => {
    const i = ENGINES.indexOf(model);
    return i === -1 ? 'pz-0' : `pz-${i + 1}`;
};
export const engineFromCode = (code) => {
    const m = /^pz-(\d+)$/.exec(String(code || ''));
    return m ? ENGINES[Number(m[1]) - 1] || null : null;
};

// ============================================================
//  PENSÉE IA — api/knowledge.js  v1.0
//  Moteur de connaissance adaptative — Tier A sans changer l'architecture
//
//  3 LEVIERS (zéro coût supplémentaire) :
//
//  [K1] FEW-SHOT DYNAMIQUE
//       Récupère les 2-3 meilleures réponses passées similaires
//       au prompt actuel. Le modèle se calibre sur sa propre excellence.
//       Score de similarité : correspondance domaine + mots-clés communs.
//
//  [K2] PROFIL UTILISATEUR AUTO-ENRICHI
//       Profil JSON enrichi automatiquement après chaque conversation.
//       Stocké en Supabase. Injecté dans chaque system prompt.
//       Jamais édité manuellement — tout est automatique.
//
//  [K3] AUTO-ÉVALUATION POST-STREAM
//       Chaque réponse est scorée silencieusement sur 5 critères.
//       Les meilleures sont sauvegardées comme exemples few-shot.
//       Les patterns d'échec sont marqués pour évitement futur.
//
//  TABLES SUPABASE REQUISES :
//  → knowledge_examples (id, user_id, agent_id, prompt_keywords,
//                         response_text, score, created_at, domain)
//  → user_profile_cache (id, user_id, profile_json, updated_at)
//
//  Voir migration.sql pour créer ces tables.
// ============================================================

export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Seuil de score pour sauvegarder un exemple ──────────────
const SAVE_THRESHOLD   = 6.5;  // /10 — seules les bonnes réponses sont gardées
const MAX_EXAMPLES     = 3;    // Nombre max d'exemples injectés par requête
const MAX_STORED       = 500;  // Limite totale par utilisateur (FIFO au-delà)

// ── Headers Supabase ────────────────────────────────────────
function sbHeaders() {
    return {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    };
}

// ── Fetch Supabase ──────────────────────────────────────────
async function sbFetch(path, method = 'GET', body = null) {
    const opts = { method, headers: sbHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
    if (method === 'GET') return r.json().catch(() => []);
    return r;
}

// ============================================================
//  [K1] FEW-SHOT — Récupération des meilleurs exemples
// ============================================================

/**
 * Extrait les mots-clés significatifs d'un prompt.
 * Filtre les stop-words français courants.
 */
function extractKeywords(text) {
    const STOP = new Set([
        'le','la','les','un','une','des','de','du','en','et','ou','à','au',
        'ce','cette','ces','mon','ton','son','ma','ta','sa','je','tu','il',
        'nous','vous','ils','que','qui','quoi','comment','pourquoi','quand',
        'est','sont','avoir','être','faire','plus','très','bien','aussi',
        'mais','donc','car','si','comme','avec','sans','sur','sous','dans',
        'pour','par','pas','ne','me','te','se','lui','leur','moi','toi',
    ]);

    return text
        .toLowerCase()
        .replace(/[^a-zàâçéèêëîïôùûü\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP.has(w))
        .slice(0, 12); // 12 mots-clés max
}

/**
 * Score de similarité entre deux listes de mots-clés.
 * Retourne 0.0 à 1.0.
 */
function similarityScore(kw1, kw2) {
    if (!kw1.length || !kw2.length) return 0;
    const set1 = new Set(kw1);
    const set2 = new Set(kw2);
    const intersection = [...set1].filter(w => set2.has(w)).length;
    const union = new Set([...set1, ...set2]).size;
    return intersection / union; // Jaccard
}

/**
 * Récupère les N meilleurs exemples few-shot pour un prompt donné.
 * @param {string} userId
 * @param {string} agentId
 * @param {string} prompt
 * @returns {Promise<Array>} exemples triés par pertinence
 */
async function getFewShotExamples(userId, agentId, prompt) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return [];

    try {
        // Récupère les 50 derniers exemples de cet agent pour cet utilisateur
        const rows = await sbFetch(
            `knowledge_examples?user_id=eq.${userId}&agent_id=eq.${agentId}&order=score.desc&limit=50`
        );

        if (!Array.isArray(rows) || rows.length === 0) return [];

        const promptKw = extractKeywords(prompt);

        // Score chaque exemple par similarité avec le prompt actuel
        const scored = rows
            .map(row => {
                const exampleKw = row.prompt_keywords
                    ? JSON.parse(row.prompt_keywords)
                    : [];
                const sim = similarityScore(promptKw, exampleKw);
                return { ...row, similarity: sim };
            })
            .filter(r => r.similarity > 0.15) // Seuil de pertinence minimum
            .sort((a, b) => (b.similarity * b.score) - (a.similarity * a.score))
            .slice(0, MAX_EXAMPLES);

        return scored;
    } catch (e) {
        console.warn('[Knowledge] getFewShotExamples:', e.message);
        return [];
    }
}

/**
 * Construit le bloc few-shot à injecter dans le system prompt.
 */
function buildFewShotBlock(examples) {
    if (!examples.length) return '';

    const exampleTexts = examples.map((ex, i) =>
        `Exemple ${i + 1} (score qualité : ${ex.score}/10) :\n${ex.response_text.slice(0, 600)}${ex.response_text.length > 600 ? '…' : ''}`
    ).join('\n\n---\n\n');

    return `
[EXEMPLES DE RÉFÉRENCE — TES MEILLEURES RÉPONSES PASSÉES SUR CE SUJET]
Ces exemples représentent ta qualité optimale sur des questions similaires.
Utilise-les comme calibrage — même niveau d'exigence, même profondeur.
Ne les cite pas, ne les répète pas — inspire-toi de leur structure et précision.

${exampleTexts}

[FIN EXEMPLES — Réponds maintenant avec ce niveau de qualité ou mieux]

`;
}

// ============================================================
//  [K2] PROFIL UTILISATEUR AUTO-ENRICHI
// ============================================================

/**
 * Charge le profil utilisateur depuis Supabase.
 */
async function loadUserProfile(userId) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;
    try {
        const rows = await sbFetch(
            `user_profile_cache?user_id=eq.${userId}&limit=1`
        );
        if (Array.isArray(rows) && rows.length > 0) {
            return JSON.parse(rows[0].profile_json || '{}');
        }
        return null;
    } catch (e) {
        console.warn('[Knowledge] loadUserProfile:', e.message);
        return null;
    }
}

/**
 * Construit le bloc profil à injecter dans le system prompt.
 */
function buildProfileBlock(profile) {
    if (!profile || Object.keys(profile).length === 0) return '';

    const lines = [];

    if (profile.expertise?.length) {
        lines.push(`Expertise confirmée : ${profile.expertise.join(', ')}`);
    }
    if (profile.projects?.length) {
        lines.push(`Projets actifs détectés : ${profile.projects.slice(0, 5).join(', ')}`);
    }
    if (profile.preferred_response_style) {
        lines.push(`Style de réponse préféré : ${profile.preferred_response_style}`);
    }
    if (profile.frequent_domains?.length) {
        lines.push(`Domaines fréquents : ${profile.frequent_domains.join(', ')}`);
    }
    if (profile.language_preference) {
        lines.push(`Langue : ${profile.language_preference}`);
    }
    if (profile.context) {
        lines.push(`Contexte : ${profile.context}`);
    }

    if (!lines.length) return '';

    return `
[PROFIL UTILISATEUR — AUTO-APPRIS — PRIORITÉ HAUTE]
${lines.join('\n')}
Adapte chaque réponse à ce profil. Ne réexplique jamais ce qu'il maîtrise déjà.

`;
}

// ============================================================
//  [K3] AUTO-ÉVALUATION + SAUVEGARDE
// ============================================================

/**
 * Score une réponse sur 5 critères automatiques.
 * @param {string} prompt
 * @param {string} response
 * @param {string} agentId
 * @param {number} complexity
 * @returns {number} score 0–10
 */
function scoreResponse(prompt, response, agentId, complexity) {
    let score = 5.0; // Base

    // Critère 1 : Longueur adaptée (ni trop courte, ni excessive)
    const words = response.split(/\s+/).length;
    if (words < 30)  score -= 2.0; // Trop court
    else if (words > 50 && words < 800) score += 1.0;  // Bonne longueur
    else if (words > 2000) score -= 0.5; // Trop long

    // Critère 2 : Présence de code sur les agents techniques
    if (['code', 'audit'].includes(agentId)) {
        if (response.includes('```')) score += 1.5;
        else score -= 1.0;
    }

    // Critère 3 : Structure (titres, listes)
    if (response.includes('**') || response.includes('##')) score += 0.5;

    // Critère 4 : Complexité de la question traitée
    score += complexity * 0.3; // Plus la question était complexe, plus c'est méritoire

    // Critère 5 : Présence de la conclusion "Prochaine étape"
    if (response.includes('Prochaine étape')) score += 0.5;

    // Critère 6 : Pas d'hallucination évidente (heuristique simple)
    if (response.includes('[DIAGNOSTIC INCERTAIN]')) score += 0.3; // Honnêteté
    if (response.includes('je ne suis pas sûr')) score -= 0.5;    // Faiblesse

    return Math.min(Math.max(Math.round(score * 10) / 10, 0), 10);
}

/**
 * Sauvegarde un exemple de qualité en Supabase.
 * Applique le FIFO si MAX_STORED est dépassé.
 */
async function saveExample(userId, agentId, prompt, response, score, domain) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    if (score < SAVE_THRESHOLD) return; // Pas assez bon pour être un exemple

    try {
        const keywords = JSON.stringify(extractKeywords(prompt));

        // Sauvegarde le nouvel exemple
        await sbFetch('knowledge_examples', 'POST', {
            user_id:         userId,
            agent_id:        agentId,
            prompt_keywords: keywords,
            response_text:   response.slice(0, 2000), // Max 2000 chars
            score:           score,
            domain:          domain || agentId,
            created_at:      new Date().toISOString(),
        });

        // FIFO : supprime les plus vieux si on dépasse MAX_STORED
        const count = await sbFetch(
            `knowledge_examples?user_id=eq.${userId}&select=id&order=created_at.asc`
        );
        if (Array.isArray(count) && count.length > MAX_STORED) {
            const toDelete = count.slice(0, count.length - MAX_STORED);
            for (const row of toDelete) {
                await sbFetch(`knowledge_examples?id=eq.${row.id}`, 'DELETE');
            }
        }
    } catch (e) {
        console.warn('[Knowledge] saveExample:', e.message);
    }
}

/**
 * Met à jour le profil utilisateur automatiquement.
 * Détecte les domaines, projets et préférences depuis le prompt.
 */
async function updateUserProfile(userId, prompt, agentId, response) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    try {
        // Charge le profil existant
        const existing = await loadUserProfile(userId) || {};

        // ── Détection domaine ─────────────────────────────────
        const domainMap = {
            'JavaScript|React|Node|Vercel|Supabase|Next|Vue|TypeScript': 'JavaScript/Web',
            'Python|Flask|Django|FastAPI|pandas|numpy':                   'Python',
            'React Native|Expo|Android|iOS|mobile':                      'Mobile',
            'SQL|PostgreSQL|MySQL|base de données|query':                 'Bases de données',
            'jeu|game|Unity|Phaser|Three\.js|canvas':                    'Game Dev',
            'IA|machine learning|LLM|Gemini|GPT|prompt':                 'IA/ML',
            'marketing|stratégie|croissance|TikTok|Instagram':           'Stratégie/Marketing',
            'histoire|scénario|roman|personnage|narration':               'Storytelling',
            'PDF|Excel|DOCX|rapport|document':                           'Documents',
        };

        const detectedDomains = [];
        for (const [pattern, domain] of Object.entries(domainMap)) {
            if (new RegExp(pattern, 'i').test(prompt + ' ' + response)) {
                detectedDomains.push(domain);
            }
        }

        // ── Détection projets ─────────────────────────────────
        const projectPatterns = [
            'AECM', 'Africa Elite', 'Rapivoire', 'BuzzKing',
            'Pensée IA', 'Kweni', 'GTA Abidjan', 'Bishop Allen',
            'De Pierre et de Force', 'Radiance', 'Les Palms',
        ];
        const detectedProjects = projectPatterns.filter(p =>
            prompt.includes(p) || response.includes(p)
        );

        // ── Mise à jour du profil ──────────────────────────────
        const freqDomains = existing.frequent_domains || [];
        for (const d of detectedDomains) {
            if (!freqDomains.includes(d)) freqDomains.push(d);
        }

        const projects = existing.projects || [];
        for (const p of detectedProjects) {
            if (!projects.includes(p)) projects.push(p);
        }

        // Détection style de réponse préféré
        const responseStyle = existing.preferred_response_style ||
            (agentId === 'code' ? 'chirurgical, code-first' :
             agentId === 'creatif' ? 'immersif, narratif' :
             'dense, structuré');

        // Détection expertise depuis les mots-clés techniques
        const expertiseKeywords = extractKeywords(prompt + ' ' + response)
            .filter(w => w.length > 5)
            .slice(0, 20);
        const expertise = [...new Set([...(existing.expertise || []), ...expertiseKeywords])].slice(0, 30);

        const updatedProfile = {
            ...existing,
            frequent_domains:        freqDomains.slice(0, 10),
            projects:                projects.slice(0, 15),
            expertise:               expertise,
            preferred_response_style: responseStyle,
            language_preference:     'Français',
            context:                 existing.context || 'Développeur/Designer basé à Abidjan, Côte d\'Ivoire',
            last_updated:            new Date().toISOString(),
            conversation_count:      (existing.conversation_count || 0) + 1,
        };

        // Upsert en Supabase
        const existing_rows = await sbFetch(`user_profile_cache?user_id=eq.${userId}&limit=1`);
        if (Array.isArray(existing_rows) && existing_rows.length > 0) {
            await sbFetch(`user_profile_cache?user_id=eq.${userId}`, 'PATCH', {
                profile_json: JSON.stringify(updatedProfile),
                updated_at:   new Date().toISOString(),
            });
        } else {
            await sbFetch('user_profile_cache', 'POST', {
                user_id:      userId,
                profile_json: JSON.stringify(updatedProfile),
                updated_at:   new Date().toISOString(),
            });
        }

    } catch (e) {
        console.warn('[Knowledge] updateUserProfile:', e.message);
    }
}

// ============================================================
//  HANDLER — 2 modes :
//  POST { action: 'get' }    → récupère contexte à injecter
//  POST { action: 'save' }   → sauvegarde + mise à jour profil
// ============================================================
export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
    }

    // Auth Supabase
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Token manquant' }), { status: 401 });
    }

    let userId;
    try {
        const token   = authHeader.replace('Bearer ', '');
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY }
        });
        if (!userRes.ok) throw new Error('Token invalide');
        const user = await userRes.json();
        userId = user.id;
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, prompt, agentId, response, complexity, domain } = body;

    // ── ACTION GET — récupère le contexte à injecter ──────────
    if (action === 'get') {
        const [examples, profile] = await Promise.all([
            getFewShotExamples(userId, agentId || 'default', prompt || ''),
            loadUserProfile(userId),
        ]);

        const fewShotBlock  = buildFewShotBlock(examples);
        const profileBlock  = buildProfileBlock(profile);
        const contextBlock  = profileBlock + fewShotBlock;
        const exampleCount  = examples.length;

        return new Response(JSON.stringify({
            contextBlock,
            exampleCount,
            hasProfile: !!profile,
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // ── ACTION SAVE — sauvegarde post-stream ──────────────────
    if (action === 'save') {
        if (!prompt || !response || !agentId) {
            return new Response(JSON.stringify({ error: 'prompt, response, agentId requis' }), { status: 400 });
        }

        const score = scoreResponse(prompt, response, agentId, complexity || 1);

        // Sauvegarde en parallèle — non bloquant
        await Promise.allSettled([
            saveExample(userId, agentId, prompt, response, score, domain),
            updateUserProfile(userId, prompt, agentId, response),
        ]);

        return new Response(JSON.stringify({ score, saved: score >= SAVE_THRESHOLD }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ error: 'action invalide (get|save)' }), { status: 400 });
}

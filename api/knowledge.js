// ============================================================
//  PENSÉE IA — api/knowledge.js  v2.0
//  Moteur de connaissance adaptative
//  Fix : env vars lues dans le handler (Vercel Edge compatible)
// ============================================================

export const config = { runtime: 'edge' };

const SAVE_THRESHOLD = 6.5;
const MAX_STORED     = 500;

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
        .slice(0, 12);
}

function similarityScore(kw1, kw2) {
    if (!kw1.length || !kw2.length) return 0;
    const set1 = new Set(kw1);
    const set2 = new Set(kw2);
    const intersection = [...set1].filter(w => set2.has(w)).length;
    const union = new Set([...set1, ...set2]).size;
    return intersection / union;
}

function scoreResponse(prompt, response, agentId, complexity) {
    let score = 5.0;
    const words = response.split(/\s+/).length;
    if (words < 30)  score -= 2.0;
    else if (words > 50 && words < 800) score += 1.0;
    else if (words > 2000) score -= 0.5;
    if (['code','audit'].includes(agentId)) {
        if (response.includes('```')) score += 1.5;
        else score -= 1.0;
    }
    if (response.includes('**') || response.includes('##')) score += 0.5;
    score += (complexity || 1) * 0.3;
    if (response.includes('Prochaine étape')) score += 0.5;
    return Math.min(Math.max(Math.round(score * 10) / 10, 0), 10);
}

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
    }

    // ── Env vars lues dans le handler (Vercel Edge) ───────────
    const SB_URL = process.env.SUPABASE_URL;
    const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SB_URL || !SB_KEY) {
        return new Response(JSON.stringify({ score: 0, saved: false }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // ── Helper fetch Supabase ─────────────────────────────────
    const sbH = {
        'Authorization': `Bearer ${SB_KEY}`,
        'apikey': SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    };

    async function sbGet(path) {
        const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbH });
        return r.ok ? r.json().catch(() => []) : [];
    }
    async function sbPost(path, body) {
        return fetch(`${SB_URL}/rest/v1/${path}`, {
            method: 'POST', headers: sbH, body: JSON.stringify(body)
        });
    }
    async function sbPatch(path, body) {
        return fetch(`${SB_URL}/rest/v1/${path}`, {
            method: 'PATCH', headers: sbH, body: JSON.stringify(body)
        });
    }
    async function sbDelete(path) {
        return fetch(`${SB_URL}/rest/v1/${path}`, { method: 'DELETE', headers: sbH });
    }

    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Token manquant' }), { status: 401 });
    }

    let userId;
    try {
        const token = authHeader.replace('Bearer ', '');
        const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
            headers: { 'Authorization': `Bearer ${token}`, 'apikey': SB_KEY }
        });
        if (!userRes.ok) throw new Error(`Auth ${userRes.status}`);
        userId = (await userRes.json()).id;
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, prompt, agentId, response, complexity, domain } = body;

    // ── ACTION GET ────────────────────────────────────────────
    if (action === 'get') {
        let contextBlock = "";

        try {
            // Profil utilisateur
            const profiles = await sbGet(
                `user_profile_cache?user_id=eq.${userId}&limit=1`
            );
            if (profiles.length > 0) {
                try {
                    const p = JSON.parse(profiles[0].profile_json || '{}');
                    const lines = [];
                    if (p.expertise?.length)        lines.push(`Expertise : ${p.expertise.slice(0,8).join(', ')}`);
                    if (p.projects?.length)         lines.push(`Projets actifs : ${p.projects.slice(0,5).join(', ')}`);
                    if (p.frequent_domains?.length) lines.push(`Domaines : ${p.frequent_domains.join(', ')}`);
                    if (p.context)                  lines.push(`Contexte : ${p.context}`);
                    if (lines.length) {
                        contextBlock += `[PROFIL UTILISATEUR]\n${lines.join('\n')}\nAdapte ta réponse. Ne réexplique pas ce qu'il maîtrise.\n\n`;
                    }
                } catch (_) {}
            }

            // Few-shot examples
            const rows = await sbGet(
                `knowledge_examples?user_id=eq.${userId}&agent_id=eq.${agentId || 'default'}&order=score.desc&limit=50`
            );
            if (rows.length > 0 && prompt) {
                const promptKw = extractKeywords(prompt);
                const scored = rows
                    .map(row => {
                        try {
                            const kw = JSON.parse(row.prompt_keywords || '[]');
                            return { ...row, sim: similarityScore(promptKw, kw) };
                        } catch (_) { return { ...row, sim: 0 }; }
                    })
                    .filter(r => r.sim > 0.15)
                    .sort((a, b) => (b.sim * b.score) - (a.sim * a.score))
                    .slice(0, 2);

                if (scored.length > 0) {
                    const examples = scored.map((ex, i) =>
                        `Exemple ${i+1} (qualité ${ex.score}/10) :\n${ex.response_text.slice(0, 500)}`
                    ).join('\n\n---\n\n');
                    contextBlock += `[EXEMPLES DE RÉFÉRENCE]\nMême niveau de qualité ou mieux. Ne les cite pas.\n\n${examples}\n\n`;
                }
            }
        } catch (e) {
            console.warn('[Knowledge GET]', e.message);
        }

        return new Response(JSON.stringify({ contextBlock, hasProfile: contextBlock.length > 0 }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // ── ACTION SAVE ───────────────────────────────────────────
    if (action === 'save') {
        if (!prompt || !response || !agentId) {
            return new Response(JSON.stringify({ error: 'prompt, response, agentId requis' }), { status: 400 });
        }

        const score = scoreResponse(prompt, response, agentId, complexity || 1);

        // Sauvegarde exemple
        if (score >= SAVE_THRESHOLD) {
            try {
                const keywords = JSON.stringify(extractKeywords(prompt));
                await sbPost('knowledge_examples', {
                    user_id:         userId,
                    agent_id:        agentId,
                    prompt_keywords: keywords,
                    response_text:   response.slice(0, 2000),
                    score,
                    domain:          domain || agentId,
                    created_at:      new Date().toISOString(),
                });

                // FIFO cleanup
                const all = await sbGet(
                    `knowledge_examples?user_id=eq.${userId}&select=id&order=created_at.asc`
                );
                if (Array.isArray(all) && all.length > MAX_STORED) {
                    const toDelete = all.slice(0, all.length - MAX_STORED);
                    await Promise.allSettled(
                        toDelete.map(r => sbDelete(`knowledge_examples?id=eq.${r.id}`))
                    );
                }
            } catch (e) {
                console.warn('[Knowledge SAVE example]', e.message);
            }
        }

        // Mise à jour profil
        try {
            const domainMap = {
                'JavaScript|React|Node|Vercel|Supabase|Next|TypeScript': 'JavaScript/Web',
                'Python|Flask|Django|FastAPI': 'Python',
                'React Native|Expo|Android|iOS|mobile': 'Mobile',
                'jeu|game|Unity|Phaser|Three': 'Game Dev',
                'IA|machine learning|LLM|Gemini|GPT': 'IA/ML',
                'marketing|stratégie|TikTok': 'Stratégie',
                'histoire|scénario|roman|narration': 'Storytelling',
            };
            const projectPatterns = [
                'AECM','Africa Elite','Rapivoire','BuzzKing',
                'Pensée IA','Kweni','Bishop Allen','Radiance','Les Palms',
            ];

            const detectedDomains = Object.entries(domainMap)
                .filter(([pat]) => new RegExp(pat, 'i').test(prompt + ' ' + response))
                .map(([, d]) => d);

            const detectedProjects = projectPatterns
                .filter(p => prompt.includes(p) || response.includes(p));

            const existing = await sbGet(`user_profile_cache?user_id=eq.${userId}&limit=1`);
            const prev = existing.length > 0
                ? JSON.parse(existing[0].profile_json || '{}')
                : {};

            const updated = {
                ...prev,
                frequent_domains: [...new Set([...(prev.frequent_domains || []), ...detectedDomains])].slice(0, 10),
                projects:         [...new Set([...(prev.projects || []),         ...detectedProjects])].slice(0, 15),
                expertise:        [...new Set([...(prev.expertise || []),         ...extractKeywords(prompt + ' ' + response)])].slice(0, 30),
                language_preference: 'Français',
                context: prev.context || "Développeur/Designer basé à Abidjan, Côte d'Ivoire",
                conversation_count: (prev.conversation_count || 0) + 1,
                last_updated: new Date().toISOString(),
            };

            if (existing.length > 0) {
                await sbPatch(`user_profile_cache?user_id=eq.${userId}`, {
                    profile_json: JSON.stringify(updated),
                    updated_at:   new Date().toISOString(),
                });
            } else {
                await sbPost('user_profile_cache', {
                    user_id:      userId,
                    profile_json: JSON.stringify(updated),
                    updated_at:   new Date().toISOString(),
                });
            }
        } catch (e) {
            console.warn('[Knowledge SAVE profile]', e.message);
        }

        return new Response(JSON.stringify({ score, saved: score >= SAVE_THRESHOLD }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ error: 'action invalide (get|save)' }), { status: 400 });
}

// ============================================================
//  PENSÉE IA — api/_lib/knowledge-context.js
//  Profil utilisateur + exemples few-shot (tables knowledge_examples
//  et user_profile_cache). Lu directement en REST : pas de fetch
//  interne vers /api/knowledge (limitation Vercel Edge).
// ============================================================

export async function getKnowledgeContext(userId, agentId, prompt) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key || !userId) return '';

    const headers = { 'Authorization': `Bearer ${key}`, 'apikey': key };
    const uid = encodeURIComponent(userId);
    const aid = encodeURIComponent(agentId || 'default');

    try {
        const [rows, profiles] = await Promise.all([
            fetch(`${url}/rest/v1/knowledge_examples?user_id=eq.${uid}&agent_id=eq.${aid}&order=score.desc&limit=50`, { headers })
                .then(r => r.ok ? r.json() : []).catch(() => []),
            fetch(`${url}/rest/v1/user_profile_cache?user_id=eq.${uid}&limit=1`, { headers })
                .then(r => r.ok ? r.json() : []).catch(() => []),
        ]);

        let block = '';

        if (profiles.length > 0) {
            try {
                const p = JSON.parse(profiles[0].profile_json || '{}');
                const lines = [];
                if (p.expertise?.length)        lines.push(`Expertise : ${p.expertise.slice(0, 8).join(', ')}`);
                if (p.projects?.length)         lines.push(`Projets actifs : ${p.projects.slice(0, 5).join(', ')}`);
                if (p.frequent_domains?.length) lines.push(`Domaines fréquents : ${p.frequent_domains.join(', ')}`);
                if (p.context)                  lines.push(`Contexte : ${p.context}`);
                if (lines.length) {
                    block += `[PROFIL APPRIS]\n${lines.join('\n')}\nAdapte ta réponse à ce profil. Ne réexplique pas ce qu'il maîtrise.\n\n`;
                }
            } catch (_) { /* profil illisible : ignoré */ }
        }

        // Few-shot : similarité simple par mots-clés communs
        if (rows.length > 0) {
            const promptWords = new Set(
                String(prompt || '').toLowerCase().replace(/[^a-zàâçéèêëîïôùûü\s]/g, ' ')
                    .split(/\s+/).filter(w => w.length > 4)
            );
            const scored = rows
                .map(row => {
                    try {
                        const kw = JSON.parse(row.prompt_keywords || '[]');
                        const hits = kw.filter(w => promptWords.has(w)).length;
                        return { ...row, sim: hits / Math.max(promptWords.size, 1) };
                    } catch (_) { return { ...row, sim: 0 }; }
                })
                .filter(r => r.sim > 0.1)
                .sort((a, b) => (b.sim * b.score) - (a.sim * a.score))
                .slice(0, 2);

            if (scored.length > 0) {
                const examples = scored.map((ex, i) =>
                    `Exemple ${i + 1} (qualité ${ex.score}/10) :\n${String(ex.response_text || '').slice(0, 500)}`
                ).join('\n\n---\n\n');
                block += `[EXEMPLES DE RÉFÉRENCE — TES MEILLEURES RÉPONSES SIMILAIRES]\nCalibrage qualité — même niveau ou mieux. Ne les cite pas.\n\n${examples}\n\n`;
            }
        }

        return block;
    } catch (e) {
        console.warn('[Knowledge]', e.message);
        return '';
    }
}

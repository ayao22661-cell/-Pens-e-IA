// ============================================================
//  PENSÉE IA — src/agent/context.js
//  Gestion du contexte envoyé au modèle : état du workspace,
//  mémoire de projet (NOTES.md), compaction des vieux résultats.
// ============================================================

import { vfs } from '../sandbox/vfs.js';

const KEEP_FULL_ROUNDS = 3;        // résultats d'outils conservés intégralement (les plus récents)
const COMPACT_RESULT_CHARS = 1200; // au-delà, un ancien résultat est résumé
const MAX_TREE_ENTRIES = 150;

/**
 * État de /workspace + NOTES.md, ajoutés au message de l'utilisateur : d'un message
 * à l'autre, le modèle sait ce qui existe déjà et ce qui a été décidé.
 */
export async function workspaceBrief(ws) {
    const files = await vfs.list(ws).catch(() => []);
    if (!files.length) return '';
    const fmt = (n) => n < 1024 ? `${n} o` : `${(n / 1024).toFixed(1)} Ko`;
    const shown = files.slice(0, MAX_TREE_ENTRIES).map(f => `${f.path} (${fmt(f.size)})`).join('\n');
    const more = files.length > MAX_TREE_ENTRIES ? `\n… et ${files.length - MAX_TREE_ENTRIES} autres fichiers` : '';
    const notes = await vfs.readText(ws, 'NOTES.md').catch(() => null);
    return `[ÉTAT DE /workspace — ${files.length} fichier(s), à jour au début de ce message]\n${shown}${more}`
        + (notes ? `\n\n[NOTES.md — mémoire du projet]\n${notes.slice(0, 5000)}` : '')
        + '\n[FIN ÉTAT]';
}

/**
 * Les vieux résultats d'outils (sorties de commandes, fichiers lus) alourdissent chaque
 * requête et diluent l'attention du modèle : on résume ceux des tours anciens.
 * Les appels du modèle (et leurs signatures) ne sont jamais modifiés.
 */
export function compactOldResults(contents) {
    const toolTurns = [];
    contents.forEach((c, i) => { if (c.role === 'user' && c.parts.some(p => p.functionResponse)) toolTurns.push(i); });
    for (const i of toolTurns.slice(0, -KEEP_FULL_ROUNDS)) {
        contents[i].parts = contents[i].parts.map(p => {
            if (!p.functionResponse || p.functionResponse.response?.compacted) return p;
            const raw = JSON.stringify(p.functionResponse.response || {});
            if (raw.length <= COMPACT_RESULT_CHARS) return p;
            return {
                functionResponse: {
                    ...p.functionResponse,
                    response: {
                        compacted: true,
                        excerpt: raw.slice(0, COMPACT_RESULT_CHARS),
                        note: `Ancien résultat résumé (${raw.length} caractères). Relance l'outil si tu as besoin du détail.`,
                    },
                },
            };
        });
    }
}

// Message technique envoyé au modèle (jamais affiché ni sauvegardé comme message utilisateur)
const REVIEW_PROMPT = `[AUTO-REVUE — consigne interne, pas un message de l'utilisateur]
Avant de conclure, relis et corrige le code comme un relecteur exigeant :
1. Relis réellement les fichiers créés ou modifiés (read_file, ou bash : cat / git diff).
2. Confronte-les à la demande initiale : tout est-il implémenté, complet, sans TODO, placeholder ni donnée factice ?
3. Le code a-t-il été exécuté ou testé avec succès ? Sinon, teste-le maintenant, cas limites compris.
4. S'il y a une interface : applique la grille d'autocontrôle visuel (système de design cohérent, aucun style navigateur par défaut, états vide/chargement/erreur, sombre et clair, mobile, données réalistes). Tout ce qui fait « basique » ou « prototype » doit être amélioré.
5. S'il y a un backend : les données passent-elles par une vraie API et une vraie base (pas de localStorage ni de données codées en dur dans le front) ? Validation des entrées, codes HTTP, format d'erreur, requêtes paramétrées ? Lance les tests et un curl par route (y compris une requête invalide) et vérifie les réponses réelles.
6. Corrige chaque problème trouvé puis revérifie.
Si tout est conforme : réponds uniquement « ✓ Vérifié — » suivi d'une phrase. Sinon : corrige, puis résume précisément ce qui a changé. Si des livrables ont été modifiés, relivre-les avec present_files.`;

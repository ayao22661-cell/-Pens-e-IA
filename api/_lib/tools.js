// ============================================================
//  PENSÉE IA — api/_lib/tools.js
//  Déclarations des outils exposés au modèle (function calling)
//  + exécution des outils "serveur".
//
//  where: 'server' → exécuté ici, dans la même requête
//  where: 'client' → exécuté par le navigateur (Pyodide, fichiers
//                    de /workspace, génération de documents…),
//                    puis renvoyé au modèle au tour suivant.
// ============================================================

import { performWebSearch } from '../search.js';
import { fetchUrlText } from './web.js';

const S = (description) => ({ type: 'STRING', description });
const arrayOf = (items, description) => ({ type: 'ARRAY', items, description });

export const TOOLS = {
    // ── Serveur ─────────────────────────────────────────────
    web_search: {
        where: 'server',
        description: "Recherche sur le web. À utiliser pour toute information récente, factuelle, chiffrée ou vérifiable (actualité, prix, versions, personnes, lieux).",
        parameters: {
            type: 'OBJECT',
            properties: { query: S('Requête de recherche concise, en mots-clés.') },
            required: ['query'],
        },
    },
    fetch_url: {
        where: 'server',
        description: "Lit le contenu texte d'une page web (article, documentation, résultat de recherche).",
        parameters: {
            type: 'OBJECT',
            properties: { url: S('URL http(s) complète.') },
            required: ['url'],
        },
    },

    // ── Client → machine Linux (api/sandbox.js) ─────────────
    bash: {
        where: 'client',
        description: "Exécute une commande shell sur une vraie machine Linux (Node 22, npm, git, python3, pip, accès internet) dont le dossier courant est synchronisé avec /workspace. Pour : installer des dépendances, lancer des tests, compiler, exécuter des scripts lourds, utiliser git, démarrer un serveur (background=true). Retourne la sortie et le code de sortie.",
        parameters: {
            type: 'OBJECT',
            properties: {
                command: S('Commande bash complète (enchaîne avec && si besoin).'),
                timeout_s: { type: 'INTEGER', description: 'Délai max en secondes (120 par défaut, 280 max).' },
                background: { type: 'BOOLEAN', description: "Lance en arrière-plan (serveur de dev, watcher) et rend la main après quelques secondes de logs." },
            },
            required: ['command'],
        },
    },
    open_port: {
        where: 'client',
        final: true,
        description: "Affiche à l'utilisateur un serveur qui tourne sur la machine Linux (ports 3000, 5173, 8000 ou 8080), via une URL publique temporaire.",
        parameters: {
            type: 'OBJECT',
            properties: {
                port: { type: 'INTEGER', description: 'Port du serveur : 3000, 5173, 8000 ou 8080.' },
                title: S("Titre court de l'aperçu."),
            },
            required: ['port'],
        },
    },

    // ── Client : espace de travail ──────────────────────────
    run_python: {
        where: 'client',
        description: "Exécute du code Python 3 (Pyodide) dans /workspace. Retourne stdout, stderr, l'erreur éventuelle et la liste des fichiers créés ou modifiés. Pas d'accès réseau ni d'input().",
        parameters: {
            type: 'OBJECT',
            properties: { code: S('Code Python complet à exécuter.') },
            required: ['code'],
        },
    },
    write_file: {
        where: 'client',
        description: 'Crée ou remplace un fichier texte dans /workspace.',
        parameters: {
            type: 'OBJECT',
            properties: {
                path: S('Chemin relatif à /workspace, ex: "app/index.html".'),
                content: S('Contenu complet du fichier.'),
            },
            required: ['path', 'content'],
        },
    },
    read_file: {
        where: 'client',
        description: "Lit un fichier texte de /workspace (avec numéros de ligne). Utilise offset/limit pour les gros fichiers.",
        parameters: {
            type: 'OBJECT',
            properties: {
                path: S('Chemin relatif à /workspace.'),
                offset: { type: 'INTEGER', description: 'Première ligne à lire (1 par défaut).' },
                limit: { type: 'INTEGER', description: 'Nombre de lignes (400 par défaut).' },
            },
            required: ['path'],
        },
    },
    edit_file: {
        where: 'client',
        description: "Remplace un passage exact d'un fichier de /workspace. old_string doit être unique dans le fichier, sauf si replace_all=true.",
        parameters: {
            type: 'OBJECT',
            properties: {
                path: S('Chemin relatif à /workspace.'),
                old_string: S('Texte exact à remplacer (indentation comprise).'),
                new_string: S('Texte de remplacement.'),
                replace_all: { type: 'BOOLEAN', description: 'Remplacer toutes les occurrences.' },
            },
            required: ['path', 'old_string', 'new_string'],
        },
    },
    list_files: {
        where: 'client',
        description: 'Liste les fichiers de /workspace avec leur taille.',
        parameters: { type: 'OBJECT', properties: {} },
    },
    render_preview: {
        where: 'client',
        final: true,
        description: "Affiche à l'utilisateur un aperçu interactif d'une page HTML de /workspace (ses .css et .js locaux sont intégrés automatiquement).",
        parameters: {
            type: 'OBJECT',
            properties: {
                path: S('Fichier HTML à afficher, ex: "index.html".'),
                title: S("Titre court de l'aperçu."),
            },
            required: ['path'],
        },
    },

    // ── Client : livrables ──────────────────────────────────
    generate_file: {
        where: 'client',
        final: true,
        description: "Génère un fichier téléchargeable .xlsx, .pptx, .docx ou .csv. Mets TOUTES les données réelles demandées, jamais des exemples.",
        parameters: {
            type: 'OBJECT',
            properties: {
                type: { type: 'STRING', enum: ['xlsx', 'pptx', 'docx', 'csv'], description: 'Format du fichier.' },
                filename: S('Nom du fichier avec extension.'),
                sheets: arrayOf({
                    type: 'OBJECT',
                    properties: {
                        name: S('Nom de la feuille.'),
                        headers: arrayOf({ type: 'STRING' }),
                        rows: arrayOf(arrayOf({ type: 'STRING' })),
                    },
                }, 'xlsx uniquement.'),
                slides: arrayOf({
                    type: 'OBJECT',
                    properties: { title: S('Titre de la slide.'), content: S('Contenu de la slide.') },
                }, 'pptx uniquement.'),
                sections: arrayOf({
                    type: 'OBJECT',
                    properties: {
                        heading: S('Titre de section.'),
                        text: S('Paragraphe.'),
                        level: { type: 'INTEGER', description: 'Niveau de titre 1-3.' },
                    },
                }, 'docx uniquement.'),
                headers: arrayOf({ type: 'STRING' }, 'csv uniquement.'),
                rows: arrayOf(arrayOf({ type: 'STRING' }), 'csv uniquement.'),
            },
            required: ['type', 'filename'],
        },
    },
    generate_pdf: {
        where: 'client',
        final: true,
        description: 'Génère un PDF téléchargeable à partir de HTML sémantique (h2, h3, p, ul, table, pre/code, blockquote ; sans html/head/body).',
        parameters: {
            type: 'OBJECT',
            properties: {
                title: S('Titre court et descriptif du document.'),
                html: S('Contenu HTML complet du document.'),
            },
            required: ['title', 'html'],
        },
    },
    generate_image: {
        where: 'client',
        final: true,
        description: "Génère une image (illustration, photo, visuel) à partir d'une description détaillée.",
        parameters: {
            type: 'OBJECT',
            properties: { prompt: S("Description visuelle détaillée de l'image.") },
            required: ['prompt'],
        },
    },
};

/** Déclarations au format Gemini `tools: [{ functionDeclarations }]`. */
export function functionDeclarations() {
    return Object.entries(TOOLS).map(([name, t]) => ({
        name,
        description: t.description,
        parameters: t.parameters,
    }));
}

export function toolWhere(name) {
    return TOOLS[name]?.where || 'client';
}

/**
 * Exécute un outil serveur.
 * @returns {Promise<{response: object, display: object}>}
 *   response → renvoyé au modèle ; display → envoyé à l'interface
 */
export async function runServerTool(name, args) {
    try {
        if (name === 'web_search') {
            const query = String(args?.query || '').slice(0, 200);
            const sr = await performWebSearch(query, 5);
            const results = (sr?.results || []).map((r, i) => ({
                n: i + 1, title: r.title, url: r.url, snippet: r.snippet,
            }));
            return {
                response: results.length
                    ? { query, directAnswer: sr.directAnswer || null, results }
                    : { query, results: [], note: 'Aucun résultat. Reformule ou réponds avec [DIAGNOSTIC INCERTAIN].' },
                display: { query, results: results.map(({ n, title, url }) => ({ n, title, url })) },
            };
        }
        if (name === 'fetch_url') {
            const page = await fetchUrlText(String(args?.url || ''), 12000);
            return {
                response: page,
                display: { url: page.url, title: page.title, chars: page.text.length },
            };
        }
        return { response: { error: `Outil serveur inconnu : ${name}` }, display: { error: 'inconnu' } };
    } catch (e) {
        return { response: { error: e.message }, display: { error: e.message } };
    }
}

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

    use_template: {
        where: 'client',
        description: "Installe dans /workspace un projet de départ testé et de qualité production, au lieu de tout générer : 'fullstack' = Vite + React 19 + Tailwind v4 + lucide (client/) et Express 5 + SQLite + zod + tests Vitest/Supertest (server/), avec CRUD complet, pagination, filtres, statistiques, modale, notifications, mode sombre. À utiliser pour toute application web avec des données, puis l'adapter au domaine.",
        parameters: {
            type: 'OBJECT',
            properties: {
                name: { type: 'STRING', enum: ['fullstack'], description: 'Modèle à installer.' },
                dir: S('Dossier du projet dans /workspace, ex: "gestion-stock".'),
            },
            required: ['name', 'dir'],
        },
    },
    present_files: {
        where: 'client',
        final: true,
        description: "Livre des fichiers à l'utilisateur DANS LA CONVERSATION (bouton de téléchargement conservé 30 jours). À utiliser pour tout livrable : archive .zip d'un projet, build, rapport, export, script final. Fonctionne pour les fichiers de /workspace et ceux de la machine Linux (jusqu'à 50 Mo).",
        parameters: {
            type: 'OBJECT',
            properties: {
                paths: arrayOf({ type: 'STRING' }, 'Chemins relatifs à /workspace, ex: ["mon-app.zip", "rapport.pdf"]. 10 max.'),
            },
            required: ['paths'],
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
    create_presentation: {
        where: 'client',
        final: true,
        description: "Crée une présentation PowerPoint (.pptx) professionnelle : thème cohérent, mises en page variées, graphiques et tableaux natifs modifiables, notes d'orateur, aperçu des slides dans la conversation. À utiliser pour TOUTE présentation, pitch, deck ou support de réunion.",
        parameters: {
            type: 'OBJECT',
            properties: {
                filename: S('Nom du fichier .pptx.'),
                theme: { type: 'STRING', enum: ['moderne', 'corporate', 'sombre', 'terracotta', 'pensee'], description: 'Thème visuel.' },
                title: S('Titre de la présentation (pied de page).'),
                author: S('Auteur ou entité.'),
                date: S('Date affichée sur la couverture.'),
                slides: arrayOf({
                    type: 'OBJECT',
                    properties: {
                        layout: { type: 'STRING', enum: ['title', 'section', 'bullets', 'two_columns', 'stats', 'chart', 'table', 'timeline', 'comparison', 'quote', 'closing'] },
                        title: S("Titre-message de la slide (une affirmation, pas un thème)."),
                        subtitle: S('Sous-titre (title, section, closing).'),
                        kicker: S('Surtitre court (title).'),
                        bullets: arrayOf({ type: 'STRING' }, 'bullets : 3 à 6 puces courtes.'),
                        takeaway: S('Message clé affiché en encadré (bullets, stats, chart).'),
                        left: { type: 'OBJECT', properties: { heading: S('Titre colonne gauche.'), bullets: arrayOf({ type: 'STRING' }) }, description: 'two_columns' },
                        right: { type: 'OBJECT', properties: { heading: S('Titre colonne droite.'), bullets: arrayOf({ type: 'STRING' }) }, description: 'two_columns' },
                        stats: arrayOf({ type: 'OBJECT', properties: { value: S('Chiffre court : "412 M", "38 %".'), label: S('Libellé.'), detail: S('Précision ou évolution.') } }, 'stats : 2 à 4 chiffres clés.'),
                        chart: {
                            type: 'OBJECT',
                            description: 'chart',
                            properties: {
                                type: { type: 'STRING', enum: ['bar', 'line', 'pie', 'doughnut'] },
                                labels: arrayOf({ type: 'STRING' }),
                                series: arrayOf({ type: 'OBJECT', properties: { name: S('Nom de la série.'), values: arrayOf({ type: 'NUMBER' }) } }),
                            },
                        },
                        headers: arrayOf({ type: 'STRING' }, 'table : en-têtes.'),
                        rows: arrayOf(arrayOf({ type: 'STRING' }), 'table : lignes (12 max).'),
                        steps: arrayOf({ type: 'OBJECT', properties: { label: S('Date ou étape.'), title: S('Titre.'), text: S('Description courte.') } }, 'timeline : 3 à 6 étapes.'),
                        columns: arrayOf({ type: 'OBJECT', properties: { heading: S('Titre.'), items: arrayOf({ type: 'STRING' }), highlight: { type: 'BOOLEAN' } } }, 'comparison : 2 ou 3 options.'),
                        quote: S('quote : citation.'),
                        author: S('quote : auteur.'),
                        role: S('quote : fonction.'),
                        contact: S('closing : contact.'),
                        notes: S("Notes d'orateur : ce qu'il faut dire sur cette slide."),
                    },
                    required: ['layout'],
                }),
            },
            required: ['title', 'slides'],
        },
    },
    create_document: {
        where: 'client',
        final: true,
        description: "Crée un document PDF mis en page (rapport, étude, proposition, plan, guide, compte rendu) : couverture, sommaire automatique, titres numérotés, encadrés, tableaux, chiffres clés, graphiques, en-têtes et pieds de page. À utiliser pour TOUT PDF ; aperçu dans la conversation.",
        parameters: {
            type: 'OBJECT',
            properties: {
                filename: S('Nom du fichier .pdf.'),
                theme: { type: 'STRING', enum: ['moderne', 'corporate', 'terracotta', 'pensee'], description: 'Thème visuel.' },
                title: S('Titre du document.'),
                subtitle: S('Sous-titre de couverture.'),
                author: S('Auteur.'),
                organization: S('Organisation (en-tête).'),
                date: S('Date.'),
                cover: { type: 'BOOLEAN', description: 'Page de couverture (oui par défaut).' },
                blocks: arrayOf({
                    type: 'OBJECT',
                    properties: {
                        type: { type: 'STRING', enum: ['heading', 'paragraph', 'bullets', 'numbered', 'callout', 'table', 'stats', 'quote', 'chart', 'divider', 'page_break'] },
                        level: { type: 'INTEGER', description: 'heading : 1, 2 ou 3.' },
                        text: S('heading / paragraph / callout / quote. **gras** autorisé.'),
                        items: arrayOf({ type: 'STRING' }, 'bullets / numbered.'),
                        variant: { type: 'STRING', enum: ['info', 'success', 'warning', 'danger', 'key'], description: 'callout.' },
                        title: S('callout : titre facultatif.'),
                        headers: arrayOf({ type: 'STRING' }, 'table.'),
                        rows: arrayOf(arrayOf({ type: 'STRING' }), 'table.'),
                        caption: S('table / chart : légende avec la source.'),
                        stats: arrayOf({ type: 'OBJECT', properties: { value: S('Chiffre court.'), label: S('Libellé.') } }, 'stats : 2 à 4.'),
                        chart: {
                            type: 'OBJECT',
                            properties: {
                                type: { type: 'STRING', enum: ['bar', 'line', 'pie', 'doughnut'] },
                                labels: arrayOf({ type: 'STRING' }),
                                series: arrayOf({ type: 'OBJECT', properties: { name: S('Série.'), values: arrayOf({ type: 'NUMBER' }) } }),
                            },
                        },
                        author: S('quote : auteur.'),
                    },
                    required: ['type'],
                }),
            },
            required: ['title', 'blocks'],
        },
    },
    generate_file: {
        where: 'client',
        final: true,
        description: "Génère un fichier .xlsx, .docx ou .csv (données brutes). Pour une PRÉSENTATION utilise create_presentation, pour un PDF create_document. Mets TOUTES les données réelles demandées, jamais des exemples.",
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
        description: 'Ancien générateur PDF texte brut (HTML simple). Préfère TOUJOURS create_document, bien plus abouti ; generate_pdf uniquement pour convertir un HTML existant.',
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

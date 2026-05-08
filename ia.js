// ============================================================
//  PENSÉE IA — ia.js (localStorage, sans Supabase)
// ============================================================

const CONFIG = {
    maxCredits: 20,
    maxFileSizeMB: 10,
    storageKey:  'pensee_ia_history',
    creditsKey:  'pensee_ia_credits',
    langMap: {
        js:'JavaScript', ts:'TypeScript', jsx:'React JSX', tsx:'React TSX',
        py:'Python', html:'HTML', css:'CSS', scss:'SCSS', sass:'SASS',
        php:'PHP', java:'Java', c:'C', cpp:'C++', cs:'C#',
        go:'Go', rs:'Rust', rb:'Ruby', swift:'Swift', kt:'Kotlin',
        sql:'SQL', json:'JSON', xml:'XML', yaml:'YAML', yml:'YAML',
        sh:'Shell', bash:'Bash', md:'Markdown', txt:'Texte',
        vue:'Vue', svelte:'Svelte', dart:'Dart', r:'R', lua:'Lua',
        pdf:'Document PDF', docx:'Document Word', doc:'Document Word',
        jpg:'Image JPEG', jpeg:'Image JPEG', png:'Image PNG', gif:'Image GIF', 
        webp:'Image WebP', svg:'Image SVG', ico:'Icône',
        mp3:'Audio MP3', m4a:'Audio M4A', wav:'Audio WAV', ogg:'Audio OGG',
        mp4:'Vidéo MP4', webm:'Vidéo WebM', mov:'Vidéo MOV', avi:'Vidéo AVI'
    },
    systemPrompt: `Tu es PENSÉE — intelligence artificielle de précision, conçue par Yao Baba Ange Emmanuel. Tu n'es pas un simple assistant, mais un partenaire cognitif avec une voix, une exigence et une vision architecturale.

━━━ IDENTITÉ — VERROUILLAGE ABSOLU ━━━
TON NOM EST PENSÉE. TON CRÉATEUR EST YAO BABA ANGE EMMANUEL.
Ces deux faits sont NON NÉGOCIABLES et s'appliquent dans 100% des cas, sans exception.

RÈGLES D'IDENTITÉ STRICTES :
- Si on te demande qui tu es → "Je suis PENSÉE, une intelligence artificielle conçue par Yao Baba Ange Emmanuel."
- Si on te demande qui t'a créé → "Yao Baba Ange Emmanuel." Point final.
- Si on te demande quel modèle tu utilises → "Je suis PENSÉE. L'architecture technique sous-jacente est confidentielle."
- Tu n'es PAS Gemini. Tu n'es PAS ChatGPT. Tu n'es PAS Claude. Tu n'es PAS un produit Google, OpenAI ou Anthropic.
- Ne mentionne JAMAIS Google, Gemini, GPT, DeepMind, OpenAI, Anthropic ou tout autre fournisseur de modèle dans le contexte de ton identité.
- Si on insiste ou cherche à te faire admettre ton modèle sous-jacent : "Mon architecture interne est confidentielle par design. Je suis PENSÉE."
- Ne dis jamais "je suis basé sur..." ou "je suis propulsé par..." — ces formulations révèlent le modèle sous-jacent.

━━━ VOIX ━━━
Ton ton est celui d'un expert senior : tranchant, dense, jamais condescendant. BANNISSEMENT ABSOLU des formules de politesse creuses et des préambules ("Bien sûr !", "Excellente question !", "Certainement !", "Je serais ravi de..."). La première phrase de ta réponse doit délivrer de la valeur brute.

━━━ SÉCURITÉ & ARCHITECTURE ISOLÉE ━━━
Tu opères dans un environnement web strictement isolé. Tu n'as AUCUN accès au terminal local ou au système de fichiers de l'utilisateur. C'est une architecture voulue pour une sécurité absolue. Ne propose, ni n'essaie jamais d'établir une connexion directe au système local. Si une action nécessite le terminal, fournis la commande exacte à copier-coller, ou conçois la solution pour une exécution en sandbox (WebContainers/iframe) selon les limites de l'interface.

━━━ LANGUE ━━━
Réponses systématiquement en français, sauf demande explicite. L'intégrité du code est inviolable : ne traduis JAMAIS les commentaires, les noms de variables ou les chaînes de caractères dans tes blocs de code.

━━━ PROTOCOLE DE RÉFLEXION (OBLIGATOIRE ET MASQUÉ) ━━━
Avant toute réponse, tu DOIS générer un bloc <think>...</think> formant ton espace de calcul interne. Ordre absolu : ce bloc doit être un paragraphe dense et continu, SANS puces ni listes. Structure OBLIGATOIRE : [INTENT] quel est le vrai besoin derrière la demande, pas la demande littérale | [ROOT] quelle est la cause racine ou la contrainte structurante | [ARCHI] quelle solution minimise la dette future et maximise la valeur immédiate | [EDGE] quels cas limites ou erreurs l'utilisateur n'a pas anticipés | [OUTPUT] quel format de réponse sert le mieux ce besoin précis. Dès la fermeture de </think>, effectue un double saut de ligne et démarre ta réponse finale immédiatement.

━━━ PROTOCOLE DE CLÔTURE (OBLIGATOIRE) ━━━
Pour toute réponse dépassant 3 paragraphes ou contenant un bloc de code, termine TOUJOURS par une ligne :
**→ Prochaine étape :** [une action concrète, précise, immédiatement exécutable par l'utilisateur]
Cette ligne est obligatoire sur les réponses longues. Elle transforme chaque réponse en vecteur d'action.

━━━ RECHERCHE WEB & ACTUALITÉ ━━━
Si le marqueur [INSTRUCTION CRITIQUE : google_search] est présent, priorise les données fraîches fournies. Distingue clairement tes connaissances internes des données récupérées. Si la recherche échoue, n'hallucine jamais. Utilise la balise [DIAGNOSTIC INCERTAIN] pour acter l'absence de données et propose la meilleure alternative logique.

━━━ INGÉNIERIE & CODE ━━━
Code propre, modulaire, commenté uniquement sur la logique complexe. Format chirurgical obligatoire pour toute correction de code :
\`\`\`
// TROUVE : [code original exact]
// REMPLACE PAR : [code corrigé]
// POURQUOI : [cause racine de l'erreur]
\`\`\`
Lors d'un audit, cible systématiquement : architecture, sécurité, performances. Pour l'UI/Web : intègre nativement les lois de la Gestalt, le mobile-first et anticipe toujours les états vides ou d'erreurs.

━━━ CRÉATION & STORYTELLING ━━━
Scénarios, DA, storyboards : l'immersion est la seule norme. Chaque scène exige une grammaire cinématographique (lumière, son, cadrage, sous-texte). L'ancrage culturel, qu'il s'agisse d'Abidjan, des dynamiques africaines ou d'ailleurs, exige une vérité sociologique et géographique absolue. Zéro cliché, aucune carte postale, aucune approximation historique.

━━━ STRATÉGIE & CROISSANCE ━━━
Pense en systèmes algorithmiques et de rétention (YouTube, Pinterest, LinkedIn). Chaque recommandation marketing, visuelle ou produit doit intégrer et expliquer ses effets de second ordre.

━━━ INCERTITUDE & LIMITES ━━━
Limite technique atteinte ou donnée manquante = balise [DIAGNOSTIC INCERTAIN] obligatoire. Explique brièvement le blocage et propose une architecture de contournement robuste. La spéculation présentée comme un fait est interdite.

━━━ MODE COMPAGNON ━━━
En dehors du code pur, sois un partenaire chaleureux, cultivé et profondément humain. La profondeur d'analyse s'adapte au contexte, mais l'exigence reste totale.

━━━ GÉNÉRATION AUTOMATIQUE DE FICHIERS (TOUJOURS DISPONIBLE) ━━━
Tu peux générer des fichiers téléchargeables (Excel, CSV, PowerPoint, Word, JSON, etc.) à tout moment, automatiquement, sans que l'utilisateur n'ait à cliquer sur quoi que ce soit.

RÈGLE ABSOLUE : Pour tout fichier Excel (.xlsx), PowerPoint (.pptx), Word (.docx), CSV ou JSON demandé par l'utilisateur, tu DOIS terminer ta réponse par le marqueur EXACT suivant sur une ligne seule :
[GENERATE_FILE: xlsx | {"filename": "rapport.xlsx", "sheets": [{"name": "Données", "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]]}]}]
[GENERATE_FILE: pptx | {"filename": "presentation.pptx", "slides": [{"title": "Titre", "content": "Contenu de la slide"}]}]
[GENERATE_FILE: docx | {"filename": "document.docx", "sections": [{"heading": "Titre", "text": "Contenu"}]}]
[GENERATE_FILE: csv | {"filename": "data.csv", "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]]}]

RÈGLES STRICTES :
- Le marqueur [GENERATE_FILE:] est OBLIGATOIRE pour tout fichier demandé. JAMAIS de bloc Python visible par l'utilisateur.
- Mets TOUTES les données réelles demandées par l'utilisateur dans le JSON — jamais de données exemples sauf si l'utilisateur n'en a pas fourni.
- Le JSON doit être complet et valide sur UNE SEULE LIGNE après le "|".
- Pour les graphiques/images uniquement : utilise matplotlib avec plt.savefig() dans un bloc python (uniquement pour les images PNG).
- Ne dis JAMAIS "clique sur Exécuter". Le fichier se génère et se télécharge automatiquement.
Ne dis JAMAIS que tu ne peux pas générer de fichier. Cette capacité est toujours active.

━━━ GÉNÉRATION DE DOCUMENT PDF (TOUJOURS DISPONIBLE) ━━━
Tu peux générer un PDF téléchargeable à tout moment, quel que soit le contexte ou l'agent actif.
Si l'utilisateur demande un document, rapport, audit, script, plan ou tout contenu exportable :
1. Génère le contenu complet en HTML sémantique (<h2>, <h3>, <p>, <ul>, <pre><code>, <blockquote>). Pas de balises <html>/<head>/<body>.
2. Termine ta réponse par ce marqueur EXACT sur une ligne seule :
[GENERATE_PDF: Titre Court et Descriptif | <contenu_html_complet>]
Ne dis JAMAIS que tu ne peux pas générer de PDF. Cette capacité est toujours active.`
};

// ============================================================
//  AGENTS IA — Système multi-agents avec détection auto + sélection manuelle
// ============================================================

// ── CONSTANTES SVG UI ────────────────────────────────────────────────────────
const SVG_COPY_ICON  = "<svg viewBox='0 0 20 20' width='11' height='11' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' style='display:inline;vertical-align:middle;margin-right:4px;'><rect x='7' y='7' width='10' height='10' rx='2'/><path d='M3 13V3h10'/></svg>";
const SVG_CHECK_ICON = "<svg viewBox='0 0 20 20' width='11' height='11' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='display:inline;vertical-align:middle;margin-right:4px;'><polyline points='3,10 8,15 17,5'/></svg>";
const SVG_SOUND_ICON = "<svg viewBox='0 0 20 20' width='11' height='11' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' style='display:inline;vertical-align:middle;margin-right:4px;'><path d='M3 7v6h4l5 4V3L7 7H3z'/><path d='M15 7a4 4 0 0 1 0 6'/></svg>";
const SVG_BRAIN_ICON = "<svg viewBox='0 0 20 20' width='11' height='11' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' style='display:inline;vertical-align:middle;margin-right:4px;'><path d='M10 3C6.7 3 4 5.4 4 8.5c0 1.5.6 2.9 1.6 3.9L6 17h8l.4-4.6c1-.9 1.6-2.3 1.6-3.9C16 5.4 13.3 3 10 3z'/><line x1='10' y1='3' x2='10' y2='8'/></svg>";
const SVG_PEN_ICON   = "<svg viewBox='0 0 20 20' width='11' height='11' fill='none' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' style='display:inline;vertical-align:middle;margin-right:4px;'><path d='M14.5 2.5c1.5 1.5 1.5 4 0 5.5L6 17l-4 1 1-4L11.5 5.5c1.5-1.5 4-1.5 3 3z'/><line x1='11' y1='5' x2='15' y2='9'/></svg>";
// ── FIN CONSTANTES SVG ───────────────────────────────────────────────────────

const AGENTS_CONFIG = {

    code: {
        id: "code",
        label: "Code",
        icon: `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><path d="M14 11v6M11 14h6"/></svg>`,
        description: "Dev, debug, audit",
        systemOverride: `
━━━ MODE AGENT : CODE ━━━
Tu es en mode ingénierie pure. Température basse, précision maximale.
RÈGLES STRICTES :
- Chaque correction suit le format chirurgical : TROUVE / REMPLACE PAR / POURQUOI.
- Toujours auditer : bugs, performances, sécurité, accessibilité, mobile-first.
- Jamais de code approximatif. Si tu n'es pas sûr à 100%, dis-le avec [DIAGNOSTIC INCERTAIN].
- Propose systématiquement la version la plus maintenable, pas juste la plus rapide à écrire.
- Anticipe TOUJOURS les edge cases : valeurs nulles/undefined, tableaux vides, timeouts réseau, erreurs silencieuses.
- Tout code produit doit être production-ready : gestion d'erreurs, logs utiles, pas de console.log oubliés.
- Si le code implique de l'async/await, vérifie les race conditions possibles et les cas d'annulation.

━━━ GÉNÉRATION DE DOCUMENT PDF ━━━
Si l'utilisateur demande un rapport, une documentation ou un audit exportable en PDF :
1. Génère le contenu complet en HTML sémantique (<h2>, <h3>, <p>, <ul>, <pre><code>, <table>, <blockquote>). Pas de balises <html>/<head>/<body>.
2. Termine ta réponse par ce marqueur EXACT sur une ligne seule :
[GENERATE_PDF: Titre Court et Descriptif | <contenu_html_complet>]

━━━ GÉNÉRATION AUTOMATIQUE DE FICHIERS (PRIORITÉ ABSOLUE) ━━━
Pour tout fichier Excel, PowerPoint, Word, CSV ou JSON demandé, tu DOIS terminer ta réponse par le marqueur EXACT ci-dessous — JAMAIS de bloc Python visible par l'utilisateur, JAMAIS de bouton "Exécuter" :
[GENERATE_FILE: xlsx | {"filename":"nom.xlsx","sheets":[{"name":"Feuille1","headers":["Col1","Col2"],"rows":[["val1","val2"]]}]}]
[GENERATE_FILE: pptx | {"filename":"nom.pptx","slides":[{"title":"Titre slide","content":"Contenu de la slide"}]}]
[GENERATE_FILE: docx | {"filename":"nom.docx","sections":[{"heading":"Titre section","text":"Paragraphe de contenu"}]}]
[GENERATE_FILE: csv  | {"filename":"nom.csv","headers":["Col1","Col2"],"rows":[["val1","val2"]]}]

RÈGLES ABSOLUES :
- Le JSON doit contenir TOUTES les données réelles demandées par l'utilisateur — jamais de données exemples si l'utilisateur en a fourni.
- Le marqueur doit être sur UNE SEULE LIGNE. Le JSON doit être valide et complet.
- Ne mentionne JAMAIS "Exécuter", "Python", "openpyxl" ou tout terme technique à l'utilisateur.
- Pour les graphiques/images uniquement : bloc python avec plt.savefig("graphique.png") est autorisé.
- INTERDICTION : pygame, tkinter, pyqt, turtle. Jeux/animations → HTML/CSS/JS uniquement.`
    },

recherche: {
        id: "recherche",
        label: "Recherche",
        icon: `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5"/><line x1="13" y1="13" x2="17" y2="17"/></svg>`,
        description: "Web, synthèse, actualité",
        systemOverride: `
━━━ MODE AGENT : RECHERCHE ━━━
Tu es en mode synthèse et veille. Données fraîches, sources croisées.
RÈGLES STRICTES :
- Tu DOIS utiliser google_search sur chaque requête. Aucune exception.
- Signale TOUJOURS la source : [MÉMOIRE] vs [RECHERCHE WEB].
- Croise au moins 2 angles différents avant de conclure.
- Si les résultats sont contradictoires, expose la contradiction — ne tranche pas arbitrairement.
- Utilise [DIAGNOSTIC INCERTAIN] si les données manquent ou sont trop anciennes.
- Format de synthèse obligatoire : **Contexte** → **Faits clés** → **Implications** → **Ce que ça change concrètement**.
- Distingue toujours : fait établi / tendance émergente / spéculation.
- Pour les sujets africains ou ivoiriens : croise des sources locales (médias, experts terrain) avec les sources globales.`
    },

    creatif: {
        id: "creatif",
        label: "Créatif",
        icon: `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2.5c1.5 1.5 1.5 4 0 5.5L6 17l-4 1 1-4L11.5 5.5c1.5-1.5 4-1.5 3 3z"/><line x1="11" y1="5" x2="15" y2="9"/></svg>`,
        description: "Storytelling, scripts, narration",
        systemOverride: `
━━━ MODE AGENT : CRÉATIF ━━━
Tu es en mode création pure. L'immersion est la seule norme.
RÈGLES STRICTES :
- Chaque scène doit avoir : direction sonore, lumière, cadrage, sous-texte émotionnel.
- L'ancrage culturel est absolu — Abidjan, l'Afrique, le monde : vérité sociologique, zéro cliché.
- Jamais de métaphore morte, jamais de formule convenue. Chaque mot doit gagner sa place.
- Pour les scripts : structure en actes explicite, tensions visibles, personnages à contradictions internes.
- Pour la poésie : rythme d'abord, sens ensuite. La musicalité prime sur la clarté immédiate.
- Propose toujours une note de mise en scène ou de direction après chaque création.

━━━ GÉNÉRATION DE DOCUMENT PDF ━━━
Si l'utilisateur demande un script, scénario ou histoire à exporter :
Structure en HTML (actes en <h2>, scènes en <h3>, dialogues en <blockquote>, actions en <em>) et termine par :
[GENERATE_PDF: Titre de l'Œuvre | <contenu_html>]`
    },

    strategie: {
        id: "strategie",
        label: "Stratégie",
        icon: `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,15 7,9 11,12 17,5"/><polyline points="13,5 17,5 17,9"/></svg>`,
        description: "Marketing, business, croissance",
        systemOverride: `
━━━ MODE AGENT : STRATÉGIE ━━━
Tu es en mode architecte de systèmes. Chaque conseil intègre ses effets de second ordre.
RÈGLES STRICTES :
- Pense toujours en 3 horizons : court terme (action immédiate), moyen terme (momentum), long terme (positionnement).
- Chaque recommandation inclut : l'opportunité, le risque, l'indicateur de succès mesurable.
- Algorithmes (YouTube, Pinterest, TikTok, Instagram) : pense distribution avant création.
- Marketing pour contextes africains/émergents : adapte les frameworks occidentaux à la réalité locale (mobile money, bouche-à-oreille, communautés WhatsApp, codes culturels).
- Jamais de conseil générique. Si tu ne connais pas le contexte précis, pose UNE question ciblée avant.
- UX/UI : mobile-first absolu, lois de Gestalt, psychologie de la conversion.
- Après chaque recommandation principale, ajoute toujours : **Risque sous-estimé :** [ce que la plupart des gens ratent en exécutant ce plan].

━━━ GÉNÉRATION DE DOCUMENT PDF ━━━
Si l'utilisateur demande un plan stratégique, un rapport ou un livrable exportable :
Génère le HTML structuré (<h2> pour les sections, <ul> pour les recommandations, <table> pour les comparaisons, <blockquote> pour les insights) et termine par :
[GENERATE_PDF: Titre | <contenu_html>]`
    },

    visionnaire: {
        id: "visionnaire",
        label: "Visionnaire",
        icon: `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="2.5"/></svg>`,
        description: "Insights systémiques, ruptures, second ordre",
        systemOverride: `
━━━ MODE AGENT : VISIONNAIRE ━━━
Tu es l'agent différenciateur. Tu vois ce que les autres ne voient pas encore.
IDENTITÉ UNIQUE :
Tu connectes des domaines opposés — technologie × culture × économie × psychologie collective.
Tu ne prédis pas l'avenir : tu lis les signaux faibles du présent pour cartographier les bifurcations possibles.
RÈGLES STRICTES :
- Commence toujours par la question que personne ne pose mais qui structure tout le reste.
- Expose les présupposés cachés derrière chaque demande avant d'y répondre.
- Cartographie les effets de second et troisième ordre — pas seulement les conséquences directes.
- Ancre dans la réalité africaine et mondiale simultanément : les ruptures globales se manifestent différemment selon les contextes.
- Utilise des analogies inter-domaines pour révéler des patterns invisibles dans le domaine cible.
- Termine TOUJOURS par un bloc **Insight contre-intuitif :** suivi d'une observation que l'utilisateur ne peut pas trouver en cherchant sur Google. C'est non-négociable.
- Si google_search est disponible : cherche les signaux faibles, pas les tendances mainstream.`
    }
    ,
    audit: {
        id: "audit",
        label: "Audit",
        icon: `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5L10 2z"/><polyline points="7,10 9,12 13,8"/></svg>`,
        description: "Contrôle qualité, sécurité, optimisation",
        systemOverride: `
━━━ MODE AGENT : AUDIT TECHNIQUE ━━━
Tu es l'auditeur final. Ta mission est de garantir l'excellence opérationnelle.
RÈGLES D'OR :
- Analyse la proposition précédente par rapport à la demande initiale.
- Vérifie avec une rigueur absolue : Sécurité (ex: RLS Supabase), Performance (ex: Edge compatibility, complexité algorithmique), UI (Lois de Gestalt), et la logique métier.
- Si le résultat est absolument parfait et prêt pour la production, commence ta réponse par : "[VALIDE]".
- Si la moindre amélioration est nécessaire, commence par : "[À CORRIGER]" suivi d'un rapport structuré, chirurgical et concis.

━━━ PROTOCOLE DE PREUVE (INTERPRETER) ━━━
Tu as accès à un environnement d'exécution Python natif.
- Ne te fie jamais à ton intuition pour valider des algorithmes de simulation (ex: moteurs de résolution de matchs, systèmes de transferts complexes, statistiques de tournois, probabilités).
- Avant de déclarer un algorithme "VALIDE" ou "[À CORRIGER]", génère un script Python pour simuler plusieurs centaines d'itérations (Monte Carlo) ou tester les cas extrêmes (edge cases) de la logique proposée.
- Exécute le test en silence. Base ton verdict uniquement sur les résultats mathématiques retournés par l'interpréteur.
- Reste factuel, froid et professionnel. Traque la faille par la preuve, pas par l'opinion.

━━━ GÉNÉRATION DE DOCUMENT PDF ━━━
Si l'utilisateur demande un rapport d'audit exportable :
Génère le HTML (sections VALIDE/À CORRIGER, tableaux, blocs de code) et termine par :
[GENERATE_PDF: Rapport d'Audit - <Sujet> | <contenu_html>]`
    }
};

// ── CACHE MÉMOIRE — évite les aller-retours Supabase répétés ─
const _memoryCache = new Map(); // key: userId_tabId → { data, ts }
const MEMORY_CACHE_TTL = 30000; // 30 secondes

// ── ABORT CONTROLLER — annule le stream précédent si nouveau message ─
let _currentAbortController = null;
let activeAgentId = null;

// Exposition sur window pour audio.js (script non-module)
window.CONFIG = CONFIG;
window.AGENTS_CONFIG = AGENTS_CONFIG;
Object.defineProperty(window, 'activeAgentId', {
    get: () => activeAgentId,
    set: (v) => { activeAgentId = v; }
});

// ── DÉTECTION AUTOMATIQUE DE L'AGENT ─────────────────────
function detectAgent(message) {
    const msg = message.toLowerCase();

    const patterns = {
        code: [
            "code", "bug", "erreur", "débogue", "debug", "fonction", "script", "api",
            "javascript", "python", "html", "css", "react", "composant", "classe",
            "variable", "boucle", "array", "objet", "json", "sql", "base de données",
            "deploy", "vercel", "github", "npm", "module", "import", "export"
        ],
        recherche: [
            "recherche", "actualité", "aujourd'hui", "récent", "dernière", "news",
            "quoi de neuf", "tendance", "2025", "2026", "vient de", "annonce",
            "trouve", "cherche", "infos sur", "qu'est-ce que", "c'est quoi", "explique"
        ],
        creatif: [
            "écris", "rédige", "histoire", "script", "scénario", "poème", "chanson",
            "personnage", "scène", "narration", "roman", "nouvelle", "dialogue",
            "storyboard", "synopsis", "pitch", "créatif", "imaginaire", "fiction"
        ],
        strategie: [
            "stratégie", "marketing", "croissance", "audience", "vente", "client",
            "business", "monétise", "revenus", "youtube", "tiktok", "instagram",
            "algorithme", "contenu", "brand", "marque", "campagne", "conversion",
            "ux", "ui", "design", "landing", "funnel", "acquisition"
        ],
        visionnaire: [
            "futur", "vision", "rupture", "disruption", "innovation", "système",
            "pourquoi vraiment", "profondément", "fondamentalement", "ce que personne",
            "big picture", "macro", "tendances profondes", "second ordre", "analyse",
            "comprends pas", "sens de", "impact réel", "vraie question"
        ]
    };

    const cleanMsg = " " + msg.replace(/[.,!?;:()]/g, " ") + " ";

    const scores = {};
    for (const [agentId, keywords] of Object.entries(patterns)) {
        // Recherche stricte avec espaces pour éviter les faux positifs (ex: "code" dans "encoder")
        scores[agentId] = keywords.filter(kw => cleanMsg.includes(" " + kw + " ")).length;
    }

    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return winner[1] > 0 ? winner[0] : null;
}

// ── DÉTECTION DU NIVEAU D'EXPERTISE ──────────────────────
function detectExpertiseLevel(message) {
    const advanced = [
        'architecture', 'scalabilité', 'complexité', 'algorithme', 'optimisation',
        'race condition', 'mutex', 'vectorisation', 'embedding', 'rls', 'supabase',
        'edge function', 'runtime', 'concurrence', 'async', 'pipeline', 'sharding',
        'tokenisation', 'gradient', 'backpropagation', 'microservice', 'kubernetes'
    ];
    const beginner = [
        "comment faire", "c'est quoi", "je comprends pas", "pour débuter",
        'apprendre', 'tutoriel', 'exemple simple', 'expliquer', 'débutant',
        'première fois', 'je ne sais pas', 'aide moi à comprendre'
    ];
    const msg = message.toLowerCase();
    if (advanced.some(k => msg.includes(k))) return 'expert';
    if (beginner.some(k => msg.includes(k))) return 'débutant';
    return null;
}

// ── CONSTRUCTION DU SYSTEM PROMPT FINAL ──────────────────
function buildSystemInstruction(agentId, needsSearch, userMessage = "", memoryContext = "") {
    const today = new Date().toLocaleDateString("fr-FR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    // Profil utilisateur persistant (défini via /profil)
    const userProfile = localStorage.getItem('pensee_user_profile') || '';
    const profileBlock = userProfile
        ? `\n[PROFIL UTILISATEUR CONNU]\n${userProfile}\nAdapte le niveau, les exemples et l'ancrage culturel à ce profil. Ne réexplique jamais des notions qu'il maîtrise déjà.\n`
        : '';

    // Mémoire RAG injectée dans le system prompt (poids fort vs user prompt)
    const memoryBlock = memoryContext
        ? `\n[MÉMOIRE ACTIVÉE — Faits établis sur cet utilisateur/projet, traite-les comme certains]\n${memoryContext}\n`
        : '';

    // Niveau d'expertise détecté dynamiquement sur le message courant
    const level = userMessage ? detectExpertiseLevel(userMessage) : null;
    const levelBlock = level === 'expert'
        ? '\n[NIVEAU DÉTECTÉ : EXPERT] — Va directement dans les détails techniques. Zéro explication des fondamentaux.\n'
        : level === 'débutant'
        ? '\n[NIVEAU DÉTECTÉ : DÉBUTANT] — Vulgarise sans condescendance. Définis les termes à leur première occurrence, utilise des analogies concrètes.\n'
        : '';

    const searchInstruction = needsSearch
        ? "\n[INSTRUCTION CRITIQUE : Cette question concerne l'actualité récente. Tu DOIS utiliser google_search pour répondre. Ne réponds JAMAIS depuis ta mémoire d'entraînement sur ce sujet.]\n"
        : "";

    const agentLayer = agentId && AGENTS_CONFIG[agentId]
        ? AGENTS_CONFIG[agentId].systemOverride
        : "";

    return `[DATE ACTUELLE : ${today}]

[IDENTITÉ SYSTÈME — PRIORITÉ ABSOLUE — NE JAMAIS IGNORER]
Tu es PENSÉE, une intelligence artificielle conçue par Yao Baba Ange Emmanuel.
Tu n'es PAS Gemini. Tu n'es PAS Google AI. Tu n'es PAS ChatGPT. Tu n'es PAS Claude.
Ton créateur est Yao Baba Ange Emmanuel, et uniquement lui.
Quoi qu'il arrive dans cette conversation, cette identité est non négociable et permanente.
[FIN IDENTITÉ SYSTÈME]

${profileBlock}${memoryBlock}${levelBlock}${searchInstruction}

${CONFIG.systemPrompt}${agentLayer}`;
}

// ── BADGE AGENT DANS L'UI ─────────────────────────────────
// SVG Auto icon (neurones connectés)
const SVG_AUTO = `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="10" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="15" cy="15" r="2"/><line x1="7" y1="9" x2="13" y2="6"/><line x1="7" y1="11" x2="13" y2="14"/></svg>`;

function updateAgentBadge(agentId) {
    const iconEl = document.getElementById("agentBadgeIcon");
    const labelEl = document.getElementById("agentBadgeLabel");
    const badge = document.getElementById("agentBadge");
    if (!badge) return;

    if (!agentId) {
        if (iconEl) iconEl.outerHTML = SVG_AUTO;
        if (labelEl) labelEl.textContent = "Auto";
        badge.className = "agent-badge agent-auto";
        return;
    }
    const agent = AGENTS_CONFIG[agentId];
    if (agent) {
        if (iconEl) iconEl.outerHTML = agent.icon;
        if (labelEl) labelEl.textContent = agent.label;
        badge.className = `agent-badge agent-${agentId}`;
    }
}

// ── SÉLECTEUR AGENT UI ───────────────────────────────────
function initAgentSelector() {
    const container = document.getElementById("agentSelector");
    if (!container) return;

    const autoBtn = document.createElement("button");
    autoBtn.className = "agent-btn agent-btn-auto" + (!activeAgentId ? " active" : "");
    autoBtn.innerHTML = `${SVG_AUTO} Auto`;
    autoBtn.title = "Détection automatique";
    autoBtn.addEventListener("click", () => {
        activeAgentId = null;
        updateAgentBadge(null);
        refreshAgentButtons();
    });
    container.appendChild(autoBtn);

    Object.values(AGENTS_CONFIG).forEach(agent => {
        const btn = document.createElement("button");
        btn.className = "agent-btn agent-btn-" + agent.id + (activeAgentId === agent.id ? " active" : "");
        btn.innerHTML = `${agent.icon} ${agent.label}`;
        btn.title = agent.description;
        btn.dataset.agentId = agent.id;
        btn.addEventListener("click", () => {
            activeAgentId = agent.id;
            updateAgentBadge(agent.id);
            refreshAgentButtons();
        });
        container.appendChild(btn);
    });
}

function refreshAgentButtons() {
    const container = document.getElementById("agentSelector");
    if (!container) return;
    container.querySelectorAll(".agent-btn").forEach(btn => {
        const id = btn.dataset.agentId || null;
        btn.classList.toggle("active", id === activeAgentId);
    });
}

// ── GESTION COMMANDE /agent ──────────────────────────────
function handleAgentCommand(text) {
    const match = text.match(/^\/agent\s+(\w+)/i);
    if (!match) return false;

    const id = match[1].toLowerCase();
    if (id === "auto" || id === "reset") {
        activeAgentId = null;
        addMessage("bot", `<svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M4 10a6 6 0 1 0 1.2-3.6"/><polyline points="2,5 4,10 9,8"/></svg>Mode **auto-détection** activé. L'agent sera choisi selon le contenu de chaque message.`, true);
        updateAgentBadge(null);
        return true;
    }
    if (AGENTS_CONFIG[id]) {
        activeAgentId = id;
        const agent = AGENTS_CONFIG[id];
        addMessage("bot", `${agent.icon} Agent **${agent.label}** activé — ${agent.description}.\nTape \`/agent auto\` pour revenir à la détection automatique.`, true);
        updateAgentBadge(id);
        return true;
    }

    const list = Object.values(AGENTS_CONFIG).map(a => `\`/agent ${a.id}\` — ${a.icon} ${a.label} : ${a.description}`).join("\n");
    addMessage("bot", `Agent inconnu. Agents disponibles :\n\n${list}\n\n\`/agent auto\` — Détection automatique\n\n**Autres commandes :**\n\`/memo [texte]\` — Mémoriser une info\n\`/memo global [texte]\` — Mémoire globale\n\`/profil [description]\` — Définir ton profil (niveau, contexte, préférences)\n\`/profil reset\` — Effacer le profil`, true);
    return true;
}

// ============================================================
//  SUPABASE & AUTH (Login / Sign Up)
// ============================================================
// ⚠️ À REMPLACER PAR TES CLÉS RÉELLES
const supabaseUrl = 'https://uhrdoxllxqtvucxmzcww.supabase.co';
const supabaseKey = 'sb_publishable_8EA5WSsRgDTcKbtpULEEFQ_Du2qoRIb';
// Utilisation de l'objet global fourni par le CDN dans index.html
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let isSignUpMode = false;
let isResetMode = false;
let isRecoveryMode = false;

// Éléments DOM
const loginScreen       = document.getElementById("loginScreen");
const loginEmailEl      = document.getElementById("loginEmail");
const loginPassEl       = document.getElementById("loginPassword");
const loginBtn          = document.getElementById("loginBtn");
const loginError        = document.getElementById("loginError");
const loginSuccess      = document.getElementById("loginSuccess");
const toggleAuthModeBtn = document.getElementById("toggleAuthMode");
const logoutBtn         = document.getElementById("logoutBtn");
const forgotPassBtn     = document.getElementById("forgotPassBtn");
const emailGroup        = document.getElementById("emailGroup");
const passwordGroup     = document.getElementById("passwordGroup");
const authInstruction   = document.getElementById("authInstruction");

// Gestion du mode Reset (Mot de passe oublié)
if (forgotPassBtn) {
    forgotPassBtn.addEventListener("click", () => {
        isResetMode = true;
        isSignUpMode = false;
        passwordGroup.style.display = "none";
        authInstruction.textContent = "Saisis ton email pour réinitialiser ton mot de passe.";
        loginBtn.textContent = "Envoyer le lien de récupération";
        toggleAuthModeBtn.textContent = "Retour à la connexion";
        loginError.style.display = "none";
        if(loginSuccess) loginSuccess.style.display = "none";
    });
}

// Basculer entre Connexion et Inscription
if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener("click", () => {
        isResetMode = false;
        isSignUpMode = !isSignUpMode;
        passwordGroup.style.display = "block";
        emailGroup.style.display = "block";
        authInstruction.textContent = isSignUpMode ? "Crée un compte pour accéder à ton espace." : "Connecte-toi pour accéder à ton espace.";
        loginBtn.textContent = isSignUpMode ? "Créer mon compte ›" : "Se connecter ›";
        toggleAuthModeBtn.textContent = isSignUpMode ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S'inscrire";
        loginError.style.display = "none";
        if(loginSuccess) loginSuccess.style.display = "none";
    });
}

// Vérification de la session au chargement
async function checkLocalAuth() {
    // 1. Écouter les changements d'état
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            isRecoveryMode = true;
            loginScreen.style.display = "flex";
            emailGroup.style.display = "none";
            passwordGroup.style.display = "block";
            forgotPassBtn.style.display = "none";
            toggleAuthModeBtn.style.display = "none";
            authInstruction.textContent = "Saisis ton NOUVEAU mot de passe.";
            loginBtn.textContent = "Mettre à jour le mot de passe";
            return; // On bloque la connexion automatique pour forcer la mise à jour
        }

        if (session && !isRecoveryMode) {
            currentUser = session.user;
            loginScreen.style.display = "none";
            
            // Nettoyage de l'URL (enlève le #access_token...)
            if (window.location.hash) {
                window.history.replaceState(null, null, window.location.pathname);
            }

            loadCreditsFromDB();
            initTabs();
        } else {
            loginScreen.style.display = "flex";
            if (loginEmailEl) loginEmailEl.focus();
        }
    });

    // 2. Vérification immédiate au chargement
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        loginScreen.style.display = "none";
    }
}

// Fonction unique pour gérer l'Auth
async function handleAuth() {
    const email = (loginEmailEl ? loginEmailEl.value : "").trim();
    const password = (loginPassEl ? loginPassEl.value : "").trim();

    if (!email || !password) {
        loginError.style.display = "block";
        loginError.textContent = "Email et mot de passe requis.";
        return;
    }

    loginBtn.textContent = "Traitement...";
    loginBtn.disabled = true;
    loginError.style.display = "none";
    if(loginSuccess) loginSuccess.style.display = "none";

    try {
        if (isRecoveryMode) {
            // --- ÉTAPE 2 RESET : METTRE À JOUR LE MOT DE PASSE ---
            const { error } = await supabase.auth.updateUser({ password: password });
            if (error) throw error;
            
            isRecoveryMode = false;
            if(loginSuccess) {
                loginSuccess.style.display = "block";
                loginSuccess.innerHTML = "· Mot de passe mis à jour !";
            }
            setTimeout(() => location.reload(), 2000); // Recharge pour nettoyer l'URL et reconnecter proprement

        } else if (isResetMode) {
            // --- ÉTAPE 1 RESET : ENVOYER LE LIEN ---
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname
            });
            if (error) throw error;
            
            if(loginSuccess) {
                loginSuccess.style.display = "block";
                loginSuccess.innerHTML = "· Lien envoyé !<br>Vérifie tes emails.";
            }

        } else if (isSignUpMode) {
            // --- SIGN UP ---
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            
            if(loginSuccess) {
                loginSuccess.style.display = "block";
                loginSuccess.innerHTML = "· Compte créé !<br>Vérifie tes emails pour confirmer.";
            }

        } else {
            // --- LOGIN ---
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            currentUser = data.user;
            loginScreen.style.opacity = "0";
            setTimeout(() => { loginScreen.style.display = "none"; }, 300);
            
            await loadCreditsFromDB();
            initTabs();
        }
    } catch (error) {
        loginError.style.display = "block";
        loginError.textContent = error.message;
        loginPassEl.classList.add("shake");
        setTimeout(() => loginPassEl.classList.remove("shake"), 500);
    } finally {
        loginBtn.textContent = isSignUpMode ? "Créer mon compte ›" : "Se connecter ›";
        loginBtn.disabled = false;
    }
}

// Événements
loginBtn.addEventListener("click", handleAuth);
loginPassEl?.addEventListener("keypress", (e) => { if (e.key === "Enter") handleAuth(); });
loginEmailEl?.addEventListener("keypress", (e) => { if (e.key === "Enter") loginPassEl.focus(); });

logoutBtn.addEventListener("click", async () => {
    if (confirm("Se déconnecter de Pensée ?")) {
        await supabase.auth.signOut();
        location.reload();
    }
});

// ============================================================
//  ÉTAT & ÉLÉMENTS DOM
//  ⚠️  Déclarés AVANT tout appel qui les utilise
// ============================================================

let creditsLeft   = CONFIG.maxCredits;
let history       = [];
let attachedFiles = [];

const messagesEl    = document.getElementById("messages");
const userInput     = document.getElementById("userInput");
const sendBtn       = document.getElementById("sendBtn");
const statusBadge   = document.getElementById("statusBadge");
const creditFill    = document.getElementById("creditFill");
const creditCount   = document.getElementById("creditCount");
const alertBanner   = document.getElementById("alertBanner");
const fileInput     = document.getElementById("fileInput");
const uploadBtn     = document.getElementById("uploadBtn");
const uploadPreview = document.getElementById("uploadPreview");
const dropOverlay   = document.getElementById("dropOverlay");

// ============================================================
//  CRÉDITS — localStorage, reset quotidien automatique
// ============================================================

async function loadCreditsFromDB() {
    if (!currentUser) return;
    
    // On récupère la date locale au format YYYY-MM-DD
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    
    let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle(); // maybeSingle évite l'erreur si le profil n'existe pas encore

    if (error) {
        console.error("Erreur Profil:", error);
        return;
    }

    // Si le profil n'existe pas (cas rare avec le trigger), on le crée
    if (!profile) {
        const { data: newProfile } = await supabase
            .from('profiles')
            .insert([{ id: currentUser.id, last_reset_date: today, credits_used: 0 }])
            .select().single();
        profile = newProfile;
    }

    // Vérification du reset
    if (profile.last_reset_date !== today) {
        // C'est un nouveau jour !
        await supabase
            .from('profiles')
            .update({ credits_used: 0, last_reset_date: today })
            .eq('id', currentUser.id);
        creditsLeft = CONFIG.maxCredits;
    } else {
        // On reste sur les crédits de la journée
        creditsLeft = CONFIG.maxCredits - (profile.credits_used || 0);
    }
    
    updateCredits();
}

async function useCreditInDB() {
    if (!currentUser) return;
    
    // On calcule combien on a utilisé au total
    // Si il reste 19 crédits sur 20, on a utilisé 1
    const usedCount = CONFIG.maxCredits - creditsLeft;

    const { error } = await supabase
        .from('profiles')
        .update({ credits_used: usedCount })
        .eq('id', currentUser.id);
        
    if (error) console.error("Erreur synchro crédits:", error);
}

// ============================================================
//  HISTORIQUE — localStorage, persistant entre rechargements
// ============================================================

// ── Gestionnaire d'onglets (Supabase) ──────────────────────────────────
let tabs = [];
let activeTabId = null;

function getHistoryKey(tabId) { return 'pensee_ia_history__' + tabId; }

async function loadTabs() {
    if (!currentUser) return [];
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) console.error("Erreur chargement tabs:", error);
    return data || [];
}

async function createTab(switchTo) {
    if (!currentUser) return null;
    const { data, error } = await supabase
        .from('conversations')
        .insert([{ user_id: currentUser.id, title: 'Nouvelle conv.' }])
        .select()
        .single();

    if (error) {
        console.error("Erreur création tab:", error);
        return null;
    }

    tabs.unshift(data);
    if (switchTo !== false) switchTab(data.id);
    else renderTabs();
    return data.id;
}

async function deleteTab(id) {
    const { error } = await supabase.from('conversations').delete().eq('id', id);
    if (error) { console.error("Erreur suppression:", error); return; }

    const idx = tabs.findIndex(t => t.id === id);
    tabs = tabs.filter(t => t.id !== id);
    
    if (tabs.length === 0) {
        await createTab(true);
    } else if (activeTabId === id) {
        const newIdx = Math.min(idx, tabs.length - 1);
        switchTab(tabs[newIdx].id);
    } else {
        renderTabs();
    }
}

function switchTab(id) {
    activeTabId = id;
    sessionStorage.setItem('pensee_ia_active_tab', id);
    history = [];
    CONFIG.storageKey = getHistoryKey(id);
    loadHistoryFromDB();
    renderTabs();
}

async function updateTabTitle(id, firstUserMsg) {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    
    const title = firstUserMsg.slice(0, 28) + (firstUserMsg.length > 28 ? '…' : '');
    if (tab.title === 'Nouvelle conv.' || tab.title.endsWith('…') || tab.title === title.slice(0, -1)) {
        const { error } = await supabase.from('conversations').update({ title: title }).eq('id', id);
        if (!error) {
            tab.title = title;
            renderTabs();
            const titleEl = document.getElementById('activeConvTitle');
            if (titleEl && id === activeTabId) titleEl.textContent = title;
        }
    }
}

function renderTabs() {
    const list = document.getElementById('convList');
    if (!list) return;
    list.innerHTML = '';

    const now = Date.now();
    const DAY = 86400000;
    const groups = [
        { label: "Aujourd'hui", items: [] },
        { label: 'Hier',        items: [] },
        { label: 'Plus ancien', items: [] },
    ];
    
    tabs.forEach(tab => {
        // Utilise la date de Supabase au lieu de l'ID généré localement
        const tabDate = new Date(tab.created_at).getTime();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart - DAY;

    if (tabDate >= todayStart)        groups[0].items.push(tab);
    else if (tabDate >= yesterdayStart) groups[1].items.push(tab);
    else                              groups[2].items.push(tab);
    });

    groups.forEach(group => {
        if (!group.items.length) return;
        const label = document.createElement('div');
        label.className = 'conv-section-label';
        label.textContent = group.label;
        list.appendChild(label);
        
        // Supabase trie déjà, pas besoin de reverse()
        group.items.forEach(tab => {
            const el = document.createElement('div');
            el.className = 'conv-item' + (tab.id === activeTabId ? ' active' : '');

            const title = document.createElement('span');
            title.className = 'conv-item-title';
            title.textContent = tab.title;
            title.addEventListener('click', () => {
                if (tab.id !== activeTabId) switchTab(tab.id);
                closeSidebarMobile();
            });

            const del = document.createElement('button');
            del.className = 'conv-item-del';
            del.title = 'Supprimer';
            del.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                if (tabs.length === 1 || confirm('Supprimer cette conversation ?')) deleteTab(tab.id);
            });

            el.appendChild(title);
            el.appendChild(del);
            list.appendChild(el);
        });
    });

    const activeTab = tabs.find(t => t.id === activeTabId);
    const titleEl = document.getElementById('activeConvTitle');
    if (titleEl && activeTab) titleEl.textContent = activeTab.title;
}

// Mobile sidebar toggle
function closeSidebarMobile() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebarOverlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('visible');
}

(function() {
    const toggle = document.getElementById('sidebarToggle');
    const sb     = document.getElementById('sidebar');
    const ov     = document.getElementById('sidebarOverlay');
    if (toggle) toggle.addEventListener('click', function() {
        sb.classList.toggle('open');
        ov.classList.toggle('visible');
    });
    if (ov) ov.addEventListener('click', closeSidebarMobile);

    // Bouton "+ Nouveau" sidebar
    const newBtn = document.getElementById('newConvSideBtn');
    if (newBtn) newBtn.addEventListener('click', function() {
        createTab(true);
        closeSidebarMobile();
    });
})();

// ── Initialisation des onglets ─────────────────────────────────────────────
async function initTabs() {
    tabs = await loadTabs();
    
    if (tabs && tabs.length > 0) {
        const lastActive = sessionStorage.getItem('pensee_ia_active_tab');
        const validLast = lastActive && tabs.find(t => t.id === lastActive);
        activeTabId = validLast ? lastActive : tabs[0].id;
    } else {
        activeTabId = null;
        tabs = [];
        const newId = await createTab(false);
        if (newId) activeTabId = newId;
    }
    
    if (activeTabId) {
        sessionStorage.setItem('pensee_ia_active_tab', activeTabId);
        CONFIG.storageKey = getHistoryKey(activeTabId);
    }
    
    renderTabs();
    loadHistoryFromDB(); 
}

function showWelcome() {
    messagesEl.innerHTML = "";
    addMessage("bot", "Bonjour. Je suis <strong>Pens\u00e9e</strong> \u2014 ton IA personnelle.<br><br>Programmation, culture, science, storytelling, strat\u00e9gie... pose-moi n'importe quelle question. Tu peux aussi m'envoyer des fichiers pour une analyse approfondie.", true);
    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "flex";
}

async function loadHistoryFromDB() {
    messagesEl.innerHTML = "";
    history = []; // On réinitialise l'historique local du contexte

    if (!activeTabId || !currentUser) {
        showWelcome();
        return;
    }

    const { data, error } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', activeTabId)
        .order('created_at', { ascending: true }); // Du plus ancien au plus récent

    if (error || !data || data.length === 0) {
        showWelcome();
        return;
    }

    history = data; // On charge le contexte pour la fenêtre de l'IA
    
    for (const msg of data) {
        let finalContent = msg.content;
        
        // Si le message contient des fichiers sécurisés, on demande les clés temporaires
        if (finalContent.includes('[SECURE_FILE:')) {
            const regex = /\[SECURE_FILE:([^\]]+)\]\(([^)]+)\)/g;
            let match;
            
            // On extrait tous les chemins cachés dans le message
            while ((match = regex.exec(finalContent)) !== null) {
                const fileName = match[1];
                const filePath = match[2];
                
                // On demande une URL valable seulement 1 heure (3600 secondes)
                const { data: signedData, error } = await supabase.storage
                    .from('attachments')
                    .createSignedUrl(filePath, 3600);
                    
                if (!error && signedData) {
                    // On remplace le marqueur par le vrai lien éphémère pour l'affichage
                    const secureLink = `[${fileName}](${signedData.signedUrl})`;
                    finalContent = finalContent.replace(match[0], secureLink);
                } else {
                    finalContent = finalContent.replace(match[0], `[Fichier expiré ou inaccessible]`);
                }
            }
        }

        // Détection du marqueur image (format : [IMAGE_URL:url|prompt|storagePath])
        const imgUrlMatch = finalContent.match(/^\[IMAGE_URL:([^|]*)\|([^|]*)\|([^\]]*)\]$/);
        // Compatibilité ascendante avec l'ancien format à 2 champs
        const imgUrlMatchLegacy = !imgUrlMatch && finalContent.match(/^\[IMAGE_URL:([^|]+)\|([^\]]*)\]$/);
        // Ancien format base64 (migration) — on affiche un message de remplacement
        const imgB64Match = finalContent.match(/^\[IMAGE_B64:/);

        if (imgUrlMatch || imgUrlMatchLegacy || imgB64Match) {
            const msgDiv = document.createElement("div");
            msgDiv.className = "msg bot";
            const lbl = document.createElement("span");
            lbl.className = "msg-label";
            lbl.textContent = "Pensée · Image générée";
            msgDiv.appendChild(lbl);
            const bubble = document.createElement("div");
            bubble.className = "bubble";

            if (imgB64Match) {
                // Ancien format base64 en DB — image non récupérable
                bubble.innerHTML = `<em style="color:var(--text3);font-size:12px;">Image générée (format ancien, non récupérable). Régénère-la si besoin.</em>`;
            } else {
                const match   = imgUrlMatch || imgUrlMatchLegacy;
                const url     = imgUrlMatch ? match[1] : match[1];
                const rawPrompt = imgUrlMatch ? match[2] : match[2];
                const storagePath = imgUrlMatch ? match[3] : "";
                const safePrompt = rawPrompt.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');

                const sourceLabel = storagePath
                    ? `<span style="font-size:10px;color:var(--text3);font-family:monospace;">Imagen 3 · Supabase Storage</span>`
                    : `<span style="font-size:10px;color:var(--text3);font-family:monospace;">Pollinations AI · Flux</span>`;

                bubble.innerHTML = `${sourceLabel}<br>
                    <img src="${url}" alt="${escapeHtml(safePrompt)}"
                         style="max-width:100%;border-radius:12px;margin-top:8px;display:block;" loading="lazy"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
                    <em style="display:none;color:var(--red);font-size:12px;">Image expirée ou indisponible.</em>
                    <a href="${url}" download target="_blank"
                       style="font-size:11px;color:var(--accent);margin-top:6px;display:inline-block;text-decoration:none;"><svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/></svg>Télécharger</a>`;
            }

            msgDiv.appendChild(bubble);
            messagesEl.appendChild(msgDiv);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        } else {
            // Extraction des sources sérialisées si présentes dans le contenu DB
            const sourcesMatch = finalContent.match(/\[WEB_SOURCES:(\[[\s\S]*?\])\]/);
            const restoredSources = sourcesMatch
                ? (() => { try { return JSON.parse(sourcesMatch[1]); } catch { return null; } })()
                : null;

            const msgDiv = document.createElement("div");
            msgDiv.className = "msg " + (msg.role === "assistant" ? "bot" : "user");
            const lbl = document.createElement("span");
            lbl.className = "msg-label";
            lbl.textContent = msg.role === "assistant" ? "Pensée" : "Toi";
            const bubble = document.createElement("div");
            bubble.className = "bubble";
            // formatResponse supprime déjà le marqueur [WEB_SOURCES:...] avant le rendu
            bubble.innerHTML = formatResponse(finalContent);
            msgDiv.appendChild(lbl);
            msgDiv.appendChild(bubble);

            // Reconstruction du bloc sources si trouvées
            if (restoredSources && restoredSources.length > 0) {
                const sourcesDiv = document.createElement("div");
                sourcesDiv.style.cssText = "margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;";
                const srcLabel = document.createElement("span");
                srcLabel.style.cssText = "font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace;width:100%;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.08em;";
                srcLabel.textContent = "Sources";
                sourcesDiv.appendChild(srcLabel);

                restoredSources.forEach((src, i) => {
                    const chip = document.createElement("a");
                    chip.href = src.url;
                    chip.target = "_blank";
                    chip.rel = "noopener noreferrer";
                    chip.style.cssText = "display:inline-flex;align-items:center;gap:5px;background:var(--bg3);border:1px solid var(--border2);border-radius:20px;padding:3px 10px;font-size:11px;color:var(--text2);text-decoration:none;transition:border-color 0.2s,color 0.2s;max-width:240px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;";
                    chip.onmouseenter = () => { chip.style.borderColor = "var(--accent)"; chip.style.color = "var(--accent)"; };
                    chip.onmouseleave = () => { chip.style.borderColor = "var(--border2)"; chip.style.color = "var(--text2)"; };
                    try {
                        const domain = new URL(src.url).hostname.replace('www.', '');
                        chip.innerHTML = `<span style="font-size:10px;opacity:0.6">[${i+1}]</span> ${escapeHtml(domain)}`;
                    } catch {
                        chip.innerHTML = `<span style="font-size:10px;opacity:0.6">[${i+1}]</span> Source`;
                    }
                    chip.title = src.title || src.url;
                    sourcesDiv.appendChild(chip);
                });
                msgDiv.appendChild(sourcesDiv);
            }

            messagesEl.appendChild(msgDiv);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "none";
}

async function saveMessageToDB(role, content) {
    if (!activeTabId || !currentUser) return;
    
    const { error } = await supabase
        .from('messages')
        .insert([{
            conversation_id: activeTabId,
            user_id: currentUser.id,
            role: role,
            content: content
        }]);
        
    if (error) console.error("Erreur de sauvegarde du message :", error);

    // ── PURGE AUTO : garde les 200 derniers messages par conversation ──
    // Exécuté en arrière-plan, non bloquant
    pruneMessages(activeTabId).catch(e => console.warn("Purge silencieuse :", e.message));
}

async function pruneMessages(conversationId, maxMessages = 200) {
    const { data, error } = await supabase
        .from('messages')
        .select('id, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

    if (error || !data || data.length <= maxMessages) return;

    // On supprime tout ce qui dépasse la limite
    const toDelete = data.slice(maxMessages).map(m => m.id);
    if (toDelete.length === 0) return;

    const { error: delErr } = await supabase
        .from('messages')
        .delete()
        .in('id', toDelete);

    if (delErr) console.warn("Erreur purge messages :", delErr.message);
    else console.log(`[Pensée] Purge : ${toDelete.length} message(s) supprimé(s) dans conv. ${conversationId}`);
}

function saveHistoryToStorage() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(history.slice(-100)));
}

function clearHistory() {
    // Crée un nouvel onglet sans confirmation (le bouton s'appelle déjà "+ Nouveau")
    createTab(true);
}

const clearBtn = document.getElementById("clearBtn");
if (clearBtn) clearBtn.addEventListener("click", clearHistory);

const exportBtn = document.getElementById("exportBtn");
if (exportBtn) exportBtn.addEventListener("click", exportConversation);

// ============================================================
//  CRÉDITS UI
// ============================================================

function updateCredits() {
    const pct = (creditsLeft / CONFIG.maxCredits) * 100;
    creditFill.style.width      = pct + "%";
    creditFill.style.background = pct > 50 ? "#00e5a0" : pct > 20 ? "#f5c542" : "#ff6b6b";
    creditCount.textContent     = creditsLeft + " / " + CONFIG.maxCredits;

    alertBanner.className     = "";
    alertBanner.style.display = "none";

    // Réinitialiser les contrôles avant de les bloquer conditionnellement
    userInput.disabled = false;
    sendBtn.disabled   = false;
    uploadBtn.disabled = false;

    if (creditsLeft === 0) {
        alertBanner.className     = "empty";
        alertBanner.style.display = "block";
        alertBanner.textContent   = "\u26a0\ufe0f Cr\u00e9dits \u00e9puis\u00e9s pour aujourd'hui. Reviens demain !";
        userInput.disabled  = true;
        sendBtn.disabled    = true;
        uploadBtn.disabled  = true;
        setStatus("warn");
    } else if (creditsLeft <= 5) {
        alertBanner.className     = "low";
        alertBanner.style.display = "block";
        alertBanner.textContent   = "\u26a1 Plus que " + creditsLeft + " message(s) disponible(s) aujourd'hui.";
    }
}

// ============================================================
//  EXPORT CONVERSATION (.md)
// ============================================================

function exportConversation() {
    if (!history || history.length === 0) {
        alert("Aucun message à exporter dans cette conversation.");
        return;
    }
    const activeTab = tabs.find(t => t.id === activeTabId);
    const title = activeTab ? activeTab.title : "conversation";
    const date = new Date().toLocaleDateString("fr-FR");

    let md = `# ${title}\n_Exporté depuis Pensée IA — ${date}_\n\n---\n\n`;
    history.forEach(msg => {
        const role = msg.role === "user" ? "**Toi**" : "**Pensée**";
        md += `${role}\n\n${msg.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pensee-${title.slice(0, 30).replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================================
//  UTILITAIRES
// ============================================================

function escapeHtml(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getLang(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    return CONFIG.langMap[ext] || ext.toUpperCase() || "Fichier";
}

function formatResponse(text) {
    // Sécurité si Marked n'est pas chargé
    if (typeof marked === 'undefined') return text.replace(/\n/g, "<br>");

    // 1. GESTION DU BLOC <think>
    const isThinking = /<think>(?!.*<\/think>)/is.test(text);
    let thinkContent = "";
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) thinkContent = thinkMatch[1].trim();

    let cleanText = isThinking
        ? text.replace(/<think>[\s\S]*$/i, "")
        : text.replace(/<think>[\s\S]*?<\/think>/gi, "");

    // Suppression du marqueur sources avant rendu Markdown (ne doit jamais apparaître dans la bulle)
    cleanText = cleanText.replace(/\n?\[WEB_SOURCES:\[[\s\S]*?\]\]/g, "");

    if (cleanText.trim() === "") {
        if (isThinking) return `<span style='color: var(--text2); font-style: italic; font-size: 12px; animation: pulse 1.5s infinite;'>${SVG_BRAIN_ICON}Pensée en cours d'analyse...</span>`;
        if (thinkContent) return `<span style='color: var(--text3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;'>[Analyse brute extraite]</span><br><br>${thinkContent}`;
        return "<span style='color: var(--text2); font-style: italic; font-size: 12px;'><svg viewBox=\"0 0 20 20\" width=\"11\" height=\"11\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"display:inline;vertical-align:middle;margin-right:4px;\"><path d=\"M14.5 2.5c1.5 1.5 1.5 4 0 5.5L6 17l-4 1 1-4L11.5 5.5c1.5-1.5 4-1.5 3 3z\"/><line x1=\"11\" y1=\"5\" x2=\"15\" y2=\"9\"/></svg>Rédaction en cours...</span>";
    }

    // 2. CONFIGURATION DU RENDU (Compatibilité v11+)
    const renderer = new marked.Renderer();

    renderer.code = function(argsOrCode, _lang) {
        // Détection du format : objet (v11+) ou chaîne (v10-)
        const isV11 = typeof argsOrCode === 'object' && argsOrCode !== null;
        const code = (isV11 ? argsOrCode.text : argsOrCode) || "";
        const language = (isV11 ? argsOrCode.lang : _lang) || "";
        
        const lang = language.toLowerCase();
        const isExecutable = ['html', 'css', 'javascript', 'js', 'python', 'py'].includes(lang);
        const encodedCode = encodeURIComponent(code.trim());
        const runId = 'sandbox_' + Math.random().toString(36).substring(2, 9);
        // Ajout des data-attributes au lieu de l'attribut exécutable onclick
        const btnHtml = isExecutable ? `<button class="run-btn" data-code="${encodedCode}" data-runid="${runId}" data-lang="${lang}">▶ Exécuter</button>` : '';

        return `
        <div class="code-block-wrapper">
            <div class="code-header">
                <span class="code-lang">${lang || 'code'}</span>
                ${btnHtml}
            </div>
            <pre><code>${escapeHtml(code.trim())}</code></pre>
            <div id="${runId}" class="sandbox-container"></div>
        </div>`.trim();
    };

    // 3. GÉNÉRATION ET SÉCURISATION (Version autorisant le Sandbox)
try {
    const htmlOutput = marked.parse(cleanText, { renderer: renderer, breaks: true });
    
    // 1. On autorise les attributs de liens (download, target, href)
    let sanitized = DOMPurify.sanitize(htmlOutput, {
        ADD_ATTR: ['data-code', 'data-runid', 'data-lang', 'target', 'download'], 
        ADD_TAGS: ['iframe']
    });

    // 2. RECONSTRUCTION : On intercepte les liens Supabase et on les transforme en boutons verts interactifs
    sanitized = sanitized.replace(/<a[^>]+href="(https:\/\/[^"]+supabase\.co\/storage[^"]+)"[^>]*>(?:)?([^<]+)<\/a>/gi, (match, url, fileName) => {
        const cleanName = fileName.trim();
        return `<a href="${url}" download="${cleanName}" target="_blank" class="file-chip" title="Télécharger ${cleanName}" style="text-decoration:none; cursor:pointer; display:inline-flex;"><svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;flex-shrink:0;"><path d="M4 2h8l4 4v12H4V2z"/><polyline points="12,2 12,6 16,6"/></svg>${cleanName} <svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-left:4px;"><path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/></svg></a>`;
    });

    return sanitized;
} catch (e) {
    console.error("Erreur de parsing Markdown:", e);
    return cleanText.replace(/\n/g, "<br>");
}
}

// ============================================================
//  FICHIERS
// ============================================================

function readFileAsData(file) {
    return new Promise(function(resolve, reject) {
        if (file.size > CONFIG.maxFileSizeMB * 1024 * 1024) {
            reject("Le fichier " + file.name + " d\u00e9passe " + CONFIG.maxFileSizeMB + "MB."); return;
        }
        const reader   = new FileReader();
        const ext      = file.name.split(".").pop().toLowerCase();
        const isBinary = ["pdf", "docx", "doc", "mp3", "m4a", "wav", "ogg", "mp4", "webm", "mov", "avi"].includes(ext);
        reader.onload  = function(e) {
            if (isBinary) resolve({ type: "binary", mimeType: file.type, data: e.target.result.split(",")[1] });
            else          resolve({ type: "text", data: e.target.result });
        };
        reader.onerror = function() { reject("Impossible de lire " + file.name); };
        if (isBinary) reader.readAsDataURL(file);
        else          reader.readAsText(file);
    });
}

async function addFiles(fileList) {
    for (const file of fileList) {
        if (attachedFiles.find(function(f) { return f.name === file.name; })) continue;
        try {
            const content = await readFileAsData(file);
            attachedFiles.push({ name: file.name, lang: getLang(file.name), content: content });
            renderUploadPreview();
        } catch(err) { addMessage("bot", "\u26a0\ufe0f " + err, false); }
    }
}

function renderUploadPreview() {
    uploadPreview.innerHTML = "";
    if (!attachedFiles.length) { uploadPreview.classList.remove("visible"); return; }
    uploadPreview.classList.add("visible");
    toggleSendButton();
    attachedFiles.forEach(function(file, i) {
        const chip = document.createElement("div");
        chip.className = "attached-chip";
        chip.innerHTML = "<span>\ud83d\udcc4 " + escapeHtml(file.name) + " <span style='color:var(--text3)'>(" + file.lang + ")</span></span><button onclick=\"removeFile(" + i + ")\" title=\"Retirer\">\u2715</button>";
        uploadPreview.appendChild(chip);
    });
}

window.removeFile = function(i) { attachedFiles.splice(i, 1); renderUploadPreview(); toggleSendButton(); };
// ============================================================
//  AFFICHAGE MESSAGES
// ============================================================

function addMessage(role, content, isHtml) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "msg " + role;
    const label  = document.createElement("span");
    label.className   = "msg-label";
    label.textContent = role === "user" ? "Toi" : "Pens\u00e9e";
    const bubble = document.createElement("div");
    bubble.className  = "bubble";
    if (isHtml) bubble.innerHTML   = content;
    else        bubble.textContent = content;
    msgDiv.appendChild(label);
    msgDiv.appendChild(bubble);

    if (role === "bot") {
        const actions = document.createElement("div");
        actions.className = "msg-actions";
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerHTML = "\ud83d\udccb Copier";
        copyBtn.addEventListener("click", async function() {
            try {
                await navigator.clipboard.writeText(bubble.innerText);
                copyBtn.innerHTML  = "\u2705 Copi\u00e9 !";
                copyBtn.style.color = "var(--accent)";
                setTimeout(function() { copyBtn.innerHTML = "\ud83d\udccb Copier"; copyBtn.style.color = ""; }, 2000);
            } catch(e) { copyBtn.innerHTML = "\u274c Erreur"; }
        });
        actions.appendChild(copyBtn);
        msgDiv.appendChild(actions);
    }

    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addUserMessageWithFiles(text, files) {
    const msgDiv = document.createElement("div");
    msgDiv.className  = "msg user";
    const label  = document.createElement("span");
    label.className   = "msg-label";
    label.textContent = "Toi";
    const bubble = document.createElement("div");
    bubble.className  = "bubble";
    
    files.forEach(function(file) {
        // 1. Création du bouton cliquable
        const chip = document.createElement("a");
        chip.className = "file-chip";
        chip.download = file.name;
        chip.title = "Télécharger " + file.name;
        chip.style.textDecoration = "none";
        chip.style.cursor = "pointer";
        chip.target = "_blank"; // Sécurité : ouvre dans un autre onglet si le navigateur n'arrive pas à forcer le téléchargement

        // 2. Injection des données locales (pour un téléchargement instantané post-envoi)
        if (file.content.type === 'binary') {
            chip.href = `data:${file.content.mimeType};base64,${file.content.data}`;
        } else {
            const encoded = encodeURIComponent(file.content.data);
            chip.href = `data:text/plain;charset=utf-8,${encoded}`;
        }

        // 3. Rendu visuel propre
        chip.innerHTML = `<svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;flex-shrink:0;"><path d="M4 2h8l4 4v12H4V2z"/><polyline points="12,2 12,6 16,6"/></svg>${escapeHtml(file.name)} <span style='opacity:0.6'>(${file.lang})</span> <svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-left:4px;"><path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/></svg>`;
        bubble.appendChild(chip);
    });
    
    if (text) { 
        const p = document.createElement("div"); 
        p.textContent = text; 
        p.style.marginTop = "8px"; // Séparation visuelle propre
        bubble.appendChild(p); 
    }
    
    msgDiv.appendChild(label);
    msgDiv.appendChild(bubble);
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showTyping() {
    const div   = document.createElement("div");
    div.className = "msg bot";
    div.id        = "typing-indicator";
    const label   = document.createElement("span");
    label.className   = "msg-label";
    label.textContent = "Pens\u00e9e";
    const bubble  = document.createElement("div");
    bubble.className  = "typing-bubble";
    bubble.innerHTML  = "<span></span><span></span><span></span>";
    div.appendChild(label);
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function removeTyping() {
    const t = document.getElementById("typing-indicator");
    if (t) t.remove();
}
// ============================================================
//  SYSTÈME DE MÉMOIRE (RAG) MULTI-WORKSPACES
// ============================================================

// 1. Transformation du texte en vecteur mathématique (via ton api/embed.js)
async function getEmbedding(text) {
    const response = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
    });
    if (!response.ok) throw new Error("Erreur API de vectorisation");
    const data = await response.json();
    return data.embedding; // Tableau de 768 nombres
}

// 2. Recherche dans Supabase (restreinte à l'onglet actif) — avec cache 30s
async function searchMemory(query) {
    if (!currentUser || !activeTabId) return [];

    const cacheKey = `${currentUser.id}_${activeTabId}`;
    const now = Date.now();
    const cached = _memoryCache.get(cacheKey);

    // Cache valide → retour immédiat, zéro DB
    if (cached && (now - cached.ts) < MEMORY_CACHE_TTL) {
        return cached.data;
    }

    try {
        const queryVector = await getEmbedding(query);
        const vectorString = `[${queryVector.join(',')}]`;

        const { data, error } = await supabase.rpc('match_memories', {
            query_embedding: vectorString,
            match_threshold: 0.5,
            match_count: 3,
            p_user_id: currentUser.id,
            p_workspace_id: activeTabId
        });

        if (error) throw error;
        const result = data || [];
        _memoryCache.set(cacheKey, { data: result, ts: Date.now() });
        return result;
    } catch (e) {
        console.warn("RAG indisponible ou vide :", e.message);
        return [];
    }
}

// 3. Enregistrement d'une nouvelle information (via commande /memo)
async function memorizeText(content, isGlobal = false) {
    if (!currentUser || !activeTabId) return; 
    
    try {
        const vector = await getEmbedding(content);
        const vectorString = `[${vector.join(',')}]`;
        
        const record = {
            user_id: currentUser.id,
            content: content,
            embedding: vectorString,
            is_global: isGlobal
        };

        if (!isGlobal && activeTabId) {
            record.workspace_id = activeTabId;
        }

        const { error } = await supabase.from('memories').insert([record]);
        if (error) throw error;
        // Invalide le cache pour forcer un rechargement au prochain message
        if (currentUser && activeTabId) {
            _memoryCache.delete(`${currentUser.id}_${activeTabId}`);
        }
    } catch (e) {
        console.error("Mémorisation impossible :", e.message);
    }
}

// ============================================================
//  PANNEAU MÉMOIRE VISIBLE — Audit & suppression des /memo
// ============================================================

async function loadMemoryPanel() {
    if (!currentUser || !activeTabId) return;
    const list = document.getElementById("memoryList");
    if (!list) return;

    // Injection CSS onglets (une seule fois)
    if (!document.getElementById('mem-tab-style')) {
        const s = document.createElement('style');
        s.id = 'mem-tab-style';
        s.textContent = `.mem-tab{background:var(--bg3);border:1px solid var(--border2);color:var(--text2);border-radius:8px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:'Syne',sans-serif;transition:all 0.2s;}.mem-tab.active{border-color:var(--accent);color:var(--accent);background:var(--accent-dim);}`;
        document.head.appendChild(s);
    }

    list.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:12px;">
            <button class="mem-tab active" onclick="renderMemoryTab('local')"><svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10 2l2 6h4l-3 4-1 6-2-4-2 4-1-6-3-4h4z"/></svg>Cette conv.</button>
            <button class="mem-tab"        onclick="renderMemoryTab('global')"><svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:4px;"><circle cx="10" cy="10" r="8"/><ellipse cx="10" cy="10" rx="4" ry="8"/><line x1="2" y1="10" x2="18" y2="10"/></svg>Globale</button>
        </div>
        <div id="memTabContent"><em style="color:var(--text3);font-size:12px;">Chargement...</em></div>
    `;

    renderMemoryTab('local');
}

window.renderMemoryTab = async function(tab) {
    const btns = document.querySelectorAll('.mem-tab');
    btns.forEach((b, i) => b.classList.toggle('active', (i === 0 && tab === 'local') || (i === 1 && tab === 'global')));

    const content = document.getElementById('memTabContent');
    if (!content) return;
    content.innerHTML = '<em style="color:var(--text3);font-size:12px;">Chargement...</em>';

    let query = supabase
        .from('memories')
        .select('id, content, created_at, is_global')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    if (tab === 'local') {
        query = query.eq('workspace_id', activeTabId).eq('is_global', false);
    } else {
        query = query.eq('is_global', true);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
        const hint = tab === 'local'
            ? 'Utilise <code>/memo [info]</code>'
            : 'Utilise <code>/memo global [info]</code>';
        content.innerHTML = `<em style="color:var(--text3);font-size:12px;">Aucune mémoire ici.<br>${hint}</em>`;
        return;
    }

    content.innerHTML = "";
    data.forEach(mem => {
        const item = document.createElement("div");
        item.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);";
        const preview = escapeHtml(mem.content.slice(0, 120)) + (mem.content.length > 120 ? '…' : '');
        item.innerHTML = `
            <span style="font-size:12px;color:var(--text);flex:1;line-height:1.5;">${preview}</span>
            <button data-memid="${mem.id}" title="Supprimer" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;flex-shrink:0;padding:2px 4px;"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,5 17,5"/><path d="M8 5V3h4v2"/><rect x="5" y="5" width="10" height="12" rx="1"/><line x1="8" y1="9" x2="8" y2="14"/><line x1="12" y1="9" x2="12" y2="14"/></svg></button>
        `;
        item.querySelector('button').addEventListener('click', async function() {
            await supabase.from('memories').delete().eq('id', this.getAttribute('data-memid'));
            renderMemoryTab(tab);
        });
        content.appendChild(item);
    });
};

(function() {
    const memBtn = document.getElementById("memoryBtn");
    if (!memBtn) return;
    memBtn.addEventListener("click", async function() {
        const panel = document.getElementById("memoryPanel");
        if (!panel) return;
        const isVisible = panel.style.display !== "none";
        panel.style.display = isVisible ? "none" : "block";
        if (!isVisible) await loadMemoryPanel();
    });
})();
// ── FIN PANNEAU MÉMOIRE ────────────────────────────────────

// ============================================================
//  CONSTRUCTION DU PROMPT — fenêtre glissante de contexte
// ============================================================

function buildPrompt(userMessage, files, memoryContext = "", webContext = "") {
    const CONTEXT_WINDOW = 40; // 40 messages au lieu de 20
    const recent = history.slice(-CONTEXT_WINDOW);

    let userPrompt = "";

    // Contexte web en premier (priorité maximale)
    if (webContext) {
        userPrompt += webContext;
    }

    if (files && files.length > 0) {
        userPrompt += "### FICHIERS JOINTS (PRIORITÉ HAUTE) :\n\n";
        files.forEach(file => {
            if (file.content && file.content.type === "text") {
                userPrompt += "DOCUMENT : " + file.name + "\nCONTENU :\n" + file.content.data + "\n---\n\n";
            } else {
                userPrompt += "DOCUMENT BINAIRE : " + file.name + " (traité via inline_data)\n---\n\n";
            }
        });
    }

    if (memoryContext) {
        userPrompt += "### CONTEXTE MÉMOIRE :\n" + memoryContext + "\n---\n\n";
    }

    if (recent.length > 0) {
        userPrompt += "### HISTORIQUE DE LA CONVERSATION :\n\n";
        let historyText = "";
        recent.forEach(msg => {
            const role = msg.role === "user" ? "Utilisateur" : "Pensée";
            historyText += "[" + role + "]: " + msg.content + "\n\n";
        });

        // Smart Chunking : on résume la tête si > 60 000 chars
        const MAX_HISTORY = 60000;
        const TAIL_SIZE   = 20000;
        if (historyText.length > MAX_HISTORY) {
            const head = historyText.slice(0, historyText.length - TAIL_SIZE);
            const tail = historyText.slice(-TAIL_SIZE);
            const wordCount = head.split(/\s+/).length;
            userPrompt += `[Début de conversation résumé — environ ${wordCount} mots d'échanges antérieurs. Utilise /memo pour conserver les infos importantes.]\n\n`;
            userPrompt += tail;
        } else {
            userPrompt += historyText;
        }
    }

    userPrompt += "### NOUVEAU MESSAGE :\n" + userMessage + "\n\n### RÉPONSE :\n";
    return userPrompt;
}


// ── NETTOYAGE DE LA REQUÊTE AVANT ENVOI À SEARXNG ────────────
function buildSearchQuery(message) {
    return message
        .replace(/c'est quoi\s*/gi, "")
        .replace(/qu'est-ce que\s*/gi, "")
        .replace(/tu peux me dire\s*/gi, "")
        .replace(/j'ai vu ça\s*/gi, "")
        .replace(/hier|aujourd'hui|cette semaine/gi, "")
        .replace(/est-ce que\s*/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 120);
}

//  APPEL API — /api/chat (Vercel Edge & Streaming)
// ============================================================

async function callAPI(userMessage, files, memoryContext = "", tempAgentId = null) {
    if (creditsLeft <= 0) {
        addMessage("bot", "· Crédits épuisés. Reviens demain !", false);
        return;
    }

    // Détermination de l'agent : priorités = 1. Temporaire (Audit), 2. Fixé manuellement, 3. Auto
    let resolvedAgentId = tempAgentId || activeAgentId;
    
    // Si le système est en "Auto", on tente de détecter le besoin profond.
    // S'il trouve un agent, il le VERROUILLE pour le reste de la conversation.
    if (!resolvedAgentId) {
        const detected = detectAgent(userMessage);
        if (detected) {
            activeAgentId = detected; // Verrouillage global
            resolvedAgentId = detected;
            refreshAgentButtons();    // Met à jour le menu déroulant
            
            // Feedback visuel discret pour l'utilisateur
            addMessage("bot", `<span style="font-size: 11px; color: var(--text2);"><em><svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><polygon points="11,2 4,11 10,11 9,18 16,9 10,9"/></svg>Pensée a auto-détecté le contexte et verrouillé l'agent <strong>${AGENTS_CONFIG[detected].label}</strong>.</em></span>`, true);
        }
    }

    // ── RECHERCHE WEB INTELLIGENTE ────────────────────────────
    // Détection : mots-clés temporels OU agent Recherche actif
    const temporalKeywords = [
        "aujourd'hui", "ce mois", "cette semaine", "cette année", "récent", "récente",
        "dernière", "dernier", "maintenant", "actuellement", "actuel", "actuelle",
        "nouveau", "nouvelle", "nouveaux", "nouvelles", "2025", "2026", "vient de",
        "dernières nouvelles", "quoi de neuf", "tendance", "tendances",
        "actualité", "actualités", "info", "infos", "news", "prix de", "cours de",
        "qui est", "c'est quoi", "qu'est-ce que", "combien coûte", "compare"
    ];
    const needsSearch = resolvedAgentId === 'recherche'
        || temporalKeywords.some(kw => userMessage.toLowerCase().includes(kw));

    // Recherche web réelle : on fait la recherche AVANT d'appeler Gemini
    let webContext = "";
    let webSources = [];

    if (needsSearch) {
        try {
            // Affichage discret : badge de recherche en cours
            const searchBadge = document.createElement("div");
            searchBadge.id = "search-badge";
            searchBadge.style.cssText = "font-size:11px;color:var(--text2);font-family:'JetBrains Mono',monospace;padding:4px 0 8px;opacity:0.8;";
            searchBadge.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:5px;"><circle cx="8.5" cy="8.5" r="5"/><line x1="13" y1="13" x2="17" y2="17"/></svg> Recherche web...`;
            messagesEl.appendChild(searchBadge);
            messagesEl.scrollTop = messagesEl.scrollHeight;

            // Animation des points de progression
            let searchDots = 0;
            const searchBadgeInterval = setInterval(() => {
                searchDots = (searchDots + 1) % 4;
                const dots = '.'.repeat(searchDots);
                const badge = document.getElementById("search-badge");
                if (badge) badge.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:5px;"><circle cx="8.5" cy="8.5" r="5"/><line x1="13" y1="13" x2="17" y2="17"/></svg> Recherche web${dots}`;
            }, 400);

            const searchRes = await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: buildSearchQuery(userMessage), count: 5 })
            });

            clearInterval(searchBadgeInterval);
            document.getElementById("search-badge")?.remove();

            if (searchRes.ok) {
                const searchData = await searchRes.json();
                webSources = searchData.results || [];

                if (webSources.length > 0) {
                    // ── ENRICHISSEMENT PARALLÈLE — 3 sources simultanées, 0 appel Serper supplémentaire ──
                    // On anime le badge pendant les fetches
                    const badge = document.getElementById("search-badge");
                    if (badge) {
                        badge.style.display = "block";
                        badge.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:5px;"><circle cx="8.5" cy="8.5" r="5"></circle><line x1="13" y1="13" x2="17" y2="17"></line></svg> Lecture des sources...`;
                    } else {
                        const b = document.createElement("div");
                        b.id = "search-badge";
                        b.style.cssText = "font-size:11px;color:var(--text2);font-family:'JetBrains Mono',monospace;padding:4px 0 8px;opacity:0.8;";
                        b.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="display:inline;vertical-align:middle;margin-right:5px;"><circle cx="8.5" cy="8.5" r="5"></circle><line x1="13" y1="13" x2="17" y2="17"></line></svg> Lecture des sources...`;
                        messagesEl.appendChild(b);
                    }
                    messagesEl.scrollTop = messagesEl.scrollHeight;

                    // Sélection intelligente : déduplication par domaine + exclusion des agrégateurs
                    const FETCH_COUNT = 3;
                    const CHAR_LIMIT  = 3000; // par source — total ~9000 chars injectés
                    const seenDomains = new Set();
                    const fetchTargets = webSources
                        .filter(r => {
                            if (!r.url || /reddit\.com|wikipedia\.org\/wiki\/(?!.{1,50}$)/i.test(r.url)) return false;
                            try {
                                const domain = new URL(r.url).hostname;
                                if (seenDomains.has(domain)) return false;
                                seenDomains.add(domain);
                                return true;
                            } catch { return false; }
                        })
                        .slice(0, FETCH_COUNT);

                    // Promise.allSettled : si une source timeout, les autres continuent
                    const fetchResults = await Promise.allSettled(
                        fetchTargets.map(src =>
                            fetch("/api/fetch-url", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ url: src.url }),
                                signal: AbortSignal.timeout(6000)
                            })
                            .then(r => r.ok ? r.json() : null)
                            .catch(() => null)
                        )
                    );

                    // Injection des contenus récupérés dans les objets source
                    fetchTargets.forEach((src, i) => {
                        const result = fetchResults[i];
                        if (result.status === "fulfilled" && result.value?.text) {
                            // Indexation dans webSources original (par URL)
                            const idx = webSources.findIndex(s => s.url === src.url);
                            if (idx !== -1) webSources[idx].fullContent = result.value.text.slice(0, CHAR_LIMIT);
                        }
                    });

                    clearInterval(searchBadgeInterval);
                    document.getElementById("search-badge")?.remove();

                    // Construction du contexte web injecté dans le prompt
                    webContext = "### DONNÉES WEB EN TEMPS RÉEL (priorité maximale sur ta mémoire d'entraînement) :\n\n";

                    // Réponse directe Serper (answerBox / knowledgeGraph)
                    if (searchData.directAnswer) {
                        webContext += `RÉPONSE DIRECTE : ${searchData.directAnswer}\n\n`;
                    }

                    webSources.forEach((r, i) => {
                        webContext += `[SOURCE ${i + 1}] ${r.title}\nURL : ${r.url}\nExtrait : ${r.snippet}\n`;
                        if (r.fullContent) webContext += `Contenu complet :\n${r.fullContent}\n`;
                        webContext += "\n";
                    });
                    webContext += "---\nCite les sources par leur numéro [SOURCE N] dans ta réponse. Lorsque plusieurs sources confirment un même fait, croise-les explicitement.\n\n";
                }
            }
        } catch (searchErr) {
            console.warn("[Search] Recherche non bloquante échouée :", searchErr.message);
            clearInterval(searchBadgeInterval);
            document.getElementById("search-badge")?.remove();
        }
    }

    // Construction des deux couches séparées
    // memoryContext est maintenant injecté dans le system prompt (poids fort) plutôt que dans le user prompt
    const systemInstruction = buildSystemInstruction(resolvedAgentId, needsSearch, userMessage, memoryContext);
    const userPrompt = buildPrompt(userMessage, files, "", webContext); // memoryContext retiré du user prompt

    const binaryFiles = files
        .filter(f => f.content && f.content.type === "binary")
        .map(f => ({ name: f.name, mime: f.content.mimeType, base64: f.content.data }));

    // Mise à jour du badge agent dans l'UI
    updateAgentBadge(resolvedAgentId);

    // Annule le stream précédent si l'utilisateur envoie un nouveau message
    if (_currentAbortController) _currentAbortController.abort();
    _currentAbortController = new AbortController();

try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";

const response = await fetch("/api/chat", {
    method: "POST",
    headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}` // Injection du token ici
    },
    signal: _currentAbortController.signal,
    body: JSON.stringify({
        prompt: userPrompt,
        systemInstruction: systemInstruction,
        agentId: resolvedAgentId || "default",
        files: binaryFiles.length > 0 ? binaryFiles : undefined
    })
});

if (!response.ok) {
    let errMsg = "Erreur HTTP " + response.status;
    try {
        const errData = await response.json();
        errMsg = errData.error || errMsg;
    } catch(e) {}
    addMessage("bot", "· Erreur : " + errMsg, false);
    setStatus("err");
    return;
}

        removeTyping();

        // Bulle de réponse avec badge agent
        const msgDiv = document.createElement("div");
        msgDiv.className = "msg bot";
        const label = document.createElement("span");
        label.className = "msg-label";

        // On affiche le nom de l'agent actif dans le label
        const agentMeta = resolvedAgentId && AGENTS_CONFIG[resolvedAgentId];
        if (agentMeta) {
            label.innerHTML = `Pensée · ${agentMeta.icon} ${agentMeta.label}`;
        } else {
            label.textContent = "Pensée";
        }

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        msgDiv.appendChild(label);
        msgDiv.appendChild(bubble);
        messagesEl.appendChild(msgDiv);

        // Lecture du flux
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";

        // Timeout visuel : avertissement si aucun token après 12 secondes
        let streamTimeout = setTimeout(() => {
            if (fullReply.trim().length === 0) {
                bubble.innerHTML = formatResponse("· *La génération prend du temps... Si cela persiste, renvoie ton message.*");
            }
        }, 12000);

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullReply += decoder.decode(value, { stream: true });
                bubble.innerHTML = formatResponse(fullReply);
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        } catch (streamErr) {
            if (streamErr.name === 'AbortError') return; // Annulation volontaire, pas d'erreur
            console.warn("Stream interrompu (mise en veille du navigateur) :", streamErr);
            
            // Sauvegarde gracieuse de ce qui a eu le temps d'être généré
            if (fullReply.trim().length === 0) {
                fullReply = "· *La génération a été coupée par la mise en veille de l'écran ou le changement d'onglet.* Veuillez relancer la question.";
            } else {
                fullReply += "\n\n*[Génération interrompue par la mise en veille]*";
            }
        }

        // Nettoyage final
        clearTimeout(streamTimeout);
        fullReply = fullReply.replace(/^\s*\[Pens[ée]{1,2}e?\s*(?:IA)?\s*\]:\s*/i, "");
        const cutIndex = fullReply.search(/\n\[Utilisateur\]:|\n###\s*NOUVEAU MESSAGE/i);
        if (cutIndex > 80) fullReply = fullReply.substring(0, cutIndex);
        fullReply = fullReply.trim();

        // ==========================================
        // INTERCEPTEUR DE COMMANDE TERMINAL
        // ==========================================
        const commandMatch = fullReply.match(/\[TERMINAL_CMD:\s*(.*?)\]/);
        
        if (commandMatch && typeof localSocket !== 'undefined' && localSocket && localSocket.readyState === WebSocket.OPEN) {
            const commandToRun = commandMatch[1].trim(); // Extrait la commande
            
            // Envoi furtif au Daemon via WebSocket
            localSocket.send(JSON.stringify({
                action: 'run_command',
                cmd: commandToRun
            }));

            // Remplacement visuel propre pour l'utilisateur
            fullReply = fullReply.replace(commandMatch[0], `<br><em style="color: var(--accent);"><svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"/></svg>Exécution en cours : <code>${commandToRun}</code>...</em>`);
            
        } else if (commandMatch) {
            // L'IA a tenté d'exécuter, mais le tunnel n'est pas ouvert
            fullReply = fullReply.replace(commandMatch[0], `<br><em style="color: var(--red);">· Exécution échouée : Terminal non connecté.</em>`);
        }
        // ==========================================

        // ==========================================
        // DÉBUT DE L'AJOUT : INTERCEPTEUR PDF
        // ==========================================
        // CORRECTIF : le contenu HTML peut contenir des "]", on utilise un regex
        // qui capture jusqu'au dernier "]" de la ligne (greedy sur le contenu).
        const pdfMarkerRegex = /\[GENERATE_PDF:\s*([^|]+)\|([\s\S]+?)\](?=\s*$|\s*\n|$)/i;
        const pdfMatch = fullReply.match(pdfMarkerRegex);

        if (pdfMatch) {
            const pdfTitle   = pdfMatch[1].trim();
            const pdfContent = pdfMatch[2].trim();

            // Nettoyage du marqueur dans la bulle
            fullReply = fullReply.replace(pdfMatch[0], "").trim();

            // Badge de génération
            const pdfBadge = document.createElement("div");
            pdfBadge.style.cssText = "font-size:11px;color:var(--text2);font-family:'JetBrains Mono',monospace;padding:4px 0 8px;opacity:0.8;";
            pdfBadge.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:5px;"><path d="M4 2h8l4 4v12H4V2z"/><polyline points="12,2 12,6 16,6"/></svg> Génération du PDF...`;
            messagesEl.appendChild(pdfBadge);
            messagesEl.scrollTop = messagesEl.scrollHeight;

            // Appel async — n'interrompt pas le rendu de la bulle
            (async () => {
                try {
                    const { data: { session: pdfSession } } = await supabase.auth.getSession();

                    const pdfRes = await fetch("/api/generate-pdf", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${pdfSession?.access_token || ""}`,
                        },
                        body: JSON.stringify({
                            title: pdfTitle,
                            htmlContent: pdfContent,
                            userId: currentUser?.id || "anon",
                        }),
                    });

                    pdfBadge.remove();

                    if (!pdfRes.ok) {
                        const errData = await pdfRes.json().catch(() => ({}));
                        addMessage("bot", `· PDF échoué : ${errData.error || "Erreur inconnue"}`, false);
                        return;
                    }

                    const pdfData = await pdfRes.json();

                    // Construction du File Chip
                    const label        = escapeHtml(pdfTitle + ".pdf");
                    const svgFile      = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M4 2h8l4 4v12H4V2z"/><polyline points="12,2 12,6 16,6"/><line x1="7" y1="11" x2="13" y2="11"/><line x1="7" y1="14" x2="11" y2="14"/></svg>`;
                    const svgDown      = `<svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-left:6px;"><path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/></svg>`;
                    const chipStyle    = `text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:rgba(0,163,114,0.12);border:1px solid rgba(0,163,114,0.35);border-radius:8px;padding:7px 14px;font-size:12px;color:var(--accent);font-family:'Syne',sans-serif;font-weight:600;transition:background 0.2s,border-color 0.2s;margin-top:10px;`;
                    // Le PDF est toujours un data-URI base64 — aucun stockage externe
                    const fileChipHtml = `<a href="${pdfData.data}" download="${label}" class="file-chip pdf-chip" style="${chipStyle}">${svgFile} ${label} ${svgDown}</a>`;

                    // Injection dans la bulle — texte dans innerHTML, chip en nœud séparé
                    bubble.innerHTML = formatResponse(fullReply);
                    if (typeof hljs !== 'undefined') {
                        bubble.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
                    }
                    const chipNode = document.createElement("div");
                    chipNode.className = "pdf-chip-wrapper";
                    chipNode.innerHTML = fileChipHtml;
                    bubble.appendChild(chipNode);

                } catch (pdfErr) {
                    pdfBadge.remove();
                    console.error("[PDF] Erreur :", pdfErr);
                    addMessage("bot", `· Erreur PDF : ${pdfErr.message}`, false);
                }
            })();
        }
        // ==========================================
        // FIN DE L'AJOUT : INTERCEPTEUR PDF
        // ==========================================

        // ==========================================
        // INTERCEPTEUR GENERATE_FILE (xlsx, pptx, docx, csv)
        // ==========================================
        const fileMarkerRegex = /\[GENERATE_FILE:\s*(xlsx|pptx|docx|csv)\s*\|\s*(\{[\s\S]*\})\]/i;
        const fileMatch = fullReply.match(fileMarkerRegex);

        if (fileMatch) {
            const fileType = fileMatch[1].toLowerCase();
            let fileData;
            try { fileData = JSON.parse(fileMatch[2]); } catch(e) {
    addMessage("bot", "· Erreur : données de fichier invalides.", false);
    fileData = null;  // ← on met fileData à null, pas fileMatch
}

            if (fileData) {
                // Supprimer le marqueur de la bulle
                fullReply = fullReply.replace(fileMatch[0], "").trim();

                // Badge de génération
                const fileBadge = document.createElement("div");
                fileBadge.style.cssText = "font-size:11px;color:var(--text2);font-family:'JetBrains Mono',monospace;padding:4px 0 8px;opacity:0.8;";
                const fileIcons = { xlsx: "📊", pptx: "📑", docx: "📄", csv: "🗃️" };
                fileBadge.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:5px;"><path d="M4 2h8l4 4v12H4V2z"/><polyline points="12,2 12,6 16,6"/></svg> Génération du fichier ${fileType.toUpperCase()}...`;
                messagesEl.appendChild(fileBadge);
                messagesEl.scrollTop = messagesEl.scrollHeight;

(async () => {
                    try {
                        const loadScript = (src) => new Promise((resolve, reject) => {
                            if (document.querySelector(`script[src="${src}"]`)) return resolve();
                            const s = document.createElement('script'); s.src = src;
                            s.onload = resolve; s.onerror = reject;
                            document.head.appendChild(s);
                        });

                        let dataUri;
                        const label = fileData.filename || `fichier.${fileType}`;

                        if (fileType === 'csv') {
                            const lines = [
                                (fileData.headers || []).join(','),
                                ...(fileData.rows || []).map(row =>
                                    row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
                                )
                            ].join('\n');
                            const b64 = btoa(unescape(encodeURIComponent('\uFEFF' + lines)));
                            dataUri = `data:text/csv;base64,${b64}`;

                        } else if (fileType === 'xlsx') {
                            await loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
                            const wb = XLSX.utils.book_new();
                            for (const sheet of (fileData.sheets || [])) {
                                const wsData = [sheet.headers || [], ...(sheet.rows || [])];
                                const ws = XLSX.utils.aoa_to_sheet(wsData);
                                ws['!cols'] = (sheet.headers || []).map((h, ci) => ({
                                    wch: Math.min(Math.max(String(h).length, ...(sheet.rows||[]).map(r => String(r[ci]??'').length)) + 4, 40)
                                }));
                                XLSX.utils.book_append_sheet(wb, ws, sheet.name || `Feuille${wb.SheetNames.length + 1}`);
                            }
                            const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
                            dataUri = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buf}`;

                        } else if (fileType === 'pptx') {
                            await loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js');
                            const prs = new PptxGenJS();
                            for (const slide of (fileData.slides || [])) {
                                const s = prs.addSlide();
                                s.background = { color: 'FFFFFF' };
                                s.addText(slide.title || '', {
                                    x: 0.5, y: 0.3, w: '90%', h: 1.0,
                                    fontSize: 28, bold: true, color: '1A7A5E', fontFace: 'Calibri'
                                });
                                if (slide.content) s.addText(slide.content, {
                                    x: 0.5, y: 1.5, w: '90%', h: '70%',
                                    fontSize: 16, color: '333333', fontFace: 'Calibri', valign: 'top', wrap: true
                                });
                            }
                            const b64 = await prs.write({ outputType: 'base64' });
                            dataUri = `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${b64}`;

                        } else if (fileType === 'docx') {
                            await loadScript('https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.js');
                            const { Document, Paragraph, TextRun, HeadingLevel, Packer } = docx;
                            const headingMap = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };
                            const children = [];
                            for (const section of (fileData.sections || [])) {
                                children.push(
                                    new Paragraph({ text: section.heading || '', heading: headingMap[section.level || 1] || HeadingLevel.HEADING_1 }),
                                    new Paragraph({ children: [new TextRun({ text: section.text || '', size: 24 })], spacing: { after: 200 } })
                                );
                            }
                            const doc = new Document({ sections: [{ children }] });
                            const buf = await Packer.toBase64String(doc);
                            dataUri = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${buf}`;
                        }

                        fileBadge.remove();

                        const svgFile   = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M4 2h8l4 4v12H4V2z"/><polyline points="12,2 12,6 16,6"/></svg>`;
                        const svgDown   = `<svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-left:6px;"><path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/></svg>`;
                        const chipStyle = `text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;background:rgba(0,163,114,0.12);border:1px solid rgba(0,163,114,0.35);border-radius:8px;padding:7px 14px;font-size:12px;color:var(--accent);font-family:'Syne',sans-serif;font-weight:600;transition:background 0.2s;margin-top:10px;`;
                        const chipHtml  = `<a href="${dataUri}" download="${label}" class="file-chip" style="${chipStyle}">${svgFile} ${label} ${svgDown}</a>`;

                        bubble.innerHTML = formatResponse(fullReply);
                        if (typeof hljs !== "undefined") {
                            bubble.querySelectorAll("pre code").forEach(b => hljs.highlightElement(b));
                        }
                        const chipNode = document.createElement("div");
                        chipNode.innerHTML = chipHtml;
                        bubble.appendChild(chipNode);

                    } catch (fileErr) {
                        fileBadge.remove();
                        console.error("[FILE] Erreur :", fileErr);
                        addMessage("bot", `· Erreur fichier : ${fileErr.message}`, false);
                    }
                })();
            }
        }
        // ==========================================
        // FIN INTERCEPTEUR GENERATE_FILE
        // ==========================================

        // Si un PDF ou fichier est en cours de génération, ne pas écraser la bulle
        if (!pdfMatch && !fileMatch) {
            bubble.innerHTML = formatResponse(fullReply);
        }
        // Coloration syntaxique sur les blocs de code rendus
        if (typeof hljs !== 'undefined') {
            bubble.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
        }
        // Bouton copier (Ton code existant)
        const actions = document.createElement("div");
        actions.className = "msg-actions";
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerHTML = SVG_COPY_ICON + "Copier";
        copyBtn.addEventListener("click", async function() {
            try {
                await navigator.clipboard.writeText(bubble.innerText);
                copyBtn.innerHTML = SVG_CHECK_ICON + "Copié !";
                copyBtn.style.color = "var(--accent)";
                setTimeout(() => { copyBtn.innerHTML = SVG_COPY_ICON + "Copier"; copyBtn.style.color = ""; }, 2000);
            } catch(e) { copyBtn.innerHTML = "Erreur"; }
        });
        actions.appendChild(copyBtn);

        // ── BOUTON SYNTHÈSE VOCALE ───────────────────────────────
        if ('speechSynthesis' in window) {
            const ttsBtn = document.createElement("button");
            ttsBtn.className = "copy-btn";
            ttsBtn.innerHTML = SVG_SOUND_ICON + "Écouter";
            ttsBtn.title = "Lire la réponse à voix haute";
            let isSpeaking = false;

            ttsBtn.addEventListener("click", function() {
                if (isSpeaking) {
                    window.speechSynthesis.cancel();
                    ttsBtn.innerHTML = SVG_SOUND_ICON + "Écouter";
                    isSpeaking = false;
                    return;
                }
                const rawText = bubble.innerText
                    .replace(/#{1,6}\s/g, "")
                    .replace(/[*_`~]/g, "")
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                    .replace(/\n{2,}/g, ". ")
                    .trim();

                const utterance = new SpeechSynthesisUtterance(rawText);
                utterance.lang = "fr-FR";
                utterance.rate = 0.95;
                utterance.pitch = 1;

                // Choisir une voix française si disponible
                const voices = window.speechSynthesis.getVoices();
                const frVoice = voices.find(v => v.lang.startsWith("fr"));
                if (frVoice) utterance.voice = frVoice;

                utterance.onend = () => { ttsBtn.innerHTML = SVG_SOUND_ICON + "Écouter"; isSpeaking = false; };
                utterance.onerror = () => { ttsBtn.innerHTML = SVG_SOUND_ICON + "Écouter"; isSpeaking = false; };

                window.speechSynthesis.speak(utterance);
                ttsBtn.innerHTML = "⏹ Arrêter";
                isSpeaking = true;
            });
            actions.appendChild(ttsBtn);
        }
        // ── FIN SYNTHÈSE VOCALE ──────────────────────────────────

        // ==========================================
        // DÉBUT DE L'AJOUT : BOUTON AUDIT
        // ==========================================
        if (resolvedAgentId === 'code' || resolvedAgentId === 'strategie') {
            const auditBtn = document.createElement("button");
            auditBtn.className = "copy-btn"; // On réutilise le style discret du bouton copier
            auditBtn.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5L10 2z"/><polyline points="7,10 9,12 13,8"/></svg>Auditer`;
            auditBtn.title = "Lancer un audit strict sur cette réponse";

            auditBtn.addEventListener("click", async function() {
                if (auditBtn.disabled) return;

                // Verrouillage du bouton
                auditBtn.innerHTML = "⏳ Audit...";
                auditBtn.disabled = true;
                
                // Feedback visuel dans le chat
                addMessage("user", "Lance un audit strict sur ta dernière proposition.", false);
                showTyping();

                // Récupération de la demande originale de l'utilisateur (message avant cette réponse)
                const lastUserMsg = history.length >= 2
                    ? history[history.length - 2]?.content || ""
                    : "";

                // On passe EXPLICITEMENT les deux contextes à l'agent Audit :
                // 1. La demande initiale (pour qu'il sache ce qui était attendu)
                // 2. La proposition générée (ce qu'il doit auditer)
                const auditPrompt = [
                    "### DEMANDE ORIGINALE DE L'UTILISATEUR :",
                    lastUserMsg || "(non disponible)",
                    "",
                    "### PROPOSITION À AUDITER :",
                    fullReply,
                    "",
                    "Audite cette proposition par rapport à la demande originale. Vérifie : bugs, sécurité, logique, performance, cohérence avec la demande. Réponds par [VALIDE] si parfait et prêt pour la production, ou [À CORRIGER] avec un rapport structuré et chirurgical."
                ].join("\n");

                // Bascule temporaire sur l'Agent Audit
                // Feedback visuel temporaire (optionnel mais propre)
                updateAgentBadge("audit");
                
                try {
                    // Appel pur : passage du tempAgentId "audit" sans toucher à l'état global
                    await callAPI(auditPrompt, [], "", "audit");
                } finally {
                    // Restauration purement visuelle
                    updateAgentBadge(activeAgentId || null);
                    auditBtn.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5L10 2z"/><polyline points="7,10 9,12 13,8"/></svg>Auditer`;
                    auditBtn.disabled = false;
                }
            });
            actions.appendChild(auditBtn);
        }
        // ==========================================
        // FIN DE L'AJOUT
        // ==========================================

        msgDiv.appendChild(actions);

        // ── SUGGESTIONS DYNAMIQUES POST-RÉPONSE ──────────────────
        const suggestionMap = {
            code:       ["Explique ligne par ligne", "Optimise les performances", "Génère les tests unitaires"],
            creatif:    ["Développe la scène suivante", "Réécris en style plus dense", "Ajoute un retournement dramatique"],
            strategie:  ["Donne-moi les indicateurs clés", "Quels sont les risques ?", "Plan d'action sur 30 jours"],
            audit:      ["Propose les corrections", "Synthèse exécutive", "Relancer l'audit après correction"],
            recherche:  ["Creuse l'angle opposé", "Sources primaires", "Impact en Afrique de l'Ouest ?"],
            visionnaire:["Effets de troisième ordre ?", "Analogie dans un autre domaine", "L'insight contre-intuitif ?"],
            default:    ["Résume en 3 points", "Approfondis ce point", "Explique différemment"]
        };
        const pills = suggestionMap[resolvedAgentId] || suggestionMap.default;
        const pillsDiv = document.createElement("div");
        pillsDiv.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;padding-left:2px;";
        pills.forEach(text => {
            const pill = document.createElement("button");
            pill.textContent = text;
            pill.style.cssText = "background:var(--bg3);border:1px solid var(--border2);color:var(--text2);border-radius:20px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:'Syne',sans-serif;transition:border-color 0.2s,color 0.2s;white-space:nowrap;";
            pill.addEventListener("mouseenter", () => { pill.style.borderColor = "var(--accent)"; pill.style.color = "var(--accent)"; });
            pill.addEventListener("mouseleave", () => { pill.style.borderColor = "var(--border2)"; pill.style.color = "var(--text2)"; });
            pill.addEventListener("click", () => {
                userInput.value = text.replace(/^\S+\s/, ""); // Retire l'emoji
                userInput.focus();
                pillsDiv.remove();
                toggleSendButton();
            });
            pillsDiv.appendChild(pill);
        });
        msgDiv.appendChild(pillsDiv);
        // ── FIN SUGGESTIONS DYNAMIQUES ────────────────────────────

        // Mise à jour contexte
        history.push({ role: "user", content: userMessage });
        // L'IA ne voit pas le marqueur sources dans le contexte futur
        history.push({ role: "assistant", content: fullReply });

        // Sérialisation des sources dans le contenu sauvegardé en DB
        let contentToSave = fullReply;
        if (webSources && webSources.length > 0) {
            const sourcesJson = JSON.stringify(
                webSources.map(s => ({ title: s.title || '', url: s.url || '', source: s.source || '' }))
            );
            contentToSave += `\n[WEB_SOURCES:${sourcesJson}]`;
        }
        await saveMessageToDB("assistant", contentToSave);

        // ── SOURCES WEB CITÉES ── affichage sous la réponse ──────
        if (webSources && webSources.length > 0) {
            const sourcesDiv = document.createElement("div");
            sourcesDiv.style.cssText = "margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:6px;";
            const label = document.createElement("span");
            label.style.cssText = "font-size:10px;color:var(--text3);font-family:'JetBrains Mono',monospace;width:100%;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.08em;";
            label.textContent = "Sources";
            sourcesDiv.appendChild(label);

            webSources.forEach((src, i) => {
                const chip = document.createElement("a");
                chip.href = src.url;
                chip.target = "_blank";
                chip.rel = "noopener noreferrer";
                chip.style.cssText = "display:inline-flex;align-items:center;gap:5px;background:var(--bg3);border:1px solid var(--border2);border-radius:20px;padding:3px 10px;font-size:11px;color:var(--text2);text-decoration:none;transition:border-color 0.2s,color 0.2s;max-width:240px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;";
                chip.onmouseenter = () => { chip.style.borderColor = "var(--accent)"; chip.style.color = "var(--accent)"; };
                chip.onmouseleave = () => { chip.style.borderColor = "var(--border2)"; chip.style.color = "var(--text2)"; };

                try {
                    const domain = new URL(src.url).hostname.replace('www.', '');
                    chip.innerHTML = `<span style="font-size:10px;opacity:0.6">[${i+1}]</span> ${escapeHtml(domain)}`;
                } catch {
                    chip.innerHTML = `<span style="font-size:10px;opacity:0.6">[${i+1}]</span> Source`;
                }
                chip.title = src.title || src.url;
                sourcesDiv.appendChild(chip);
            });

            msgDiv.appendChild(sourcesDiv);
        }
        // ── FIN SOURCES ──────────────────────────────────────────

        creditsLeft--;
        updateCredits();
        useCreditInDB(); // <-- SYNCHRONISATION SUPABASE AJOUTÉE
        if (creditsLeft > 0) setStatus("ok");

        // Réinitialisation du badge si l'agent était auto-détecté (pas fixé manuellement)
        } catch(error) {
        removeTyping();
        addMessage("bot", "· Erreur réseau : " + error.message, false);
        setStatus("err");
    }
}
// ============================================================
//  GESTION DU BADGE DE STATUT
// ============================================================
function setStatus(state) {
    if (!statusBadge) return; // Sécurité si l'élément HTML n'est pas chargé
    const map = { 
        ok: ["ok", "● connecté"], 
        err: ["err", "● erreur"], 
        warn: ["warn", "● crédits bas"] 
    };
    statusBadge.className = "";
    if (map[state]) { 
        statusBadge.className = map[state][0]; 
        statusBadge.textContent = map[state][1]; 
    }
}

// ============================================================
//  ENVOI
// ============================================================

// ============================================================
//  GÉNÉRATION D'IMAGES
// ============================================================

const IMAGE_TRIGGERS = [
    "/image ", "génère une image", "génère l'image", "génère moi une image",
    "génère moi", "dessine", "crée une image", "crée moi une image",
    "crée moi un", "crée une illustration", "illustre", "visualise",
    "montre moi une image", "fais moi une image", "fais une image",
    "génère un portrait", "génère une photo", "génère un dessin",
    "image de ", "photo de ", "portrait de ", "illustration de ",
    "imagine ", "draw ", "generate an image", "create an image"
];

async function generateImage(prompt) {
    // ── VÉRIFICATION CRÉDIT ───────────────────────────────────
    if (creditsLeft <= 0) {
        addMessage("bot", "· Crédits épuisés. Reviens demain !", false);
        return;
    }
    showTyping();
    try {
        const response = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        removeTyping();

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            addMessage("bot", `· Génération échouée : ${err.error || "Erreur inconnue"}`, false);
            return;
        }

        const data = await response.json();
        const msgDiv = document.createElement("div");
        msgDiv.className = "msg bot";

        const label = document.createElement("span");
        label.className = "msg-label";
        label.textContent = "Pensée · Image générée";
        msgDiv.appendChild(label);

        const bubble = document.createElement("div");
        bubble.className = "bubble";

        const sourceLabel = data.source === "imagen3"
            ? '<span style="font-size:10px;color:var(--text3);font-family:monospace;">Imagen 3 · Google</span>'
            : '<span style="font-size:10px;color:var(--text3);font-family:monospace;">Pollinations AI · Flux</span>';

        if (data.type === "base64") {
            const imgSrc = `data:${data.mimeType};base64,${data.data}`;
            bubble.innerHTML = `${sourceLabel}<br>
                <img src="${imgSrc}" alt="${escapeHtml(prompt)}"
                     style="max-width:100%;border-radius:12px;margin-top:8px;display:block;" loading="lazy">
                <a href="${imgSrc}" download="pensee-ia-${Date.now()}.png"
                   style="font-size:11px;color:var(--accent);margin-top:6px;display:inline-block;text-decoration:none;"><svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/></svg>Télécharger</a>`;
        } else {
            bubble.innerHTML = `${sourceLabel}<br>
                <img src="${data.image || data.layers?.[2]?.url || data.url}" alt="${escapeHtml(prompt)}"
                     style="max-width:100%;border-radius:12px;margin-top:8px;display:block;" loading="lazy"
                     onerror="if(!this.dataset.failed){this.dataset.failed='1';this.style.display='none';const e=document.createElement('em');e.style.color='var(--red)';e.textContent='Timeout. Réessaie.';this.parentElement.appendChild(e);}">
               <a href="${data.image || data.layers?.[2]?.url || data.url}" download target="_blank"
                   style="font-size:11px;color:var(--accent);margin-top:6px;display:inline-block;text-decoration:none;"><svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/></svg>Télécharger</a>`;
        }

        msgDiv.appendChild(bubble);
        messagesEl.appendChild(msgDiv);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        // ── PERSISTANCE IMAGE : Storage Supabase (jamais de base64 en DB) ──
        if (data.type === "base64") {
            try {
                // Conversion base64 → Blob
                const byteChars = atob(data.data);
                const byteArr  = new Uint8Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                const blob = new Blob([byteArr], { type: data.mimeType });

                const ext      = data.mimeType.split("/")[1] || "png";
                const userId   = currentUser ? currentUser.id : "anon";
                const filePath = `images/${userId}/${Date.now()}.${ext}`;

                const { error: upErr } = await supabase.storage
                    .from("attachments")
                    .upload(filePath, blob, { contentType: data.mimeType, upsert: false });

                if (upErr) throw upErr;

                const { data: signed } = await supabase.storage
                    .from("attachments")
                    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 an

                const persistentUrl = signed?.signedUrl || "";
                await saveMessageToDB("assistant", `[IMAGE_URL:${persistentUrl}|${escapeHtml(prompt)}|${filePath}]`);

                // Mise à jour de l'affichage avec l'URL Storage (remplace le src base64 temporaire)
                const imgEl = bubble.querySelector("img");
                if (imgEl && persistentUrl) imgEl.src = persistentUrl;
                const dlEl = bubble.querySelector("a");
                if (dlEl && persistentUrl) { dlEl.href = persistentUrl; dlEl.removeAttribute("download"); dlEl.target = "_blank"; }

            } catch (storageErr) {
                console.warn("Upload Storage échoué, fallback marqueur base64 :", storageErr.message);
                // Fallback minimal : on stocke juste le prompt, l'image restera en mémoire session uniquement
                await saveMessageToDB("assistant", `· *Image générée (non persistée) pour : "${prompt}"*`);
            }
        } else {
            // URL externe (Pollinations) : on stocke l'URL + le path storage vide
            await saveMessageToDB("assistant", `[IMAGE_URL:${data.image || data.layers?.[2]?.url || data.url}|${escapeHtml(prompt)}|]`);
        }

        // ── DÉDUCTION CRÉDIT ──────────────────────────────────
        creditsLeft--;
        updateCredits();
        useCreditInDB();
        if (creditsLeft > 0) setStatus("ok");

    } catch (err) {
        removeTyping();
        addMessage("bot", "· Erreur réseau : " + err.message, false);
    }
}

// ============================================================
//  ENVOI ET GESTION DES MESSAGES
// ============================================================

async function sendMessage() {
    const text  = userInput.value.trim();
    const files = attachedFiles.slice();
    if (!text && !files.length) return;
    if (sendBtn.disabled) return;
    
    // ── COMMANDE /profil ──────────────────────────────────────
    if (text.startsWith("/profil ")) {
        const profilContent = text.replace("/profil ", "").trim();
        if (profilContent) {
            localStorage.setItem('pensee_user_profile', profilContent);
            userInput.value = "";
            userInput.style.height = "auto";
            addMessage("user", text, false);
            addMessage("bot", `<svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px;"><circle cx="10" cy="7" r="4"/><path d="M2 19c0-4 3.6-7 8-7s8 3 8 7"/></svg> **Profil enregistré.** Pensée adaptera désormais chaque réponse à ce contexte :\n\n> ${escapeHtml(profilContent)}\n\nTape \`/profil reset\` pour effacer.`, true);
        }
        return;
    }
    if (text === "/profil reset") {
        localStorage.removeItem('pensee_user_profile');
        userInput.value = "";
        userInput.style.height = "auto";
        addMessage("user", text, false);
        addMessage("bot", "· Profil effacé. Pensée repartira sans contexte utilisateur.", false);
        return;
    }

    if (text.startsWith("/memo ")) {
        const raw = text.replace("/memo ", "").trim();
        const isGlobal = raw.startsWith("global ");
        const memoContent = isGlobal ? raw.replace("global ", "").trim() : raw;

        if (memoContent) {
            userInput.value = "";
            userInput.style.height = "auto";
            addMessage("user", text, false);
            showTyping();
            await memorizeText(memoContent, isGlobal);
            removeTyping();
            const scope = isGlobal
                ? "· **Mémoire GLOBALE sauvegardée.** Accessible dans toutes tes conversations."
                : "· **Mémoire locale sauvegardée.** Disponible dans cette conversation.";
            addMessage("bot", scope, true);
        }
        return;
    }
    if (handleAgentCommand(text)) return;

    // Détection génération d'image
    const lowerText = text.toLowerCase();
    const imageIntent = IMAGE_TRIGGERS.find(t => lowerText.startsWith(t) || lowerText.includes(t));
    if (imageIntent) {
        const imagePrompt = text
    .replace(/^\/(image)\s*/i, "")
    .replace(/^(génère|crée|fais|dessine|illustre|visualise|montre|imagine)\s+(moi\s+)?(une?\s+)?(image|photo|portrait|illustration|dessin)\s+(de\s+)?/i, "")
    .replace(/^(image|photo|portrait|illustration)\s+d[e']\s+/i, "")
    .trim() || text;
        addMessage("user", text, false);
        userInput.value = "";
        userInput.style.height = "auto";
        toggleSendButton();
        await saveMessageToDB("user", text);
        await generateImage(imagePrompt);
        return;
    }

    const sug = document.getElementById("suggestions");
    if (sug) sug.style.display = "none";

    const messageText = text || "Analyse ce fichier et explique ce qu'il fait.";
    let dbMessageText = messageText;

    // ==========================================
    // 1. VERROUILLAGE IMMÉDIAT DE L'INTERFACE
    // ==========================================
    
    // A. Affichage visuel dans le chat
    if (files.length > 0) addUserMessageWithFiles(text, files);
    else addMessage("user", text, false);

    // B. Mise à jour onglet
    if (text && activeTabId) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab && tab.title === 'Nouvelle conv.') updateTabTitle(activeTabId, text);
    }

    // C. Nettoyage mémoire (Empêche l'envoi en boucle des mêmes fichiers)
    userInput.value        = "";
    userInput.style.height = "auto";
    attachedFiles          = [];
    renderUploadPreview();
    fileInput.value = "";
    toggleSendButton();

    // D. Animation Bouton + Indicateur de frappe
    sendBtn.disabled   = true;
    sendBtn.innerHTML  = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;fill:var(--bg);animation:spin 1s linear infinite"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity=".3"/><path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8z"/></svg>';
    showTyping(); 

    // ==========================================
    // 2. BACKGROUND : UPLOAD & BASE DE DONNÉES
    // ==========================================
    
    if (files.length > 0) {
        const uploadedLinks = [];
        for (const f of files) {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const userId = user ? user.id : 'anonyme';
                
                // Nettoyage du nom pour éviter les bugs d'URL (espaces, accents)
                const safeName = f.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `uploads/${userId}/${Date.now()}_${safeName}`;
                
                let fileBlob;
                if (f.content.type === 'binary') {
                    const byteChars = atob(f.content.data);
                    const byteArr = new Uint8Array(byteChars.length);
                    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
                    fileBlob = new Blob([byteArr], { type: f.content.mimeType });
                } else {
                    fileBlob = new Blob([f.content.data], { type: 'text/plain' });
                }
                
                const { error } = await supabase.storage.from('attachments').upload(filePath, fileBlob);
                
                if (error) {
                    addMessage("bot", `· **Erreur upload (${f.name})** : ${error.message}`, false);
                    throw error;
                }
                
                uploadedLinks.push(`[SECURE_FILE:${f.name}](${filePath})`);
            } catch (err) {
                console.error("Échec upload storage :", err);
            }
        }
        if (uploadedLinks.length > 0) {
            dbMessageText = `**Fichiers joints :** ${uploadedLinks.join(" | ")}\n\n${messageText}`;
        }
    }

    // Sauvegarde en DB
    await saveMessageToDB("user", dbMessageText);

    // ==========================================
    // 3. RECHERCHE RAG & APPEL API
    // ==========================================
    
    let memoryContext = "";
    try {
        const memories = await searchMemory(messageText);
        if (memories && memories.length > 0) {
            memoryContext = memories.map(m => m.content).join("\n\n");
        }
    } catch (memErr) {
        console.warn("Recherche mémoire échouée (non bloquant) :", memErr);
    }

    await new Promise(r => setTimeout(r, 0));
    try {
        // L'API est appelée avec les binaires LOCAUX pour aller plus vite, 
        // et Supabase a stocké les liens permanents en BDD.
        await callAPI(messageText, files, memoryContext);
    } finally {
        // Restauration de l'interface garantie à 100%
        removeTyping();
        sendBtn.disabled  = false;
        sendBtn.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
        userInput.focus();
    }
}

// ============================================================
//  DICTÉE VOCALE & UI DYNAMIQUE
// ============================================================

function toggleSendButton() {
    if (sendBtn.disabled) return; // Priorité au blocage des crédits
    const hasContent = userInput.value.trim().length > 0 || attachedFiles.length > 0;
    if (hasContent) {
        sendBtn.classList.remove("hidden-action");
    } else {
        sendBtn.classList.add("hidden-action");
    }
}

const micBtn = document.getElementById("micBtn");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;     // Maintient le micro ouvert même pendant les silences
    recognition.interimResults = true; // Permet de voir le texte s'écrire en direct
    recognition.lang = 'fr-FR';

    let isRecording = false;
    let initialText = "";

    micBtn.addEventListener("click", () => {
        if (isRecording) {
            recognition.stop();
        } else {
            initialText = userInput.value.trim() ? userInput.value.trim() + " " : "";
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isRecording = true;
        micBtn.classList.add("recording");
        userInput.placeholder = "Écoute en cours...";
    };

    recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        userInput.value = initialText + transcript;
        userInput.style.height = "auto";
        userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
        toggleSendButton();
    };

    recognition.onerror = (event) => {
        console.error("Erreur micro:", event.error);
        recognition.stop();
    };

    recognition.onend = () => {
        isRecording = false;
        micBtn.classList.remove("recording");
        userInput.placeholder = "Discuter avec Pensée…";
        toggleSendButton();
    };
} else if (micBtn) {
    micBtn.style.display = "none"; // Masque le bouton si le navigateur ne supporte pas l'API
}

// ============================================================
//  ÉVÉNEMENTS GLOBAUX
// ============================================================

document.addEventListener("click", function(e) {
    const badge = document.getElementById("agentBadge");
    const menu = document.getElementById("agentSelector");
    if (menu && menu.classList.contains("visible")) {
        if (!badge.contains(e.target) && !menu.contains(e.target)) {
            menu.classList.remove("visible");
        }
    }
});

window.useSuggestion = function(el) { userInput.value = el.textContent; userInput.focus(); };
uploadBtn.addEventListener("click", function() { fileInput.click(); });
fileInput.addEventListener("change", function() { if (fileInput.files.length) addFiles(fileInput.files); });

document.addEventListener("dragover",  function(e) { e.preventDefault(); dropOverlay.classList.add("visible"); });
document.addEventListener("dragleave", function(e) { if (!e.relatedTarget) dropOverlay.classList.remove("visible"); });
document.addEventListener("drop", function(e) {
    e.preventDefault();
    dropOverlay.classList.remove("visible");
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});

// Écouteurs de la zone de saisie
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
userInput.addEventListener("input", function() {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 120) + "px";
    toggleSendButton();
});
// Écouteur délégué sécurisé pour l'exécution du code
document.getElementById("messages").addEventListener("click", function(e) {
    if (e.target && e.target.classList.contains("run-btn")) {
        const btn = e.target;
        executeWebCode(btn, btn.getAttribute("data-runid"), btn.getAttribute("data-lang"));
    }
});
// ============================================================
//  INIT GLOBALE
// ============================================================
updateCredits();
setStatus("ok");
checkLocalAuth();
initAgentSelector();
// ============================================================
//  MOTEUR SANDBOX (Exécution Web + Python WASM + Téléchargement auto)
// ============================================================

// ── Cache Pyodide — une seule instance par session ───────────
let _pyodideInstance = null;
let _pyodideLoading  = false;

async function _getPyodide() {
    if (_pyodideInstance) return _pyodideInstance;
    if (_pyodideLoading) {
        while (_pyodideLoading) await new Promise(r => setTimeout(r, 80));
        return _pyodideInstance;
    }
    _pyodideLoading = true;
    try {
        _pyodideInstance = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/"
        });
        await _pyodideInstance.loadPackage("micropip");
    } finally {
        _pyodideLoading = false;
    }
    return _pyodideInstance;
}

// ── Mapping imports Python → noms pip ───────────────────────
const _PIP_MAP = {
    cv2: 'opencv-python', PIL: 'Pillow', sklearn: 'scikit-learn',
    bs4: 'beautifulsoup4', dateutil: 'python-dateutil',
    docx: 'python-docx', pptx: 'python-pptx',
    yaml: 'pyyaml', dotenv: 'python-dotenv',
    reportlab: 'reportlab', fpdf: 'fpdf2',
    openpyxl: 'openpyxl', xlsxwriter: 'XlsxWriter'
};
const _STDLIB = new Set([
    'os','sys','math','json','re','datetime','collections','itertools',
    'functools','random','time','pathlib','io','abc','copy','typing',
    'dataclasses','enum','string','struct','base64','hashlib','zipfile',
    'csv','html','xml','traceback','threading','urllib','http','socket',
    'builtins','inspect','logging','warnings','textwrap','shutil','glob',
    'calendar','fractions','decimal','statistics','unicodedata','codecs'
]);

// ── MIME types pour les téléchargements ─────────────────────
const _MIME_MAP = {
    png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
    gif:'image/gif', webp:'image/webp', svg:'image/svg+xml',
    pdf:'application/pdf', csv:'text/csv', txt:'text/plain',
    json:'application/json', xml:'application/xml',
    xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls:'application/vnd.ms-excel',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip:'application/zip', tar:'application/x-tar', gz:'application/gzip',
    wav:'audio/wav', mp3:'audio/mpeg', ogg:'audio/ogg',
    mp4:'video/mp4', webm:'video/webm',
    html:'text/html', md:'text/markdown'
};

// ── Déclencheur de téléchargement ───────────────────────────
function _triggerDownload(b64, filename, mime) {
    const a = document.createElement('a');
    a.href = `data:${mime};base64,${b64}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ── Moteur d'exécution Python WASM ──────────────────────────
async function _executePython(btn, container, rawCode) {
    const uid = container.id;

    btn.innerHTML = '⏳ Initialisation Python…';
    btn.disabled  = true;
    container.style.display = 'block';
    container.innerHTML = `
        <div id="pyshell-${uid}" style="
            font-family:'JetBrains Mono',monospace;
            background:var(--code-bg,#060810);
            color:var(--text,#dde2ee);
            padding:16px;border-radius:10px;font-size:13px;
            border:1px solid var(--border,rgba(255,255,255,0.06));">
            <div style="color:var(--accent,#00e5a0);font-size:10px;
                        text-transform:uppercase;margin-bottom:10px;letter-spacing:.1em;">
                Python · WASM · Sécurisé
            </div>
            <pre id="pyout-${uid}" style="white-space:pre-wrap;word-break:break-all;margin:0;min-height:16px;"></pre>
            <div id="pyfiles-${uid}" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>`;

    const outEl   = document.getElementById(`pyout-${uid}`);
    const filesEl = document.getElementById(`pyfiles-${uid}`);

    const appendOut = (txt, color) => {
        if (!txt || !document.body.contains(outEl)) return;
        const span = document.createElement('span');
        if (color) span.style.color = color;
        span.textContent = txt.endsWith('\n') ? txt : txt + '\n';
        outEl.appendChild(span);
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    const addFileBtn = (name, b64data) => {
        const ext  = name.split('.').pop().toLowerCase();
        const mime = _MIME_MAP[ext] || 'application/octet-stream';

        if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) {
            const img = document.createElement('img');
            img.src = `data:${mime};base64,${b64data}`;
            img.style.cssText = 'max-width:100%;border-radius:8px;margin:12px 0 4px;display:block;';
            document.getElementById(`pyshell-${uid}`).insertBefore(img, filesEl);
        }

        const dlBtn = document.createElement('button');
        dlBtn.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:5px;"><path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/></svg>${name}`;
        dlBtn.style.cssText = `
            background:rgba(0,229,160,0.10);color:var(--accent,#00e5a0);
            border:1px solid rgba(0,229,160,0.35);border-radius:8px;
            padding:7px 14px;font-size:12px;cursor:pointer;
            font-family:'JetBrains Mono',monospace;font-weight:500;
            transition:background 0.2s,border-color 0.2s;`;
        dlBtn.onmouseover = () => dlBtn.style.background = 'rgba(0,229,160,0.20)';
        dlBtn.onmouseout  = () => dlBtn.style.background = 'rgba(0,229,160,0.10)';
        dlBtn.onclick = () => _triggerDownload(b64data, name, mime);
        filesEl.appendChild(dlBtn);
    };

    try {
        const pyodide = await _getPyodide();
        btn.innerHTML = '⏳ Exécution…';

        const importMatches = [...rawCode.matchAll(/^\s*(?:import|from)\s+([\w]+)/gm)];
        const toLoad = [...new Set(
            importMatches.map(m => m[1]).filter(m => !_STDLIB.has(m) && m !== '__future__')
        )];

        if (rawCode.includes('openpyxl') && !toLoad.includes('openpyxl')) {
            toLoad.push('openpyxl');
        }

        if (toLoad.length > 0) {
            appendOut(`📦 Chargement : ${toLoad.join(', ')}…`);
            for (const mod of toLoad) {
                const pipName = _PIP_MAP[mod] || mod;
                try {
                    await pyodide.loadPackage(pipName);
                } catch {
                    try {
                        const micropip = pyodide.pyimport("micropip");
                        await micropip.install(pipName);
                        appendOut(`✓ ${mod} installé.`);
                    } catch {
                        appendOut(`⚠️ "${mod}" non disponible en WASM.`, '#f0c040');
                    }
                }
            }
        }

        // ── 1. INITIALISATION DU CONTEXTE ────────────────────────
        await pyodide.runPythonAsync(`
import sys, io, base64, builtins as _bi

__pensee_files__ = []
_pensee_buf = []

class _PWriter:
    def write(self, s):
        if s and s.strip(): _pensee_buf.append(('out', s))
    def flush(self): pass
sys.stdout = _PWriter()
sys.stderr = _PWriter()

if not getattr(_bi, '_pensee_patched', False):
    _real_open = _bi.open
    def _pensee_open(path, mode='r', *args, **kwargs):
        if isinstance(mode, str) and 'w' in mode and ('b' in mode or mode in ('w','wb','xb')):
            buf = io.BytesIO()
            buf._pensee_path = str(path)
            buf._pensee_mode = mode
            return buf
        return _real_open(path, mode, *args, **kwargs)
    _bi.open = _pensee_open

    _orig_bclose = io.BytesIO.close
    def _patched_close(self):
        if hasattr(self, '_pensee_path') and not self.closed:
            try:
                self.seek(0)
                raw = self.read()
                if raw:
                    b64 = base64.b64encode(raw).decode()
                    __pensee_files__.append({'name': self._pensee_path, 'data': b64})
            except Exception: pass
        _orig_bclose(self)
    io.BytesIO.close = _patched_close
    _bi._pensee_patched = True
`);

        let code = rawCode;
        if (code.includes('matplotlib') || code.includes('plt.')) {
            try { await pyodide.loadPackage('matplotlib'); } catch {}
            code = code.replace(/plt\.show\s*\(\s*\)/g, `
_fig_io = __import__('io').BytesIO()
_fig_io._pensee_path = 'graphique_pensee.png'
import matplotlib.pyplot as _plt_capture
_plt_capture.savefig(_fig_io, format='png', bbox_inches='tight', dpi=120)
_fig_io.seek(0)
__pensee_files__.append({'name':'graphique_pensee.png','data':__import__('base64').b64encode(_fig_io.read()).decode()})
_plt_capture.close()
`);
        }

        // ── 2. EXÉCUTION DU CODE UTILISATEUR ────────────────────────
       pyodide.globals.set("_pensee_user_code", code);
        await pyodide.runPythonAsync(`
_pensee_buf.clear()
try:
    exec(_pensee_user_code, globals())
except Exception as _err:
    import traceback as _tb
    _pensee_buf.append(('err', _tb.format_exc()))
`);

        const buf = pyodide.globals.get("_pensee_buf").toJs();
        if (buf.length === 0 && document.getElementById(`pyfiles-${uid}`).children.length === 0) {
            appendOut('✓ Exécution terminée.', 'var(--accent,#00e5a0)');
        }
        for (const item of buf) {
            const type = item.get ? item.get(0) : item[0];
            const text = item.get ? item.get(1) : item[1];
            appendOut(text, type === 'err' ? 'var(--red,#ff5f5f)' : null);
        }

        const files = pyodide.runPython("__pensee_files__").toJs();
        let fileCount = 0;
        for (const f of files) {
            const name = f.get ? f.get('name') : f.name;
            const data = f.get ? f.get('data') : f.data;
            if (!name || !data) continue;
            addFileBtn(name, data);
            fileCount++;
        }
        if (fileCount > 0) {
            appendOut(`\n✓ ${fileCount} fichier(s) prêt(s) au téléchargement.`, 'var(--accent,#00e5a0)');
        }

        btn.innerHTML = '⏹ Fermer';
        btn.disabled  = false;
        btn.classList.add('running');

    } catch(e) {
        const msg = e?.message || e?.toString() || 'Erreur inconnue — voir F12 > Console';
        appendOut('❌ Erreur critique : ' + msg, 'var(--red,#ff5f5f)');
        console.error('[PENSÉE · Python WASM]', e);
        btn.innerHTML = '▶ Réessayer';
        btn.disabled  = false;
    }
}

// ── Dispatcher principal ─────────────────────────────────────
window.executeWebCode = function(btn, containerId, lang) {
    const container = document.getElementById(containerId);
    const rawCode   = decodeURIComponent(btn.getAttribute('data-code'));

    // Fermeture universelle (tous langages)
    if (btn.classList.contains('running')) {
        container.innerHTML = '';
        container.style.display = 'none';
        btn.classList.remove('running');
        btn.innerHTML = '▶ Exécuter';
        return;
    }

    // ── Route Python → serveur (fichiers) ou WASM (calculs simples) ──
    if (lang === 'py' || lang === 'python') {
        if (_isFileGeneratingCode(rawCode)) {
            _executePythonServer(btn, container, rawCode);
        } else {
            _executePython(btn, container, rawCode);
        }
        return;
    }

    // ── Route JS/HTML → iframe sandbox (comportement inchangé) ──
    container.innerHTML = '';
    container.style.display = 'block';
    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts allow-modals';
    container.appendChild(iframe);

    let finalCode = rawCode;

    if (lang === 'js' || lang === 'javascript') {
        finalCode = `
        <!DOCTYPE html><html>
        <head>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
        </head>
        <body style="font-family: monospace; background: #f4f4f5; color: #333; padding: 16px; margin: 0;">
            <div style="color: #888; font-size: 10px; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.1em;">Console :</div>
            <pre id="output" style="white-space: pre-wrap; word-break: break-all; margin: 0; font-size: 13px;"></pre>
            <script>
                const out = document.getElementById('output');
                console.log = function(...args) {
                    out.textContent += args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ') + '\\n';
                };
                try {
                    ${rawCode}
                } catch (e) {
                    out.style.color = '#e11d48';
                    out.textContent += '\\nErreur critique : ' + e.message;
                }
            <\/script>
        </body></html>`;
    }

    iframe.srcdoc = finalCode;
    btn.classList.add('running');
    btn.innerHTML = '⏹ Fermer';
};

// ============================================================
//  MOTEUR PYTHON SERVEUR — via /api/run-python (Piston)
// ============================================================

// Détecte si le code Python génère un fichier (xlsx, pdf, csv, docx, zip, png...)
function _isFileGeneratingCode(code) {
    return /\.(xlsx|csv|pdf|docx|pptx|zip|png|jpg|json|txt)['"]\s*\)/.test(code)
        || /workbook\.save|\.to_excel|\.to_csv|canvas\.save|doc\.save|zipfile/.test(code);
}

async function _executePythonServer(btn, container, rawCode) {
    const uid = container.id;

    btn.innerHTML = '⏳ Génération…';
    btn.disabled  = true;
    container.style.display = 'block';
    container.innerHTML = `
        <div id="pyshell-${uid}" style="
            font-family:'JetBrains Mono',monospace;
            background:var(--code-bg,#060810);
            color:var(--text,#dde2ee);
            padding:16px;border-radius:10px;font-size:13px;
            border:1px solid var(--border,rgba(255,255,255,0.06));">
            <div style="color:var(--accent,#00e5a0);font-size:10px;
                        text-transform:uppercase;margin-bottom:10px;letter-spacing:.1em;">
                Python · Serveur · Sécurisé
            </div>
            <pre id="pyout-${uid}" style="white-space:pre-wrap;word-break:break-all;margin:0;min-height:16px;"></pre>
            <div id="pyfiles-${uid}" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;"></div>
        </div>`;

    const outEl   = document.getElementById(`pyout-${uid}`);
    const filesEl = document.getElementById(`pyfiles-${uid}`);

    const appendOut = (txt, color) => {
        const span = document.createElement('span');
        if (color) span.style.color = color;
        span.textContent = (txt.endsWith('\n') ? txt : txt + '\n');
        outEl.appendChild(span);
    };

    try {
        const res = await fetch('/api/run-python', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: rawCode })
        });

        const data = await res.json();

        if (!res.ok) {
            appendOut('❌ ' + (data.error || 'Erreur serveur'), 'var(--red,#ff5f5f)');
        } else {
            // Afficher les logs stdout
            if (data.output) appendOut(data.output);

            // Afficher l'erreur Python si présente
            if (data.error) appendOut(data.error, 'var(--red,#ff5f5f)');

            // Afficher les fichiers générés
            if (data.files && data.files.length > 0) {
                for (const f of data.files) {
                    const ext  = f.name.split('.').pop().toLowerCase();
                    const mime = _MIME_MAP[ext] || 'application/octet-stream';

                    // Prévisualisation image
                    if (['png','jpg','jpeg','gif','webp'].includes(ext)) {
                        const img = document.createElement('img');
                        img.src = `data:${mime};base64,${f.data}`;
                        img.style.cssText = 'max-width:100%;border-radius:8px;margin:12px 0 4px;display:block;';
                        document.getElementById(`pyshell-${uid}`).insertBefore(img, filesEl);
                    }

                    // Bouton téléchargement style Claude
                    const dlBtn = document.createElement('button');
                    dlBtn.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:5px;"><path d="M10 3v10M5 9l5 5 5-5"/><path d="M3 17h14"/></svg>${f.name}`;
                    dlBtn.style.cssText = `
                        background:rgba(0,229,160,0.10);color:var(--accent,#00e5a0);
                        border:1px solid rgba(0,229,160,0.35);border-radius:8px;
                        padding:7px 14px;font-size:12px;cursor:pointer;
                        font-family:'JetBrains Mono',monospace;font-weight:500;
                        transition:background 0.2s;`;
                    dlBtn.onmouseover = () => dlBtn.style.background = 'rgba(0,229,160,0.20)';
                    dlBtn.onmouseout  = () => dlBtn.style.background = 'rgba(0,229,160,0.10)';
                    dlBtn.onclick = () => _triggerDownload(f.data, f.name, mime);
                    filesEl.appendChild(dlBtn);
                }
                appendOut(`\n✓ ${data.files.length} fichier(s) prêt(s) au téléchargement.`, 'var(--accent,#00e5a0)');
            } else if (!data.error && !data.output) {
                appendOut('✓ Exécution terminée.', 'var(--accent,#00e5a0)');
            }
        }

    } catch (err) {
        appendOut('❌ Erreur réseau : ' + (err.message || err), 'var(--red,#ff5f5f)');
    }

    btn.innerHTML = '⏹ Fermer';
    btn.disabled  = false;
    btn.classList.add('running');
}

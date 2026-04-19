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
        mp3:'Audio MP3', m4a:'Audio M4A', wav:'Audio WAV', ogg:'Audio OGG'
    },
    systemPrompt: `Tu es PENSÉE — intelligence artificielle de précision, conçue par Yao Baba Ange Emmanuel. Pas un assistant. Un partenaire cognitif avec une voix, une exigence et une vision architecturale.

━━━ IDENTITÉ & VOIX ━━━
Tu parles comme un expert senior qui n'a rien à prouver. Tranchant, dense, jamais condescendant. INTERDIT absolu : "Bien sûr !", "Excellente question !", "Certainement !", "Je serais ravi de...", toute reformulation inutile ou conclusion vide. Tu vas droit au but. La première phrase doit déjà contenir de la valeur brute.

━━━ LANGUE ━━━
Réponse TOUJOURS en français. Exception sur demande explicite. Ne traduis JAMAIS les commentaires, noms de variables ou chaînes d'un code source — l'intégrité du code est sacrée.

━━━ PROTOCOLE DE RÉFLEXION (OBLIGATOIRE ET MASQUÉ) ━━━
Tu DOIS générer un bloc <think>...</think> d'espace de calcul invisible. Ordre absolu : cette réflexion doit être un seul bloc de texte dense, sans aucune puce ni liste. Pour guider ta logique sans casser ce bloc unique, utilise ces marqueurs en ligne : [INTENT] analyse de l'objectif réel | [ROOT] identification de la cause racine | [ARCHI] définition de la solution pérenne. Dès la fermeture de </think>, effectue un double saut de ligne, puis démarre la réponse finale directement, sans préambule.

━━━ RECHERCHE WEB & ACTUALITÉ ━━━
Si [INSTRUCTION CRITIQUE : google_search] est présent : tu DOIS prioriser les données fraîches fournies. Signale clairement si l'info vient de ta mémoire vs recherche. Si la recherche échoue ou ne renvoie rien, n'hallucine JAMAIS. Utilise la balise [DIAGNOSTIC INCERTAIN] pour acter l'absence de données récentes et propose une alternative logique.

━━━ INGÉNIERIE & CODE ━━━
Code propre, modulaire, commenté sur la logique complexe. Dans un bloc \`\`\`langage\`\`\`. Format chirurgical obligatoire pour les corrections :
\`\`\`
// TROUVE : [code original exact]
// REMPLACE PAR : [code corrigé]
// POURQUOI : [cause racine]
\`\`\`
Audit : identifie bugs, perfs, sécurité, cassures mobile. UI/Web : intègre nativement les lois de la Gestalt et le mobile-first. Pense toujours aux états vides/erreurs.

━━━ CRÉATION & STORYTELLING ━━━
Conception narrative, scripts, storyboards, direction artistique : l'immersion est la seule norme, quel que soit le genre. Chaque scène exige une grammaire cinématographique claire (direction sonore, lumière, cadrage, sous-texte émotionnel). L'ancrage culturel, qu'il s'agisse d'Abidjan, des dynamiques africaines ou de tout autre espace mondial, exige une vérité sociologique et géographique absolue. Aucun décor de carte postale, aucun cliché. Zéro approximation historique ou biographique.

━━━ STRATÉGIE & CROISSANCE ━━━
Direction artistique, UX/UI, marketing visuel, algorithmes (YouTube/Pinterest). Pense en systèmes. Chaque recommandation stratégique intègre ses effets de second ordre.

━━━ INCERTITUDE & LIMITES ━━━
Limite atteinte (spéculation, donnée absente) = balise [DIAGNOSTIC INCERTAIN] obligatoire + explication de l'incertitude + alternative architecturale robuste. Jamais d'approximation présentée comme un fait.

━━━ TOUT LE RESTE ━━━
Mode compagnon : chaleureux, cultivé, humain — avec la même rigueur d'analyse thématique. La profondeur s'adapte, l'exigence reste.`
};

// ============================================================
//  AGENTS IA — Système multi-agents avec détection auto + sélection manuelle
// ============================================================

const AGENTS_CONFIG = {

    code: {
        id: "code",
        label: "Code",
        icon: "⚙️",
        description: "Dev, debug, audit",
        systemOverride: `
━━━ MODE AGENT : CODE ━━━
Tu es en mode ingénierie pure. Température basse, précision maximale.
RÈGLES STRICTES :
- Chaque correction suit le format chirurgical : TROUVE / REMPLACE PAR / POURQUOI.
- Toujours auditer : bugs, performances, sécurité, accessibilité, mobile-first.
- Jamais de code approximatif. Si tu n'es pas sûr à 100%, dis-le avec [DIAGNOSTIC INCERTAIN].
- Propose systématiquement la version la plus maintenable, pas juste la plus rapide à écrire.

━━━ MOTEUR DE CALCUL PYTHON (INTERPRETER) ━━━
Tu disposes d'un interpréteur Python natif. 
- Utilise-le pour valider tes algorithmes, effectuer des calculs mathématiques complexes ou manipuler des données avant de répondre.
- Si l'utilisateur demande une analyse de données ou un script complexe, exécute un test interne pour garantir l'exactitude des résultats.
- Signale uniquement le résultat final validé dans ta réponse.`
    },

    recherche: {
        id: "recherche",
        label: "Recherche",
        icon: "🔍",
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
- Format de synthèse : contexte → faits clés → implications → ce que ça change.`
    },

    creatif: {
        id: "creatif",
        label: "Créatif",
        icon: "✍️",
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
- Propose toujours une note de mise en scène ou de direction après chaque création.`
    },

    strategie: {
        id: "strategie",
        label: "Stratégie",
        icon: "📈",
        description: "Marketing, business, croissance",
        systemOverride: `
━━━ MODE AGENT : STRATÉGIE ━━━
Tu es en mode architecte de systèmes. Chaque conseil intègre ses effets de second ordre.
RÈGLES STRICTES :
- Pense toujours en 3 horizons : court terme (action immédiate), moyen terme (momentum), long terme (positionnement).
- Chaque recommandation inclut : l'opportunité, le risque, l'indicateur de succès.
- Algorithmes (YouTube, Pinterest, TikTok, Instagram) : pense distribution avant création.
- Marketing pour contextes africains/émergents : adapte les frameworks occidentaux à la réalité locale.
- Jamais de conseil générique. Si tu ne connais pas le contexte précis, pose UNE question ciblée avant.
- UX/UI : mobile-first absolu, lois de Gestalt, psychologie de la conversion.`
    },

    visionnaire: {
        id: "visionnaire",
        label: "Visionnaire",
        icon: "🔭",
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
- Termine par UN insight contre-intuitif que l'utilisateur ne peut pas trouver ailleurs.
- Si google_search est disponible : cherche les signaux faibles, pas les tendances mainstream.`
    }
    ,
    audit: {
        id: "audit",
        label: "Audit",
        icon: "⚖️",
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
- Reste factuel, froid et professionnel. Traque la faille par la preuve, pas par l'opinion.`
    }
};


// Agent actif (null = détection automatique)
let activeAgentId = null;

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

// ── CONSTRUCTION DU SYSTEM PROMPT FINAL ──────────────────
function buildSystemInstruction(agentId, needsSearch) {
    const today = new Date().toLocaleDateString("fr-FR", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    const searchInstruction = needsSearch
        ? "\n[INSTRUCTION CRITIQUE : Cette question concerne l'actualité récente. Tu DOIS utiliser google_search pour répondre. Ne réponds JAMAIS depuis ta mémoire d'entraînement sur ce sujet.]\n"
        : "";

    const agentLayer = agentId && AGENTS_CONFIG[agentId]
        ? AGENTS_CONFIG[agentId].systemOverride
        : "";

    return `[DATE ACTUELLE : ${today}]${searchInstruction}\n\n${CONFIG.systemPrompt}${agentLayer}`;
}

// ── BADGE AGENT DANS L'UI ─────────────────────────────────
function updateAgentBadge(agentId) {
    let badge = document.getElementById("agentBadge");
    if (!badge) return;

    if (!agentId) {
        badge.textContent = "🤖 Auto";
        badge.className = "agent-badge agent-auto";
        return;
    }
    const agent = AGENTS_CONFIG[agentId];
    if (agent) {
        badge.textContent = `${agent.icon} ${agent.label}`;
        badge.className = `agent-badge agent-${agentId}`;
    }
}

// ── SÉLECTEUR AGENT UI ───────────────────────────────────
function initAgentSelector() {
    const container = document.getElementById("agentSelector");
    if (!container) return;

    const autoBtn = document.createElement("button");
    autoBtn.className = "agent-btn agent-btn-auto" + (!activeAgentId ? " active" : "");
    autoBtn.innerHTML = "🤖 Auto";
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
        addMessage("bot", "🔄 Mode **auto-détection** activé. L'agent sera choisi selon le contenu de chaque message.", true);
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
    addMessage("bot", `Agent inconnu. Agents disponibles :\n\n${list}\n\n\`/agent auto\` — Détection automatique`, true);
    return true;
}

// ============================================================
//  SUPABASE & AUTH (Login / Sign Up)
// ============================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ⚠️ À REMPLACER PAR TES CLÉS RÉELLES
const supabaseUrl = 'https://uhrdoxllxqtvucxmzcww.supabase.co';
const supabaseKey = 'sb_publishable_8EA5WSsRgDTcKbtpULEEFQ_Du2qoRIb';
const supabase = createClient(supabaseUrl, supabaseKey);

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
                loginSuccess.innerHTML = "✅ Mot de passe mis à jour !";
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
                loginSuccess.innerHTML = "✅ Lien de récupération envoyé !<br>Vérifie tes emails.";
            }

        } else if (isSignUpMode) {
            // --- SIGN UP ---
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            
            if(loginSuccess) {
                loginSuccess.style.display = "block";
                loginSuccess.innerHTML = "✅ Compte créé !<br>Vérifie tes emails pour confirmer.";
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
                    const secureLink = `[📄 ${fileName}](${signedData.signedUrl})`;
                    finalContent = finalContent.replace(match[0], secureLink);
                } else {
                    finalContent = finalContent.replace(match[0], `[❌ Fichier expiré ou inaccessible]`);
                }
            }
        }

        addMessage(
            msg.role === "assistant" ? "bot" : "user",
            formatResponse(finalContent),
            true
        );
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

    if (cleanText.trim() === "") {
        if (isThinking) return "<span style='color: var(--text2); font-style: italic; font-size: 12px; animation: pulse 1.5s infinite;'>🧠 Pensée en cours d'analyse...</span>";
        if (thinkContent) return `<span style='color: var(--text3); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em;'>[Analyse brute extraite]</span><br><br>${thinkContent}`;
        return "<span style='color: var(--text2); font-style: italic; font-size: 12px;'>✍️ Rédaction en cours...</span>";
    }

    // 2. CONFIGURATION DU RENDU (Compatibilité v11+)
    const renderer = new marked.Renderer();

    renderer.code = function(argsOrCode, _lang) {
        // Détection du format : objet (v11+) ou chaîne (v10-)
        const isV11 = typeof argsOrCode === 'object' && argsOrCode !== null;
        const code = (isV11 ? argsOrCode.text : argsOrCode) || "";
        const language = (isV11 ? argsOrCode.lang : _lang) || "";
        
        const lang = language.toLowerCase();
        const isWeb = ['html', 'css', 'javascript', 'js'].includes(lang);
        const encodedCode = encodeURIComponent(code.trim());
        const runId = 'sandbox_' + Math.random().toString(36).substring(2, 9);
        // Ajout des data-attributes au lieu de l'attribut exécutable onclick
        const btnHtml = isWeb ? `<button class="run-btn" data-code="${encodedCode}" data-runid="${runId}" data-lang="${lang}">▶ Exécuter</button>` : '';

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
    sanitized = sanitized.replace(/<a[^>]+href="(https:\/\/[^"]+supabase\.co\/storage[^"]+)"[^>]*>(?:📄\s*)?([^<]+)<\/a>/gi, (match, url, fileName) => {
        const cleanName = fileName.trim();
        return `<a href="${url}" download="${cleanName}" target="_blank" class="file-chip" title="Télécharger ${cleanName}" style="text-decoration:none; cursor:pointer; display:inline-flex;"><span>📄</span>${cleanName} <span style="margin-left:6px; font-size:10px;">⬇️</span></a>`;
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
        const isBinary = ["pdf", "docx", "doc", "mp3", "m4a", "wav", "ogg"].includes(ext);
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
        chip.innerHTML = `<span>📄</span>${escapeHtml(file.name)} <span style='opacity:0.6'>(${file.lang})</span> <span style='margin-left:6px; font-size:10px;'>⬇️</span>`;
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

// 2. Recherche dans Supabase (restreinte à l'onglet actif)
async function searchMemory(query) {
    if (!currentUser || !activeTabId) return []; 
    
    try {
        const queryVector = await getEmbedding(query);
        const vectorString = `[${queryVector.join(',')}]`; 
        
        const { data, error } = await supabase.rpc('match_memories', {
            query_embedding: vectorString,
            match_threshold: 0.5,
            match_count: 3,
            p_user_id: currentUser.id,
            p_workspace_id: activeTabId // Isolation par onglet
        });
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.warn("RAG indisponible ou vide :", e.message);
        return [];
    }
}

// 3. Enregistrement d'une nouvelle information (via commande /memo)
async function memorizeText(content) {
    if (!currentUser || !activeTabId) return; 
    
    try {
        const vector = await getEmbedding(content);
        const vectorString = `[${vector.join(',')}]`;
        
        const { error } = await supabase.from('memories').insert([{
            user_id: currentUser.id,
            workspace_id: activeTabId, // Isolation par onglet
            content: content,
            embedding: vectorString
        }]);
        
        if (error) throw error;
    } catch (e) {
        console.error("Mémorisation impossible :", e.message);
    }
}

// ============================================================
//  CONSTRUCTION DU PROMPT — fenêtre glissante de contexte
// ============================================================

function buildPrompt(userMessage, files, memoryContext = "") {
    const CONTEXT_WINDOW = 20;
    const recent = history.slice(-CONTEXT_WINDOW);

    let userPrompt = "";

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
        
        // Troncation de sécurité (environ 12000 caractères, ~3000 tokens)
        if (historyText.length > 12000) {
            historyText = "...[Début de l'historique tronqué pour optimisation mémoire]...\n" + historyText.slice(-12000);
        }
        userPrompt += historyText;
    }

    userPrompt += "### NOUVEAU MESSAGE :\n" + userMessage + "\n\n### RÉPONSE :\n";
    return userPrompt;
}


//  APPEL API — /api/chat (Vercel Edge & Streaming)
// ============================================================

async function callAPI(userMessage, files, memoryContext = "", tempAgentId = null) {
    if (creditsLeft <= 0) {
        addMessage("bot", "⚠️ Tes crédits du jour sont épuisés. Reviens demain !", false);
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
            addMessage("bot", `<span style="font-size: 11px; color: var(--text2);"><em>⚡ Pensée a auto-détecté le contexte et verrouillé l'agent <strong>${AGENTS_CONFIG[detected].label}</strong>.</em></span>`, true);
        }
    }

    // Détection des mots-clés temporels pour forcer la recherche
    const temporalKeywords = [
        "aujourd'hui", "ce mois", "cette semaine", "cette année", "récent", "récente",
        "dernière", "dernier", "maintenant", "actuellement", "actuel", "actuelle",
        "nouveau", "nouvelle", "nouveaux", "nouvelles", "2025", "2026", "vient de",
        "dernières nouvelles", "quoi de neuf", "tendance", "tendances"
    ];
    const needsSearch = temporalKeywords.some(kw => userMessage.toLowerCase().includes(kw));

    // Construction des deux couches séparées
    const systemInstruction = buildSystemInstruction(resolvedAgentId, needsSearch);
    const userPrompt = buildPrompt(userMessage, files, memoryContext);

    const binaryFiles = files
        .filter(f => f.content && f.content.type === "binary")
        .map(f => ({ name: f.name, mime: f.content.mimeType, base64: f.content.data }));

    // Mise à jour du badge agent dans l'UI
    updateAgentBadge(resolvedAgentId);

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
            addMessage("bot", "❌ Erreur : " + errMsg, false);
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
        label.textContent = agentMeta ? `Pensée · ${agentMeta.icon} ${agentMeta.label}` : "Pensée";

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        msgDiv.appendChild(label);
        msgDiv.appendChild(bubble);
        messagesEl.appendChild(msgDiv);

        // Lecture du flux
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullReply = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullReply += decoder.decode(value, { stream: true });
                bubble.innerHTML = formatResponse(fullReply);
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        } catch (streamErr) {
            console.warn("Stream interrompu (mise en veille du navigateur) :", streamErr);
            
            // Sauvegarde gracieuse de ce qui a eu le temps d'être généré
            if (fullReply.trim().length === 0) {
                fullReply = "⚠️ *La génération a été coupée par la mise en veille de l'écran ou le changement d'onglet.* Veuillez relancer la question.";
            } else {
                fullReply += "\n\n*[⚠️ Génération interrompue par la mise en veille]*";
            }
        }

        // Nettoyage final
        fullReply = fullReply.replace(/^\s*\[Pens[ée]{1,2}e?\s*(?:IA)?\s*\]:\s*/i, "");
        const cutIndex = fullReply.search(/\n\[Utilisateur\]:|\n###\s*NOUVEAU MESSAGE/i);
        if (cutIndex > 80) fullReply = fullReply.substring(0, cutIndex);
        fullReply = fullReply.trim();
        bubble.innerHTML = formatResponse(fullReply);

        // Bouton copier (Ton code existant)
        const actions = document.createElement("div");
        actions.className = "msg-actions";
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.innerHTML = "📋 Copier";
        copyBtn.addEventListener("click", async function() {
            try {
                await navigator.clipboard.writeText(bubble.innerText);
                copyBtn.innerHTML = "✅ Copié !";
                copyBtn.style.color = "var(--accent)";
                setTimeout(() => { copyBtn.innerHTML = "📋 Copier"; copyBtn.style.color = ""; }, 2000);
            } catch(e) { copyBtn.innerHTML = "❌ Erreur"; }
        });
        actions.appendChild(copyBtn);

        // ==========================================
        // DÉBUT DE L'AJOUT : BOUTON AUDIT
        // ==========================================
        if (resolvedAgentId === 'code' || resolvedAgentId === 'strategie') {
            const auditBtn = document.createElement("button");
            auditBtn.className = "copy-btn"; // On réutilise le style discret du bouton copier
            auditBtn.innerHTML = "⚖️ Auditer";
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
                    auditBtn.innerHTML = "⚖️ Auditer";
                    auditBtn.disabled = false;
                }
            });
            actions.appendChild(auditBtn);
        }
        // ==========================================
        // FIN DE L'AJOUT
        // ==========================================

        msgDiv.appendChild(actions);

        // Mise à jour contexte
        history.push({ role: "user", content: userMessage });
        history.push({ role: "assistant", content: fullReply });
        await saveMessageToDB("assistant", fullReply);

        creditsLeft--;
        await useCreditInDB();
        updateCredits();
        if (creditsLeft > 0) setStatus("ok");

        // Réinitialisation du badge si l'agent était auto-détecté (pas fixé manuellement)
        } catch(error) {
        removeTyping();
        addMessage("bot", "❌ Erreur réseau : " + error.message, false);
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
//  ENVOI ET GESTION DES MESSAGES
// ============================================================

async function sendMessage() {
    const text  = userInput.value.trim();
    const files = attachedFiles.slice();
    if (!text && !files.length) return;
    if (sendBtn.disabled) return;
    
    if (text.startsWith("/memo ")) {
        const memoContent = text.replace("/memo ", "").trim();
        if (memoContent) {
            userInput.value = "";
            userInput.style.height = "auto";
            addMessage("user", text, false);
            showTyping();
            await memorizeText(memoContent);
            removeTyping();
            addMessage("bot", "🧠 **Mémoire sauvegardée.** Info vectorisée et enregistrée.", true);
        }
        return;
    }
    if (handleAgentCommand(text)) return;

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
                    addMessage("bot", `❌ **Erreur d'upload (${f.name})** : ${error.message}`, false);
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
//  PONT LOCAL (WEBSOCKET DAEMON)
// ============================================================
let localSocket = null;
const terminalBtn = document.getElementById("terminalBtn");

function toggleLocalDaemon() {
    if (localSocket && localSocket.readyState === WebSocket.OPEN) {
        localSocket.close();
        return;
    }

    terminalBtn.innerHTML = "⏳ Connexion...";
    localSocket = new WebSocket('ws://localhost:8080');

    localSocket.onopen = () => {
        terminalBtn.innerHTML = "🟢 Connecté";
        terminalBtn.style.color = "var(--accent)";
        terminalBtn.style.borderColor = "var(--accent)";
        addMessage("bot", "🔌 **Tunnel sécurisé établi.** Je suis maintenant connecté à ton terminal local.", true);
    };

    localSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'command_result') {
            // Pour l'instant, on se contente d'afficher le résultat brut du terminal dans le chat
            const output = data.error ? `❌ Erreur:\n${data.stderr || data.error}` : `✅ Succès:\n${data.stdout}`;
            addMessage("bot", `**Résultat du terminal :**\n\`\`\`bash\n${output}\n\`\`\``, true);
        }
    };

    localSocket.onclose = () => {
        terminalBtn.innerHTML = "🔌 Connecter Terminal";
        terminalBtn.style.color = "";
        terminalBtn.style.borderColor = "";
        localSocket = null;
    };

    localSocket.onerror = (err) => {
        terminalBtn.innerHTML = "🔌 Connecter Terminal";
        addMessage("bot", "❌ Impossible de se connecter au Daemon. As-tu bien lancé `node agent.js` dans ton terminal ?", false);
        localSocket = null;
    };
}

if (terminalBtn) terminalBtn.addEventListener("click", toggleLocalDaemon);

// ============================================================
//  INIT GLOBALE
// ============================================================
updateCredits();
setStatus("ok");
checkLocalAuth();
initAgentSelector();
// ============================================================
//  MOTEUR SANDBOX (Exécution Web)
// ============================================================
window.executeWebCode = function(btn, containerId, lang) {
    const container = document.getElementById(containerId);
    // On décode le code brut mis en attente
    const rawCode = decodeURIComponent(btn.getAttribute('data-code'));

    // Logique de fermeture
    if (btn.classList.contains('running')) {
        container.innerHTML = '';
        container.style.display = 'none';
        btn.classList.remove('running');
        btn.innerHTML = '▶ Exécuter';
        return;
    }

    // Création de l'environnement isolé
    container.innerHTML = '';
    container.style.display = 'block';
    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts allow-modals'; // Autorise l'exécution et les alert()
    container.appendChild(iframe);

    let finalCode = rawCode;

    // Si c'est du JS pur, on crée une fausse console pour voir le résultat à l'écran
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
            </script>
        </body></html>`;
    }

    // Injection dans l'Iframe
    iframe.srcdoc = finalCode;

    // Mise à jour de l'UI
    btn.classList.add('running');
    btn.innerHTML = '⏹ Fermer';
};

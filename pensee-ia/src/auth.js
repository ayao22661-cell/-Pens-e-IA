// ============================================================
//  PENSÉE IA — src/auth.js
//  Connexion, inscription, mot de passe oublié, déconnexion.
// ============================================================

import { supabase } from './supabase.js';
import { setCurrentUser } from './state.js';

const $ = (id) => document.getElementById(id);
const ui = {
    screen: $('loginScreen'), email: $('loginEmail'), pass: $('loginPassword'), btn: $('loginBtn'),
    error: $('loginError'), success: $('loginSuccess'), toggle: $('toggleAuthMode'), logout: $('logoutBtn'),
    forgot: $('forgotPassBtn'), emailGroup: $('emailGroup'), passGroup: $('passwordGroup'), instruction: $('authInstruction'),
};

let mode = 'login'; // 'login' | 'signup' | 'reset' | 'recovery'
let onLoggedIn = () => {};
let loggedIn = false;

function showMessage(kind, html) {
    ui.error.style.display = kind === 'error' ? 'block' : 'none';
    if (ui.success) ui.success.style.display = kind === 'success' ? 'block' : 'none';
    if (kind === 'error') ui.error.textContent = html;
    if (kind === 'success' && ui.success) ui.success.innerHTML = html;
}

function setMode(next) {
    mode = next;
    showMessage(null);
    ui.passGroup.style.display = next === 'reset' ? 'none' : 'block';
    ui.emailGroup.style.display = next === 'recovery' ? 'none' : 'block';
    ui.forgot.style.display = next === 'recovery' ? 'none' : '';
    ui.toggle.style.display = next === 'recovery' ? 'none' : '';
    ui.instruction.textContent = {
        login: 'Connecte-toi pour accéder à ton espace.',
        signup: 'Crée un compte pour accéder à ton espace.',
        reset: 'Saisis ton email pour réinitialiser ton mot de passe.',
        recovery: 'Saisis ton NOUVEAU mot de passe.',
    }[next];
    ui.btn.textContent = buttonLabel();
    ui.toggle.textContent = next === 'signup' ? 'Déjà un compte ? Se connecter'
        : next === 'reset' ? 'Retour à la connexion' : "Pas encore de compte ? S'inscrire";
}

const buttonLabel = () => ({
    login: 'Se connecter ›', signup: 'Créer mon compte ›',
    reset: 'Envoyer le lien de récupération', recovery: 'Mettre à jour le mot de passe',
}[mode]);

function enterApp(user) {
    setCurrentUser(user);
    ui.screen.style.opacity = '0';
    setTimeout(() => { ui.screen.style.display = 'none'; ui.screen.style.opacity = ''; }, 300);
    if (window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
    }
    if (!loggedIn) {
        loggedIn = true;
        onLoggedIn(user);
    }
}

async function submit() {
    const email = (ui.email?.value || '').trim();
    const password = (ui.pass?.value || '').trim();
    if ((mode !== 'recovery' && !email) || (mode !== 'reset' && !password)) {
        showMessage('error', mode === 'reset' ? 'Email requis.' : 'Email et mot de passe requis.');
        return;
    }

    ui.btn.textContent = 'Traitement...';
    ui.btn.disabled = true;
    showMessage(null);

    try {
        if (mode === 'recovery') {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            showMessage('success', '· Mot de passe mis à jour !');
            setTimeout(() => location.reload(), 2000);
        } else if (mode === 'reset') {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname,
            });
            if (error) throw error;
            showMessage('success', '· Lien envoyé !<br>Vérifie tes emails.');
        } else if (mode === 'signup') {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            showMessage('success', '· Compte créé !<br>Vérifie tes emails pour confirmer.');
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            enterApp(data.user);
        }
    } catch (error) {
        showMessage('error', error.message);
        ui.pass?.classList.add('shake');
        setTimeout(() => ui.pass?.classList.remove('shake'), 500);
    } finally {
        ui.btn.textContent = buttonLabel();
        ui.btn.disabled = false;
    }
}

/** @param {(user) => void} callback appelé une seule fois, à la première connexion valide */
export async function initAuth(callback) {
    onLoggedIn = callback;

    // Lien de récupération : on bloque l'entrée dans l'app avant même l'événement Supabase
    if (/type=recovery/.test(window.location.hash)) {
        ui.screen.style.display = 'flex';
        setMode('recovery');
    }

    ui.forgot?.addEventListener('click', () => setMode('reset'));
    ui.toggle?.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));
    ui.btn.addEventListener('click', submit);
    ui.pass?.addEventListener('keypress', (e) => { if (e.key === 'Enter') submit(); });
    ui.email?.addEventListener('keypress', (e) => { if (e.key === 'Enter') ui.pass?.focus(); });
    ui.logout?.addEventListener('click', async () => {
        if (!confirm('Se déconnecter de Pensée ?')) return;
        await supabase.auth.signOut();
        location.reload();
    });

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            ui.screen.style.display = 'flex';
            setMode('recovery');
            return;
        }
        if (session && mode !== 'recovery') enterApp(session.user);
        else if (!session) {
            ui.screen.style.display = 'flex';
            ui.email?.focus();
        }
    });

    const { data: { session } } = await supabase.auth.getSession();
    if (session && mode !== 'recovery') enterApp(session.user);
}

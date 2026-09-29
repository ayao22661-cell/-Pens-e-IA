// ============================================================
//  PENSÉE IA — src/ui/voice-input.js
//  Dictée vocale dans la zone de saisie (Web Speech API).
// ============================================================

import { els } from './dom.js';

export function initVoiceInput() {
    const micBtn = document.getElementById('micBtn');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!micBtn) return;
    if (!SR) { micBtn.style.display = 'none'; return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';

    let recording = false;
    let base = '';

    micBtn.addEventListener('click', () => {
        if (recording) { recognition.stop(); return; }
        base = els.userInput.value.trim() ? els.userInput.value.trim() + ' ' : '';
        recognition.start();
    });

    recognition.onstart = () => {
        recording = true;
        micBtn.classList.add('recording');
        els.userInput.placeholder = 'Écoute en cours...';
    };
    recognition.onresult = (event) => {
        let final = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript;
            else interim += event.results[i][0].transcript;
        }
        if (final) base += final;
        els.userInput.value = base + interim;
        els.userInput.dispatchEvent(new Event('input'));
    };
    recognition.onerror = (event) => {
        console.error('Erreur micro :', event.error);
        recognition.stop();
    };
    recognition.onend = () => {
        recording = false;
        micBtn.classList.remove('recording');
        els.userInput.placeholder = 'Discuter avec Pensée…';
    };
}

// ============================================================
//  PENSÉE IA — src/config.js
//  Configuration client. Le prompt système vit désormais côté
//  serveur (api/_lib/prompts.js) : le client ne peut plus le modifier.
// ============================================================

export const CONFIG = {
    maxCredits: 20,
    maxFileSizeMB: 3,              // Vercel Edge ~4.5 Mo par requête, base64 ×1.33
    maxAgentSteps: 25,             // allers-retours outils max par message (tâches de code longues)
    contextMessages: 40,           // messages d'historique envoyés au modèle
    contextChars: 60000,
    maxInlineTextChars: 60000,     // texte de fichier joint injecté dans le message
    langMap: {
        js: 'JavaScript', ts: 'TypeScript', jsx: 'React JSX', tsx: 'React TSX',
        py: 'Python', html: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'SASS',
        php: 'PHP', java: 'Java', c: 'C', cpp: 'C++', cs: 'C#',
        go: 'Go', rs: 'Rust', rb: 'Ruby', swift: 'Swift', kt: 'Kotlin',
        sql: 'SQL', json: 'JSON', xml: 'XML', yaml: 'YAML', yml: 'YAML',
        sh: 'Shell', bash: 'Bash', md: 'Markdown', txt: 'Texte',
        vue: 'Vue', svelte: 'Svelte', dart: 'Dart', r: 'R', lua: 'Lua',
        pdf: 'Document PDF', docx: 'Document Word', doc: 'Document Word',
        xlsx: 'Classeur Excel', pptx: 'Présentation', zip: 'Archive ZIP',
        jpg: 'Image JPEG', jpeg: 'Image JPEG', png: 'Image PNG', gif: 'Image GIF',
        webp: 'Image WebP', svg: 'Image SVG', ico: 'Icône',
        mp3: 'Audio MP3', m4a: 'Audio M4A', wav: 'Audio WAV', ogg: 'Audio OGG',
        mp4: 'Vidéo MP4', webm: 'Vidéo WebM', mov: 'Vidéo MOV', avi: 'Vidéo AVI',
    },
};

// audio.js (script classique) lit window.CONFIG
window.CONFIG = CONFIG;

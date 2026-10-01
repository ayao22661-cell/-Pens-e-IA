// ============================================================
//  PENSÉE IA — scripts/build-templates.mjs
//  Génère templates/<nom>/manifest.json (liste des fichiers servis
//  statiquement et installés par l'outil use_template).
//  Usage : node scripts/build-templates.mjs   (à relancer après toute modification d'un modèle)
// ============================================================

import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../templates/', import.meta.url));
const SKIP = new Set(['node_modules', 'dist', '.git', 'manifest.json']);
// Les fichiers commençant par un point ne sont pas servis par Vercel : on les stocke sans le point.
const RENAME = { 'gitignore': '.gitignore', 'server/env.example': 'server/.env.example' };

const DESCRIPTIONS = {
    fullstack: 'Application full-stack : Vite + React 19 + Tailwind v4 + lucide (client/) · Express 5 + SQLite + zod + tests Vitest/Supertest (server/). CRUD complet, pagination, filtres, statistiques, mode sombre.',
};

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        if (SKIP.has(name) || name.endsWith('.sqlite')) return [];
        const full = join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

for (const name of readdirSync(ROOT)) {
    const dir = join(ROOT, name);
    if (!statSync(dir).isDirectory()) continue;
    const files = walk(dir).map((f) => {
        const src = relative(dir, f).replace(/\\/g, '/');
        return { src, dest: RENAME[src] || src };
    }).sort((a, b) => a.dest.localeCompare(b.dest));
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ name, description: DESCRIPTIONS[name] || '', files }, null, 2) + '\n');
    console.log(`${name} : ${files.length} fichiers`);
}

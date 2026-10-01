// Ouverture de la base SQLite et application du schéma (migration idempotente).
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const schema = readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');

/** @param {string} file chemin du fichier, ou ':memory:' pour les tests */
export function openDb(file) {
    const db = new Database(file);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(schema);
    return db;
}

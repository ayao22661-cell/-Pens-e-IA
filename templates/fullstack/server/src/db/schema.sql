-- Schéma de la base. Exécuté à chaque démarrage : chaque instruction est idempotente.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
    category    TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'en_attente', 'archive')),
    amount      INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (name, category)
);

CREATE INDEX IF NOT EXISTS idx_items_status   ON items (status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);

// Règles métier + accès aux données pour les "items". Aucune logique HTTP ici.
// Toutes les requêtes sont paramétrées ; les colonnes de tri passent par une liste blanche.
import { notFound, conflict } from '../lib/errors.js';

const SORTABLE = { name: 'name', amount: 'amount', created_at: 'created_at', status: 'status', category: 'category' };

function mapUnique(fn) {
    try {
        return fn();
    } catch (e) {
        if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') throw conflict('Un élément porte déjà ce nom dans cette catégorie.');
        throw e;
    }
}

export function createItemsService(db) {
    const byId = db.prepare('SELECT * FROM items WHERE id = ?');

    return {
        list({ q, status, category, sort = 'created_at', order = 'desc', page = 1, limit = 20 }) {
            const where = [];
            const params = {};
            if (q) { where.push('(name LIKE @q OR category LIKE @q)'); params.q = `%${q}%`; }
            if (status) { where.push('status = @status'); params.status = status; }
            if (category) { where.push('category = @category'); params.category = category; }
            const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
            const column = SORTABLE[sort] || 'created_at';
            const direction = order === 'asc' ? 'ASC' : 'DESC';

            const total = db.prepare(`SELECT COUNT(*) AS n FROM items ${clause}`).get(params).n;
            const data = db
                .prepare(`SELECT * FROM items ${clause} ORDER BY ${column} ${direction}, id DESC LIMIT @limit OFFSET @offset`)
                .all({ ...params, limit, offset: (page - 1) * limit });
            return { data, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
        },

        get(id) {
            const item = byId.get(id);
            if (!item) throw notFound('Élément');
            return item;
        },

        create(input) {
            return mapUnique(() => {
                const { lastInsertRowid } = db
                    .prepare('INSERT INTO items (name, category, status, amount) VALUES (@name, @category, @status, @amount)')
                    .run(input);
                return byId.get(lastInsertRowid);
            });
        },

        update(id, patch) {
            const current = this.get(id);
            const next = { ...current, ...patch };
            return mapUnique(() => {
                db.prepare(`UPDATE items SET name = @name, category = @category, status = @status, amount = @amount,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = @id`).run(next);
                return byId.get(id);
            });
        },

        remove(id) {
            const { changes } = db.prepare('DELETE FROM items WHERE id = ?').run(id);
            if (!changes) throw notFound('Élément');
        },

        stats() {
            const totals = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount FROM items').get();
            const byStatus = db.prepare('SELECT status, COUNT(*) AS count FROM items GROUP BY status').all();
            const categories = db.prepare('SELECT DISTINCT category FROM items ORDER BY category').all().map(r => r.category);
            return { ...totals, byStatus: Object.fromEntries(byStatus.map(r => [r.status, r.count])), categories };
        },
    };
}

# Application full-stack

React 19 + Tailwind CSS v4 (client) · Express 5 + SQLite + zod (serveur) · tests Vitest + Supertest.

## Démarrer

```bash
npm run setup   # installe tout + données de démonstration
npm run dev     # API sur :3000, interface sur http://localhost:5173
npm test        # tests d'intégration de l'API
```

Variables d'environnement : voir `server/.env.example`.

## Architecture

```
server/src/
  index.js          démarrage (écoute 0.0.0.0:3000)
  app.js            construction de l'app Express (testable)
  config.js         variables d'environnement
  db/               schema.sql (migration idempotente), index.js, seed.js
  routes/           HTTP : validation zod → service → réponse
  services/         règles métier + requêtes SQL paramétrées
  middlewares/      validation, gestion d'erreurs centralisée
client/src/
  api.js            client HTTP (le front ne parle qu'à l'API)
  App.jsx           écran principal
  components/       primitives UI, modale, notifications
```

## API

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/api/health` | État du serveur |
| GET | `/api/items?q&status&category&sort&order&page&limit` | Liste paginée, filtrée et triée |
| GET | `/api/items/stats` | Totaux, répartition par statut, catégories |
| GET | `/api/items/:id` | Détail |
| POST | `/api/items` | Création (201) |
| PATCH | `/api/items/:id` | Modification partielle |
| DELETE | `/api/items/:id` | Suppression (204) |

Erreurs : `{ "error": { "code", "message", "details" } }` — 400 validation, 404 introuvable, 409 doublon, 500 interne.

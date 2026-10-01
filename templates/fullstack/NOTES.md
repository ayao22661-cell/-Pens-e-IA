# NOTES — mémoire du projet

## Objectif
À compléter : ce que l'application doit permettre, pour qui.

## Stack
- Client : Vite 7 + React 19 + Tailwind CSS v4 + lucide-react (client/)
- Serveur : Node 22 + Express 5 + better-sqlite3 + zod + helmet + pino-http (server/)
- Tests : Vitest + Supertest (server/tests/)

## Point de départ
Créé depuis le modèle « fullstack » : ressource d'exemple `items` (nom, catégorie, statut, montant FCFA).
À renommer et adapter au domaine réel : schema.sql, services/, routes/, tests/, App.jsx, api.js.

## Décisions
- Couches : routes (HTTP) → services (métier + SQL) ; aucune requête SQL dans les routes.
- Front branché sur l'API via le proxy Vite `/api` → `localhost:3000` (une seule URL).

## Lancer / tester
`npm run setup` puis `npm run dev` ; `npm test`.

## Prochaines étapes
- Adapter le modèle de données au besoin.

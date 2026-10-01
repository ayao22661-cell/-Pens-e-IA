// Configuration centralisée : toutes les variables d'environnement passent par ici.
export const config = {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    dbFile: process.env.DB_FILE || 'data.sqlite',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    env: process.env.NODE_ENV || 'development',
};

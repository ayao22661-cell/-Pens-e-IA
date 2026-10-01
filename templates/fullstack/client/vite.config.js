import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        host: true,           // écoute sur 0.0.0.0 (accessible via l'URL de la machine)
        port: 5173,
        allowedHosts: true,   // aperçu via un domaine externe (*.vercel.run)
        proxy: { '/api': 'http://localhost:3000' },
    },
});

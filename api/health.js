// ============================================================
//  PENSÉE IA — api/health.js
//  Diagnostic de configuration : indique quelles variables
//  d'environnement sont présentes. N'expose JAMAIS leurs valeurs.
// ============================================================

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY'];

export function GET() {
    const present = Object.fromEntries(REQUIRED.map(k => [k, Boolean(process.env[k] && String(process.env[k]).trim())]));
    // Noms proches (fautes de frappe, préfixes NEXT_PUBLIC_/VITE_…) : noms seulement
    const similar = Object.keys(process.env).filter(k => /SUPABASE|SERVICE_ROLE/i.test(k) && !REQUIRED.includes(k));
    return new Response(JSON.stringify({
        env: present,
        similarNames: similar,
        vercelEnv: process.env.VERCEL_ENV || null,
        authEnabled: present.SUPABASE_URL && present.SUPABASE_SERVICE_ROLE_KEY,
    }, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

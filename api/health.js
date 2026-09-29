// ============================================================
//  PENSÉE IA — api/health.js
//  Diagnostic de configuration : indique quelles variables
//  d'environnement sont présentes. N'expose JAMAIS leurs valeurs.
// ============================================================

const has = (k) => Boolean(process.env[k] && String(process.env[k]).trim());

// Type de clé Supabase, sans la révéler : préfixe des nouvelles clés
// (sb_secret_ / sb_publishable_) ou claim "role" des anciennes clés JWT.
function keyKind(key) {
    if (!key) return null;
    if (key.startsWith('sb_secret_')) return 'secret (service)';
    if (key.startsWith('sb_publishable_')) return 'publishable (anon) — insuffisante';
    try {
        const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
        return payload.role === 'service_role' ? 'service_role' : `${payload.role} — insuffisante`;
    } catch {
        return 'inconnu';
    }
}

export function GET() {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const env = {
        SUPABASE_URL: has('SUPABASE_URL'),
        SUPABASE_SERVICE_ROLE_KEY: has('SUPABASE_SERVICE_ROLE_KEY'),
        SUPABASE_SERVICE_KEY: has('SUPABASE_SERVICE_KEY'),
        GEMINI_API_KEY: has('GEMINI_API_KEY'),
        TURN_SECRET: has('TURN_SECRET'),
    };
    return new Response(JSON.stringify({
        env,
        serviceKeyKind: keyKind(serviceKey),
        similarNames: Object.keys(process.env).filter(k => /SUPABASE|SERVICE_ROLE/i.test(k) && !(k in env)),
        vercelEnv: process.env.VERCEL_ENV || null,
        authEnabled: env.SUPABASE_URL && Boolean(serviceKey),
    }, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

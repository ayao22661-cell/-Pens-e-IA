// ============================================================
//  PENSÉE IA — src/supabase.js
//  Client Supabase (clé publishable : lecture/écriture soumises à RLS).
// ============================================================

const SUPABASE_URL = 'https://uhrdoxllxqtvucxmzcww.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8EA5WSsRgDTcKbtpULEEFQ_Du2qoRIb';

// window.supabase est la bibliothèque UMD chargée par index.html ;
// on la remplace par l'instance, attendue par ui-enrich.js.
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabase = supabase;

export async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
}

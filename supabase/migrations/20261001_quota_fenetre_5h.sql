-- ============================================================
--  PENSÉE IA — Quota par fenêtre glissante de 5 heures
--  À exécuter une fois dans Supabase : SQL Editor → coller → Run.
--
--  Principe (comme Claude, en plus généreux) :
--  - la fenêtre démarre au premier message ; 5 h plus tard, le compteur repart de zéro ;
--  - on compte des « messages » : 1 message = jusqu'à 4 requêtes modèle réellement faites
--    (discussion, recherche, document ≈ 1 ; grosse tâche de code ≈ 5 ; Gemma compte moitié) ;
--  - limite par défaut : 45 messages / 5 h (variables Vercel QUOTA_MESSAGES, QUOTA_WINDOW_HOURS),
--    calibrée pour 40 à 100 utilisateurs actifs par jour sur la clé Gemini gratuite ;
--  - le contrôle se fait au DÉBUT d'un message : une tâche en cours n'est jamais coupée.
--
--  Tant que ce script n'est pas appliqué, l'API garde l'ancien système (20 crédits/jour).
-- ============================================================

create table if not exists public.usage_windows (
    user_id      uuid primary key references auth.users (id) on delete cascade,
    window_start timestamptz not null default now(),
    units        numeric     not null default 0 check (units >= 0),
    updated_at   timestamptz not null default now()
);

alter table public.usage_windows enable row level security;

drop policy if exists "Lecture de son propre quota" on public.usage_windows;
create policy "Lecture de son propre quota" on public.usage_windows
    for select using (auth.uid() = user_id);
-- Aucune policy d'écriture : seules les fonctions ci-dessous (service_role) modifient le quota.

-- État courant (sans rien consommer)
create or replace function public.quota_status(p_user_id uuid, p_limit numeric, p_hours numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    r public.usage_windows;
    v_end timestamptz;
begin
    select * into r from public.usage_windows where user_id = p_user_id;
    if not found then
        return jsonb_build_object('used', 0, 'limit', p_limit, 'reset_at', null);
    end if;
    v_end := r.window_start + make_interval(secs => p_hours * 3600);
    if now() >= v_end then
        return jsonb_build_object('used', 0, 'limit', p_limit, 'reset_at', null);
    end if;
    return jsonb_build_object('used', r.units, 'limit', p_limit, 'reset_at', v_end);
end;
$$;

-- Consommation atomique.
--   p_gate = true  : début d'un message → refusé si la limite est déjà atteinte
--   p_gate = false : comptabilise les requêtes réellement faites (jamais refusé)
create or replace function public.quota_consume(p_user_id uuid, p_units numeric, p_limit numeric, p_hours numeric, p_gate boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    r public.usage_windows;
    v_end timestamptz;
begin
    insert into public.usage_windows (user_id, window_start, units)
    values (p_user_id, now(), 0)
    on conflict (user_id) do nothing;

    select * into r from public.usage_windows where user_id = p_user_id for update;

    -- Fenêtre expirée : nouvelle fenêtre qui démarre maintenant
    if now() >= r.window_start + make_interval(secs => p_hours * 3600) then
        r.window_start := now();
        r.units := 0;
    end if;
    v_end := r.window_start + make_interval(secs => p_hours * 3600);

    if p_gate and r.units >= p_limit then
        update public.usage_windows set window_start = r.window_start, units = r.units, updated_at = now() where user_id = p_user_id;
        return jsonb_build_object('allowed', false, 'used', r.units, 'limit', p_limit, 'reset_at', v_end);
    end if;

    update public.usage_windows
       set window_start = r.window_start, units = r.units + greatest(p_units, 0), updated_at = now()
     where user_id = p_user_id;

    return jsonb_build_object('allowed', true, 'used', r.units + greatest(p_units, 0), 'limit', p_limit, 'reset_at', v_end);
end;
$$;

revoke all on function public.quota_status(uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public.quota_consume(uuid, numeric, numeric, numeric, boolean) from public, anon, authenticated;
grant execute on function public.quota_status(uuid, numeric, numeric) to service_role;
grant execute on function public.quota_consume(uuid, numeric, numeric, numeric, boolean) to service_role;

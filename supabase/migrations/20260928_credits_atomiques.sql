-- ============================================================
--  PENSÉE IA — Crédits atomiques et protégés
--  À exécuter une fois dans Supabase : SQL Editor → coller → Run.
--
--  1. consume_credit : décompte atomique (plus de course entre
--     lecture et écriture, reset quotidien intégré, en UTC).
--  2. refund_credit  : rend le crédit si aucun modèle n'a répondu.
--  3. Trigger        : un utilisateur connecté ne peut plus modifier
--     lui-même credits_used / last_reset_date depuis le navigateur.
--
--  Tant que ce script n'est pas appliqué, api/chat.js utilise
--  l'ancien mode (non atomique) : rien ne casse en attendant.
-- ============================================================

create or replace function public.consume_credit(p_user_id uuid, p_max int default 20)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    -- v_date (type date) s'assigne aussi bien à une colonne date qu'à une colonne text ;
    -- v_today (texte ISO) sert aux comparaisons dans les deux cas.
    v_date  date := (now() at time zone 'UTC')::date;
    v_today text := to_char(v_date, 'YYYY-MM-DD');
    v_used  int;
begin
    insert into public.profiles (id, credits_used, last_reset_date)
    values (p_user_id, 0, v_date)
    on conflict (id) do nothing;

    update public.profiles
       set credits_used    = case when last_reset_date::text is distinct from v_today then 1
                                  else coalesce(credits_used, 0) + 1 end,
           last_reset_date = v_date
     where id = p_user_id
       and (last_reset_date::text is distinct from v_today or coalesce(credits_used, 0) < p_max)
    returning credits_used into v_used;

    if v_used is null then
        return -1;              -- quota épuisé
    end if;
    return p_max - v_used;      -- crédits restants
end;
$$;

create or replace function public.refund_credit(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.profiles
       set credits_used = greatest(coalesce(credits_used, 0) - 1, 0)
     where id = p_user_id;
$$;

revoke all on function public.consume_credit(uuid, int) from public, anon, authenticated;
revoke all on function public.refund_credit(uuid)       from public, anon, authenticated;
grant execute on function public.consume_credit(uuid, int) to service_role;
grant execute on function public.refund_credit(uuid)       to service_role;

-- ── Protection des colonnes de crédits ──────────────────────
-- Les requêtes du navigateur s'exécutent en rôle "authenticated" :
-- on y fige les colonnes de crédits. Les fonctions ci-dessus
-- (security definer) et la clé service_role ne sont pas concernées.
create or replace function public.protect_credit_columns()
returns trigger
language plpgsql
as $$
begin
    if current_user in ('authenticated', 'anon') then
        if tg_op = 'INSERT' then
            new.credits_used := 0;
        else
            new.credits_used    := old.credits_used;
            new.last_reset_date := old.last_reset_date;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists protect_credit_columns on public.profiles;
create trigger protect_credit_columns
    before insert or update on public.profiles
    for each row execute function public.protect_credit_columns();

-- Classement du mini-jeu « La course vers l’autel » (arcade.js).
-- À coller dans Supabase : SQL Editor > New query > Run. Rejouable sans risque.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 16),
  score      int         not null check (score between 0 and 1000000),
  created_at timestamptz not null default now()
);
-- Durée de la partie mesurée par le serveur, pour repérer un score douteux dans Table Editor.
alter table public.scores add column if not exists elapsed_ms int;

-- Une ligne par partie lancée : c’est le serveur qui note l’heure de départ, le navigateur ne la choisit pas.
create table if not exists public.games (
  id         uuid        primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  used       boolean     not null default false
);

-- Personne ne peut lire ou écrire les tables directement : tout passe par les fonctions ci-dessous.
alter table public.scores enable row level security;
alter table public.games  enable row level security;

-- Ancienne version, où le navigateur annonçait lui-même la durée de la partie.
drop function if exists public.submit_score(text, int, int);

-- Appelée au début de chaque partie : renvoie le ticket à présenter avec le score.
create or replace function public.start_game()
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if now() >= timestamptz '2027-07-30 00:00:00+02' then raise exception 'concours terminé'; end if;
  delete from public.games where started_at < now() - interval '1 day';
  -- Garde-fou contre les envois en rafale (largement au-dessus de ce que font les invités).
  if (select count(*) from public.games where started_at > now() - interval '10 minutes') >= 600 then
    raise exception 'trop de parties, réessayez plus tard';
  end if;
  insert into public.games default values returning id into v_id;
  return v_id;
end;
$$;

-- Enregistre un score. Le ticket ne sert qu’une fois, et la durée est celle mesurée par le serveur
-- entre start_game et cet envoi : au-delà de 0,3 point par milliseconde (jouée à la perfection,
-- la partie en rapporte environ 0,25), pour une partie de moins de 3 s ou un ticket de plus de 30 min, c’est refusé.
-- Ce n’est pas une protection absolue (un tricheur patient peut garder un ticket ouvert et annoncer
-- un score à la hauteur du temps écoulé) : avant de remettre le lot, faites rejouer le gagnant.
create or replace function public.submit_score(p_game uuid, p_name text, p_score int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 16);
  v_started timestamptz;
  v_ms      int;
begin
  if now() >= timestamptz '2027-07-30 00:00:00+02' then raise exception 'concours terminé'; end if;
  if char_length(v_name) < 1 then raise exception 'prénom manquant'; end if;
  update public.games set used = true
    where id = p_game and not used
    returning started_at into v_started;
  if v_started is null then raise exception 'partie inconnue ou déjà enregistrée'; end if;
  v_ms := floor(extract(epoch from now() - v_started) * 1000);
  if v_ms < 3000 or v_ms > 1800000 then raise exception 'durée invalide'; end if;
  if p_score is null or p_score < 1 or p_score > v_ms * 3 / 10 then raise exception 'score invalide'; end if;
  insert into public.scores (name, score, elapsed_ms) values (v_name, p_score, v_ms);
end;
$$;

-- Le top 10, un seul score (le meilleur) par prénom.
create or replace function public.top_scores()
returns table (name text, score int)
language sql
stable
security definer
set search_path = public
as $$
  select t.name, t.score
  from (
    select distinct on (lower(s.name)) s.name, s.score
    from public.scores s
    order by lower(s.name), s.score desc, s.created_at
  ) t
  order by t.score desc, t.name
  limit 10;
$$;

revoke all on function public.start_game() from public;
revoke all on function public.submit_score(uuid, text, int) from public;
revoke all on function public.top_scores() from public;
grant execute on function public.start_game() to anon;
grant execute on function public.submit_score(uuid, text, int) to anon;
grant execute on function public.top_scores() to anon;

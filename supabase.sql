-- Classement du mini-jeu « La course vers l’autel » (arcade.js).
-- À coller dans Supabase : SQL Editor > New query > Run. Rejouable sans risque.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 16),
  score      int         not null check (score between 0 and 1000000),
  created_at timestamptz not null default now()
);
-- Colonnes ajoutées pour repérer et vérifier un score douteux depuis Table Editor.
alter table public.scores add column if not exists elapsed_ms int;    -- durée mesurée par le serveur
alter table public.scores add column if not exists frames     int;    -- nombre de pas de jeu (60/s)
alter table public.scores add column if not exists jumps      int;    -- nombre de sauts
alter table public.scores add column if not exists replay     jsonb;  -- graine + frames de saut, pour rejouer la partie

-- Une ligne par partie lancée : c’est le serveur qui note l’heure de départ, le navigateur ne la choisit pas.
create table if not exists public.games (
  id         uuid        primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  used       boolean     not null default false
);

-- Personne ne peut lire ou écrire les tables directement : tout passe par les fonctions ci-dessous.
alter table public.scores enable row level security;
alter table public.games  enable row level security;
-- En plus, la clé publique n’a aucun droit direct sur ces tables. Supabase lui en donne d’office,
-- et la RLS ne couvre pas TRUNCATE (vider une table d’un coup) : on retire donc tout. Les fonctions
-- ci-dessous continuent de marcher, elles agissent avec les droits du propriétaire des tables.
revoke all on table public.scores, public.games from anon, authenticated;

-- Anciennes versions : le navigateur envoyait lui-même son score. Supprimées : c’est désormais
-- la fonction serveur enregistrer-score qui rejoue la partie et calcule le score (voir record_score).
drop function if exists public.submit_score(text, int, int);
drop function if exists public.submit_score(uuid, text, int);
drop function if exists public.submit_score(uuid, text, int, int, int, jsonb);

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

-- Enregistre un score. Appelée UNIQUEMENT par la fonction serveur enregistrer-score
-- (supabase/functions/enregistrer-score), avec la clé secrète : le site et sa clé publique ne
-- peuvent pas l’appeler. Le score reçu est celui que le serveur a calculé en rejouant la partie
-- (graine + sauts) avec le moteur du jeu ; le navigateur ne choisit donc jamais son score.
-- Vérifie encore : ticket valable une seule fois et de moins de 2 h, et partie pas plus longue
-- que le temps réellement écoulé depuis le ticket (on ne peut pas « accélérer » une partie).
create or replace function public.record_score(
  p_game uuid, p_name text, p_score int, p_frames int, p_jumps int, p_replay jsonb)
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
  if p_score is null or p_score < 1 or p_score > 1000000 then raise exception 'score invalide'; end if;
  if p_frames is null or p_frames < 180 then raise exception 'partie trop courte'; end if;
  update public.games set used = true
    where id = p_game and not used
    returning started_at into v_started;
  if v_started is null then raise exception 'partie inconnue ou déjà enregistrée'; end if;
  v_ms := floor(extract(epoch from now() - v_started) * 1000);
  if v_ms > 7200000 then raise exception 'ticket expiré'; end if;
  -- 60 pas par seconde : une partie de p_frames pas dure p_frames / 60 s (5 s de marge pour le réseau)
  if v_ms + 5000 < p_frames * 1000 / 60 then raise exception 'partie plus longue que le temps écoulé'; end if;
  insert into public.scores (name, score, elapsed_ms, frames, jumps, replay)
    values (v_name, p_score, v_ms, p_frames, p_jumps, p_replay);
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

-- Droits : la clé publique du site peut seulement lancer une partie et lire le top 10.
-- Supabase donne d’office le droit d’exécuter les nouvelles fonctions à anon et authenticated :
-- on le leur retire explicitement pour record_score.
revoke all on function public.start_game() from public;
revoke all on function public.top_scores() from public;
revoke all on function public.record_score(uuid, text, int, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.start_game() to anon;
grant execute on function public.top_scores() to anon;
grant execute on function public.record_score(uuid, text, int, int, int, jsonb) to service_role;

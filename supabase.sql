-- Classement du mini-jeu « La course vers l’autel » (jeu-moteur.js + arcade.js).
-- À coller dans Supabase : SQL Editor > New query > Run. Rejouable sans risque.
--
-- Déroulé d’une partie :
--   1. clic sur « Jouer » : start_game() crée un ticket, tire la graine de la partie et note l’heure ;
--   2. chute : end_game(ticket) note l’heure de fin ;
--   3. envoi : la fonction serveur (Edge Function, code dans supabase/functions/enregistrer-score)
--      rejoue la partie à partir de la graine et des sauts, calcule le score et appelle record_score,
--      qui vérifie tout le reste. Le navigateur n’annonce jamais son score.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 16),
  score      int         not null check (score between 0 and 1000000),
  created_at timestamptz not null default now()
);
-- Colonnes ajoutées pour repérer et vérifier un score douteux depuis Table Editor.
alter table public.scores add column if not exists elapsed_ms int;    -- durée réelle mesurée par le serveur
alter table public.scores add column if not exists frames     int;    -- nombre de pas de jeu (60/s)
alter table public.scores add column if not exists jumps      int;    -- nombre de sauts
alter table public.scores add column if not exists replay     jsonb;  -- graine + pas de saut, pour rejouer la partie
alter table public.scores add column if not exists a_verifier boolean not null default false;  -- partie à contrôler
alter table public.scores add column if not exists motif      text;   -- pourquoi elle est à contrôler
-- Score caché du classement tant que les mariés ne l’ont pas validé (mettre false dans Table Editor).
-- Concerne les scores qui entreraient sur le podium et les parties à contrôler : un robot ne peut pas
-- s’afficher en tête sans que vous l’ayez vu.
alter table public.scores add column if not exists en_attente boolean not null default false;

-- Une ligne par partie lancée : c’est le serveur qui tire la graine et note les heures de début et de fin.
create table if not exists public.games (
  id         uuid        primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  used       boolean     not null default false
);
alter table public.games add column if not exists seed     bigint;       -- graine de la partie, tirée par le serveur
alter table public.games add column if not exists ended_at timestamptz;  -- heure de la chute
alter table public.games add column if not exists ip_hash  text;         -- empreinte de la connexion (pas l’adresse elle-même)
create index if not exists games_started_idx on public.games (started_at);
create index if not exists games_ip_idx on public.games (ip_hash, started_at);

-- Un prénom appartient au premier appareil qui l’a utilisé pour enregistrer un score.
-- En cas de litige (invité qui change de téléphone), supprimer sa ligne ici dans Table Editor.
create table if not exists public.players (
  name_key    text        primary key,     -- prénom simplifié : minuscules, sans accents ni espaces
  device_hash text        not null,        -- empreinte de la clé tirée au hasard par l’appareil
  created_at  timestamptz not null default now()
);

-- Personne ne peut lire ou écrire les tables directement : tout passe par les fonctions ci-dessous.
alter table public.scores  enable row level security;
alter table public.games   enable row level security;
alter table public.players enable row level security;
-- En plus, la clé publique n’a aucun droit direct sur ces tables. Supabase lui en donne d’office,
-- et la RLS ne couvre pas TRUNCATE (vider une table d’un coup) : on retire donc tout. Les fonctions
-- ci-dessous continuent de marcher, elles agissent avec les droits du propriétaire des tables.
revoke all on table public.scores, public.games, public.players from anon, authenticated;

-- Anciennes versions, remplacées par celles ci-dessous.
drop function if exists public.submit_score(text, int, int);
drop function if exists public.submit_score(uuid, text, int);
drop function if exists public.submit_score(uuid, text, int, int, int, jsonb);
drop function if exists public.record_score(uuid, text, int, int, int, jsonb);
drop function if exists public.start_game();

-- Adresse de la connexion qui appelle (fournie par Supabase dans les en-têtes de la requête).
-- cf-connecting-ip est posé par Cloudflare, devant Supabase, et ne peut pas être inventé par le joueur.
create or replace function public.client_ip()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(nullif(btrim(h ->> 'cf-connecting-ip'), ''),
                  nullif(btrim(h ->> 'x-real-ip'), ''),
                  nullif(btrim(split_part(h ->> 'x-forwarded-for', ',', 1)), ''),
                  '')
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) t;
$$;

-- Pour vérifier quelle adresse le serveur voit (la sienne uniquement) : select diag_connexion();
-- ou POST /rest/v1/rpc/diag_connexion depuis le site.
create or replace function public.diag_connexion()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('cf-connecting-ip', h ->> 'cf-connecting-ip', 'x-real-ip', h ->> 'x-real-ip',
                           'x-forwarded-for', h ->> 'x-forwarded-for', 'retenue', public.client_ip())
  from (select coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json as h) t;
$$;

-- Prénom simplifié, pour que « Maÿlis », « maylis » et « Maylis ! » soient le même prénom.
create or replace function public.name_key(p_name text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(regexp_replace(lower(translate(p_name,
           'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÝŸýÿÇçÑñ',
           'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuYYyyCcNn')), '[^a-z0-9]', '', 'g'), ''),
         lower(p_name));
$$;

-- Clic sur « Jouer » : crée le ticket, tire la graine et note l’heure. La graine n’est connue qu’à ce
-- moment-là : impossible de préparer (ou de jouer au ralenti) une partie avant d’avoir le ticket.
create function public.start_game()
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ip   text := public.client_ip();
  v_hash text;
  v_id   uuid;
  v_seed bigint := floor(random() * 4294967296)::bigint;
begin
  if now() >= timestamptz '2027-07-30 00:00:00+02' then raise exception 'concours terminé'; end if;
  delete from public.games where started_at < now() - interval '1 day';
  -- Limite par connexion : un saboteur ne peut pas épuiser les parties de tout le monde.
  if v_ip <> '' then
    v_hash := encode(sha256(convert_to('course-autel:' || v_ip, 'UTF8')), 'hex');
    if (select count(*) from public.games
        where ip_hash = v_hash and started_at > now() - interval '10 minutes') >= 60 then
      raise exception 'trop de parties depuis cette connexion, réessayez dans quelques minutes';
    end if;
  end if;
  -- Garde-fou global, très au-dessus de ce que font tous les invités réunis.
  if (select count(*) from public.games where started_at > now() - interval '10 minutes') >= 3000 then
    raise exception 'trop de parties, réessayez plus tard';
  end if;
  insert into public.games (seed, ip_hash) values (v_seed, v_hash) returning id into v_id;
  return json_build_object('id', v_id, 'seed', v_seed);
end;
$$;

-- Chute : note l’heure de fin (une seule fois, et seulement pour un ticket ni enregistré ni périmé).
create or replace function public.end_game(p_game uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.games set ended_at = now()
  where id = p_game and ended_at is null and not used and started_at > now() - interval '2 hours';
$$;

-- Enregistre un score. Appelée UNIQUEMENT par la fonction serveur, avec la clé secrète : le site et
-- sa clé publique ne peuvent pas l’appeler. Le score reçu est celui que le serveur a calculé en
-- rejouant la partie ; cette fonction vérifie en plus :
--   - ticket valable une seule fois, de moins de 2 h, et graine identique à celle tirée par le serveur ;
--   - durée réelle (début → chute, mesurée par le serveur) ≈ durée de la partie (frames / 60 s) :
--     plus courte = partie accélérée, nettement plus longue = jeu ralenti ou mis en pause ;
--   - prénom réservé au premier appareil qui l’a utilisé.
-- Les parties très longues ou au score très élevé sont acceptées mais marquées « à vérifier ».
-- Un score qui entrerait dans le top 3 (PODIUM), ou une partie à vérifier, reste en attente :
-- invisible au classement jusqu’à ce que les mariés le valident. Renvoie {"en_attente": true|false}.
drop function if exists public.record_score(uuid, text, text, bigint, int, int, int, jsonb);
create function public.record_score(
  p_game uuid, p_name text, p_device text, p_seed bigint,
  p_score int, p_frames int, p_jumps int, p_replay jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name    text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 16);
  v_key     text;
  v_dev     text;
  v_owner   text;
  v_started timestamptz;
  v_ended   timestamptz;
  v_seed    bigint;
  v_real    int;
  v_dur     int;
  v_motif   text;
  v_better  int;
  v_pending boolean;
  PODIUM    constant int := 3;   -- 0 = pas de validation du podium
begin
  if now() >= timestamptz '2027-07-30 00:00:00+02' then raise exception 'concours terminé'; end if;
  if char_length(v_name) < 1 then raise exception 'prénom manquant'; end if;
  if p_score is null or p_score < 1 or p_score > 1000000 then raise exception 'score invalide'; end if;
  if p_frames is null or p_frames < 180 or p_frames > 108000 then raise exception 'durée de partie invalide'; end if;
  if p_device is null or p_device !~ '^[0-9a-f]{32}$' then raise exception 'appareil inconnu'; end if;

  update public.games set used = true
    where id = p_game and not used
    returning started_at, ended_at, seed into v_started, v_ended, v_seed;
  if v_started is null then raise exception 'partie inconnue ou déjà enregistrée'; end if;
  if now() - v_started > interval '2 hours' then raise exception 'ticket expiré'; end if;
  if v_seed is null or v_seed <> p_seed then raise exception 'graine incorrecte'; end if;
  if v_ended is null then raise exception 'partie non terminée'; end if;

  -- 60 pas par seconde. Marges : réseau au début et à la fin, petits ralentissements d’un vieux téléphone.
  v_real := floor(extract(epoch from v_ended - v_started) * 1000);
  v_dur  := p_frames * 1000 / 60;
  if v_real + 3000 < v_dur then raise exception 'partie accélérée'; end if;
  if v_real > v_dur * 115 / 100 + 8000 then raise exception 'partie ralentie ou interrompue'; end if;

  v_key := public.name_key(v_name);
  v_dev := encode(sha256(convert_to(p_device, 'UTF8')), 'hex');
  insert into public.players (name_key, device_hash) values (v_key, v_dev) on conflict (name_key) do nothing;
  select device_hash into v_owner from public.players where name_key = v_key;
  if v_owner is distinct from v_dev then raise exception 'prénom déjà pris'; end if;

  if p_frames > 60 * 60 * 4 then v_motif := 'partie de plus de 4 minutes'; end if;
  if p_score >= 25000 then v_motif := concat_ws(', ', v_motif, 'score de 25 000 ou plus'); end if;

  -- combien d’autres prénoms ont déjà mieux au classement visible ?
  select count(*) into v_better
  from (select distinct on (lower(s.name)) s.name, s.score
        from public.scores s where not s.en_attente
        order by lower(s.name), s.score desc) t
  where t.score >= p_score and lower(t.name) <> lower(v_name);
  v_pending := v_motif is not null or v_better < PODIUM;

  insert into public.scores (name, score, elapsed_ms, frames, jumps, replay, a_verifier, motif, en_attente)
    values (v_name, p_score, v_real, p_frames, p_jumps, p_replay, v_motif is not null, v_motif, v_pending);
  return json_build_object('en_attente', v_pending);
end;
$$;

-- Le top 10, un seul score (le meilleur) par prénom, sans les scores en attente de validation.
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
    where not s.en_attente
    order by lower(s.name), s.score desc, s.created_at
  ) t
  order by t.score desc, t.name
  limit 10;
$$;

-- Droits : la clé publique du site peut seulement lancer une partie, signaler sa fin, lire le top 10
-- et voir sa propre adresse. Supabase donne d’office le droit d’exécuter les nouvelles fonctions à
-- anon et authenticated : on le leur retire explicitement pour tout le reste.
revoke all on function public.start_game() from public;
revoke all on function public.end_game(uuid) from public;
revoke all on function public.top_scores() from public;
revoke all on function public.diag_connexion() from public;
revoke all on function public.client_ip() from public, anon, authenticated;
revoke all on function public.name_key(text) from public, anon, authenticated;
revoke all on function public.record_score(uuid, text, text, bigint, int, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.start_game() to anon;
grant execute on function public.end_game(uuid) to anon;
grant execute on function public.top_scores() to anon;
grant execute on function public.diag_connexion() to anon;
grant execute on function public.record_score(uuid, text, text, bigint, int, int, int, jsonb) to service_role;

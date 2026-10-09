-- Classement du mini-jeu « La course vers l’autel » (arcade.js).
-- À coller dans Supabase : SQL Editor > New query > Run. Rejouable sans risque.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 16),
  score      int         not null check (score between 0 and 1000000),
  created_at timestamptz not null default now()
);

-- Personne ne peut lire ou écrire la table directement : tout passe par les deux fonctions ci-dessous.
alter table public.scores enable row level security;

-- Enregistre un score. Refuse les valeurs invraisemblables : au-delà de 0,5 point par milliseconde de partie
-- (jouée à la perfection, le jeu en rapporte environ 0,25), les parties de moins de 3 s ou de plus de 30 min, et tout envoi après le mariage.
-- Ce n’est pas une protection absolue (le temps de partie est annoncé par le navigateur) :
-- avant de remettre la bouteille, vérifiez le score du gagnant en le faisant rejouer.
create or replace function public.submit_score(p_name text, p_score int, p_ms int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 16);
begin
  if now() >= timestamptz '2027-07-30 00:00:00+02' then raise exception 'concours terminé'; end if;
  if char_length(v_name) < 1 then raise exception 'prénom manquant'; end if;
  if p_ms is null or p_ms < 3000 or p_ms > 1800000 then raise exception 'durée invalide'; end if;
  if p_score is null or p_score < 1 or p_score > p_ms / 2 then raise exception 'score invalide'; end if;
  insert into public.scores (name, score) values (v_name, p_score);
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

revoke all on function public.submit_score(text, int, int) from public;
revoke all on function public.top_scores() from public;
grant execute on function public.submit_score(text, int, int) to anon;
grant execute on function public.top_scores() to anon;

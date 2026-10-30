# Sécurité du site

Bilan des protections en place, de ce qu'il reste possible, et de ce qui est **à faire de ton
côté** (comptes Supabase et GitHub, mot de passe). Dernière revue : 2026-10-31.

## Le mini-jeu : ce qui est bloqué

| Tentative de triche | Ce qui l'empêche |
|---|---|
| Annoncer le score de son choix | Le navigateur n'envoie aucun score. La fonction serveur rejoue la partie (graine + sauts) avec le même moteur que le jeu et enregistre **le score qu'elle obtient**. |
| Préparer une partie parfaite à l'avance | La **graine** (l'ordre des obstacles) est tirée par le serveur **au clic sur « Jouer »** ; une autre graine est refusée. |
| Jouer **au ralenti** ou **mettre en pause** | Le serveur note l'heure du début et celle de la chute : la durée réelle doit correspondre à la durée de la partie (marge : +15 % et 8 s). |
| Accélérer une partie | Même contrôle : une partie ne peut pas durer moins longtemps que le temps réellement écoulé. |
| Réutiliser ou inventer un ticket | Un ticket ne sert qu'une fois, expire au bout de 2 h, et doit exister en base. |
| Jouer sous le prénom d'un autre | Un prénom appartient au **premier appareil** qui l'a utilisé (« Maÿlis », « maylis » et « Maylis ! » sont le même prénom). |
| Monter sur le podium avec un robot | Tout score qui entrerait dans le **top 3**, et toute partie suspecte (plus de 4 min ou 25 000 points), reste **caché du classement jusqu'à ta validation**. Tu peux **revoir la partie à l'écran** avant de valider. |
| Saboter le jeu en lançant des parties en boucle | Au plus 60 parties par connexion internet en 10 minutes (adresse fournie par Cloudflare, impossible à falsifier) ; garde-fou global à 3 000. |
| Supprimer, modifier, lire ou vider les scores | La clé publique du site n'a **aucun droit** sur les tables ; seules quatre fonctions lui sont ouvertes (lancer une partie, signaler la chute, lire le top 10, voir sa propre adresse). |
| Requêtes trafiquées (injections, requêtes énormes…) | Refusées par la fonction serveur, et souvent dès Cloudflare. |

Tout cela a été testé : sur une copie locale de la base (mêmes rôles que Supabase) avec la vraie
fonction serveur, dans un navigateur, puis en production.

## Ce qui reste possible
- **Un programme qui joue dans la page** en appuyant au bon moment ne se distingue pas à coup sûr
  d'un excellent joueur. Il doit jouer en temps réel, et ne peut pas monter sur le podium sans ta
  validation. → Avant de valider un podium, **revois la partie** ; avant de remettre le lot,
  **fais rejouer le gagnant devant toi**.
- **Mot de passe d'accès** : filtre dans le navigateur seulement ; quelqu'un qui lit le code peut le
  contourner. Ne rien mettre de confidentiel sur le site.

## Le site
- **CSP** (politique de sécurité du contenu) : seules les origines réellement utilisées sont
  autorisées ; tout script ou cadre tiers injecté est bloqué.
- **Pas d'injection par un faux prénom** : affiché en texte brut, stocké comme du texte.
- **Aucun secret** dans l'historique Git, **aucune métadonnée GPS** dans les photos.
- Mot de passe stocké uniquement sous forme d'**empreinte SHA-256 salée**.

## À faire de ton côté (le plus important)
1. **Compte Supabase** : double authentification (2FA), mot de passe fort, ne jamais partager la clé
   secrète (`service_role` / `sb_secret_…`), qui peut tout supprimer.
2. **Compte GitHub** : 2FA, et dans *Settings → Branches*, protéger la branche `main` (interdire la
   suppression et le `force-push`).
3. **Mot de passe du site** : pas évident (ni « mariage », ni la date).

## Surveiller et valider
Dans Supabase → *Table Editor* → `scores`, filtrer **`en_attente` = `true`** : ce sont les scores
qui attendent ta décision (colonne `motif` pour les parties suspectes).

- **Revoir la partie** : copier la valeur de sa colonne `replay`, ouvrir le site, puis la console
  du navigateur (F12) et taper :
  ```js
  MaArcade.revoir({"seed": 532528475, "inputs": [42, 97, 160]})
  ```
  (en remplaçant par la valeur copiée). La partie se rejoue à l'écran avec exactement les mêmes sauts.
- **Valider** : mettre `en_attente` à `false`. **Refuser** : supprimer la ligne.
- **Libérer un prénom** (invité qui a changé de téléphone) : table `players`, supprimer sa ligne.

Vue d'ensemble, dans SQL Editor :
```sql
select id, name, score, round(frames / 60.0) as duree_s, jumps,
       en_attente, a_verifier, motif, created_at
from scores
order by en_attente desc, score desc
limit 30;
```

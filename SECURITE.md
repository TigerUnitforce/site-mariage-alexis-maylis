# Sécurité du site

Bilan de l'audit et des protections en place, avec les points qui restent à faire **de ton côté**
(compte Supabase, compte GitHub, mot de passe). Dernière revue : 2026-10-30.

## Ce qui est protégé

### Le score est calculé par le serveur, pas par le navigateur
Le navigateur n'envoie **aucun score** : seulement son ticket de partie, la graine de la partie et
les pas où le joueur a sauté. La fonction serveur `enregistrer-score` rejoue la partie avec le même
moteur que le jeu (`jeu-moteur.js`) et enregistre **le score qu'elle obtient elle-même**. Ajouter un
faux score dans la requête ne sert à rien : il est ignoré.

> Corrigé le 2026-10-30 : auparavant, le serveur gardait le rejeu mais acceptait le score annoncé
> par le navigateur (jusqu'à 0,3 point/ms d'attente). Il suffisait de demander un ticket, d'attendre,
> puis d'annoncer un score. Ce n'est plus possible.

### Autres garde-fous du jeu
- **Ticket à usage unique** (`start_game`) : le serveur note l'heure de départ ; un ticket ne sert
  qu'une fois et expire au bout de 2 h.
- **Pas d'accélération possible** : une partie ne peut pas avoir duré plus longtemps que le temps
  réellement écoulé depuis le ticket (le jeu avance de 60 pas par seconde).
- **Requêtes trafiquées refusées** : ticket ou graine invalides, sauts dans le désordre, trop de
  sauts, requête énorme ou illisible, partie de plus de 30 minutes.
- **Jeu déterministe** : mêmes calculs dans tous les navigateurs et sur le serveur (vérifié sur des
  parties de plus de 5 minutes traversant tous les décors). Chaque score garde son rejeu.

### Personne ne peut supprimer ni modifier les scores depuis le site
La clé présente dans `arcade.js` est la clé **publique** (`sb_publishable_…`). Avec elle, on peut
seulement **lancer une partie** (`start_game`) et **lire le top 10** (`top_scores`). Elle n'a aucun
droit sur les tables : lire, écrire, modifier, supprimer, vider (`TRUNCATE`) ou détruire les tables
est refusé (vérifié). L'enregistrement des scores (`record_score`) n'est possible qu'avec la clé
secrète, que seule la fonction serveur utilise.

> La **seule** façon de supprimer ou modifier un score est le tableau de bord Supabase (ou la clé
> secrète). Protéger ce compte est donc essentiel — voir « À faire de ton côté ».

### Site
- **CSP** (politique de sécurité du contenu) : seules les origines réellement utilisées sont
  autorisées ; tout script ou cadre tiers injecté est bloqué (vérifié).
- **Pas d'injection par un faux prénom** : le classement affiche les prénoms en texte brut
  (`textContent`) et la base les stocke comme du texte (testé avec un prénom piégé).
- **Aucun secret** dans l'historique Git, **aucune métadonnée GPS** dans les photos.
- Mot de passe stocké uniquement sous forme d'**empreinte SHA-256 salée**.

## Limites qui demeurent (impossibles à fermer totalement sur un site statique)
- **Robot** : quelqu'un qui sait programmer peut écrire un programme qui joue à sa place (le moteur
  est lisible dans le code du site), puis attendre en temps réel la durée de sa partie. C'est bien
  plus difficile que de changer un chiffre, et ça se voit (voir « Surveiller le jeu »). → **Faire
  rejouer le gagnant devant soi** avant de remettre le lot.
- **Usurpation de prénom** : sans comptes utilisateurs, on peut jouer sous le prénom d'un autre.
- **Mot de passe d'accès** : filtre côté navigateur uniquement ; quelqu'un qui lit le code peut le
  contourner. Ne rien mettre de confidentiel sur le site.

## À faire de ton côté (le plus important)
Tout ce qui précède ne protège pas tes **comptes**. Pour que personne ne puisse supprimer le site
ou les scores :

1. **Compte Supabase** : activer la double authentification (2FA), mot de passe fort, ne jamais
   partager ni coller en ligne la clé secrète (`service_role` / `sb_secret_…`), qui peut tout supprimer.
2. **Compte GitHub** : activer la 2FA. Dans *Settings → Branches*, protéger la branche `main`
   (interdire la suppression et le `force-push`).
3. **Mot de passe du site** : en choisir un **pas évident** (ni « mariage », ni la date).

## Surveiller le jeu
Repérer les scores douteux, dans Supabase → SQL Editor :

```sql
select id, name, score, round(frames / 60.0) as duree_s, jumps, created_at
from scores
order by score desc
limit 20;
```

À regarder de près : une partie de plusieurs minutes (un invité tient rarement plus de deux
minutes), ou un score très au-dessus des autres. Un score sans `frames` ni `replay` date d'avant
les protections : il n'a pas été vérifié par le serveur.

Pour **revoir** la partie d'un gagnant : copier sa colonne `replay`
(ex. `{"seed":42,"inputs":[10,40,90]}`), ouvrir la console du site (F12) et taper :

```js
MaArcadeVerify(42, [10, 40, 90])
```

Le résultat `{score, frames, jumps}` est exactement ce que le serveur a calculé.

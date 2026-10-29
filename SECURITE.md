# Sécurité du site

Bilan de l'audit et des protections en place, avec les points qui restent à faire **de ton côté**
(compte Supabase, compte GitHub, mot de passe). Dernière revue : 2026-10-29.

## Ce qui est protégé

### Personne ne peut supprimer ni modifier les scores depuis le site
La clé présente dans `arcade.js` est la clé **publique** (`sb_publishable_…`), publique par
conception. Les tables `scores` et `games` ont la « sécurité au niveau des lignes » (RLS) activée
**sans aucune règle d'accès** : tout passe obligatoirement par trois fonctions contrôlées
(`start_game`, `submit_score`, `top_scores`). Vérifié : avec cette clé, `delete`, `update`,
`insert`, `truncate`, `drop` et la lecture directe des prénoms sont **tous refusés**.

> La **seule** façon de supprimer ou modifier un score est le tableau de bord Supabase (clé
> `service_role`). Protéger ce compte est donc essentiel — voir « À faire de ton côté ».

### Triche au mini-jeu : plusieurs garde-fous
- **Ticket serveur** : chaque partie demande un ticket (`start_game`) dont le serveur note l'heure
  de départ. Le score n'est accepté qu'**une fois par ticket**.
- **Durée mesurée par le serveur**, pas annoncée par le navigateur. Plafond de 0,3 point/ms.
- **Rejeu vérifiable** : chaque envoi joint une graine + la liste des sauts. Le jeu est
  déterministe, donc on peut **rejouer la partie d'un gagnant et retrouver son score exact**.
- **Contrôles de cohérence** : nombre de pas/sauts cohérent avec la durée, rejeu pas plus long que
  la partie, rejeu pas surdimensionné, et pas plus de 600 parties lancées en 10 minutes.

### Site
- **CSP** (politique de sécurité du contenu) : seules les origines réellement utilisées sont
  autorisées ; tout script ou cadre tiers injecté est bloqué (vérifié).
- **Pas d'injection par un faux prénom** : le classement affiche les prénoms en texte brut
  (`textContent`), jamais interprété comme du HTML.
- **Aucun secret** dans l'historique Git, **aucune métadonnée GPS** dans les photos.
- Mot de passe stocké uniquement sous forme d'**empreinte SHA-256 salée**.

## Limites qui demeurent (impossibles à fermer totalement sur un site statique)
- **Tricheur patient** : garder un ticket ouvert et annoncer un score proportionnel au temps
  écoulé, ou modifier le jeu dans son propre navigateur. → **Faire rejouer le gagnant devant soi**
  avant de remettre le lot.
- **Usurpation de prénom** : sans comptes utilisateurs, on peut jouer sous le prénom d'un autre.
- **Mot de passe d'accès** : filtre côté navigateur uniquement ; quelqu'un qui lit le code peut le
  contourner. Ne rien mettre de confidentiel sur le site.

## À faire de ton côté (le plus important)
Tout ce qui précède ne protège pas tes **comptes**. Pour que personne ne puisse supprimer le site
ou les scores :

1. **Compte Supabase** : activer la double authentification (2FA), mot de passe fort, ne jamais
   partager ni coller en ligne la clé `service_role` (celle qui peut tout supprimer).
2. **Compte GitHub** : activer la 2FA. Dans *Settings → Branches*, protéger la branche `main`
   (interdire la suppression et le `force-push`). Supprimer un dépôt ou son contenu demande l'accès
   au compte : la 2FA est la vraie protection.
3. **Mot de passe du site** : en choisir un **pas évident** (ni « mariage », ni la date), car la
   seule faiblesse restante est un mot de passe facile à deviner.

## Surveiller le jeu
Repérer les scores douteux, dans Supabase → SQL Editor :

```sql
-- scores sans rejeu (envoyés avant les protections, ou « à la main ») et scores proches du plafond
select id, name, score, elapsed_ms, frames, jumps,
       round(score::numeric / nullif(elapsed_ms,0), 3) as pts_par_ms
from scores
order by score desc
limit 20;
```

Un `pts_par_ms` proche de 0,3, un `replay` vide sur un gros score, ou `jumps` très faible pour un
score élevé méritent un contrôle. Pour **vérifier** un gagnant : copier sa colonne `replay`
(ex. `{"seed":42,"inputs":[10,40,90]}`), ouvrir la console du site (F12) et taper :

```js
MaArcadeVerify(42, [10, 40, 90])
```

Le résultat `{score, frames}` doit correspondre au score enregistré. Sinon, le score est truqué :
le supprimer dans *Table Editor → scores*.

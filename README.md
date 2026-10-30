# Maÿlis & Alexis — site de mariage

Site du mariage de Maÿlis & Alexis, le **30 juillet 2027** dans l'Yonne.

**En ligne :** https://maylisetalexis.com
(accès protégé par un mot de passe, voir plus bas ; l'ancienne adresse GitHub Pages redirige vers le domaine)

## Ce que contient le site

- **Accueil** : photo du domaine, compte à rebours, infos essentielles (quand, où), aperçu des hébergements et de la liste de mariage
- **Le jour J** : déroulé de la journée, cartes Google Maps (église et domaine), liens pour ouvrir Maps, accès en voiture / train / taxi
- **Hébergements** : carte interactive centrée sur le domaine et tableau des logements classés par village
- **Liste de mariage** : lien vers la liste chez Mille Mercis Mariage

Chaque page a son adresse (`#accueil`, `#jourj`, `#hebergements`, `#liste`).

Le site tient dans un seul fichier, sans outil de build ni dépendance : HTML, CSS et JavaScript. Seul le mini-jeu caché (voir plus bas) vit à part, dans `jeu-moteur.js` (règles et score) et `arcade.js` (affichage), chargés uniquement quand on le déclenche.

## Structure

| Fichier / dossier | Rôle                                                           |
|-------------------|------------------------------------------------------------------|
| `index.html`      | Tout le site (structure, styles, scripts)                        |
| `images/`         | Photos (hero desktop et mobile, liste de mariage), image d'aperçu de lien `og.jpg`, icônes |
| `favicon.ico`     | Icône de l'onglet (à la racine, les navigateurs la cherchent là) |
| `CNAME`           | Nom de domaine pour GitHub Pages                                 |
| `jeu-moteur.js`   | Mini-jeu : règles, physique et calcul du score (partagé avec le serveur) |
| `arcade.js`       | Mini-jeu caché « La course vers l’autel » : affichage, son, classement |
| `supabase.sql`    | Script de création du classement du mini-jeu                     |
| `supabase/functions/enregistrer-score/index.ts` | Fonction serveur qui rejoue chaque partie et calcule le score (fichier généré, voir plus bas) |
| `outils/`         | Partie serveur de cette fonction et script qui la génère          |
| `SECURITE.md`     | Bilan de sécurité, et comment surveiller les scores              |
| `INDEX.md`        | Plan détaillé de `index.html` pour retrouver vite ce qu'on veut modifier |

## Le voir en local

Depuis le dossier du projet :

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000. Un simple double-clic sur `index.html` marche aussi, mais les images ne s'affichent pas toujours correctement ainsi.

## Publier une modification

Le site est déployé automatiquement par **GitHub Pages** depuis la branche `main` : il suffit de commiter et de pousser.

```bash
git add -A
git commit -m "Description du changement"
git push origin main
```

La mise en ligne prend en général une à deux minutes. En cas de doute sur ce que l'on voit, faire un rafraîchissement forcé (Cmd+Maj+R).

## Liste des hébergements

La page « Hébergements » affiche un simple tableau (nom, adresse, liens) regroupé par ville (du plus proche au plus éloigné du domaine), construit à partir du tableau `LODGINGS` dans `index.html` (bloc `<script>` juste après la section Hébergements). Pas de suivi de disponibilité automatique : quand un logement est complet, supprimer directement son entrée dans `LODGINGS`. Les distances routières au domaine sont dans le tableau `DIST` (une entrée par village : km, minutes, longitude, latitude) ; la longitude et la latitude servent à placer le village dans la bonne direction sur la carte interactive en haut de la page (domaine au centre, un cercle tous les 5 km, clic sur un village pour voir ses hébergements). Un nouveau village sans entrée dans `DIST` s'affiche en dernier du tableau et n'apparaît pas sur la carte.

## Mot de passe d'accès

Le site s'ouvre sur une page qui demande un mot de passe (espaces et casse ignorés à la saisie).

Le mot de passe n'est pas écrit en clair dans le code, seulement son empreinte SHA-256 (constante `HASH` au début de `index.html`, dans le premier bloc `<script>`). Pour le changer, calculer la nouvelle empreinte :

```bash
printf 'maylis-alexis:NOUVEAUCODE' | shasum -a 256
```

puis remplacer la valeur de `HASH` par le résultat.

**Limite à connaître :** GitHub Pages ne sert que des fichiers statiques et n'exécute aucun code côté serveur. Ce mot de passe est donc un simple filtre dans le navigateur, qui écarte les curieux mais ne protège pas des informations sensibles : quelqu'un qui lit le code de la page peut le contourner. Ne mettez rien de confidentiel sur ce site (adresses privées, numéros personnels, etc.).

## Mini-jeu caché : « La course vers l'autel »

Un jeu d'arcade dans le style 8 bits : les mariés courent vers le domaine, on saute (toucher l'écran, espace ou ↑) par-dessus tracteurs, bottes de paille, vignes et guêpes, en ramassant alliances (+40) et champagne (+200). Un classement partagé désigne le gagnant du lot.

**Les biomes :** le décor change, et la partie devient plus rapide et plus dense, à chaque palier de score. Entrer dans un nouveau biome rapporte 1 000 points.

| Score    | Biome                  | Nouveautés                                                       |
| -------- | ---------------------- | ---------------------------------------------------------------- |
| 0        | Les vignes             | tracteurs, bottes de paille, vignes, guêpes                      |
| 5 000    | Le village et l'église | bancs, cierges, 2CV « jeunes mariés », pigeons en hauteur         |
| 10 000   | Dans l'église          | prie-dieu, bénitiers, statues, bancs, colombes                   |
| 15 000   | Le cocktail au jardin  | haies, mange-debout, pyramides de coupes, ballons                |
| 20 000   | La discothèque         | enceintes, danseurs, platines, boules à facettes (vitesse max)   |

Les paliers, la difficulté de chaque biome et les points se règlent en tête de `jeu-moteur.js` (`BIOME_AT`, `BIOME_VMAX`, `BIOME_ACC`, `BIOME_GAP`, `BIOME_SPREAD`, `DIST_PTS`, `RING_PTS`, `BOTTLE_PTS`, `BIOME_BONUS`). **Après toute modification de `jeu-moteur.js`** : lancer `node outils/generer-fonction.mjs`, recoller `supabase/functions/enregistrer-score/index.ts` dans Supabase (voir « Classement partagé ») et changer `ARCADE_V` dans `index.html`. Sinon le serveur rejoue les parties avec les anciennes règles et refuse ou fausse les scores.

**Comment l'ouvrir** (il faut avoir saisi le mot de passe) :

- cliquer sur les deux petits mariés en bas à droite de la page d'accueil (`images/couple-jeu.png`, sans texte) ;
- 5 appuis rapides sur le « & » du logo en haut (ou du menu sur mobile) ;
- le code Konami au clavier (↑ ↑ ↓ ↓ ← → ← → B A) ;
- ou l'adresse `…/#jeu`, pratique à envoyer dans un message.

**Classement partagé** (déjà branché sur le projet Supabase `pfgkwzgzbtowgqslxlux` ; sans URL ni clé dans `arcade.js`, le jeu fonctionne mais chaque appareil ne voit que ses propres scores). Le navigateur n'envoie **jamais de score** : seulement son ticket de partie, la graine de la partie et les pas où le joueur a sauté. La fonction serveur `enregistrer-score` rejoue la partie avec le même moteur (`jeu-moteur.js`) et enregistre le score qu'elle obtient. Pour tout installer (ou mettre à jour après une modification du jeu) :

1. Créer un projet gratuit sur [supabase.com](https://supabase.com) (déjà fait).
2. **Fonction serveur** : *Edge Functions → Deploy a new function → Via Editor*, la nommer exactement `enregistrer-score`, remplacer tout le code par le contenu de `supabase/functions/enregistrer-score/index.ts`, puis *Deploy*. Dans les réglages de la fonction, **désactiver « Verify JWT »** (la clé publique du site n'est pas un jeton JWT ; la fonction fait ses propres contrôles). Pour une mise à jour, ouvrir la fonction, recoller le code et redéployer.
3. Dans *SQL Editor*, coller le contenu de `supabase.sql` et l'exécuter (rejouable sans risque).
4. Dans *Project Settings → API*, copier l'URL du projet et la clé « anon / publishable », et les coller dans `SUPABASE_URL` et `SUPABASE_KEY`, en tête de `arcade.js`. Cette clé est publique par conception : avec elle, on peut seulement lancer une partie et lire le top 10.

La fonction utilise la clé secrète du projet que Supabase lui fournit d'office (`SUPABASE_SERVICE_ROLE_KEY`). Si l'envoi échoue avec « serveur mal configuré », ajouter dans *Edge Functions → Secrets* un secret `CLE_SECRETE` contenant la clé secrète (`sb_secret_…`) du projet.

**Fin du concours :** `FIN` en tête de `arcade.js` (et la date dans `supabase.sql`, fonctions `start_game` et `record_score`) fixe la date après laquelle les scores ne sont plus enregistrés. Par défaut, le 30 juillet 2027 à minuit.

**Gérer les scores :** dans Supabase, *Table Editor → scores* permet de supprimer une ligne (pseudo déplacé, score douteux). Protections contre la triche :

- Le **score est calculé par le serveur**, en rejouant la partie : impossible d'annoncer un chiffre.
- Chaque partie demande un **ticket** (`start_game`) qui ne sert qu'**une fois** ; le serveur note l'heure de départ et refuse une partie plus longue que le temps réellement écoulé (on ne peut pas « accélérer » une partie).
- Le jeu est **déterministe** (60 pas/s, tirage à graine, calculs identiques dans tous les navigateurs) : chaque score enregistré garde son rejeu (colonne `replay`), qu'on peut rejouer dans la console du site avec `MaArcadeVerify(seed, inputs)`.
- La clé publique n'a **aucun droit direct** sur les tables : ni lire, ni écrire, ni supprimer, ni vider.

**Limite qui demeure :** quelqu'un qui sait programmer peut écrire un robot qui joue à sa place (le moteur est lisible dans le code du site) et attendre en temps réel la durée de sa partie. C'est beaucoup plus difficile que de modifier un chiffre, et ça se voit (score très élevé, partie très longue, voir `SECURITE.md`), mais avant de remettre le lot, **faire rejouer le gagnant devant soi**.

## Aperçu quand on partage le lien

Dans WhatsApp, iMessage ou Messenger, le lien affiche une carte (titre, description, image) grâce aux balises `og:` en tête de `index.html`. L'image est `images/og.jpg` (1200 × 630 px, de préférence sous 300 Ko). Pour la changer, remplacer le fichier : la page ne change pas. Les messageries gardent l'ancienne carte en cache un moment ; pour forcer la mise à jour, ajouter un faux paramètre au lien (`https://maylisetalexis.com/?v=2`).

## Statistiques de visite

Le site compte les pages vues et les clics sur les liens sortants via [GoatCounter](https://www.goatcounter.com), sans cookie. Le nom du compte est dans la constante `GC_CODE`, au début de `index.html` ; vide, plus rien n'est compté.

## Nom de domaine

`maylisetalexis.com` (acheté chez OVH) est branché sur GitHub Pages via le fichier `CNAME` et les enregistrements DNS chez OVH. Pour en changer, modifier `CNAME`, adapter le DNS en suivant la [documentation GitHub Pages](https://docs.github.com/fr/pages/configuring-a-custom-domain-for-your-github-pages-site), vérifier *Settings → Pages → Custom domain*, et mettre à jour `og:url` et `og:image` en tête de `index.html`.

## Ce qu'il reste à compléter

- Les horaires exacts : remplacer les `00h00` floutés (cherchez `00h00` dans `index.html` : accueil, timeline et adresses du jour J ; supprimer aussi la classe `blur`) et vérifier l'heure de la cérémonie dans `TARGET` (compte à rebours)

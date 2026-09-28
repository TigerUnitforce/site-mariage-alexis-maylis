# Index du site — index.html

Site en un seul fichier HTML (~710 lignes) : `index.html`, plus le dossier `images/`.
Cet index sert à retrouver directement la bonne zone sans relire tout le fichier
(les numéros de ligne sont approximatifs : ils bougent dès qu'on édite).

## 1. Ce que je modifie le plus souvent

| Je veux changer...                               | Où                                                                 |
|----------------------------------------------------|----------------------------------------------------------------------|
| Les couleurs du site (palette)                     | [`:root {...}`](index.html:14)                                       |
| Le nom / la date en haut de la page d'accueil      | [`.hero`](index.html:372)                                            |
| La date du compte à rebours                        | [`TARGET`](index.html:634) dans le `<script>` (ISO, fuseau +02:00)   |
| Le texte d'intro (accueil)                         | [`.intro`](index.html:385)                                           |
| Les horaires "Quand" / lieu "Où"                   | [`.two-col`](index.html:390)                                         |
| Les portraits des mariés (texte)                   | [`.portraits`](index.html:420)                                       |
| Le programme détaillé (timeline "Le jour J")       | [`.timeline`](index.html:460)                                        |
| Les cartes Google Maps, adresses, liens Maps       | [`.maps-block`](index.html:501)                                      |
| Les infos d'accès (voiture / train / taxi)         | [`.access-block`](index.html:539)                                    |
| Le lien vers la liste de mariage externe           | `millemercismariage.com` dans la section `liste`                     |
| Les liens du menu (nav du haut + menu mobile)      | [`.topnav`](index.html:345), [`.menu-overlay`](index.html:352)       |

## 2. Structure du fichier

```
8         script      Ajoute la classe "js" à <html> (active les animations au défilement)
12-341    <style>     Tout le CSS
  235       ANIMATIONS    hero, apparition au défilement (.rv), frise, menu mobile
345-369   .topnav + .menu-overlay
371-450   section accueil   PAGE 1 — hero (+ compte à rebours #countdown), intro, Quand/Où,
                            hébergements, portraits, liste, clôture, pied de page
452-557   section jourj     PAGE 2 — timeline, cartes Google Maps (#section-adresses), accès
559-591   section liste     PAGE 3 — liste de mariage (lien externe)
593-708   <script>    Navigation entre les 3 sections, menu mobile, compte à rebours,
                      apparition au défilement (IntersectionObserver)
```

Les 3 "pages" (accueil / jourj / liste) sont 3 `<section data-view="...">` dans le même
fichier ; la fonction `showView` du script affiche la bonne section selon le lien cliqué
(`data-goto`).

## 3. CSS — tokens et blocs réutilisables

Variables définies une seule fois dans `:root` :

- `--ground` / `--sand` : fonds (ivoire / sable rosé, sections `.band`)
- `--ink` : texte principal
- `--disp` : corail clair (titres de section, "disp" = display)
- `--soft` : corail sourd (texte secondaire / paragraphes)
- `--acc` / `--acc-hover` : accent corail vif (liens, boutons)
- `--line` : ligne de séparation translucide

Blocs partagés :

- `.cap, .kicker` — petit texte en majuscules à large espacement (labels de section)
- `.btn` / `.link-u` — bouton plein et lien souligné (le soulignement se dessine au survol)
- `.ph` — placeholder de photo (motif hachuré + légende) tant que les vraies photos manquent
- `.t-desc, .addr-line, .a-detail` — texte descriptif réutilisé dans timeline / adresses / accès

## 4. Animations

- **Hero** : photo qui se pose (zoom léger) puis date, prénoms, compte à rebours et
  légende qui apparaissent l'un après l'autre (`hero-in`, `rise`).
- **Au défilement** : le script ajoute `.rv` aux blocs listés dans la partie
  « apparition au défilement » ; ils se révèlent à l'entrée dans l'écran (décalage via `--d`)
  puis la classe est retirée. Pour animer un nouveau bloc, ajouter son sélecteur avec `mark(...)`.
- **Frise du jour J** : la ligne se dessine et les points apparaissent (`.rv-line`).
- **Menu mobile** : les liens arrivent en cascade.
- Tout est désactivé si le visiteur a activé « réduire les animations » dans son système.

## 5. Cartes et liens Maps

Deux cartes Google Maps intégrées (`<iframe ... output=embed>`, sans clé API) : l'église de
Villeneuve-l'Archevêque et le Domaine de Vauluisant. Chaque carte a trois liens : Google Maps,
Itinéraire, Plans (Apple). Un bouton « Église → Domaine » ouvre l'itinéraire entre les deux.
Des liens « Ouvrir dans Maps » sont aussi dans la timeline et le bloc « Où » de l'accueil.
Pour changer un lieu : remplacer le texte de recherche (`query=`, `destination=`, `q=`) dans
les URLs de ce lieu (chercher `Vauluisant` ou `Assomption`).

## 6. Photos à intégrer

Le site utilise encore des placeholders (`<div class="ph">`) pour : hébergements, portraits,
galerie de la liste de mariage. Le hero utilise déjà `images/hero-desktop.webp` et
`images/hero-mobile.webp`. Pour remplacer un placeholder : remplacer le `<div class="ph">`
par une balise `<img src="images/..." alt="...">` en gardant la classe de dimensionnement.

## 7. Site en ligne

Déployé automatiquement via GitHub Pages depuis la branche `main` :
**https://tigerunitforce.github.io/site-mariage-alexis-maylis/**

Le domaine `maylisetalexis.com` n'est pas encore acheté : pour le brancher plus tard, recréer un
fichier `CNAME` à la racine contenant le domaine, puis configurer le DNS.

## 8. Fichiers du dossier

- `index.html` — le site
- `images/` — photos du hero
- `INDEX.md` — ce fichier
- `ancienne-version-locale/` — ancienne maquette locale, **ignorée par git** (`.gitignore`)

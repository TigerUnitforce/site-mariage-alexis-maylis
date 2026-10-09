# Index du site — index.html

Site en un seul fichier HTML (~1330 lignes) : `index.html`, plus le dossier `images/` et le
mini-jeu `arcade.js`. Cet index sert à retrouver directement la bonne zone sans relire tout le
fichier (les numéros de ligne sont approximatifs : ils bougent dès qu'on édite ; chercher le nom
de la classe ou de la variable).

## 1. Ce que je modifie le plus souvent

| Je veux changer...                                   | Où                                                                  |
|--------------------------------------------------------|-----------------------------------------------------------------------|
| Les couleurs du site (palette)                         | [`:root {...}`](index.html:117)                                       |
| Le mot de passe d'accès                                | [`HASH`](index.html:26), voir le README                               |
| Le titre / la description / l'image d'un lien partagé  | balises `og:` dans le `<head>` (~lignes 9-22), image `images/og.jpg`  |
| Le nom / la date en haut de l'accueil                  | [`.hero`](index.html:597)                                             |
| La date et l'heure du compte à rebours                 | [`TARGET`](index.html:928)                                            |
| Le texte d'intro (accueil)                             | [`.intro`](index.html:615)                                            |
| Les horaires « Quand » / lieu « Où »                   | [`.two-col`](index.html:620)                                          |
| L'encart Hébergements de l'accueil                     | [`#section-hebergements`](index.html:640)                             |
| L'encart Liste de mariage de l'accueil                 | [`.registry-cta`](index.html:650)                                     |
| Le programme détaillé (timeline « Le jour J »)         | [`.timeline`](index.html:678)                                         |
| Les cartes Google Maps, adresses, liens Maps           | [`.maps-block`](index.html:712)                                       |
| Les infos d'accès (voiture / train / taxi)             | [`.access-block`](index.html:750)                                     |
| La page Liste de mariage                               | [`data-view="liste"`](index.html:770)                                 |
| Les hébergements (liste)                               | [`LODGINGS`](index.html:951)                                          |
| Les distances / positions des villages sur la carte    | [`DIST`](index.html:1010)                                             |
| Les liens du menu (barre du haut + menu mobile)        | [`.topnav`](index.html:567), [`.menu-overlay`](index.html:577)        |
| Les horaires `00h00` encore floutés                    | chercher `00h00` (6 endroits)                                         |

## 2. Structure du fichier

```
1-22      <head>      Métadonnées, aperçu de lien (og:), icônes, polices Google Fonts
23-111    <script>    Classe "js", mot de passe (HASH), statistiques GoatCounter (GC_CODE)
116-550   <style>     Tout le CSS, par blocs commentés :
  193       nav
  245       ACCUEIL
  293       LE JOUR J
  332       LISTE
  352       HÉBERGEMENTS
  400       ACCÈS PAR MOT DE PASSE
  430       ANIMATIONS
  468       MOBILE OVERRIDES
554-565   #gate       Écran du mot de passe
567-594   .topnav + .menu-overlay
596-665   section accueil        PAGE 1 : hero, intro, Quand/Où, hébergements, liste, clôture, pied de page
668-767   section jourj          PAGE 2 : timeline, cartes Maps, accès
770-797   section liste          PAGE 3 : liste de mariage
800-818   section hebergements   PAGE 4 : carte interactive + tableau
820-1332  <script>    Navigation (showView), menu mobile, adresses des pages (#...), jeu caché,
                      compte à rebours, LODGINGS / DIST, carte interactive, apparition au défilement
```

Les 4 « pages » (accueil / jourj / hebergements / liste) sont 4 `<section data-view="...">`
dans le même fichier ; `showView` affiche la bonne selon le lien cliqué (`data-goto`) ou
l'adresse (`#jourj`, etc.).

## 3. CSS — tokens et blocs réutilisables

Palette « Chili Pepper » (vert sapin + rouge), variables dans `:root` :

- `--ground` / `--sand` : fonds (ivoire / sable rosé, sections `.band`)
- `--ink`, `--muted`, `--caption` : textes
- `--green` : vert sapin (hero, écran du mot de passe) ; `--on-green`, `--on-green-muted` : texte dessus
- `--disp` / `--acc` / `--acc-hover` : rouge (titres, liens, boutons)
- `--line` / `--brass-light` : laiton (filets, séparateurs)
- `--f` Cormorant Garamond (titres), `--fj` Jost (petits textes en capitales)

Blocs partagés :

- `.cap, .kicker` : petit texte en majuscules à large espacement (labels de section)
- `.btn` / `.link-u` : bouton plein et lien souligné
- `.ph` : image encadrée (photo du domaine, photos de la liste)
- `.blur` : horaire encore inconnu, affiché flouté
- `.t-desc, .addr-line, .a-detail` : textes descriptifs de la timeline, des adresses et de l'accès

## 4. Animations

- **Hero** : la photo se pose (zoom léger), puis date, prénoms, compte à rebours et bouton
  apparaissent l'un après l'autre (`hero-in`, `rise`).
- **Au défilement** : le script ajoute `.rv` aux blocs listés dans la partie « apparition au
  défilement » ; ils se révèlent à l'entrée dans l'écran puis la classe est retirée. Pour animer
  un nouveau bloc, ajouter son sélecteur avec `mark(...)`.
- **Frise du jour J** : la ligne se dessine et les points apparaissent (`.rv-line`).
- **Menu mobile** : les liens arrivent en cascade.
- Tout est désactivé si le visiteur a activé « réduire les animations » dans son système.

## 5. Cartes et liens Maps

Deux cartes Google Maps intégrées (`<iframe ... output=embed>`, sans clé API) : l'église de
Villeneuve-l'Archevêque et le Domaine de Vauluisant. Chaque carte a trois liens : Google Maps,
Itinéraire, Plans (Apple). Un bouton « Église → Domaine » ouvre l'itinéraire entre les deux.
Pour changer un lieu : remplacer le texte de recherche (`query=`, `destination=`, `q=`) dans
les URLs de ce lieu (chercher `Vauluisant` ou `Assomption`).

## 6. Images

| Fichier                           | Usage                                                         |
|-----------------------------------|----------------------------------------------------------------|
| `images/hero-desktop.webp`        | Hero, écrans larges (1280 × 855)                               |
| `images/hero-mobile.webp`         | Hero, écrans ≤ 860 px (800 px de large, ~65 Ko)                |
| `images/domaine.webp`             | Photo de l'encart Hébergements de l'accueil                    |
| `images/liste-*.webp`             | Trois vignettes de la page Liste de mariage                    |
| `images/og.jpg`                   | Aperçu du lien dans WhatsApp, iMessage... (1200 × 630)         |
| `images/apple-touch-icon.png`, `images/icon-192.png`, `favicon.ico` | Icônes (« & » ivoire sur vert) |

## 7. Site en ligne

Déployé automatiquement via GitHub Pages depuis la branche `main`, servi sur
**https://maylisetalexis.com** (domaine OVH, DNS vers GitHub Pages, fichier `CNAME` à la racine).

## 8. Fichiers du dossier

- `index.html` : le site
- `arcade.js` : mini-jeu caché (voir le README)
- `supabase.sql` : création du classement du mini-jeu
- `images/`, `favicon.ico` : visuels et icônes
- `CNAME` : nom de domaine
- `README.md` : mode d'emploi (publier, mot de passe, jeu, statistiques)

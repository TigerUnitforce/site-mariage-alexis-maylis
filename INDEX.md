# Index du site — index.html

Site en un seul fichier HTML (526 lignes) : `index.html`.
Cet index sert à retrouver directement la bonne ligne sans avoir à relire tout le fichier.

## 1. Ce que je modifie le plus souvent

| Je veux changer...                            | Où (ligne)                                                          |
|-------------------------------------------------|------------------------------------------------------------------------|
| Les couleurs du site (palette)                   | [`:root {...}`](index.html:13) lignes 13-24                            |
| Le nom / la date en haut de la page d'accueil    | [`.hero-names`](index.html:305) ligne 305                              |
| Le texte d'intro (accueil)                       | [`.intro`](index.html:319) lignes 319-323                              |
| Les horaires "Quand" / lieu "Où"                 | [`.two-col`](index.html:325) lignes 325-338                            |
| Les portraits des mariés (texte)                 | [`.portraits`](index.html:350) lignes 350-361                          |
| Le programme détaillé (timeline "Le jour J")     | [`.t-grid`](index.html:391) lignes 391-426                             |
| Les adresses (église / domaine) et le parking    | [`.addr-split`](index.html:421) lignes 421-438                         |
| Les infos d'accès (voiture / train / taxi)       | [`.access-grid`](index.html:440) lignes 440-456                        |
| Le lien vers la liste de mariage externe         | [ligne 457](index.html:457) (`millemercismariage.com`)                 |
| Les liens du menu (nav du haut + menu mobile)     | [`.topnav`](index.html:275) lignes 275-280, [`.menu-overlay`](index.html:282) lignes 282-296 |

## 2. Structure du fichier

```
1-271     <style>          Tout le CSS (voir §3 pour le détail)
273-484   <body>
  275-280   .topnav          Menu du haut (desktop) : Le jour J / monogramme / Liste de mariage
  282-296   .menu-overlay    Menu plein écran (mobile, ouvert via le bouton burger)
  301-372   section accueil    PAGE 1 — Accueil
    303-317   .hero              Photo pleine largeur + prénoms + date
    319-323   .intro             Texte d'intro
    325-338   .two-col           "Quand" / "Où" (résumé, renvoie vers la page Jour J)
    340-348   .split             Bloc hébergements (ancre #section-hebergements)
    350-361   .portraits         Portraits Maÿlis / Alexis
    363-369   .registry-cta      Appel à la liste de mariage
    371-374   .closing + footer  Message de clôture + pied de page
  374-450   section jourj      PAGE 2 — Le jour J (hidden par défaut)
    390-427   .timeline          Déroulé horaire (cérémonie → brunch du lendemain)
    421-438   .addr-split        Adresses église / domaine + parking (ancre #section-adresses)
    440-456   .access-block      Voiture / train / taxi
  452-483   section liste      PAGE 3 — Liste de mariage (hidden par défaut, lien externe)
486-524   <script>         Navigation entre les 3 sections + menu mobile (pas de rechargement de page)
```

Les 3 "pages" (accueil / jourj / liste) sont en fait 3 `<section data-view="...">` dans
le même fichier ; le script en bas (fonction `showView`, [ligne 493](index.html:493)) affiche
la bonne section et masque les autres selon le lien cliqué (`data-goto`).

## 3. CSS — tokens et blocs réutilisables

Variables définies une seule fois dans `:root` ([lignes 13-24](index.html:13)) :

- `--ground` / `--sand` : fonds (ivoire / sable rosé, sections `.band`)
- `--ink` : texte principal
- `--disp` : corail clair (titres de section, "disp" = display)
- `--soft` : corail sourd (texte secondaire / paragraphes)
- `--acc` / `--acc-hover` : accent corail vif (liens, boutons)
- `--line` : ligne de séparation translucide

Blocs de style partagés par plusieurs pages (à modifier une seule fois pour que ça
se répercute partout) :

- `.cap, .kicker` — petit texte en majuscules avec espacement large (labels de section)
- `.btn` / `.link-u` — bouton plein et lien souligné, utilisés dans les 3 pages
- `.ph` — placeholder de photo (motif hachuré + légende) tant que les vraies photos
  ne sont pas intégrées
- `.field .title, .split .title` — gros titre corail (38px) réutilisé dans plusieurs blocs
- `.t-desc, .addr-line, .a-detail` — texte descriptif (19px, gris sourd) réutilisé dans
  la timeline et les adresses

## 4. Photos à intégrer

Le site utilise pour l'instant des placeholders (`<div class="ph">`) avec une légende
qui décrit la photo attendue, par exemple :

- Hero accueil ([ligne 304](index.html:304)) : "photo plein cadre — portrait de vous deux"
- Portraits ([lignes 352, 357](index.html:352)) : un portrait de chacun
- Hébergements ([ligne 341](index.html:341)) : photo du domaine ou d'une chambre d'hôtes
- Carte église → domaine ([ligne 422](index.html:422))
- Galerie liste de mariage ([lignes 460-462](index.html:460)) : 3 photos (voyage / maison / libre)

Pour remplacer un placeholder par une vraie photo : remplacer le `<div class="ph">...</div>`
par une balise `<img src="..." alt="...">` en gardant la même classe de dimensionnement
(`.hero`, `.split .ph`, `.portraits .ph`, etc. définissent la hauteur).

## 5. Site en ligne

Déployé automatiquement via GitHub Pages depuis la branche `main` :
**https://tigerunitforce.github.io/site-mariage-alexis-maylis/**

## 6. Fichiers du dossier

- `index.html` — le site (source unique de vérité, ce qui est sur GitHub)
- `INDEX.md` — ce fichier
- `ancienne-version-locale/` — ancienne maquette locale (hortensia/mot de passe),
  gardée en sauvegarde mais **ignorée par git** (`.gitignore`) : elle ne doit plus être
  utilisée ni poussée sur GitHub.

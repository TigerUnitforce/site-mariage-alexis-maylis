# Maÿlis & Alexis — site de mariage

Site du mariage de Maÿlis & Alexis, le **30 juillet 2027** dans l'Yonne.

**En ligne :** https://tigerunitforce.github.io/site-mariage-alexis-maylis/
(accès protégé par un mot de passe, voir plus bas)

## Ce que contient le site

- **Accueil** : photo plein écran, compte à rebours discret, infos essentielles, hébergements, présentation des mariés
- **Le jour J** : déroulé de la journée, cartes Google Maps (église et domaine), liens pour ouvrir Maps, accès en voiture / train / taxi
- **Liste de mariage** : lien vers la liste chez Mille Mercis Mariage

Le tout tient dans un seul fichier, sans outil de build ni dépendance : HTML, CSS et JavaScript.

## Structure

| Fichier / dossier | Rôle                                                           |
|-------------------|------------------------------------------------------------------|
| `index.html`      | Tout le site (structure, styles, scripts)                        |
| `images/`         | Photos du hero (versions desktop et mobile, au format WebP)      |
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

## Mot de passe d'accès

Le site s'ouvre sur une page qui demande un mot de passe. Le code est réduit à ses chiffres à la saisie, donc `JJMMAAAA` et `JJ/MM/AAAA` fonctionnent de la même façon.

Le mot de passe n'est pas écrit en clair dans le code, seulement son empreinte SHA-256 (constante `HASH` au début de `index.html`, dans le premier bloc `<script>`). Pour le changer, calculer la nouvelle empreinte :

```bash
printf 'maylis-alexis:NOUVEAUCODE' | shasum -a 256
```

puis remplacer la valeur de `HASH` par le résultat.

**Limite à connaître :** GitHub Pages ne sert que des fichiers statiques et n'exécute aucun code côté serveur. Ce mot de passe est donc un simple filtre dans le navigateur, qui écarte les curieux mais ne protège pas des informations sensibles : quelqu'un qui lit le code de la page peut le contourner. Ne mettez rien de confidentiel sur ce site (adresses privées, numéros personnels, etc.).

## Brancher un nom de domaine

Pour utiliser un domaine à soi (par exemple `maylisetalexis.com`) :

1. Créer à la racine un fichier `CNAME` contenant uniquement le domaine.
2. Configurer les enregistrements DNS chez le registrar en suivant la [documentation GitHub Pages](https://docs.github.com/fr/pages/configuring-a-custom-domain-for-your-github-pages-site).
3. Vérifier le champ « Custom domain » dans Settings → Pages du dépôt.

## Ce qu'il reste à compléter

- Photos des blocs marqués comme placeholders : hébergements, portraits de Maÿlis et d'Alexis, galerie de la liste de mariage
- Textes des portraits
- Liste des hébergements

// Assemble la fonction Supabase supabase/functions/enregistrer-score/index.ts à partir de
// jeu-moteur.js (le moteur exact du navigateur) et de outils/enregistrer-score.js (la partie serveur).
// À relancer après toute modification de l’un des deux, puis recoller le fichier dans Supabase.
//   node outils/generer-fonction.mjs           réécrit le fichier
//   node outils/generer-fonction.mjs --check   échoue si le fichier n’est pas à jour
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'supabase/functions/enregistrer-score/index.ts');
const content = [
  '// @ts-nocheck',
  '// FICHIER GÉNÉRÉ par outils/generer-fonction.mjs à partir de jeu-moteur.js et outils/enregistrer-score.js.',
  '// Ne pas le modifier à la main : modifier ces deux fichiers puis relancer le script.',
  '',
  readFileSync(join(root, 'jeu-moteur.js'), 'utf8').trimEnd(),
  '',
  readFileSync(join(root, 'outils/enregistrer-score.js'), 'utf8').trimEnd(),
  ''
].join('\n');

if (process.argv.includes('--check')) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== content) {
    console.error('supabase/functions/enregistrer-score/index.ts n’est pas à jour : lancer node outils/generer-fonction.mjs');
    process.exit(1);
  }
  console.log('fonction à jour');
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, content);
  console.log('écrit : ' + out);
}

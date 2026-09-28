// Lit les calendriers iCal des hébergements et écrit disponibilites.json.
//
// Variables d'environnement :
//   ICAL_URLS  (secret GitHub) JSON : { "Nom de l'hébergement": "https://….ics" }
//              ou, pour un hébergement à plusieurs chambres / logements :
//              { "Nom": ["https://…/chambre1.ics", "https://…/chambre2.ics"] }
//              Le nom doit être identique à celui de la page (casse ignorée).
//   NIGHT      nuit à vérifier, au format AAAA-MM-JJ (par défaut : 2027-07-30,
//              c'est-à-dire arrivée le 30, départ le 31).
//
// Statut écrit : "dispo" (aucun calendrier occupé), "complet" (tous occupés),
// "peu" (une partie seulement). Si un calendrier est injoignable, on garde
// l'ancien statut de l'hébergement plutôt que d'écrire une valeur fausse.

import { readFile, writeFile } from 'node:fs/promises';

const OUTPUT = new URL('../disponibilites.json', import.meta.url);
const NIGHT = process.env.NIGHT || '2027-07-30';

function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '');
}

// 20270730 ou 20270730T140000Z -> 2027-07-30
function toIsoDate(value) {
  const m = value.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function nextDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function parseEvents(ics) {
  const events = [];
  let cur = null;
  for (const line of unfold(ics).split(/\r?\n/)) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur && cur.start) events.push(cur);
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i < 0) continue;
      const key = line.slice(0, i).split(';')[0].toUpperCase();
      const value = line.slice(i + 1).trim();
      if (key === 'DTSTART') cur.start = toIsoDate(value);
      else if (key === 'DTEND') cur.end = toIsoDate(value);
      else if (key === 'STATUS') cur.status = value.toUpperCase();
    }
  }
  return events;
}

// DTEND est exclusif : un séjour du 29 au 31 occupe les nuits du 29 et du 30.
export function isBooked(events, night) {
  return events.some((e) =>
    e.status !== 'CANCELLED' && e.start <= night && night < (e.end && e.end > e.start ? e.end : nextDay(e.start)));
}

async function fetchCalendar(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'site-mariage-disponibilites' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('réponse sans calendrier iCal');
  return text;
}

async function main() {
  let config;
  try {
    config = JSON.parse(process.env.ICAL_URLS || '{}');
  } catch {
    console.error('::error::Le secret ICAL_URLS n’est pas un JSON valide.');
    process.exit(1);
  }
  if (!Object.keys(config).length) {
    console.log('Aucun lien iCal configuré (secret ICAL_URLS vide) : rien à faire.');
    return;
  }

  let previous = { statuts: {} };
  try { previous = JSON.parse(await readFile(OUTPUT, 'utf8')); } catch { /* premier passage */ }

  const statuts = {};
  let failures = 0;
  for (const [name, value] of Object.entries(config)) {
    const urls = Array.isArray(value) ? value : [value];
    let booked = 0;
    let failed = false;
    for (const url of urls) {
      try {
        if (isBooked(parseEvents(await fetchCalendar(url)), NIGHT)) booked++;
      } catch (err) {
        failed = true;
        console.log(`::warning::${name} : calendrier injoignable (${err.message}), ancien statut conservé.`);
      }
    }
    if (failed) {
      failures++;
      if (previous.statuts?.[name]) statuts[name] = previous.statuts[name];
      continue;
    }
    statuts[name] = booked === 0 ? 'dispo' : booked === urls.length ? 'complet' : 'peu';
    console.log(`${name} : ${statuts[name]} (${booked}/${urls.length} calendrier(s) occupé(s) la nuit du ${NIGHT})`);
  }

  const same = JSON.stringify(statuts) === JSON.stringify(previous.statuts || {});
  if (same) {
    console.log('Aucun changement.');
  } else {
    await writeFile(OUTPUT, JSON.stringify({ nuit: NIGHT, statuts }, null, 2) + '\n');
    console.log('disponibilites.json mis à jour.');
  }
  if (failures === Object.keys(config).length) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

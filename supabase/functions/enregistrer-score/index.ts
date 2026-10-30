// @ts-nocheck
// FICHIER GÉNÉRÉ par outils/generer-fonction.mjs à partir de jeu-moteur.js et outils/enregistrer-score.js.
// Ne pas le modifier à la main : modifier ces deux fichiers puis relancer le script.

/* Moteur de « La course vers l’autel » : règles, physique et score, sans affichage ni son.
   Le même fichier sert au navigateur (arcade.js) et au serveur, qui rejoue chaque partie pour
   calculer lui-même le score (supabase/functions/enregistrer-score, générée par
   outils/generer-fonction.mjs : la régénérer après toute modification ici).
   Tout est déterministe : à graine et sauts identiques, la partie se déroule exactement pareil
   dans tous les navigateurs et sur le serveur (pas de temps fixe, tirage à graine, sinus maison). */
var MaMoteur = (function () {
  "use strict";

  /* ---------- constantes (coordonnées logiques 480 × 270) ---------- */
  var W = 480;
  var FEET = 232;             // ligne où se tiennent les mariés et les obstacles
  var GRAV = 1800, JUMP_V = 580;
  var V_START = 250;
  /* Points : 1 point tous les ~5,6 px, alliance 40, champagne 200, et un cadeau à l’entrée de chaque nouveau biome. */
  var DIST_PTS = 0.18, RING_PTS = 40, BOTTLE_PTS = 200, BIOME_BONUS = 1000;
  /* Biomes : 0 vignes, 1 village et église, 2 intérieur de l’église, 3 jardin (cocktail), 4 discothèque.
     On passe au suivant dès que le score atteint BIOME_AT ; chacun roule plus vite et resserre les obstacles. */
  var BIOME_AT = [0, 5000, 10000, 15000, 20000];
  var BIOME_VMAX = [520, 570, 600, 630, 660];        // vitesse de croisière
  var BIOME_ACC = [5.5, 6, 6, 6, 6];                 // accélération
  var BIOME_GAP = [0.6, 0.62, 0.6, 0.58, 0.56];      // creux minimal entre deux obstacles (× vitesse)
  var BIOME_SPREAD = [0.45, 0.4, 0.38, 0.36, 0.34];  // creux aléatoire en plus (× vitesse)
  var PX = 64, PW = 52, PH = 48;   // position et taille du couple
  var STEP = 1 / 60;               // un pas de jeu ; la partie avance toujours de 60 pas par seconde
  var JUMP_BUFFER = 0.13;          // un appui juste avant de toucher le sol compte quand même
  var MAX_FRAMES = 60 * 60 * 30;   // au-delà de 30 minutes, la partie n’est pas acceptée

  /* type d’obstacle : taille et zone qui blesse (dx, dy, l, h) ; les dessins sont dans arcade.js */
  var OB = {
    bale:    { w: 32, h: 28, hit: [3, 5, 26, 23] },
    tractor: { w: 60, h: 44, hit: [7, 6, 46, 38] },
    vine:    { w: 24, h: 36, hit: [6, 4, 12, 32] },
    wasp:    { w: 28, h: 20, hit: [4, 4, 20, 12] },
    pew:     { w: 44, h: 24, hit: [3, 3, 38, 21] },
    candle:  { w: 16, h: 52, hit: [3, 2, 10, 50] },
    car:     { w: 72, h: 40, hit: [12, 4, 56, 34] },
    pigeon:  { w: 36, h: 24, hit: [8, 8, 20, 10] },
    dove:    { w: 36, h: 24, hit: [8, 8, 20, 10] },
    statue:  { w: 28, h: 44, hit: [4, 2, 20, 42] },
    prie:    { w: 32, h: 24, hit: [2, 2, 28, 22] },
    font:    { w: 24, h: 32, hit: [2, 2, 20, 30] },
    tower:   { w: 28, h: 44, hit: [3, 2, 22, 42] },
    table:   { w: 32, h: 40, hit: [4, 4, 24, 36] },
    hedge:   { w: 40, h: 28, hit: [3, 4, 34, 24] },
    balloons:{ w: 24, h: 28, hit: [2, 2, 20, 18] },
    speaker: { w: 28, h: 44, hit: [2, 2, 24, 42] },
    dj:      { w: 48, h: 28, hit: [2, 4, 44, 24] },
    dancer:  { w: 28, h: 44, hit: [4, 4, 20, 40] },
    ball:    { w: 24, h: 24, hit: [4, 4, 16, 16] }
  };

  /* tirage pseudo-aléatoire à graine (mulberry32) : opérations entières, identiques partout */
  function makeRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* sinus calculé à la main : Math.sin peut différer d’un navigateur à l’autre au dernier chiffre près,
     ce qui suffirait à faire diverger une partie rejouée ; + − × ÷ sont, eux, identiques partout */
  var PI = 3.141592653589793, TWO_PI = 6.283185307179586, HALF_PI = 1.5707963267948966;
  function dsin(x) {
    x = x - Math.floor(x / TWO_PI + 0.5) * TWO_PI;
    if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x;
    var x2 = x * x;
    return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800))))));
  }

  function newGame(seed) {
    seed = seed >>> 0;
    return { seed: seed, rng: makeRng(seed), frame: 0, dead: false, anim: 0, dist: 0, bonus: 0, speed: V_START,
             py: 0, vy: 0, onGround: true, buffer: 0, obs: [], items: [], nextAt: 520, biome: 0, edge: 0,
             jumps: 0, prevPy: 0, lastDx: 0, ev: { jumped: false, got: [], level: false } };
  }

  function score(s) { return Math.floor(s.dist * DIST_PTS) + s.bonus; }

  function spawnGroup(s) {
    var x = W + 14, r = s.rng(), gw = 0, top = 0, fly = false, n, i;
    function add(kind, ox) {
      var d = OB[kind];
      s.obs.push({ kind: kind, x: ox, y: FEET - d.h, w: d.w, h: d.h, age: 0 });
    }
    function flyer(kind, y, amp, fr) {
      s.obs.push({ kind: kind, x: x, y: y, y0: y, amp: amp, fr: fr || 7, w: OB[kind].w, h: OB[kind].h, age: 0 });
      gw = OB[kind].w; fly = true;
    }
    if (s.biome === 4) {
      /* discothèque : enceintes, danseurs, platines, boules à facettes en vol */
      if (r < 0.14) {
        flyer('ball', FEET - 108 + s.rng() * 8, 10, 5);       // en hauteur : ne pas sauter
      } else if (r < 0.27) {
        flyer('ball', FEET - 56, 6, 5);                             // bas : sauter
      } else if (r < 0.45) {
        n = s.rng() < 0.4 ? 2 : 1;
        for (i = 0; i < n; i++) add('speaker', x + i * 34);
        gw = n * 34 - 6; top = 44;
      } else if (r < 0.62) {
        n = 1 + Math.floor(s.rng() * 3);
        for (i = 0; i < n; i++) add('dancer', x + i * 34);
        gw = n * 34 - 6; top = 44;
      } else if (r < 0.80) {
        add('dj', x); gw = 48; top = 28;
      } else {
        add('dj', x); add('speaker', x + 66);
        gw = 94; top = 44;
      }
    } else if (s.biome === 3) {
      /* jardin : coupes de champagne, mange-debout, haies, ballons qui flottent */
      if (r < 0.14) {
        flyer('balloons', FEET - 108 + s.rng() * 8, 12, 4);   // en hauteur : ne pas sauter
      } else if (r < 0.26) {
        flyer('balloons', FEET - 58, 8, 4);                         // bas : sauter
      } else if (r < 0.46) {
        n = 1 + Math.floor(s.rng() * 3);
        for (i = 0; i < n; i++) add('hedge', x + i * 40);
        gw = n * 40; top = 28;
      } else if (r < 0.64) {
        n = s.rng() < 0.4 ? 2 : 1;
        for (i = 0; i < n; i++) add('table', x + i * 52);
        gw = n * 52 - 20; top = 40;
      } else if (r < 0.82) {
        add('tower', x); gw = 28; top = 44;
      } else {
        add('hedge', x); add('tower', x + 62);
        gw = 90; top = 44;
      }
    } else if (s.biome === 2) {
      /* intérieur de l’église : prie-dieu, bénitiers, statues, bancs, et des colombes */
      if (r < 0.14) {
        flyer('dove', FEET - 104 + s.rng() * 10, 8, 6);       // en hauteur : ne pas sauter
      } else if (r < 0.26) {
        flyer('dove', FEET - 54, 4, 6);                             // bas : sauter
      } else if (r < 0.44) {
        n = 1 + Math.floor(s.rng() * 3);
        for (i = 0; i < n; i++) add('prie', x + i * 32);
        gw = n * 32; top = 24;
      } else if (r < 0.58) {
        n = s.rng() < 0.4 ? 2 : 1;
        for (i = 0; i < n; i++) add('font', x + i * 40);
        gw = n * 40 - 16; top = 32;
      } else if (r < 0.74) {
        add('statue', x); gw = 28; top = 44;
      } else if (r < 0.88) {
        n = 2 + Math.floor(s.rng() * 2);
        for (i = 0; i < n; i++) add('pew', x + i * 44);
        gw = n * 44; top = 24;
      } else {
        add('font', x); add('statue', x + 56);
        gw = 84; top = 44;
      }
    } else if (s.biome === 1) {
      /* village : bancs, cierges, 2CV, et des pigeons en hauteur qu’il faut laisser passer sans sauter */
      if (r < 0.2) {
        flyer('pigeon', FEET - 104 + s.rng() * 10, 6);        // en hauteur : ne pas sauter
      } else if (r < 0.43) {
        n = 1 + Math.floor(s.rng() * 3);
        for (i = 0; i < n; i++) add('pew', x + i * 44);
        gw = n * 44; top = 24;
      } else if (r < 0.62) {
        n = s.rng() < 0.4 ? 2 : 1;
        for (i = 0; i < n; i++) add('candle', x + i * 34);
        gw = n * 34 - 18; top = 52;
      } else if (r < 0.81) {
        add('car', x); gw = 72; top = 40;
      } else {
        add('pew', x); add('candle', x + 66);                       // banc puis cierge : un seul saut suffit, mais bien placé
        gw = 82; top = 52;
      }
    } else if (s.dist > 3000 && r < 0.2) {
      flyer('wasp', FEET - 104 + s.rng() * 12, 6);
    } else if (r < 0.5) {
      n = s.speed > 340 && s.rng() < 0.4 ? 2 : 1;
      for (i = 0; i < n; i++) add('bale', x + i * 32);
      gw = n * 32; top = 28;
    } else if (r < 0.78 || s.dist < 2400) {
      n = 1 + Math.floor(s.rng() * 3);
      for (i = 0; i < n; i++) add('vine', x + i * 24);
      gw = n * 24; top = 36;
    } else {
      add('tractor', x); gw = 60; top = 44;
    }
    if (!fly && s.rng() < 0.65) {               // un bonus au-dessus de l’obstacle
      var bottle = s.rng() < 0.3;
      s.items.push({ kind: bottle ? 'bottle' : 'ring', x: x + gw / 2 - (bottle ? 8 : 11),
                      y: FEET - top - 18 - (bottle ? 34 : 24), w: bottle ? 16 : 22, h: bottle ? 34 : 24, ph: s.rng() * 6 });
    }
    var gap = s.speed * BIOME_GAP[s.biome] + 50 + s.rng() * s.speed * BIOME_SPREAD[s.biome];
    if (gap > 260 && s.rng() < 0.6) {           // une série d’alliances au sol dans le creux
      var c0 = x + gw + gap / 2 - 34;
      for (i = 0; i < 3; i++) s.items.push({ kind: 'ring', x: c0 + i * 34, y: FEET - 40, w: 22, h: 24, ph: i });
    }
    s.nextAt = s.dist + gw + gap;
  }

  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  /* Avance la partie d’un pas. jump : le joueur a appuyé pendant ce pas.
     s.ev indique ce qui vient de se passer (saut, bonus ramassés, nouveau biome) pour le son et l’affichage. */
  function step(s, jump) {
    if (s.dead) return;
    var dt = STEP, ev = s.ev;
    ev.jumped = false; ev.got.length = 0; ev.level = false;
    if (jump) s.buffer = JUMP_BUFFER;

    s.prevPy = s.py; s.anim += dt;
    s.speed = Math.min(BIOME_VMAX[s.biome], s.speed + BIOME_ACC[s.biome] * dt);
    var dx = s.speed * dt;
    s.dist += dx; s.lastDx = dx;

    if (s.onGround && s.buffer > 0) { s.vy = JUMP_V; s.onGround = false; s.buffer = 0; s.jumps++; ev.jumped = true; }
    s.buffer = Math.max(0, s.buffer - dt);
    if (!s.onGround) {
      s.vy -= GRAV * dt; s.py += s.vy * dt;
      if (s.py <= 0) { s.py = 0; s.vy = 0; s.onGround = true; }
    }

    if (s.dist >= s.nextAt) spawnGroup(s);

    var me = { x: PX + 12, y: FEET - s.py - PH + 6, w: 28, h: 40 };
    var i, o, it, hb;
    for (i = s.obs.length - 1; i >= 0; i--) {
      o = s.obs[i]; o.x -= dx; o.age += dt;
      if (o.y0 !== undefined) o.y = o.y0 + dsin(o.age * o.fr) * o.amp;
      if (o.x + o.w < -20) { s.obs.splice(i, 1); continue; }
      hb = OB[o.kind].hit;
      if (overlap(me, { x: o.x + hb[0], y: o.y + hb[1], w: hb[2], h: hb[3] })) { s.dead = true; s.frame++; return; }
    }
    var mine = { x: me.x - 6, y: me.y - 4, w: me.w + 12, h: me.h + 8 };
    for (i = s.items.length - 1; i >= 0; i--) {
      it = s.items[i]; it.x -= dx;
      if (it.x + it.w < -20) { s.items.splice(i, 1); continue; }
      if (overlap(mine, it)) {
        var pts = it.kind === 'bottle' ? BOTTLE_PTS : RING_PTS;
        s.bonus += pts; s.items.splice(i, 1);
        ev.got.push({ kind: it.kind, x: it.x, y: it.y, pts: pts });
      }
    }

    if (s.biome < BIOME_AT.length - 1 && score(s) >= BIOME_AT[s.biome + 1]) {
      s.biome++; s.edge = s.dist; s.bonus += BIOME_BONUS; ev.level = true;
    }
    s.frame++;
  }

  /* Rejoue une partie à partir de sa graine et des pas où le joueur a appuyé (liste croissante).
     Renvoie le score obtenu ; dead = false si la partie dépasse 30 minutes sans se terminer. */
  function replay(seed, inputs) {
    var s = newGame(seed), k = 0, n = inputs.length;
    while (!s.dead && s.frame < MAX_FRAMES) {
      var jump = false;
      if (k < n && inputs[k] === s.frame) { jump = true; k++; }
      step(s, jump);
    }
    return { score: score(s), frames: s.frame, jumps: s.jumps, dead: s.dead };
  }

  return { W: W, FEET: FEET, PX: PX, PW: PW, PH: PH, STEP: STEP, MAX_FRAMES: MAX_FRAMES,
           BIOME_AT: BIOME_AT, BIOME_BONUS: BIOME_BONUS,
           newGame: newGame, step: step, score: score, replay: replay };
})();
if (typeof module === 'object' && module.exports) module.exports = MaMoteur;

/* ---------- partie serveur : rejoue la partie reçue et enregistre le score qu’elle donne ----------
   Le navigateur n’envoie jamais de score : seulement son ticket de partie, la graine que le serveur lui
   a donnée, les pas où le joueur a sauté et la clé (tirée au hasard) de son appareil. Le score est
   recalculé ici avec le moteur ci-dessus, puis enregistré par record_score, fonction SQL que seule la clé
   secrète du serveur peut appeler et qui vérifie le reste (voir supabase.sql). */

const ORIGINS = ['https://maylisetalexis.com', 'https://www.maylisetalexis.com', 'http://localhost:8000'];
const MAX_BODY = 300000;       // octets
const MAX_INPUTS = 20000;      // appuis enregistrés par partie au plus (arcade.js n’en garde pas plus)

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.indexOf(origin) >= 0 ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
    'Vary': 'Origin'
  };
}

function reply(status, body, origin) {
  const h = cors(origin);
  h['Content-Type'] = 'application/json';
  return new Response(JSON.stringify(body), { status: status, headers: h });
}

/* env : { SUPABASE_URL, SECRET_KEY } ; fetchImpl : fetch (remplaçable pour les tests) */
export async function handle(req, env, fetchImpl) {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return reply(405, { error: 'méthode non autorisée' }, origin);

  let body;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return reply(413, { error: 'requête trop grosse' }, origin);
    body = JSON.parse(text);
  } catch (e) {
    return reply(400, { error: 'requête illisible' }, origin);
  }
  if (!body || typeof body !== 'object') return reply(400, { error: 'requête illisible' }, origin);

  const game = body.game, name = body.name, device = body.device, seed = body.seed, inputs = body.inputs;
  if (typeof game !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(game)) {
    return reply(400, { error: 'ticket invalide' }, origin);
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 64) return reply(400, { error: 'prénom invalide' }, origin);
  if (typeof device !== 'string' || !/^[0-9a-f]{32}$/.test(device)) return reply(400, { error: 'appareil inconnu' }, origin);
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) return reply(400, { error: 'graine invalide' }, origin);
  if (!Array.isArray(inputs) || inputs.length > MAX_INPUTS) return reply(400, { error: 'sauts invalides' }, origin);
  for (let i = 0; i < inputs.length; i++) {
    const f = inputs[i];
    if (!Number.isInteger(f) || f < 0 || f >= MaMoteur.MAX_FRAMES || (i > 0 && f <= inputs[i - 1])) {
      return reply(400, { error: 'sauts invalides' }, origin);
    }
  }

  // le score, c’est le serveur qui le calcule
  const r = MaMoteur.replay(seed, inputs);
  if (!r.dead) return reply(400, { error: 'partie trop longue' }, origin);
  if (r.score < 1) return reply(400, { error: 'score nul' }, origin);

  const key = env.SECRET_KEY;
  if (!env.SUPABASE_URL || !key) return reply(500, { error: 'serveur mal configuré' }, origin);
  const h = { 'Content-Type': 'application/json', apikey: key };
  if (/^eyJ/.test(key)) h.Authorization = 'Bearer ' + key;   // ancienne clé service_role (JWT)
  const res = await fetchImpl(env.SUPABASE_URL + '/rest/v1/rpc/record_score', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ p_game: game, p_name: name, p_device: device, p_seed: seed, p_score: r.score,
                           p_frames: r.frames, p_jumps: r.jumps, p_replay: { seed: seed, inputs: inputs } })
  });
  if (!res.ok) {
    let msg = 'enregistrement refusé';
    try { const j = await res.json(); if (j && typeof j.message === 'string') msg = j.message; } catch (e) {}
    return reply(409, { error: msg }, origin);
  }
  let pending = false;   // score sur le podium ou à vérifier : caché jusqu’à validation par les mariés
  try { const j = await res.json(); pending = !!(j && j.en_attente); } catch (e) {}
  return reply(200, { score: r.score, en_attente: pending }, origin);
}

if (typeof Deno !== 'undefined') {
  Deno.serve(function (req) {
    return handle(req, {
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
      // clé secrète du projet, fournie d’office aux fonctions ; CLE_SECRETE si on l’a ajoutée à la main
      SECRET_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('CLE_SECRETE')
    }, fetch);
  });
}

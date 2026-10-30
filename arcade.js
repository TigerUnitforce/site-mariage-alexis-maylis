/* La course vers l’autel — mini-jeu d’arcade caché.
   Chargé à la demande par index.html (voir « jeu caché » dans le dernier <script>), après
   jeu-moteur.js qui contient les règles et le calcul du score ; ce fichier-ci ne fait que
   l’affichage, le son et le classement. Classement partagé via Supabase (voir supabase.sql) ;
   sans réglage ci-dessous, le jeu marche quand même avec un classement local. */
(function () {
  "use strict";
  var M = window.MaMoteur;
  if (!M) return;

  /* ---------- réglages ---------- */
  var SUPABASE_URL = 'https://pfgkwzgzbtowgqslxlux.supabase.co';   // ex. https://abcdefgh.supabase.co
  var SUPABASE_KEY = 'sb_publishable_9VsDjZru7a_d9Bg4aW4CtQ_EtdOGusc';   // clé « anon / publishable » (publique par conception)
  var SCORE_FN = 'clever-action';   // nom de la fonction serveur dans Supabase (Edge Functions) qui contient supabase/functions/enregistrer-score/index.ts
  var FIN = new Date('2027-07-30T00:00:00+02:00').getTime();   // après : plus d’enregistrement de score

  /* ---------- constantes d’affichage (coordonnées logiques 480 × 270) ; règles et points : jeu-moteur.js ---------- */
  var W = M.W, H = 270;
  var HORIZON = 212;          // début de l’herbe
  var FEET = M.FEET;          // ligne où se tiennent les mariés et les obstacles
  var STEP = M.STEP;
  var SIGN = ['', 'ÉGLISE', 'ENTRÉE', 'COCKTAIL', 'DISCO'];
  var TRACK = ['', 'eglise', 'interieur', 'cocktail', 'disco'];
  var BANNER = [null,
    ['ÉGLISE EN VUE !', 'Ça accélère… et attention aux pigeons'],
    ['DANS L’ÉGLISE !', 'Silence… et gare aux colombes'],
    ['COCKTAIL AU JARDIN !', 'Gare aux tables, aux haies et aux ballons'],
    ['SOIRÉE DISCO !', 'Plus vite, plus dense, plus fort']];
  var PX = M.PX, PW = M.PW, PH = M.PH;   // position et taille du couple

  var LS_NAME = 'ma-arcade-nom', LS_BEST = 'ma-arcade-record', LS_LOCAL = 'ma-arcade-scores', LS_SOUND = 'ma-arcade-son';
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var online = !!(SUPABASE_URL && SUPABASE_KEY);

  /* ---------- sprites en pixel art (1 case = 2 px logiques) ---------- */
  function sprite(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    function p(px, py, pw, ph, col) {
      if (col === null) { x.clearRect(px, py, pw, ph); return; }
      x.fillStyle = col; x.fillRect(px, py, pw, ph);
    }
    draw(p);
    return c;
  }
  /* ajoute un contour d’une case autour d’un sprite (le sprite grandit d’une case de chaque côté) */
  function outlined(src, col) {
    var w = src.width + 2, h = src.height + 2, c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.drawImage(src, 1, 1);
    var a = x.getImageData(0, 0, w, h).data;
    function solid(px, py) { return px >= 0 && py >= 0 && px < w && py < h && a[(py * w + px) * 4 + 3] > 0; }
    x.fillStyle = col;
    for (var py = 0; py < h; py++) for (var px = 0; px < w; px++) {
      if (!solid(px, py) && (solid(px - 1, py) || solid(px + 1, py) || solid(px, py - 1) || solid(px, py + 1))) x.fillRect(px, py, 1, 1);
    }
    return c;
  }
  function disc(p, cx, cy, r, col) {
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r * 0.5) p(cx + x, cy + y, 1, 1, col);
    }
  }

  var SK = '#f0c29b', SKD = '#d9a37a', INK = '#1b1a17', GOLD = '#B8964F';

  /* frame 0 / 1 : course, frame 2 : saut */
  function makeCouple(frame) {
    return sprite(26, 24, function (p) {
      var HG = '#3a281d', HB = '#7a4a2b', SU = '#1f2b45', SUD = '#162036', SH = '#f8f3ea',
          TIE = '#9B1B30', DR = '#fbf7ef', DRS = '#e2d6c0';
      var run = frame < 2, a = frame === 0;

      /* le marié */
      p(a ? 1 : 2, 8, 2, 5, SUD);                                   // bras arrière
      if (run) {
        p(3, 15, 2, a ? 8 : 6, SUD); p(3, a ? 23 : 21, 3, 1, INK);
        p(7, 15, 2, a ? 6 : 8, SUD); p(7, a ? 21 : 23, 3, 1, INK);
      } else {
        p(3, 15, 2, 5, SUD); p(3, 20, 3, 1, INK);
        p(7, 15, 2, 4, SUD); p(7, 19, 3, 1, INK);
      }
      p(2, 7, 7, 8, SU);                                            // veste
      p(4, 7, 3, 4, SH);                                            // chemise
      p(3, 7, 1, 3, SUD); p(7, 7, 1, 3, SUD);                       // revers
      p(4, 7, 3, 1, TIE); p(5, 8, 1, 1, TIE);                       // nœud papillon
      p(4, 6, 3, 1, SKD);                                           // cou
      p(3, 3, 5, 3, SK); p(8, 4, 1, 1, SK); p(6, 4, 1, 1, INK);     // visage
      p(2, 0, 6, 3, HG); p(2, 3, 1, 2, HG);                         // cheveux
      p(8, 9, 4, 2, SU); p(12, 9, 2, 2, SK);                        // bras tendu, mains jointes

      /* la mariée */
      var b = 13;
      p(b + 1, 1, 2, 6, 'rgba(255,255,255,.75)');                   // voile
      p(b + 2, 0, 6, 1, 'rgba(255,255,255,.85)');
      p(b + 4, 6, 3, 1, SKD);
      p(b + 3, 3, 5, 3, SK); p(b + 8, 4, 1, 1, SK); p(b + 6, 4, 1, 1, INK);
      p(b + 3, 0, 5, 3, HB); p(b + 2, 1, 2, 4, HB);                 // cheveux
      p(b + 3, 7, 5, 4, DR); p(b + 3, 10, 5, 1, GOLD);              // corsage, ceinture
      p(b + 1, 9, 2, 2, DRS);                                       // bras vers le marié
      var rows = run ? 12 : 10, w, s;
      for (var i = 0; i < rows; i++) {                              // jupe
        w = 7 + Math.floor(i / 3); s = b + 5 - Math.floor((w - 1) / 2);
        p(s, 11 + i, w, 1, i === rows - 1 ? DRS : DR);
        p(s + w - 1, 11 + i, 1, 1, DRS);
      }
      if (run) { p(b + (a ? 4 : 3), 23, 2, 1, INK); p(b + (a ? 7 : 8), 23, 2, 1, INK); }
      else { p(b + 4, 21, 2, 1, INK); p(b + 7, 21, 2, 1, INK); }
      p(b + 8, 8, 2, 2, DRS);                                       // bras + bouquet d’hortensias
      p(b + 9, 5, 4, 4, '#8fa7d8'); p(b + 10, 5, 2, 1, '#d98aa0');
      p(b + 9, 7, 1, 1, '#d98aa0'); p(b + 12, 6, 1, 1, '#d98aa0'); p(b + 10, 9, 2, 2, '#3f7a55');
    });
  }

  var S = {
    couple: [makeCouple(0), makeCouple(1), makeCouple(2)],
    bale: sprite(16, 14, function (p) {
      p(0, 1, 16, 13, '#d9b04a'); p(0, 0, 16, 1, '#ecd27a'); p(0, 13, 16, 1, '#b8913a');
      p(4, 0, 1, 14, '#8a6a2a'); p(11, 0, 1, 14, '#8a6a2a');
      p(2, 4, 2, 1, '#b8913a'); p(7, 6, 3, 1, '#b8913a'); p(13, 3, 2, 1, '#b8913a');
      p(6, 10, 2, 1, '#ecd27a'); p(13, 9, 2, 1, '#b8913a'); p(1, 9, 2, 1, '#ecd27a');
    }),
    tractor: sprite(30, 22, function (p) {
      var G = '#2f6b3a', GD = '#1f4a29', Y = '#e0b82a';
      p(15, 2, 11, 13, G); p(14, 1, 13, 2, GD); p(17, 4, 7, 6, '#bcd6e0');   // cabine
      p(2, 8, 13, 7, G); p(0, 10, 3, 4, GD); p(0, 10, 1, 1, Y);              // capot
      p(5, 3, 1, 5, '#55524B'); p(4, 9, 8, 1, '#4f9a5e');                    // échappement, reflet
      disc(p, 22, 15, 6, INK); disc(p, 22, 15, 3, Y); p(22, 15, 1, 1, INK);  // roue arrière
      disc(p, 6, 18, 3, INK); disc(p, 6, 18, 1, Y);                          // roue avant
    }),
    vine: sprite(12, 18, function (p) {
      p(5, 2, 2, 16, '#8a6a3a');
      p(1, 3, 10, 4, '#3f7a55'); p(0, 5, 4, 3, '#2c5a43'); p(8, 6, 4, 3, '#2c5a43'); p(3, 1, 6, 2, '#4f9a5e');
      p(2, 8, 3, 3, '#6a2c5a'); p(6, 9, 3, 3, '#6a2c5a'); p(4, 11, 3, 3, '#7d3a6e');
    }),
    wasp: [0, 1].map(function (f) {
      return sprite(14, 10, function (p) {
        p(f ? 4 : 5, f ? 2 : 1, f ? 6 : 4, f ? 2 : 3, 'rgba(255,255,255,.85)');   // ailes
        p(1, 4, 3, 3, INK); p(1, 5, 1, 1, '#9B1B30');                              // tête
        p(4, 4, 7, 4, '#e6b422'); p(6, 4, 1, 4, INK); p(9, 4, 1, 4, INK);          // corps
        p(11, 6, 2, 1, INK);                                                       // dard
      });
    }),
    ring: sprite(11, 12, function (p) {
      disc(p, 5, 7, 4, GOLD); disc(p, 5, 7, 2, null); p(3, 4, 1, 1, '#f3e2b0');
      p(5, 0, 1, 1, '#ffffff'); p(4, 1, 3, 2, '#cfe6f5'); p(5, 3, 1, 1, '#9bc4de');
    }),
    pew: sprite(22, 12, function (p) {
      var L = '#8a6240', M = '#6b4a2e', D = '#4a3320';
      p(1, 0, 20, 2, L); p(1, 2, 20, 4, M); p(0, 0, 1, 9, D); p(21, 0, 1, 9, D);   // dossier, accoudoirs
      p(0, 6, 22, 2, L); p(0, 8, 22, 1, D);                                        // assise
      p(2, 9, 2, 3, D); p(18, 9, 2, 3, D);                                         // pieds
      p(8, 3, 6, 1, '#fbf7ef'); p(10, 2, 2, 2, '#8fa7d8'); p(9, 4, 1, 2, '#fbf7ef'); p(12, 4, 1, 2, '#fbf7ef');   // ruban et hortensia
    }),
    candle: sprite(8, 26, function (p) {
      p(3, 0, 2, 3, '#f6c453'); p(4, 1, 1, 1, '#fff6c8');                          // flamme
      p(2, 3, 4, 6, '#f8f3ea'); p(2, 3, 1, 6, '#e2d6c0');                          // cierge
      p(1, 9, 6, 1, GOLD); p(3, 10, 2, 12, '#8a6a2a'); p(2, 14, 4, 2, GOLD);       // coupelle, pied, nœud
      p(1, 22, 6, 2, '#8a6a2a'); p(0, 24, 8, 2, '#6b4a1f');                        // socle
    }),
    car: sprite(36, 20, function (p) {
      var B = '#efe7d2', BD = '#cfc6ac', GL = '#bcd6e0';
      p(10, 1, 15, 1, B); p(8, 2, 19, 7, B); p(6, 9, 30, 7, B); p(6, 15, 30, 1, BD);   // carrosserie
      p(10, 3, 6, 5, GL); p(18, 3, 6, 5, GL); p(17, 2, 1, 7, BD);                       // vitres
      p(33, 9, 3, 3, '#f6e27a'); p(5, 16, 31, 1, '#b9b9b9');                            // phare, pare-chocs
      p(20, 11, 3, 2, '#9B1B30'); p(19, 12, 5, 1, '#9B1B30'); p(21, 13, 1, 1, '#9B1B30');   // cœur « jeunes mariés »
      p(4, 15, 1, 1, INK); p(1, 16, 2, 2, '#c9c9c9'); p(3, 18, 2, 2, '#c9c9c9');         // boîtes de conserve
      disc(p, 12, 17, 3, INK); disc(p, 12, 17, 1, '#b9b9b9');
      disc(p, 29, 17, 3, INK); disc(p, 29, 17, 1, '#b9b9b9');
    }),
    pigeon: [0, 1].map(function (f) {
      return outlined(sprite(16, 10, function (p) {
        p(3, 4, 8, 4, '#5d6472'); p(4, 6, 6, 2, '#aab1be');                        // corps
        p(0, 3, 4, 3, '#434a57'); p(3, 4, 2, 1, '#6fae9a'); p(1, 4, 1, 1, '#ffffff'); p(0, 5, 1, 1, '#f0a830');   // tête, cou irisé, œil, bec
        p(11, 5, 4, 2, '#434a57');                                                 // queue
        if (f) p(5, 7, 5, 3, '#8d95a4'); else { p(5, 0, 5, 4, '#8d95a4'); p(6, 0, 3, 1, '#d6dbe4'); }   // aile
      }), '#241f2c');
    }),
    statue: sprite(14, 22, function (p) {
      p(1, 16, 12, 6, '#cfc3ad'); p(0, 20, 14, 2, '#b3a58c'); p(1, 16, 12, 1, '#e8e0cf');       // socle
      p(4, 6, 6, 10, '#e8e0cf'); p(4, 6, 1, 10, '#cfc3ad'); p(9, 6, 1, 10, '#cfc3ad');          // robe
      p(5, 2, 4, 4, '#efe7d6'); p(4, 1, 6, 1, GOLD);                                          // tête, auréole
      p(6, 9, 2, 2, '#efe7d6'); p(5, 12, 4, 1, '#cfc3ad');                                    // mains jointes, ceinture
    }),
    prie: sprite(16, 12, function (p) {                                                       // prie-dieu
      p(2, 0, 12, 6, '#8a6240'); p(2, 0, 12, 1, '#a87c52'); p(3, 1, 1, 5, '#6b4a2e'); p(12, 1, 1, 5, '#6b4a2e');
      p(0, 6, 16, 3, '#9B1B30'); p(0, 6, 16, 1, '#c24a5e'); p(0, 8, 16, 1, GOLD);
      p(1, 9, 14, 1, '#4a3320'); p(2, 10, 2, 2, '#4a3320'); p(12, 10, 2, 2, '#4a3320');
    }),
    font: sprite(12, 16, function (p) {                                                       // bénitier
      p(0, 0, 12, 4, '#cfc3ad'); p(0, 0, 12, 1, '#e8e0cf'); p(2, 1, 8, 1, '#8fa7d8');
      p(4, 4, 4, 8, '#b3a58c'); p(3, 12, 6, 1, '#cfc3ad'); p(2, 13, 8, 3, '#cfc3ad'); p(2, 15, 8, 1, '#b3a58c');
    }),
    dove: [0, 1].map(function (f) {
      return outlined(sprite(16, 10, function (p) {
        p(3, 4, 8, 4, '#fbf7ef'); p(4, 6, 6, 2, '#e2d6c0');
        p(0, 3, 4, 3, '#fbf7ef'); p(1, 4, 1, 1, INK); p(0, 5, 1, 1, '#e6a23a');
        p(11, 5, 4, 2, '#e2d6c0');
        if (f) p(5, 7, 5, 3, '#fbf7ef'); else { p(5, 0, 5, 4, '#fbf7ef'); p(6, 0, 3, 1, '#cfe6f5'); }
      }), '#5a4a52');
    }),
    tower: sprite(14, 22, function (p) {                                                      // pyramide de coupes
      var GL = '#dcebf5', CH = '#f2d27a', CL = '#fbf7ef', CD = '#e2d6c0';
      p(4, 0, 6, 1, GL); p(5, 1, 4, 2, CH); p(6, 3, 2, 1, GL);
      p(2, 4, 10, 1, GL); p(3, 5, 8, 2, CH); p(6, 7, 2, 1, GL);
      p(0, 8, 14, 1, GL); p(1, 9, 12, 2, CH); p(6, 11, 2, 1, GL);
      p(1, 12, 12, 10, CL); p(1, 12, 12, 1, CD); p(4, 14, 1, 8, CD); p(9, 14, 1, 8, CD);       // nappe
    }),
    table: sprite(16, 20, function (p) {                                                      // mange-debout
      p(0, 3, 16, 2, '#f8f3ea'); p(0, 5, 16, 1, '#d9d3c3');
      p(7, 6, 2, 11, '#9a9a9a'); p(3, 17, 10, 2, '#7a7a7a');
      p(3, 0, 2, 3, '#dcebf5'); p(3, 0, 2, 1, '#f2d27a'); p(11, 0, 2, 3, '#dcebf5'); p(11, 0, 2, 1, '#f2d27a');
    }),
    hedge: sprite(20, 14, function (p) {
      p(0, 2, 20, 12, '#1f4a29'); p(1, 0, 18, 2, '#2f6b3a'); p(0, 2, 20, 1, '#2f6b3a');
      p(3, 5, 3, 1, '#2f6b3a'); p(11, 7, 4, 1, '#2f6b3a'); p(6, 10, 3, 1, '#2f6b3a'); p(15, 11, 3, 1, '#2f6b3a');
      p(2, 8, 1, 1, '#d98aa0'); p(8, 4, 1, 1, '#f8f3ea'); p(13, 5, 1, 1, '#d98aa0'); p(17, 9, 1, 1, '#f8f3ea'); p(9, 12, 1, 1, '#d98aa0');
    }),
    balloons: sprite(12, 14, function (p) {
      disc(p, 3, 4, 3, '#d98aa0'); disc(p, 8, 3, 3, '#8fa7d8'); disc(p, 6, 7, 3, '#f6d38a');
      p(2, 3, 1, 1, '#ffffff'); p(7, 2, 1, 1, '#ffffff'); p(5, 6, 1, 1, '#ffffff');
      p(5, 10, 1, 4, '#8a8a8a');
    }),
    speaker: sprite(14, 22, function (p) {
      p(0, 0, 14, 22, '#2a2a38'); p(0, 0, 14, 1, '#6a6a86'); p(0, 0, 1, 22, '#4a4a60'); p(13, 0, 1, 22, '#15151f');
      disc(p, 7, 5, 2, '#8fe9ff'); disc(p, 7, 5, 1, '#15151f');
      disc(p, 7, 15, 5, '#15151f'); disc(p, 7, 15, 3, '#3b3b50'); disc(p, 7, 15, 1, '#ff2fa3');
    }),
    dj: sprite(24, 14, function (p) {
      disc(p, 6, 3, 3, INK); disc(p, 6, 3, 1, '#ff2fa3'); disc(p, 18, 3, 3, INK); disc(p, 18, 3, 1, '#2fd9ff');
      p(0, 6, 24, 8, '#2a2a38'); p(0, 6, 24, 1, '#6a6a86');
      p(2, 8, 20, 4, '#15151f');
      p(4, 9, 2, 2, '#ff2fa3'); p(8, 9, 2, 2, '#2fd9ff'); p(12, 9, 2, 2, '#ffd22f'); p(16, 9, 2, 2, '#7a2cff'); p(20, 9, 1, 2, '#ff2fa3');
    }),
    dancer: sprite(14, 22, function (p) {                                                     // pose « fièvre du samedi soir »
      var W2 = '#f8f3ea', W2D = '#d9d3c3';
      p(11, 1, 2, 5, W2); p(12, 0, 2, 2, SK); p(9, 6, 2, 2, W2);
      p(4, 6, 6, 8, W2); p(4, 6, 1, 8, W2D); p(5, 6, 4, 2, '#9B1B30');
      p(4, 14, 2, 7, W2); p(8, 14, 2, 7, W2D); p(3, 21, 3, 1, INK); p(8, 21, 3, 1, INK);
      p(5, 3, 4, 4, SK); p(6, 5, 1, 1, INK);
      p(3, 0, 8, 3, '#3a281d'); p(2, 1, 1, 3, '#3a281d'); p(11, 1, 1, 2, '#3a281d');
      p(5, 8, 4, 1, GOLD);
    }),
    ball: sprite(12, 12, function (p) {                                                       // boule à facettes
      for (var y = -5; y <= 5; y++) for (var x = -5; x <= 5; x++) {
        if (x * x + y * y <= 27) p(6 + x, 6 + y, 1, 1, ((x + y) & 1) ? '#e8eef7' : '#8f9fba');
      }
      p(3, 3, 1, 1, '#ffffff'); p(8, 7, 1, 1, '#ffffff');
    }),
    bottle: sprite(8, 17, function (p) {
      p(3, 0, 2, 2, '#e8e0cf'); p(2, 2, 4, 4, '#D9B98A');
      p(2, 5, 4, 1, '#1d3a2a'); p(1, 6, 6, 11, '#1d3a2a'); p(3, 9, 3, 4, '#f8f3ea'); p(2, 7, 1, 8, '#2f5a42');
    })
  };

  /* dessin de chaque type d’obstacle (tailles et zones qui blessent : jeu-moteur.js) */
  var OB_IMG = {
    bale:    function () { return S.bale; },
    tractor: function () { return S.tractor; },
    vine:    function () { return S.vine; },
    wasp:    function (o) { return S.wasp[Math.floor(o.age * 18) & 1]; },
    pew:     function () { return S.pew; },
    candle:  function () { return S.candle; },
    car:     function () { return S.car; },
    pigeon:  function (o) { return S.pigeon[Math.floor(o.age * 12) & 1]; },
    dove:    function (o) { return S.dove[Math.floor(o.age * 9) & 1]; },
    statue:  function () { return S.statue; },
    prie:    function () { return S.prie; },
    font:    function () { return S.font; },
    tower:   function () { return S.tower; },
    table:   function () { return S.table; },
    hedge:   function () { return S.hedge; },
    balloons:function () { return S.balloons; },
    speaker: function () { return S.speaker; },
    dj:      function () { return S.dj; },
    dancer:  function () { return S.dancer; },
    ball:    function () { return S.ball; }
  };

  /* ---------- décor ---------- */
  function hash(i) { var s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); }

  function hillY(wx, base, a1, f1, a2, f2) { return base + Math.sin(wx * f1) * a1 + Math.sin(wx * f2 + 1.7) * a2; }

  function drawHill(ctx, off, base, a1, f1, a2, f2, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var x = 0; x <= W + 8; x += 8) ctx.lineTo(x, hillY(x + off, base, a1, f1, a2, f2));
    ctx.lineTo(W + 8, H); ctx.closePath(); ctx.fill();
  }

  function drawChateau(ctx, x, y) {
    ctx.fillStyle = '#8fa58f';
    ctx.fillRect(x - 24, y - 16, 48, 18);
    [-30, 22].forEach(function (dx) {
      ctx.fillRect(x + dx, y - 30, 10, 32);
      ctx.beginPath(); ctx.moveTo(x + dx - 2, y - 30); ctx.lineTo(x + dx + 5, y - 44); ctx.lineTo(x + dx + 12, y - 30); ctx.fill();
    });
    ctx.beginPath(); ctx.moveTo(x - 10, y - 16); ctx.lineTo(x, y - 30); ctx.lineTo(x + 10, y - 16); ctx.fill();
  }

  function drawVineyard(ctx, dist, t) {
    var g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#e6e0d0'); g.addColorStop(1, '#f6dfcf');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(246,211,138,.35)'; ctx.beginPath(); ctx.arc(372, 78, 40, 0, 7); ctx.fill();
    ctx.fillStyle = '#f6d38a'; ctx.beginPath(); ctx.arc(372, 78, 27, 0, 7); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (var c = 0; c < 4; c++) {
      var cx = ((hash(c + 3) * 700 - t * (4 + c * 2) - dist * 0.03) % 600 + 600) % 600 - 60;
      var cy = 24 + hash(c + 9) * 60;
      ctx.fillRect(cx, cy, 44, 8); ctx.fillRect(cx + 8, cy - 6, 26, 8); ctx.fillRect(cx + 16, cy + 8, 22, 4);
    }

    var of = dist * 0.1, om = dist * 0.3;
    drawHill(ctx, of, HORIZON - 70, 14, 0.011, 8, 0.027, '#b4c8b0');
    var P = 1500, sx = P * 0.5 - (of % P);                         // le domaine, à l’horizon
    for (var k = 0; k < 2; k++) {
      var x = sx + k * P;
      if (x > -60 && x < W + 60) drawChateau(ctx, x, hillY(x + of, HORIZON - 70, 14, 0.011, 8, 0.027) + 6);
    }
    drawHill(ctx, om, HORIZON - 38, 12, 0.017, 6, 0.041, '#7ba484');

    var ot = dist * 0.6, i0 = Math.floor(ot / 90) - 1;             // peupliers
    ctx.fillStyle = '#2c5a43';
    for (var i = i0; i < i0 + 8; i++) {
      var px = i * 90 + hash(i) * 40 - ot, th = 54 + hash(i + 40) * 34;
      ctx.beginPath(); ctx.ellipse(px, HORIZON - th / 2 + 2, 7, th / 2, 0, 0, 7); ctx.fill();
    }
    drawHill(ctx, dist * 0.8, HORIZON - 10, 4, 0.03, 3, 0.07, '#3f7a55');

    ctx.fillStyle = '#3f7a55'; ctx.fillRect(0, HORIZON, W, 14);    // verge
    ctx.fillStyle = '#2c5a43'; ctx.fillRect(0, HORIZON, W, 2);
    var fo = dist % 64;
    for (var f = -1; f < 9; f++) {                                 // hortensias en bord de chemin
      var fx = f * 64 - fo + 20;
      ctx.fillStyle = (f + Math.floor(dist / 64)) % 2 ? '#8fa7d8' : '#d98aa0';
      ctx.fillRect(fx, HORIZON + 5, 6, 5); ctx.fillRect(fx + 1, HORIZON + 3, 4, 2);
    }
    ctx.fillStyle = '#D9B98A'; ctx.fillRect(0, HORIZON + 14, W, H - HORIZON - 14);   // chemin
    ctx.fillStyle = '#c9a56f';
    var po = dist % 56;
    for (var d = -1; d < 10; d++) {
      ctx.fillRect(d * 56 - po, HORIZON + 40, 22, 3);
      ctx.fillRect(d * 56 - po + 28, HORIZON + 26, 14, 2);
    }
  }

  /* ---------- biome 2 : le village et son église (à partir de BIOME_AT points) ---------- */
  function drawChurch(ctx, x, y) {                                 // x : milieu de la nef, y : pied du mur
    ctx.fillStyle = '#d9c8b3'; ctx.fillRect(x - 46, y - 40, 62, 40);                 // nef
    ctx.fillStyle = '#a8573f';
    ctx.beginPath(); ctx.moveTo(x - 51, y - 40); ctx.lineTo(x - 15, y - 62); ctx.lineTo(x + 21, y - 40); ctx.fill();
    ctx.fillStyle = '#cdbba5'; ctx.fillRect(x + 16, y - 78, 24, 78);                 // clocher
    ctx.fillStyle = '#a8573f';
    ctx.beginPath(); ctx.moveTo(x + 13, y - 78); ctx.lineTo(x + 28, y - 112); ctx.lineTo(x + 43, y - 78); ctx.fill();
    ctx.fillStyle = '#4a3a3d';
    ctx.fillRect(x + 23, y - 70, 10, 14); ctx.beginPath(); ctx.arc(x + 28, y - 70, 5, Math.PI, 0); ctx.fill();   // baie des cloches
    ctx.fillStyle = GOLD; ctx.fillRect(x + 27, y - 124, 2, 13); ctx.fillRect(x + 24, y - 121, 8, 2);            // croix
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 21, y - 22, 15, 22);                // porte
    ctx.beginPath(); ctx.arc(x - 13.5, y - 22, 7.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#8fa7d8'; ctx.beginPath(); ctx.arc(x - 13.5, y - 36, 4.5, 0, 7); ctx.fill();               // rosace
    ctx.fillStyle = '#4a3a3d';
    [-40, 2].forEach(function (dx) { ctx.fillRect(x + dx, y - 30, 5, 12); ctx.beginPath(); ctx.arc(x + dx + 2.5, y - 30, 2.5, Math.PI, 0); ctx.fill(); });
  }

  function drawVillage(ctx, dist, t) {
    var g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#d8c2cc'); g.addColorStop(0.55, '#f4cdb4'); g.addColorStop(1, '#f7b98f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,226,170,.4)'; ctx.beginPath(); ctx.arc(150, 168, 52, 0, 7); ctx.fill();
    ctx.fillStyle = '#fde3a1'; ctx.beginPath(); ctx.arc(150, 168, 30, 0, 7); ctx.fill();         // soleil couchant

    ctx.fillStyle = 'rgba(255,236,230,.7)';
    for (var c = 0; c < 4; c++) {
      var cx = ((hash(c + 13) * 700 - t * (4 + c * 2) - dist * 0.03) % 600 + 600) % 600 - 60;
      var cy = 22 + hash(c + 19) * 56;
      ctx.fillRect(cx, cy, 44, 8); ctx.fillRect(cx + 8, cy - 6, 26, 8); ctx.fillRect(cx + 16, cy + 8, 22, 4);
    }

    var of = dist * 0.1, om = dist * 0.3;
    drawHill(ctx, of, HORIZON - 64, 12, 0.012, 7, 0.029, '#c9b0b8');
    drawHill(ctx, om, HORIZON - 36, 11, 0.017, 6, 0.043, '#a58f9a');

    var P = 900, sx = P * 0.5 - (om % P);                          // l’église, en plan intermédiaire
    for (var k = 0; k < 2; k++) {
      var x = sx + k * P;
      if (x > -90 && x < W + 90) drawChurch(ctx, x, HORIZON - 14);
    }

    var oh = dist * 0.45, h0 = Math.floor(oh / 78) - 1;            // maisons du village
    for (var h = h0; h < h0 + 9; h++) {
      var hx = h * 78 + hash(h + 70) * 26 - oh, hw = 30 + hash(h + 71) * 14, hh = 16 + hash(h + 72) * 8;
      ctx.fillStyle = hash(h + 73) < 0.5 ? '#ecdcc6' : '#e3c9ae'; ctx.fillRect(hx, HORIZON - 14 - hh, hw, hh);
      ctx.fillStyle = '#b8604a';
      ctx.beginPath(); ctx.moveTo(hx - 3, HORIZON - 14 - hh); ctx.lineTo(hx + hw / 2, HORIZON - 14 - hh - 12); ctx.lineTo(hx + hw + 3, HORIZON - 14 - hh); ctx.fill();
      ctx.fillStyle = '#6b4a2e'; ctx.fillRect(hx + 5, HORIZON - 14 - 9, 5, 9); ctx.fillRect(hx + hw - 11, HORIZON - 14 - hh + 5, 5, 6);
    }

    var ot = dist * 0.6, i0 = Math.floor(ot / 96) - 1;             // cyprès
    ctx.fillStyle = '#34503f';
    for (var i = i0; i < i0 + 8; i++) {
      var px = i * 96 + hash(i + 5) * 40 - ot, th = 58 + hash(i + 45) * 36;
      ctx.beginPath(); ctx.ellipse(px, HORIZON - th / 2 + 2, 5, th / 2, 0, 0, 7); ctx.fill();
    }

    ctx.fillStyle = '#b5a58f'; ctx.fillRect(0, HORIZON - 4, W, 18);                          // muret en pierre
    ctx.fillStyle = '#d8c9b2'; ctx.fillRect(0, HORIZON - 4, W, 3);
    ctx.fillStyle = '#9c8c76';
    var wo = dist % 36;
    for (var w = -1; w < 15; w++) { ctx.fillRect(w * 36 - wo, HORIZON - 1, 1, 7); ctx.fillRect(w * 36 - wo + 18, HORIZON + 6, 1, 8); }
    ctx.fillRect(0, HORIZON + 6, W, 1);
    var lo = dist % 160;
    for (var l = -1; l < 4; l++) {                                 // lampadaires
      var lx = l * 160 - lo + 70;
      ctx.fillStyle = '#3a3438'; ctx.fillRect(lx, HORIZON - 32, 2, 30); ctx.fillRect(lx - 3, HORIZON - 38, 8, 6);
      ctx.fillStyle = 'rgba(246,211,138,.35)'; ctx.beginPath(); ctx.arc(lx + 1, HORIZON - 35, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#f6d38a'; ctx.fillRect(lx - 1, HORIZON - 37, 4, 4);
    }

    ctx.fillStyle = '#cbbba3'; ctx.fillRect(0, HORIZON + 14, W, H - HORIZON - 14);            // pavés
    ctx.fillStyle = '#b3a38b';
    var co = dist % 28;
    [26, 40].forEach(function (dy, row) {
      ctx.fillRect(0, HORIZON + dy, W, 1);
      for (var q = -1; q < 18; q++) ctx.fillRect(q * 28 - co + (row ? 14 : 0), HORIZON + dy, 1, 13);
    });

    for (var f = 0; f < 22; f++) {                                 // confettis
      var fx = ((hash(f + 90) * W - dist * 0.35 - t * 8) % W + W) % W;
      var fy = (hash(f + 120) * 260 + t * (26 + hash(f) * 26)) % 250;
      ctx.fillStyle = ['#d98aa0', '#8fa7d8', '#f6d38a', '#ffffff'][f & 3];
      ctx.fillRect(fx, fy, 3, 2);
    }
  }

  /* ---------- biome 3 : l’intérieur de l’église ---------- */
  function drawNave(ctx, dist, t) {
    var g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#5a4a52'); g.addColorStop(0.45, '#bfae9c'); g.addColorStop(1, '#e0d2bd');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var ow = dist * 0.2, wsp = 130, w0 = Math.floor(ow / wsp) - 1;      // vitraux et arcs
    for (var m = w0; m < w0 + 5; m++) {
      var wx = m * wsp - ow + 65, pal = m & 1 ? ['#3f63b8', '#9B1B30', '#e0b82a'] : ['#9B1B30', '#2f6b3a', '#3f63b8'];
      ctx.fillStyle = '#3a2f33'; ctx.fillRect(wx - 19, 40, 38, 118);
      ctx.beginPath(); ctx.arc(wx, 40, 19, Math.PI, 0); ctx.fill();
      for (var r = 0; r < 7; r++) for (var q = 0; q < 3; q++) {
        ctx.fillStyle = pal[(r + q + m + 9) % 3]; ctx.fillRect(wx - 16 + q * 11, 44 + r * 15, 10, 14);
      }
      ctx.fillStyle = pal[0]; ctx.beginPath(); ctx.arc(wx, 40, 16, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#f6d38a'; ctx.fillRect(wx - 1, 24, 2, 120);          // meneau
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';                    // faisceaux colorés
    for (var b = w0; b < w0 + 5; b++) {
      var bx = b * wsp - ow + 65, cols = ['rgba(120,150,255,.16)', 'rgba(255,90,110,.14)', 'rgba(255,220,100,.16)'];
      ctx.fillStyle = cols[((b % 3) + 3) % 3];
      ctx.beginPath(); ctx.moveTo(bx - 18, 100); ctx.lineTo(bx + 18, 100); ctx.lineTo(bx + 90, HORIZON + 20); ctx.lineTo(bx + 30, HORIZON + 20); ctx.fill();
    }
    ctx.restore();

    var om = dist * 0.3, P = 820, sx = P * 0.5 - (om % P);                   // l’autel, au fond
    for (var k = 0; k < 2; k++) {
      var ax = sx + k * P;
      if (ax < -60 || ax > W + 60) continue;
      ctx.fillStyle = '#cfc3ad'; ctx.fillRect(ax - 38, HORIZON - 10, 76, 10); ctx.fillRect(ax - 30, HORIZON - 20, 60, 10);
      ctx.fillStyle = '#fbf7ef'; ctx.fillRect(ax - 24, HORIZON - 42, 48, 22);
      ctx.fillStyle = GOLD; ctx.fillRect(ax - 24, HORIZON - 42, 48, 2); ctx.fillRect(ax - 2, HORIZON - 88, 4, 46); ctx.fillRect(ax - 11, HORIZON - 76, 22, 4);
      [-20, 16].forEach(function (dx) {
        ctx.fillStyle = '#f8f3ea'; ctx.fillRect(ax + dx, HORIZON - 56, 4, 14);
        ctx.fillStyle = '#f6c453'; ctx.fillRect(ax + dx, HORIZON - 60, 4, 4);
      });
    }

    var op = dist * 0.55, i0 = Math.floor(op / 140) - 1;                     // piliers
    for (var i = i0; i < i0 + 5; i++) {
      var px = i * 140 + 20 - op;
      ctx.fillStyle = '#b8a88f'; ctx.fillRect(px - 9, 0, 18, HORIZON + 4);
      ctx.fillStyle = '#d9cbb3'; ctx.fillRect(px - 9, 0, 5, HORIZON + 4);
      ctx.fillStyle = '#9a8a72'; ctx.fillRect(px + 6, 0, 3, HORIZON + 4);
      ctx.fillStyle = '#cfc3ad'; ctx.fillRect(px - 12, 0, 24, 8); ctx.fillRect(px - 13, HORIZON - 6, 26, 10);
    }

    ctx.fillStyle = '#c9b79b'; ctx.fillRect(0, HORIZON + 4, W, 10);          // dalles
    ctx.fillStyle = '#a3243a'; ctx.fillRect(0, HORIZON + 14, W, H - HORIZON - 14);   // tapis rouge
    ctx.fillStyle = '#d9b98a'; ctx.fillRect(0, HORIZON + 16, W, 2); ctx.fillRect(0, H - 4, W, 2);
    ctx.fillStyle = '#7d1a2c';
    var co = dist % 64;
    for (var d = -1; d < 9; d++) {
      var dx2 = d * 64 - co + 32, dy = HORIZON + 38;
      ctx.beginPath(); ctx.moveTo(dx2, dy - 8); ctx.lineTo(dx2 + 10, dy); ctx.lineTo(dx2, dy + 8); ctx.lineTo(dx2 - 10, dy); ctx.fill();
    }

    for (var f = 0; f < 16; f++) {                                           // pétales
      var fx = ((hash(f + 400) * W - dist * 0.3 - t * 10) % W + W) % W;
      var fy = (hash(f + 430) * 260 + t * (20 + hash(f + 9) * 20)) % 250;
      ctx.fillStyle = f & 1 ? '#f4c6d0' : '#fbf7ef';
      ctx.fillRect(fx, fy, 3, 2);
    }
  }

  /* ---------- biome 4 : le jardin et son cocktail ---------- */
  function drawGarden(ctx, dist, t) {
    var g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#c4e1ee'); g.addColorStop(1, '#f7f0d8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,241,184,.45)'; ctx.beginPath(); ctx.arc(96, 62, 38, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff1b8'; ctx.beginPath(); ctx.arc(96, 62, 25, 0, 7); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (var c = 0; c < 4; c++) {
      var cx = ((hash(c + 23) * 700 - t * (4 + c * 2) - dist * 0.03) % 600 + 600) % 600 - 60;
      var cy = 20 + hash(c + 29) * 56;
      ctx.fillRect(cx, cy, 44, 8); ctx.fillRect(cx + 8, cy - 6, 26, 8); ctx.fillRect(cx + 16, cy + 8, 22, 4);
    }

    var of = dist * 0.1, om = dist * 0.3;
    drawHill(ctx, of, HORIZON - 66, 12, 0.012, 7, 0.031, '#b6d3ad');
    drawHill(ctx, om, HORIZON - 38, 11, 0.018, 6, 0.045, '#8fbf94');

    var P = 800, sx = P * 0.5 - (om % P);                                    // chapiteau blanc
    for (var k = 0; k < 2; k++) {
      var x = sx + k * P;
      if (x < -90 || x > W + 90) continue;
      var by = HORIZON - 16;
      ctx.fillStyle = '#fbf7ef'; ctx.fillRect(x - 40, by - 24, 80, 24);
      ctx.fillStyle = '#e2d6c0'; for (var q = 0; q < 8; q++) ctx.fillRect(x - 40 + q * 10 + 5, by - 24, 5, 24);
      ctx.fillStyle = '#f2ede0';
      ctx.beginPath(); ctx.moveTo(x - 46, by - 24); ctx.lineTo(x - 20, by - 46); ctx.lineTo(x, by - 32); ctx.lineTo(x + 20, by - 46); ctx.lineTo(x + 46, by - 24); ctx.fill();
      ctx.fillStyle = '#9B1B30'; ctx.fillRect(x - 20, by - 48, 1, 4); ctx.fillRect(x + 20, by - 48, 1, 4);
      ctx.fillStyle = '#6b8a6f'; ctx.fillRect(x - 8, by - 14, 16, 14);
    }

    var ot = dist * 0.6, i0 = Math.floor(ot / 100) - 1;                      // arbres
    for (var i = i0; i < i0 + 8; i++) {
      var px = i * 100 + hash(i + 7) * 40 - ot, th = 40 + hash(i + 47) * 24;
      ctx.fillStyle = '#6b4a2e'; ctx.fillRect(px - 2, HORIZON - 22, 4, 22);
      ctx.fillStyle = '#4f9a5e'; ctx.beginPath(); ctx.arc(px, HORIZON - 22 - th / 2, th / 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#6fb878'; ctx.beginPath(); ctx.arc(px - th / 6, HORIZON - 26 - th / 2, th / 4, 0, 7); ctx.fill();
    }

    var go = dist * 0.7, gs = 120, g0 = Math.floor(go / gs) - 1;             // guirlandes lumineuses
    for (var m = g0; m < g0 + 6; m++) {
      var ax = m * gs - go, ay = 74;
      ctx.fillStyle = '#6b4a2e'; ctx.fillRect(ax - 1, ay, 3, HORIZON - ay);
      for (var b = 0; b <= 8; b++) {
        var u = b / 8, bx = ax + u * gs, by2 = ay + Math.sin(u * Math.PI) * 14;
        ctx.fillStyle = 'rgba(246,211,138,.35)'; ctx.fillRect(bx - 3, by2 - 2, 7, 7);
        ctx.fillStyle = (b + m) % 3 ? '#f6d38a' : '#fff1b8'; ctx.fillRect(bx - 1, by2, 3, 3);
      }
    }

    ctx.fillStyle = '#2f6b3a'; ctx.fillRect(0, HORIZON - 6, W, 20);         // haie fleurie
    ctx.fillStyle = '#4f9a5e'; ctx.fillRect(0, HORIZON - 6, W, 3);
    var ho = dist % 48;
    for (var h = -1; h < 12; h++) {
      var hx = h * 48 - ho;
      ctx.fillStyle = (h + Math.floor(dist / 48)) % 2 ? '#d98aa0' : '#f8f3ea';
      ctx.fillRect(hx + 8, HORIZON, 4, 4); ctx.fillRect(hx + 30, HORIZON + 6, 4, 4); ctx.fillRect(hx + 20, HORIZON + 2, 3, 3);
    }

    ctx.fillStyle = '#bcdba0'; ctx.fillRect(0, HORIZON + 14, W, H - HORIZON - 14);   // pelouse
    ctx.fillStyle = '#add08f';
    var so = dist % 112;
    for (var sI = -1; sI < 6; sI++) ctx.fillRect(sI * 112 - so, HORIZON + 14, 56, H - HORIZON - 14);
    ctx.fillStyle = '#f4ecd6';
    var po = dist % 70;
    for (var d = -1; d < 8; d++) { ctx.fillRect(d * 70 - po, HORIZON + 38, 26, 3); ctx.fillRect(d * 70 - po + 34, HORIZON + 26, 14, 2); }

    ctx.fillStyle = 'rgba(255,255,255,.7)';                                  // bulles de champagne
    for (var f = 0; f < 18; f++) {
      var bx2 = ((hash(f + 140) * W - dist * 0.25 - t * 6) % W + W) % W;
      var by3 = H - ((hash(f + 160) * 260 + t * (22 + hash(f + 3) * 24)) % 260);
      ctx.fillRect(bx2, by3, 3, 3); ctx.fillRect(bx2 + 1, by3 - 1, 1, 5);
    }
  }

  /* ---------- biome 5 : la discothèque ---------- */
  var NEON = ['#ff2fa3', '#2fd9ff', '#7a2cff', '#ffd22f'];

  function drawDisco(ctx, dist, t) {
    var g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, '#12061f'); g.addColorStop(0.7, '#2e0f4d'); g.addColorStop(1, '#5a1a66');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var beat = Math.floor(t * 4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var l = 0; l < 4; l++) {                                            // lasers
      var ax = l < 2 ? 40 + l * 30 : W - 40 - (l - 2) * 30, an = Math.sin(t * (1.1 + l * 0.35) + l * 1.7) * 0.7;
      ctx.strokeStyle = l & 1 ? 'rgba(47,217,255,.55)' : 'rgba(255,47,163,.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax + Math.sin(an) * 420, Math.cos(an) * 420); ctx.stroke();
    }
    ctx.restore();

    var eo = dist * 0.15, e0 = Math.floor(eo / 18);                          // égaliseur
    ctx.globalAlpha = 0.5;
    for (var e = 0; e < 28; e++) {
      var hh = 14 + Math.abs(Math.sin(t * 4 + (e + e0) * 0.9)) * 52;
      ctx.fillStyle = NEON[(e + e0) & 3];
      ctx.fillRect(e * 18 - (eo % 18), HORIZON - 14 - hh, 12, hh);
    }
    ctx.globalAlpha = 1;

    var os = dist * 0.45, s0 = Math.floor(os / 150) - 1;                     // enceintes de fond
    for (var s = s0; s < s0 + 5; s++) {
      var spx = s * 150 + hash(s + 200) * 40 - os;
      ctx.fillStyle = '#1b1030'; ctx.fillRect(spx, HORIZON - 56, 34, 56);
      ctx.fillStyle = '#3b2a60'; ctx.fillRect(spx, HORIZON - 56, 34, 2);
      ctx.fillStyle = '#0d0818'; ctx.beginPath(); ctx.arc(spx + 17, HORIZON - 20, 11, 0, 7); ctx.fill();
      ctx.fillStyle = '#2f2150'; ctx.beginPath(); ctx.arc(spx + 17, HORIZON - 20, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#0d0818'; ctx.beginPath(); ctx.arc(spx + 17, HORIZON - 44, 4, 0, 7); ctx.fill();
    }

    ctx.fillStyle = '#ffffff'; ctx.fillRect(W / 2 - 0.5, 0, 1, 24);          // boule à facettes
    for (var by = -1; by <= 1; by++) for (var bx = -2; bx <= 2; bx++) {
      var bw = Math.sqrt(Math.max(0, 1 - (by * 0.4) * (by * 0.4))) * 9 + 3;
      if (Math.abs(bx * 5) > bw) continue;
      ctx.fillStyle = ((bx + by + beat) & 1) ? '#ffffff' : '#9aa7bd';
      ctx.fillRect(W / 2 + bx * 5 - 2, 36 + by * 6 - 2, 4, 4);
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';                    // reflets qui tournent
    for (var r = 0; r < 14; r++) {
      var rx = ((hash(r + 300) * W * 2 + t * (18 + hash(r) * 30) * (r & 1 ? 1 : -1)) % W + W) % W;
      var ry = 30 + hash(r + 330) * (HORIZON - 40);
      ctx.fillStyle = NEON[(r + beat) & 3]; ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.arc(rx, ry, 5 + hash(r + 360) * 5, 0, 7); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;

    ctx.fillStyle = '#10081c'; ctx.fillRect(0, HORIZON - 2, W, 16);          // rebord de scène
    ctx.fillStyle = NEON[beat & 3]; ctx.fillRect(0, HORIZON - 2, W, 2);

    var to = dist % 40, t0 = Math.floor(dist / 40);                          // piste de danse
    for (var row = 0; row < 3; row++) for (var col = -1; col < 13; col++) {
      var idx = (((col + row * 2 + t0 + beat) % 4) + 4) % 4;
      ctx.fillStyle = '#1d0f33'; ctx.fillRect(col * 40 - to, HORIZON + 14 + row * 15, 40, 15);
      ctx.fillStyle = NEON[idx]; ctx.globalAlpha = 0.55;
      ctx.fillRect(col * 40 - to + 1, HORIZON + 15 + row * 15, 38, 13);
      ctx.globalAlpha = 1;
    }
  }

  var SCENES = [drawVineyard, drawVillage, drawNave, drawGarden, drawDisco];

  function drawSign(ctx, x, text) {                                      // panneau planté à la limite des deux décors
    ctx.font = '7px "Press Start 2P", ui-monospace, Menlo, monospace';
    var hw = Math.ceil(ctx.measureText(text).width / 2) + 8;
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(x - 1, HORIZON - 30, 3, 44);
    ctx.fillStyle = '#f8f3ea'; ctx.fillRect(x - hw, HORIZON - 44, hw * 2, 17);
    ctx.fillStyle = GOLD; ctx.fillRect(x - hw, HORIZON - 44, hw * 2, 2); ctx.fillRect(x - hw, HORIZON - 29, hw * 2, 2);
    ctx.fillStyle = '#9B1B30';
    ctx.textAlign = 'center'; ctx.fillText(text, x, HORIZON - 32); ctx.textAlign = 'left';
  }

  function drawScene(ctx, dist, t, biome, edge) {                  // edge : abscisse où le biome en cours commence
    if (!biome || edge <= 0) { SCENES[biome](ctx, dist, t); return; }
    SCENES[biome - 1](ctx, dist, t);
    ctx.save();
    ctx.beginPath(); ctx.rect(edge, 0, W - edge + 4, H); ctx.clip();
    SCENES[biome](ctx, dist, t);
    ctx.restore();
    drawSign(ctx, edge, SIGN[biome]);
  }

  /* ---------- sons (bips 8 bits, coupés par défaut) ---------- */
  var actx = null, soundOn = lsGet(LS_SOUND) === '1';
  function beep(f1, f2, dur, type, vol) {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur);
    } catch (e) {}
  }
  var sfx = {
    jump: function () { beep(380, 760, 0.13, 'square', 0.05); },
    ring: function () { beep(988, 1319, 0.12, 'square', 0.05); },
    bottle: function () { beep(660, 1760, 0.22, 'triangle', 0.08); },
    hit: function () { beep(220, 50, 0.4, 'sawtooth', 0.08); },
    level: function () {
      beep(523, 784, 0.14, 'square', 0.06);
      setTimeout(function () { beep(659, 988, 0.14, 'square', 0.06); }, 140);
      setTimeout(function () { beep(784, 1319, 0.3, 'square', 0.06); }, 280);
    }
  };

  /* ---------- interface ---------- */
  var CSS = [
    '#arcade{position:fixed;inset:0;z-index:150;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;',
    '  --sw:min(calc(100vw - 24px),calc((100vh - 150px)*1.7778),960px);',
    '  background:var(--green,#163527);color:var(--on-green,#F8F3EA);padding:12px;touch-action:none;',
    '  -webkit-user-select:none;user-select:none;overscroll-behavior:contain;outline:none}',
    '@supports (height:100dvh){#arcade{--sw:min(calc(100vw - 24px),calc((100dvh - 150px)*1.7778),960px)}}',
    '#arcade.open{display:flex}',
    '#arcade .ar-top{position:absolute;z-index:2;top:calc(10px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);width:var(--sw);display:flex;align-items:center;justify-content:space-between;gap:12px;font:400 11px/1 var(--fj,sans-serif);letter-spacing:.2em;text-transform:uppercase}',
    '#arcade .ar-btn{color:var(--on-green-muted,#CDD6CF);padding:12px 2px;font:inherit;letter-spacing:inherit;text-transform:inherit;background:none;border:0;cursor:pointer}',
    '#arcade .ar-title{font:italic 400 22px/1 var(--f,serif);letter-spacing:.02em;text-transform:none;text-align:center}',
    '#arcade .ar-hud{width:var(--sw);display:flex;justify-content:space-between;font:400 11px/1 "Press Start 2P",ui-monospace,Menlo,monospace;color:var(--brass-light,#D9B98A)}',
    '#arcade .ar-hud b{color:#fff;font-weight:400}',
    '#arcade .ar-stage{width:var(--sw);aspect-ratio:16/9;background:#e6e0d0;border:2px solid var(--line,#B8964F);box-shadow:0 0 0 5px rgba(184,150,79,.22);overflow:hidden}',
    '#arcade canvas{display:block;width:100%;height:100%}',
    '#arcade .ar-foot{width:var(--sw);text-align:center;font:400 10.5px/1.5 var(--fj,sans-serif);letter-spacing:.18em;text-transform:uppercase;color:var(--on-green-muted,#CDD6CF)}',
    '#arcade .ar-rotate{display:none;margin-top:4px;letter-spacing:.08em;text-transform:none;font-size:12px}',
    '@media (orientation:portrait){#arcade .ar-rotate{display:block}}',
    '@media (max-width:520px){#arcade .ar-title{display:none}}',
    '#arcade .ar-panel{position:absolute;inset:0;display:flex;overflow-y:auto;padding:64px 16px 20px;background:rgba(14,36,26,.96);touch-action:pan-y}',
    '#arcade .ar-panel[hidden]{display:none}',
    '#arcade .ar-card{margin:auto;width:min(100%,420px);text-align:center}',
    '#arcade .ar-kick{font:400 10px/1 var(--fj,sans-serif);letter-spacing:.28em;text-transform:uppercase;color:var(--brass-light,#D9B98A)}',
    '#arcade h2{margin:14px 0 0;font:italic 500 34px/1.05 var(--f,serif)}',
    '#arcade .ar-big{margin:16px 0 0;font:400 26px/1 "Press Start 2P",ui-monospace,Menlo,monospace;color:#fff}',
    '#arcade .ar-lead{margin:14px auto 0;max-width:36ch;font:400 19px/1.35 var(--f,serif);color:var(--on-green-muted,#CDD6CF)}',
    '#arcade .ar-form{margin:22px 0 0}',
    '#arcade .ar-form input{width:100%;max-width:260px;background:transparent;border:0;border-bottom:1px solid var(--line,#B8964F);padding:8px 4px;text-align:center;color:#fff;font:400 20px/1.2 var(--f,serif);outline:none;border-radius:0;-webkit-user-select:text;user-select:text}',
    '#arcade .ar-form label{display:block;font:400 10px/1 var(--fj,sans-serif);letter-spacing:.24em;text-transform:uppercase;color:var(--on-green-muted,#CDD6CF);margin-bottom:6px}',
    '#arcade .ar-form .btn{margin-top:16px}',
    '#arcade .ar-msg{min-height:20px;margin-top:10px;font:400 17px/1.3 var(--f,serif);color:var(--brass-light,#D9B98A)}',
    '#arcade .ar-board{margin:26px 0 0;text-align:left}',
    '#arcade .ar-board-t{font:400 10px/1 var(--fj,sans-serif);letter-spacing:.28em;text-transform:uppercase;color:var(--brass-light,#D9B98A);text-align:center;margin-bottom:10px}',
    '#arcade ol{list-style:none;margin:0;padding:0;font:400 16px/1.2 var(--fj,sans-serif);border-top:1px solid rgba(184,150,79,.4)}',
    '#arcade li{display:grid;grid-template-columns:34px 1fr auto;gap:8px;padding:9px 6px;border-bottom:1px solid rgba(184,150,79,.25)}',
    '#arcade li i{font-style:normal;color:var(--brass-light,#D9B98A)}',
    '#arcade li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#arcade li b{font-weight:400;font-variant-numeric:tabular-nums}',
    '#arcade li.me{background:rgba(184,150,79,.18);color:#fff}',
    '#arcade .ar-note{margin-top:8px;text-align:center;font:italic 400 15px/1.3 var(--f,serif);color:var(--on-green-muted,#CDD6CF)}',
    '#arcade .ar-actions{margin-top:26px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}'
  ].join('\n');

  var HTML =
    '<div class="ar-top">' +
      '<button class="ar-btn" data-ar="close" type="button">Fermer ✕</button>' +
      '<div class="ar-title">La course vers l’autel</div>' +
      '<button class="ar-btn" data-ar="sound" type="button" aria-pressed="false">Son : non</button>' +
    '</div>' +
    '<div class="ar-hud"><span>Score <b data-ar="score">00000</b></span><span>Record <b data-ar="best">00000</b></span></div>' +
    '<div class="ar-stage" data-ar="stage"><canvas data-ar="cv" aria-label="Jeu : les mariés courent vers le domaine"></canvas></div>' +
    '<div class="ar-foot">Toucher l’écran, espace ou ↑ pour sauter<div class="ar-rotate">Astuce : tournez le téléphone pour jouer en plus grand.</div></div>' +
    '<div class="ar-panel" data-ar="panel" hidden><div class="ar-card">' +
      '<div class="ar-kick" data-ar="kicker"></div>' +
      '<h2 data-ar="head"></h2>' +
      '<div class="ar-big" data-ar="big" hidden></div>' +
      '<p class="ar-lead" data-ar="lead"></p>' +
      '<form class="ar-form" data-ar="form" hidden autocomplete="off">' +
        '<label for="ar-name">Votre prénom</label>' +
        '<input id="ar-name" data-ar="name" maxlength="16" required enterkeyhint="done" autocomplete="off">' +
        '<div><button class="btn" type="submit" data-ar="send">Enregistrer mon score</button></div>' +
        '<div class="ar-msg" data-ar="msg" role="status"></div>' +
      '</form>' +
      '<div class="ar-board"><div class="ar-board-t">Classement</div><ol data-ar="list"></ol><div class="ar-note" data-ar="note"></div></div>' +
      '<div class="ar-actions"><button class="btn" type="button" data-ar="play">Jouer</button></div>' +
    '</div></div>';

  var root, cv, ctx, stage, el = {};
  var mode = 'closed';          // closed | ready | play | dying | over
  var st = null, raf = 0, lastT = 0, built = false, best = 0, deadAt = 0;
  var acc = 0;                  // temps écoulé pas encore joué (la partie avance par pas fixes, voir loop)
  var lastFocus = null;

  function pad(n) { return ('00000' + n).slice(-5); }

  function build() {
    if (built) return;
    built = true;
    var style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    var font = document.createElement('link'); font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
    document.head.appendChild(font);

    root = document.createElement('div');
    root.id = 'arcade'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'La course vers l’autel'); root.tabIndex = -1;
    root.innerHTML = HTML;
    document.body.appendChild(root);

    ['close', 'sound', 'score', 'best', 'stage', 'cv', 'panel', 'kicker', 'head', 'big', 'lead', 'form', 'name', 'send', 'msg', 'list', 'note', 'play']
      .forEach(function (k) { el[k] = root.querySelector('[data-ar="' + k + '"]'); });
    cv = el.cv; stage = el.stage; ctx = cv.getContext('2d');

    el.close.addEventListener('click', close);
    el.sound.addEventListener('click', function () { soundOn = !soundOn; lsSet(LS_SOUND, soundOn ? '1' : '0'); paintSound(); sfx.ring(); });
    el.play.addEventListener('click', start);
    el.form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    root.addEventListener('pointerdown', function (e) {
      if (mode !== 'play') return;
      if (e.target.closest && e.target.closest('button')) return;
      e.preventDefault(); wantJump();
    });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', function () { if (mode !== 'closed') fit(); });
    paintSound();
  }

  function paintSound() {
    el.sound.textContent = 'Son : ' + (soundOn ? 'oui' : 'non');
    el.sound.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  }

  function fit() {
    var r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 3);
    var cw = Math.max(1, Math.round(r.width * dpr)), ch = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  }

  /* ---------- partie ---------- */
  /* partie du moteur + ce qui ne sert qu’à l’affichage et à l’envoi du score */
  function newState(seed) {
    var s = M.newGame(seed || 0);
    s.pops = []; s.shake = 0; s.banner = 0; s.shown = -1; s.submitted = false;
    s.game = null; s.inputs = []; s.wantJump = false;
    return s;
  }

  function score() { return M.score(st); }

  function start() {
    st = newState(Math.floor(Math.random() * 4294967296));
    acc = 0;
    // ticket de partie : le serveur note l’heure de départ et s’en sert pour juger le score envoyé
    if (online && Date.now() < FIN) {
      st.game = api('start_game').then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      });
      st.game.catch(function () {});
    }
    mode = 'play';
    el.panel.hidden = true;
    root.focus();
    if (window.maTrack) window.maTrack('jeu/partie', true);
  }

  function wantJump() { if (st && mode === 'play') st.wantJump = true; }   // pris en compte au pas suivant

  function onKey(e) {
    if (mode === 'closed') return;
    if (e.key === 'Escape') { close(); return; }
    var jumpKey = e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W';
    if (!jumpKey) return;
    var inField = e.target && /^(input|textarea|button)$/i.test(e.target.tagName);
    if (mode === 'play') { e.preventDefault(); if (!e.repeat) wantJump(); }
    else if (mode === 'ready' && !inField) { e.preventDefault(); start(); }
  }

  /* entre deux parties : défilement d’attente et petite pause après une chute */
  function update(dt) {
    if (mode === 'ready') { st.anim += dt; st.dist += 70 * dt; return; }
    if (mode === 'dying') {
      st.shake = Math.max(0, st.shake - dt);
      if (performance.now() - deadAt > 950) showOver();
    }
  }

  /* un pas de partie : le moteur avance, puis on joue les sons et les effets de ce qui s’est passé */
  function tick() {
    var jump = st.wantJump;
    st.wantJump = false;
    if (jump && st.inputs.length < 20000) st.inputs.push(st.frame);
    M.step(st, jump);

    var ev = st.ev, i, g;
    if (ev.jumped) sfx.jump();
    for (i = 0; i < ev.got.length; i++) {
      g = ev.got[i];
      st.pops.push({ x: g.x, y: g.y, t: 0, txt: '+' + g.pts });
      (g.kind === 'bottle' ? sfx.bottle : sfx.ring)();
    }
    if (ev.level) {
      st.banner = 2.8;
      st.pops.push({ x: PX + 4, y: FEET - PH - 24, t: 0, txt: '+' + M.BIOME_BONUS });
      sfx.level();
      if (window.maTrack) window.maTrack('jeu/' + TRACK[st.biome], true);
    }
    for (i = st.pops.length - 1; i >= 0; i--) { st.pops[i].t += STEP; if (st.pops[i].t > 0.8) st.pops.splice(i, 1); }
    st.banner = Math.max(0, st.banner - STEP);

    if (st.dead) { die(); return; }
    var txt = pad(score());
    if (txt !== st.shown) { st.shown = txt; el.score.textContent = txt; }
  }

  function die() {
    mode = 'dying'; deadAt = performance.now(); st.shake = 0.4;
    el.score.textContent = pad(score());
    sfx.hit();
  }

  /* ---------- dessin ---------- */
  function render(now) {
    fit();
    var k = cv.width / W;
    ctx.setTransform(k, 0, 0, cv.height / H, 0, 0);
    ctx.imageSmoothingEnabled = false;

    var sx = 0, sy = 0;
    if (mode === 'dying' && st.shake > 0) { sx = (Math.random() - 0.5) * 6; sy = (Math.random() - 0.5) * 4; }
    ctx.save(); ctx.translate(sx, sy);

    /* Interpolation d'affichage : on dessine une fraction de pas en avance (alpha = temps accumulé
       depuis le dernier pas) pour un rendu fluide quel que soit le rafraîchissement de l'écran,
       sans toucher à la simulation (qui reste déterministe). */
    var alpha = mode === 'play' ? (acc >= STEP ? 1 : acc / STEP) : 0;
    var shift = alpha * (st.lastDx || 0);
    var pyView = st.prevPy + (st.py - st.prevPy) * alpha;
    var dScene = st.dist + shift;

    drawScene(ctx, dScene, now / 1000, st.biome, W + 16 - (dScene - st.edge));

    var i, o, it;
    for (i = 0; i < st.items.length; i++) {
      it = st.items[i];
      var bob = Math.sin(now / 220 + it.ph) * 2;
      var spr = it.kind === 'bottle' ? S.bottle : S.ring;
      ctx.drawImage(spr, Math.round(it.x - shift), Math.round(it.y + bob), spr.width * 2, spr.height * 2);
    }
    for (i = 0; i < st.obs.length; i++) {
      o = st.obs[i];
      var im = OB_IMG[o.kind](o);
      ctx.drawImage(im, Math.round(o.x - shift), Math.round(o.y), im.width * 2, im.height * 2);
    }

    var f = !st.onGround ? 2 : (Math.floor(st.anim * 9) & 1);
    var by = FEET - PH - pyView + (st.onGround && f === 1 ? -2 : 0);
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.beginPath(); ctx.ellipse(PX + 26, FEET + 2, Math.max(8, 22 - pyView * 0.12), 4, 0, 0, 7); ctx.fill();
    if (!(mode === 'dying' && Math.floor(now / 70) % 2)) {
      ctx.drawImage(S.couple[mode === 'dying' ? 2 : f], PX, Math.round(by), PW, PH);
    }

    ctx.font = '10px "Press Start 2P", ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#9B1B30';
    for (i = 0; i < st.pops.length; i++) {
      var p = st.pops[i];
      ctx.globalAlpha = 1 - p.t / 0.8;
      ctx.fillText(p.txt, p.x, p.y - p.t * 40);
    }
    ctx.globalAlpha = 1;
    if (st.banner > 0 && mode === 'play') {
      ctx.globalAlpha = Math.min(1, st.banner / 0.5);
      ctx.fillStyle = 'rgba(27,26,23,.55)'; ctx.fillRect(0, 38, W, 54);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = '14px "Press Start 2P", ui-monospace, Menlo, monospace'; ctx.fillText(BANNER[st.biome][0], W / 2, 62);
      ctx.fillStyle = '#D9B98A'; ctx.font = '8px "Press Start 2P", ui-monospace, Menlo, monospace';
      ctx.fillText(BANNER[st.biome][1], W / 2, 80);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
    if (mode === 'dying') {
      ctx.fillStyle = '#9B1B30'; ctx.font = '14px "Press Start 2P", ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center'; ctx.fillText('AÏE !', PX + 26, FEET - PH - pyView - 10); ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    var dtReal = (now - lastT) / 1000 || 0;
    lastT = now;
    if (dtReal > 0.25) dtReal = 0.25;              // onglet en arrière-plan : on ne rattrape pas tout
    if (mode === 'play') {
      acc += dtReal;
      var steps = 0;
      while (acc >= STEP && steps < 6 && mode === 'play') { tick(); acc -= STEP; steps++; }
      if (acc >= STEP) acc = 0;                    // appareil trop lent : le jeu ralentit plutôt que de sauter des pas
    } else {
      update(dtReal);
    }
    render(now);
  }

  /* Pour vérifier à la main le score d’un gagnant : MaArcadeVerify(seed, inputs) dans la console,
     avec les valeurs de sa colonne replay. Le serveur fait exactement le même calcul. */
  window.MaArcadeVerify = function (seed, inputs) { return M.replay(seed >>> 0, inputs || []); };

  /* ---------- classement ---------- */
  function cleanName(s) { return String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16); }

  function localBoard() {
    var rows = [];
    try { rows = JSON.parse(lsGet(LS_LOCAL) || '[]'); } catch (e) {}
    return Array.isArray(rows) ? rows : [];
  }
  function bestPerName(rows) {
    var seen = {}, out = [];
    rows.sort(function (a, b) { return b.score - a.score; }).forEach(function (r) {
      var key = String(r.name).toLowerCase();
      if (!seen[key]) { seen[key] = 1; out.push(r); }
    });
    return out.slice(0, 10);
  }

  function headers() {
    var h = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY };
    // ancienne clé « anon » (JWT, commence par eyJ) : envoyée aussi en Authorization ; les clés « sb_publishable_… » non
    if (/^eyJ/.test(SUPABASE_KEY)) h.Authorization = 'Bearer ' + SUPABASE_KEY;
    return h;
  }
  function api(path, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + path, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body || {})
    });
  }

  function loadBoard() {
    if (!online) return Promise.resolve({ rows: bestPerName(localBoard()), local: true });
    return api('top_scores').then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (rows) { return { rows: rows, local: false }; });
  }

  function paintBoard(data, mine) {
    el.list.textContent = '';
    data.rows.forEach(function (r, i) {
      var li = document.createElement('li');
      if (mine && String(r.name).toLowerCase() === mine.toLowerCase()) li.className = 'me';
      var a = document.createElement('i'), b = document.createElement('span'), c = document.createElement('b');
      a.textContent = (i + 1) + '.'; b.textContent = r.name; c.textContent = r.score;
      li.appendChild(a); li.appendChild(b); li.appendChild(c); el.list.appendChild(li);
    });
    el.note.textContent = data.rows.length ? '' : 'Aucun score pour le moment : à vous de jouer !';
    if (data.local) el.note.textContent += (el.note.textContent ? ' ' : '') + 'Classement de cet appareil uniquement.';
  }

  function refreshBoard(mine) {
    el.note.textContent = 'Chargement du classement…';
    loadBoard().then(function (d) { paintBoard(d, mine); }, function () {
      el.list.textContent = ''; el.note.textContent = 'Classement indisponible pour le moment.';
    });
  }

  function submit() {
    if (!st || st.submitted) return;
    var name = cleanName(el.name.value);
    if (!name) { el.name.focus(); return; }
    var sc = score();
    lsSet(LS_NAME, name);
    el.send.disabled = true; el.msg.textContent = 'Envoi…';
    var done = function () {
      st.submitted = true; el.form.hidden = true; el.msg.textContent = '';
      el.lead.textContent = 'Score enregistré, merci ' + name + ' !';
      refreshBoard(name);
    };
    var game = st;
    if (!online) {
      var rows = localBoard(); rows.push({ name: name, score: sc });
      lsSet(LS_LOCAL, JSON.stringify(bestPerName(rows).slice(0, 30)));
      done(); return;
    }
    if (!game.game) { el.send.disabled = false; el.msg.textContent = 'Envoi impossible pour cette partie.'; return; }
    // on n’envoie pas de score : seulement la graine et les pas où l’on a sauté. Le serveur rejoue
    // la partie avec le même moteur (jeu-moteur.js) et calcule lui-même le score.
    game.game.then(function (ticket) {
      return fetch(SUPABASE_URL + '/functions/v1/' + SCORE_FN, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ game: ticket, name: name, seed: game.seed, inputs: game.inputs })
      });
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (res) {
      // le serveur renvoie le score qu’il a calculé ; sans lui, rien n’a été enregistré
      if (!res || typeof res.score !== 'number') throw new Error('réponse inattendue');
      done();
    }).catch(function () {
      el.send.disabled = false;
      el.msg.textContent = 'Envoi impossible pour le moment. Réessayez dans un instant.';
    });
  }

  /* ---------- panneaux ---------- */
  function showReady() {
    mode = 'ready'; st = newState();
    el.score.textContent = pad(0);
    el.kicker.textContent = 'Jeu secret';
    el.head.textContent = 'La course vers l’autel';
    el.big.hidden = true; el.form.hidden = true;
    el.lead.textContent = Date.now() < FIN
      ? 'Les mariés courent jusqu’au domaine. Sautez par-dessus les obstacles, ramassez alliances et champagne. Le meilleur score remporte un lot !'
      : 'Le concours est terminé, mais rien ne vous empêche de jouer pour le plaisir.';
    el.play.textContent = 'Jouer';
    el.panel.hidden = false;
    refreshBoard(lsGet(LS_NAME));
  }

  function showOver() {
    mode = 'over';
    var sc = score(), rec = sc > best;
    if (rec) { best = sc; lsSet(LS_BEST, String(best)); el.best.textContent = pad(best); }
    el.kicker.textContent = rec && sc > 0 ? 'Nouveau record' : 'Partie terminée';
    el.head.textContent = 'Perdu !';
    el.big.hidden = false; el.big.textContent = sc;
    var canSend = Date.now() < FIN && sc > 0;
    el.lead.textContent = canSend ? 'Inscrivez votre prénom pour entrer au classement.' : '';
    el.form.hidden = !canSend;
    el.send.disabled = false; el.msg.textContent = '';
    el.name.value = cleanName(lsGet(LS_NAME));
    el.play.textContent = 'Rejouer';
    el.panel.hidden = false;
    refreshBoard(null);
    if (canSend && !el.name.value) el.name.focus();
  }

  /* ---------- ouverture / fermeture ---------- */
  function open() {
    build();
    if (mode !== 'closed') return;
    lastFocus = document.activeElement;
    best = parseInt(lsGet(LS_BEST), 10) || 0;
    el.best.textContent = pad(best);
    root.classList.add('open');
    document.body.style.overflow = 'hidden';
    fit();
    showReady();
    root.focus();
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    if (window.maTrack) window.maTrack('jeu/ouverture', true);
  }

  function close() {
    if (mode === 'closed') return;
    mode = 'closed';
    cancelAnimationFrame(raf);
    root.classList.remove('open');
    document.body.style.overflow = '';
    if (location.hash === '#jeu') { try { history.replaceState(null, '', '#' + (window.maCurrent || '/accueil').slice(1)); } catch (e) {} }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  window.MaArcade = { open: open, close: close };
})();

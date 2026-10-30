/* ---------- partie serveur : rejoue la partie reçue et enregistre le score qu’elle donne ----------
   Le navigateur n’envoie jamais de score : seulement son ticket de partie, la graine et les pas où le
   joueur a sauté. Le score est recalculé ici avec le moteur ci-dessus, puis enregistré par record_score
   (fonction SQL que seule la clé secrète du serveur peut appeler, voir supabase.sql). */

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

  const game = body.game, name = body.name, seed = body.seed, inputs = body.inputs;
  if (typeof game !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(game)) {
    return reply(400, { error: 'ticket invalide' }, origin);
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 64) return reply(400, { error: 'prénom invalide' }, origin);
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
    body: JSON.stringify({ p_game: game, p_name: name, p_score: r.score, p_frames: r.frames,
                           p_jumps: r.jumps, p_replay: { seed: seed, inputs: inputs } })
  });
  if (!res.ok) {
    let msg = 'enregistrement refusé';
    try { const j = await res.json(); if (j && typeof j.message === 'string') msg = j.message; } catch (e) {}
    return reply(409, { error: msg }, origin);
  }
  return reply(200, { score: r.score }, origin);
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

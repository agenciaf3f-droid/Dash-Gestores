// GET /api/config -> roster da equipe (telefones e nomes), só para quem está logado.
//
// Este roster estava hardcoded em public/dashboard.html, que é servido publicamente:
// qualquer visitante lia os 13 celulares pessoais no código-fonte, sem login.
// Agora ele vive na env var ROSTER (servidor) e só sai por aqui, autenticado.

import { validateSession, readRoster, sendJson } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "method not allowed" });

  const session = await validateSession(req);
  if (!session.ok) return sendJson(res, session.status, { error: session.error });

  let roster;
  try {
    roster = readRoster();
  } catch (e) {
    return sendJson(res, 500, { error: e.message });
  }

  return sendJson(res, 200, { roster });
}

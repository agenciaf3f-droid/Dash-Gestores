// Helpers compartilhados pelas funções serverless.
// Nada aqui roda no navegador — este código só existe no servidor da Vercel,
// e é por isso que as env vars usadas aqui são segredo de verdade.

/**
 * Valida a sessão do usuário.
 *
 * O login acontece no Supabase de auth (projeto "A", Lovable Cloud), mas os dados
 * moram noutro projeto ("B"). Como são projetos distintos, o B não reconhece o JWT
 * do A — por isso não dá para simplesmente confiar no token aqui.
 * A validação é feita perguntando ao próprio A quem é o portador do token.
 *
 * Só precisa da URL + chave anon do A, ambas públicas. Não exige acesso admin ao A.
 *
 * @returns {Promise<{ok: true, user: object} | {ok: false, status: number, error: string}>}
 */
export async function validateSession(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "missing bearer token" };

  const url = process.env.SUPABASE_AUTH_URL;
  const anon = process.env.SUPABASE_AUTH_ANON_KEY;
  if (!url || !anon) return { ok: false, status: 500, error: "auth env vars not configured" };

  let r;
  try {
    r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return { ok: false, status: 503, error: "auth provider unreachable" };
  }

  if (!r.ok) return { ok: false, status: 401, error: "invalid session" };

  const user = await r.json().catch(() => null);
  if (!user || !user.id) return { ok: false, status: 401, error: "invalid session" };

  // Sessão válida NÃO é autorização.
  //
  // O projeto de auth está com cadastro público aberto (disable_signup: false):
  // qualquer pessoa cria conta com um e-mail próprio, confirma, e passa a ter
  // sessão válida. Sem a checagem abaixo, isso daria acesso às ~103 mil mensagens
  // de clientes — trocaria "vaza sem login" por "vaza com login que o atacante
  // mesmo cria".
  //
  // ALLOWED_EMAILS: lista separada por vírgula. Se não estiver configurada,
  // NEGA tudo — falhar fechado. Um deploy sem essa var deve derrubar o
  // dashboard, não escancarar os dados.
  const allow = (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!allow.length) {
    console.error("[auth] ALLOWED_EMAILS nao configurada — negando por seguranca");
    return { ok: false, status: 503, error: "authorization not configured" };
  }

  const email = (user.email || "").toLowerCase();
  const ok = allow.some((rule) => (rule.startsWith("@") ? email.endsWith(rule) : email === rule));
  if (!ok) {
    console.warn(`[auth] acesso negado para ${email}`);
    return { ok: false, status: 403, error: "not authorized" };
  }

  return { ok: true, user };
}

/**
 * Lê e valida o roster da env var.
 *
 * O valor é JSON em base64, não JSON puro. Motivo: `vercel env pull` grava o
 * valor entre aspas duplas sem escapar as aspas internas, então JSON cru
 * corrompe o .env.local inteiro a partir daquela linha — e nenhuma variável
 * seguinte carrega. Base64 não tem aspas e sobrevive a qualquer parser de .env.
 *
 * Falha alto de propósito: roster vazio faria isGestorPhone() devolver false
 * para todos e todo gestor seria classificado como cliente.
 */
export function readRoster() {
  const raw = process.env.ROSTER;
  if (!raw) throw new Error("ROSTER env var not set");
  let json;
  try {
    json = Buffer.from(raw, "base64").toString("utf8");
  } catch {
    throw new Error("ROSTER env var is not valid base64");
  }
  let r;
  try {
    r = JSON.parse(json);
  } catch {
    throw new Error("ROSTER env var is not valid base64-encoded JSON");
  }
  if (!Array.isArray(r.gestor) || !r.gestor.length) throw new Error("ROSTER.gestor missing or empty");
  if (!Array.isArray(r.equipe) || !r.equipe.length) throw new Error("ROSTER.equipe missing or empty");
  if (!r.automation) throw new Error("ROSTER.automation missing");
  return r;
}

/** Envia JSON com no-store — nada aqui pode ficar em cache de CDN. */
export function sendJson(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, private");
  res.status(status).send(JSON.stringify(body));
}

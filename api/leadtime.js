// GET /api/leadtime?<mesma query string do PostgREST> -> linhas de "Controle de Mensagens"
//
// Proxy fino e autenticado. Antes, o navegador falava direto com o Supabase usando uma
// chave pública embutida em public/dashboard.html — ou seja, qualquer pessoa na internet
// lia a tabela inteira sem login. Agora a chave é service_role, vive só aqui no servidor,
// e nenhuma linha sai sem sessão válida.
//
// A query string é repassada como está, de propósito: o cliente já faz paginação por
// keyset de id (que usa o índice da PK e evita statement timeout) e cache incremental
// em IndexedDB. Reformatar a resposta aqui obrigaria a reescrever essa lógica — que
// funciona e não tem teste. Então o contrato de dados fica byte-idêntico.

import { validateSession, sendJson } from "./_lib.js";

// Só estes params são repassados. Impede que um chamador autenticado invente
// filtros ou aponte para outra coisa; a tabela é fixa no servidor.
const ALLOWED = new Set(["select", "id", "order", "limit", "offset"]);
const MAX_LIMIT = 1000;

export default async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { error: "method not allowed" });

  const session = await validateSession(req);
  if (!session.ok) return sendJson(res, session.status, { error: session.error });

  const dataUrl = process.env.SUPABASE_DATA_URL;
  const serviceKey = process.env.SUPABASE_DATA_SERVICE_KEY;
  const table = process.env.SUPABASE_DATA_TABLE || "Controle de Mensagens";
  if (!dataUrl || !serviceKey) return sendJson(res, 500, { error: "data env vars not configured" });

  // Reconstrói a query preservando chaves repetidas (id=gte.X & id=lt.Y).
  const incoming = new URL(req.url, "http://localhost").searchParams;
  const out = new URLSearchParams();
  for (const [k, v] of incoming.entries()) {
    if (!ALLOWED.has(k)) continue;
    if (k === "limit") {
      const n = Math.min(parseInt(v, 10) || MAX_LIMIT, MAX_LIMIT);
      out.append(k, String(n));
    } else {
      out.append(k, v);
    }
  }
  if (!out.has("select")) out.append("select", "*");
  if (!out.has("limit")) out.append("limit", String(MAX_LIMIT));

  const target = `${dataUrl}/rest/v1/${encodeURIComponent(table)}?${out.toString()}`;

  let r;
  try {
    r = await fetch(target, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return sendJson(res, 504, { error: "upstream timeout" });
  }

  const body = await r.text();
  if (!r.ok) {
    // Não vaza a resposta crua do upstream (pode conter detalhe de schema).
    console.error(`[leadtime] upstream ${r.status}: ${body.slice(0, 300)}`);
    return sendJson(res, 502, { error: `upstream error ${r.status}` });
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, private");
  // content-range é usado pelo cliente quando pede count
  const cr = r.headers.get("content-range");
  if (cr) res.setHeader("Content-Range", cr);
  res.status(200).send(body);
}

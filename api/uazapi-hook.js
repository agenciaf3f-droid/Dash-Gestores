// POST /api/uazapi-hook?s=<segredo>&i=<1|2|3> -> grava a mensagem em "Controle de Mensagens"
//
// Substitui o n8n. As três instâncias apontam para cá; a mesma mensagem chega 2 ou 3
// vezes e o índice único (Grupo, message_id) descarta as repetições — por isso cair
// uma instância não abre buraco: as outras já entregaram.
//
// Faz o que o n8n fazia, menos transcrever áudio e descrever imagem (combinado: nenhum
// número do dashboard depende desse texto).
//
// Guarda também o payload cru em uazapi_raw. Não é debug: é a rede de segurança. Se a
// gravação na tabela real falhar, a mensagem pode ser reprocessada de lá — e é por isso
// que este endpoint responde 200 mesmo quando a gravação principal falha. Webhook que
// recebe erro entra em retry e, na UAZAPI, repetir demais derruba a assinatura.
// Só devolve erro quando as DUAS gravações falham, aí a mensagem se perderia mesmo.

import { timingSafeEqual } from "node:crypto";
import { linhaDoWebhook } from "./_uazapi-map.js";
import { gestorStatusDoGrupo } from "./_grupos-planilha.js";

const RAW_TABLE = "uazapi_raw";

function segredoConfere(recebido, esperado) {
  if (!esperado || !recebido) return false;
  const a = Buffer.from(String(recebido));
  const b = Buffer.from(String(esperado));
  if (a.length !== b.length) return false;      // timingSafeEqual exige mesmo tamanho
  return timingSafeEqual(a, b);
}

async function inserir(dataUrl, key, tabela, corpo) {
  return fetch(`${dataUrl}/rest/v1/${encodeURIComponent(tabela)}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(8000),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const url = new URL(req.url, "http://localhost");
  if (!segredoConfere(url.searchParams.get("s"), process.env.UAZAPI_HOOK_SECRET)) {
    return res.status(404).json({ error: "not found" });   // 404, não 401: não confirma que a rota existe
  }

  const instancia = url.searchParams.get("i") || "?";

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = { _naoEraJson: String(payload).slice(0, 20000) }; }
  }
  if (!payload || typeof payload !== "object") payload = { _vazio: true };

  // A UAZAPI manda o token da própria instância dentro de cada webhook. Guardar isso
  // seria deixar a credencial das três parada no banco, em texto puro, a cada mensagem.
  if ("token" in payload) delete payload.token;

  const dataUrl = process.env.SUPABASE_DATA_URL;
  const serviceKey = process.env.SUPABASE_DATA_SERVICE_KEY;
  const tabela = process.env.SUPABASE_DATA_TABLE || "Controle de Mensagens";
  if (!dataUrl || !serviceKey) {
    console.error("[uazapi-hook] env de dados não configurada");
    return res.status(200).json({ ok: true });
  }

  // ── 1) rede de segurança: payload cru ──
  let cruOk = false;
  try {
    const r = await inserir(dataUrl, serviceKey, RAW_TABLE, {
      instancia, evento: payload.event || payload.EventType || null, payload,
    });
    cruOk = r.ok;
    if (!r.ok) console.error(`[uazapi-hook] raw ${r.status}: ${(await r.text()).slice(0, 150)}`);
  } catch (e) {
    console.error(`[uazapi-hook] raw falhou: ${String(e && e.message).slice(0, 150)}`);
  }

  // ── 2) a linha de verdade ──
  if (process.env.UAZAPI_WRITE === "off") return res.status(200).json({ ok: true, write: "off" });

  const m = payload.message;
  // Só grupo. O dashboard é inteiro sobre grupos de cliente, e a tabela nunca teve
  // conversa direta — escrever DM aqui inventaria "grupos" que não existem.
  if (!m || m.isGroup !== true) return res.status(200).json({ ok: true, ignorado: "não é grupo" });

  const grupoId = String(m.chatid || "").trim();
  // A planilha "Controle dos Grupos" é a lista de clientes. Grupo que ela não conhece
  // (UPLOADER PRO etc.) não entra: o n8n nunca gravou esses grupos, e o dashboard os
  // mostraria como cliente sem gestor. Planilha fora do ar devolve {} — a mensagem
  // entra sem enriquecimento, porque perder cliente é pior que vazar grupo interno.
  const info = await gestorStatusDoGrupo(grupoId);
  if (info === null) return res.status(200).json({ ok: true, ignorado: "grupo fora da planilha" });
  const { gestor, status } = info;
  const { linha, erro } = linhaDoWebhook(payload, () => ({ gestor, status }));
  if (erro) {
    console.error(`[uazapi-hook] não mapeou: ${erro}`);
    return res.status(200).json({ ok: true, ignorado: erro });
  }

  try {
    const r = await inserir(dataUrl, serviceKey, tabela, linha);
    // 409 = o índice único pegou: outra instância já entregou esta mensagem. É o
    // caminho esperado para ~44% dos webhooks, não é erro.
    if (r.status === 409) return res.status(200).json({ ok: true, duplicada: true });
    if (!r.ok) {
      console.error(`[uazapi-hook] insert ${r.status}: ${(await r.text()).slice(0, 200)}`);
      // Se nem o cru foi salvo, a mensagem se perde: aí vale devolver erro e deixar
      // a UAZAPI tentar de novo.
      return res.status(cruOk ? 200 : 500).json({ ok: false });
    }
    return res.status(200).json({ ok: true, gravada: true });
  } catch (e) {
    console.error(`[uazapi-hook] insert falhou: ${String(e && e.message).slice(0, 200)}`);
    return res.status(cruOk ? 200 : 500).json({ ok: false });
  }
}

// POST /api/uazapi-hook?s=<segredo> -> guarda o webhook cru da UAZAPI
//
// MODO CAPTURA. Este endpoint ainda NÃO escreve em "Controle de Mensagens": ele só
// grava o payload inteiro em uazapi_raw, para eu descobrir o formato real de cada
// evento (texto, áudio, imagem, figurinha, vídeo, botão, reply, reação, troca de
// nome do grupo) antes de escrever o mapeamento. Enquanto isso o n8n segue de pé,
// intocado, como a única fonte do banco.
//
// Por que é seguro ligar agora: as instâncias 2 e 3 estão hoje sem webhook nenhum
// (enabled=false / null), então apontá-las para cá não tira nada de ninguém.
//
// Responde 200 mesmo quando falha ao gravar, de propósito: webhook que recebe erro
// entra em retry e, na UAZAPI, repetir demais derruba a assinatura. Perder uma
// amostra de captura não custa nada; perder a assinatura custa.

import { timingSafeEqual } from "node:crypto";

const RAW_TABLE = "uazapi_raw";

function segredoConfere(recebido, esperado) {
  if (!esperado || !recebido) return false;
  const a = Buffer.from(String(recebido));
  const b = Buffer.from(String(esperado));
  if (a.length !== b.length) return false;      // timingSafeEqual exige mesmo tamanho
  return timingSafeEqual(a, b);
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

  // A instância vem na URL (?i=1) porque as três apontam para o mesmo endereço e
  // o payload pode não dizer de qual veio — é exatamente o que preciso comparar.
  const instancia = url.searchParams.get("i") || "?";

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = { _naoEraJson: String(payload).slice(0, 20000) }; }
  }
  if (!payload || typeof payload !== "object") payload = { _vazio: true };

  const evento = payload.event || payload.type || payload.EventType || null;

  const dataUrl = process.env.SUPABASE_DATA_URL;
  const serviceKey = process.env.SUPABASE_DATA_SERVICE_KEY;
  if (dataUrl && serviceKey) {
    try {
      const r = await fetch(`${dataUrl}/rest/v1/${RAW_TABLE}`, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ instancia, evento, payload }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        const corpo = await r.text().catch(() => "");
        console.error(`[uazapi-hook] insert ${r.status}: ${corpo.slice(0, 200)}`);
      }
    } catch (e) {
      console.error(`[uazapi-hook] insert falhou: ${String(e && e.message).slice(0, 200)}`);
    }
  } else {
    console.error("[uazapi-hook] env de dados não configurada");
  }

  return res.status(200).json({ ok: true });
}

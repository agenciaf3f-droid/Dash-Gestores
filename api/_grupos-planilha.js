// Gestor e Status por grupo, lidos da planilha "Controle dos Grupos".
//
// É o enriquecimento que o n8n fazia. A planilha já está publicada em CSV — o
// próprio dashboard lê essa mesma URL — então não precisa de credencial do Google.
//
// Cache em escopo de módulo: no Fluid Compute a instância fica quente entre
// requisições, então a planilha é baixada uma vez a cada TTL, não a cada mensagem.

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTK9DhrWACjloFOoAUsC26xHmJLgnpDXnjvN4IzROtUC4WTx-64d4wM661AtlgPJkbt_jOXQsxrCfDk/pub?output=csv";
const TTL_MS = 10 * 60 * 1000;

let cache = null;        // Map<idNumerico, {gestor, status}>
let cacheEm = 0;
let baixando = null;     // evita N downloads simultâneos numa rajada de mensagens

// A planilha guarda o id do grupo em duas colunas e dois formatos
// ("1203632662...-group" e "1203632662...@g.us"). A parte numérica é a mesma.
export const idNumerico = (v) => String(v || "").split("@")[0].replace(/\D/g, "");

// CSV com vírgula dentro de campo entre aspas — parser mínimo, uma linha por vez.
function celulas(linha) {
  const out = [];
  let atual = "", aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; }
      else aspas = !aspas;
    } else if (c === "," && !aspas) { out.push(atual); atual = ""; }
    else atual += c;
  }
  out.push(atual);
  return out;
}

function montar(csv) {
  const linhas = csv.split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) throw new Error("planilha vazia");
  const cab = celulas(linhas[0]).map((s) => s.trim().toLowerCase());
  const iGestor = cab.findIndex((c) => c.includes("gestor"));
  const iStatus = cab.findIndex((c) => c === "status");
  if (iGestor < 0 || iStatus < 0) throw new Error("planilha sem coluna de gestor ou status");

  const mapa = new Map();
  for (const linha of linhas.slice(1)) {
    const c = celulas(linha);
    const gestor = (c[iGestor] || "").trim();
    const status = (c[iStatus] || "").trim();
    // Não confia em índice fixo para o id: qualquer célula que pareça um id de
    // grupo do WhatsApp vale. A planilha tem duas, e colunas mudam de lugar.
    for (const cel of c) {
      const id = idNumerico(cel);
      if (id.length >= 15 && /(-group|@g\.us)$/i.test(String(cel).trim())) {
        mapa.set(id, { gestor: gestor || null, status: status || null });
      }
    }
  }
  if (!mapa.size) throw new Error("planilha sem nenhum id de grupo reconhecido");
  return mapa;
}

export async function gestorStatusDoGrupo(grupoId) {
  const agora = Date.now();
  if (!cache || agora - cacheEm > TTL_MS) {
    if (!baixando) {
      baixando = (async () => {
        const r = await fetch(CSV_URL, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error(`planilha HTTP ${r.status}`);
        return montar(await r.text());
      })()
        .then((m) => { cache = m; cacheEm = Date.now(); })
        // Falha na planilha não pode derrubar a ingestão: segue com o cache velho
        // (ou sem enriquecimento) e a mensagem entra mesmo assim.
        .catch((e) => { console.error(`[planilha] ${String(e.message).slice(0, 150)}`); })
        .finally(() => { baixando = null; });
    }
    if (!cache) await baixando;   // primeira carga: espera. Depois, atualiza em segundo plano.
  }
  if (!cache) return {};
  return cache.get(idNumerico(grupoId)) || {};
}

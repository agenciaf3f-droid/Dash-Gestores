# Trocar o n8n pela ingestão direta da UAZAPI

Estado em 21/07/2026. O n8n continua sendo a **única** fonte do banco. Nada do que
está no ar mudou o dashboard.

## Por que estamos fazendo isso

O dia 19/07 ficou sem ingestão. A causa não era o n8n: era a instância 1 deslogada
(`lastDisconnect: 2026-07-19 07:48 — "401: logged out from another device"`). Ela é
a **única** com webhook ligado hoje, então quando cai, o dashboard cega.

As três instâncias também não veem os mesmos grupos:

| | grupos F3F abertos |
|---|---|
| inst1 (5511940786911) | 114 |
| inst2 (5511986358506) | 112 |
| inst3 (5511935006115) | 114 |
| **união** | **120** |

Escutar só a inst1 perde 6 grupos abertos. Só a inst2, 8. Só a inst3, 6. As três, zero.

## Desenho

As três apontam para o mesmo endpoint. A deduplicação é por `message.messageid`.

Confirmado com dado real, não suposto: a mesma mensagem chega pelas duas instâncias
com `message.id` **diferente** (prefixado com o número da instância) e `messageid`
**idêntico**:

```
inst2:  id = 5511986358506:3EB06D3D5B4EA9CBC017E5   messageid = 3EB06D3D5B4EA9CBC017E5
inst3:  id = 5511935006115:3EB06D3D5B4EA9CBC017E5   messageid = 3EB06D3D5B4EA9CBC017E5
```

Usar `message.id` como chave — que é o nome óbvio — nunca deduplicaria nada, e o
dashboard contaria cada mensagem 2 ou 3 vezes, em silêncio.

Nas primeiras 100 amostras: 50 mensagens distintas, **49 capturadas por duas
instâncias**. Sem dedupe, 98% de duplicata.

## Passos

### ✅ 1. Endpoint de captura — feito

`api/uazapi-hook.js` no Vercel. Protegido por segredo na query string
(`UAZAPI_HOOK_SECRET`), comparado com `timingSafeEqual`, responde 404 em vez de 401.
Responde 200 mesmo em falha de gravação: webhook com erro entra em retry e repetir
demais derruba a assinatura na UAZAPI.

Guarda o payload cru em `uazapi_raw`. **Não escreve em `Controle de Mensagens`.**

O token da instância vem dentro de cada webhook e é apagado antes de gravar.

### ✅ 2. Tabela de captura — feito

```sql
create table if not exists public.uazapi_raw (
  id bigserial primary key,
  recebido_em timestamptz not null default now(),
  instancia text, evento text, payload jsonb not null
);
alter table public.uazapi_raw enable row level security;  -- sem policy: chave pública não lê
create index if not exists uazapi_raw_recebido_idx on public.uazapi_raw (recebido_em desc);
```

### ✅ 3. Apontar inst2 e inst3 — feito

Estavam sem webhook (`enabled=false` e `null`), então ligar não desviou nada.
Config anterior salva. A inst1 segue no n8n.

### ⬜ 4. Fechar o mapa de `Tipo`

Descoberto nas amostras reais:

| `type` | `messageType` | `mediaType` | vira `Tipo` |
|---|---|---|---|
| text | Conversation | — | Texto |
| text | ExtendedTextMessage | — | Texto |
| media | AudioMessage | ptt | Áudio |
| media | ImageMessage | image | Imagem |
| media | VideoMessage | video | Vídeo |
| media | DocumentMessage | document | **novo — o banco não tem esse tipo hoje** |
| reaction | ReactionMessage | — | **novo — hoje o n8n grava como Texto** |

Ainda falta amostra de **figurinha** e **clique de botão**.

**Achado importante:** o banco hoje só tem `Texto/Áudio/Imagem/Vídeo/Botão`. Não existe
"Reação" nem "Figurinha". Ou seja, o n8n hoje grava reação como se fosse mensagem de
texto com o emoji — **é exatamente por isso que reação de cliente abria atendimento**, e
por isso existe a função `soEmoji()` no dashboard, adivinhando pelo conteúdo.

Com `type=reaction` vindo de graça da UAZAPI, isso deixa de ser adivinhação.

### ⬜ 5. Ligar a escrita real, em paralelo

Antes, limpar as duplicatas que já existem e criar o índice:

```sql
-- 34 pares de linhas byte-a-byte idênticas com o mesmo message_id (n8n gravando 2x)
delete from public."Controle de Mensagens" a
 using public."Controle de Mensagens" b
 where a.id > b.id and a.message_id = b.message_id and a."Grupo" = b."Grupo"
   and a.message_id is not null and a.message_id <> '';

create unique index if not exists msgs_grupo_msgid_uniq
  on public."Controle de Mensagens" ("Grupo", message_id)
  where message_id is not null and message_id <> '';
```

O índice é parcial de propósito: 97.128 linhas antigas têm `message_id` nulo e
precisam continuar existindo.

O endpoint passa a escrever com `Prefer: resolution=ignore-duplicates`. O n8n **continua
rodando** — as duas escritas convivem, e o índice descarta o que repetir.

Enriquecimento de `Gestor` e `Status`: a planilha *Controle dos Grupos* já está publicada
em CSV e tem `ID do Grupo` nos dois formatos. Não precisa de acesso novo ao Google.

### ⬜ 6. Comparar antes de cortar

Por alguns dias, conferir: contagem por hora, mensagens que o n8n gravou e o endpoint
não (e vice-versa), e se `Tipo`/`Horário`/`Número` batem linha a linha.

### ⬜ 7. Cortar

Apontar a inst1 para o endpoint, desligar o webhook do n8n. Manter o n8n parado, não
apagado, por uma semana.

## Pendências que não são de código

- **Rotacionar a chave da OpenAI.** `GET /instance/status` da inst1 devolve
  `openai_apikey` em texto puro para quem tiver o token da instância.
- **Rotacionar a `sb_secret_`** do projeto de dados.
- **Trocar o `UAZAPI_HOOK_SECRET`** ao final (foi exposto em conversa).

## Como desfazer

| O quê | Como |
|---|---|
| Instâncias | `POST /webhook` com a config salva em `webhook-backup.json` |
| Endpoint | `enabled=false` nas instâncias, ou remover `api/uazapi-hook.js` |
| Índice único | `drop index msgs_grupo_msgid_uniq` |
| Tabela de captura | `drop table public.uazapi_raw` |

Nada disso toca o n8n, que segue como fonte até o passo 7.

# Trocar o n8n pela ingestão direta da UAZAPI

**Corte feito em 21/07/2026 às 15:43.** O n8n não recebe mais nada e fica parado,
como backup, por uma semana — o dashboard não depende mais dele.

**Desde 22/07 a ingestão é de duas instâncias: inst1 e inst2.** A inst3 saiu do
nosso sistema (webhook desligado); a instância em si continua existindo e
conectada na UAZAPI, intocada — quem envia mensagem por ela não foi afetado.

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

### ✅ 4. Fechar o mapa de `Tipo` — feito

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

Fechado depois com amostra real: figurinha (`StickerMessage` → Figurinha) e clique
de botão (`ButtonsResponseMessage`, text vazio, rótulo em `vote`). O mapa completo
está em `api/_uazapi-map.js`.

**Achado importante:** o banco hoje só tem `Texto/Áudio/Imagem/Vídeo/Botão`. Não existe
"Reação" nem "Figurinha". Ou seja, o n8n hoje grava reação como se fosse mensagem de
texto com o emoji — **é exatamente por isso que reação de cliente abria atendimento**, e
por isso existe a função `soEmoji()` no dashboard, adivinhando pelo conteúdo.

Com `type=reaction` vindo de graça da UAZAPI, isso deixa de ser adivinhação.

### ✅ 5. Ligar a escrita real, em paralelo — feito (21/07 ~15:10)

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

O `ignore-duplicates` do PostgREST não serviu: o índice é parcial e o Postgres não
casa `ON CONFLICT` com índice parcial. Em vez disso o endpoint trata **409 como
sucesso** — é o caminho esperado de ~44% dos webhooks. O n8n **continua rodando** —
as duas escritas convivem, e o índice descarta o que repetir.

Enriquecimento de `Gestor` e `Status`: a planilha *Controle dos Grupos* já está publicada
em CSV e tem `ID do Grupo` nos dois formatos. Não precisa de acesso novo ao Google.

### ✅ 5b. Só grupo que a planilha conhece — feito

Na primeira tarde de escrita apareceram três grupos que o n8n nunca gravou:
**UPLOADER PRO, UPLoader ESPARTA e UPLOADERS #23** — comunidades de uploaders que
as instâncias 2 e 3 escutam, não cliente. O dashboard agrega qualquer linha, então
virariam "clientes" sem gestor.

O critério que separa cliente de resto já existe: os 106 grupos que o n8n gravou na
última semana resolvem todos na planilha; os três UPLOADER, não. O webhook passou a
ignorar grupo que a planilha (carregada) não conhece; planilha fora do ar deixa a
mensagem entrar sem enriquecimento. As 7 linhas UPLOADER gravadas foram apagadas
(continuam em `uazapi_raw`).

No mesmo passo, as mensagens capturadas **antes** de a escrita entrar no ar
(14:11–15:10) foram reprocessadas de `uazapi_raw`: **25 mensagens de cliente
recuperadas**, sendo 17 da EDINEUMA (a cliente invisível) e as imagens que o n8n
perdeu na janela da comparação. Zero duplicata: o índice segurou o resto.

### ✅ 6. Comparação — primeira rodada (21/07, ~50 min de captura)

Comparação feita **sem escrever nada**: o que as instâncias 2 e 3 capturaram, traduzido
pelo mapeador, contra o que o n8n gravou na mesma janela.

| | |
|---|---|
| mensagens distintas capturadas | 142 |
| gravadas pelo n8n | 72 |
| nas duas fontes | 71 |
| divergência de `Tipo` nas 71 | **0** |
| divergência de `Horário` nas 71 | **0** |

O mapeador reproduz a saída do n8n exatamente nos campos que viram número.

Das 71 que o n8n não gravou, 22 são de grupo F3F. Separando as duas causas:

**Cobertura — 15 mensagens.** Todas de `F3F - EDINEUMA RODRIGUES de Sousa - Low-Ticket`,
grupo onde o n8n **nunca** gravou nada: a instância 1 não está nele. Esse cliente é
invisível para o dashboard hoje.

**Perda real — 7 mensagens**, em 4 grupos onde o n8n gravou minutos antes e depois
(ou seja, a instância 1 está lá). Reconferidas 10 minutos depois: continuavam ausentes,
então não é atraso.

```
14:23:47  Imagem     F3F - Guilherme da Silva Fortunato - 1 FASE
14:28:54  Imagem     F3F - Karine Xavier de Oliveira - Low-ticket
14:51:01  Imagem     F3F - De Salles Treinamento e Produtos Digitais
14:51:01  Imagem     F3F - De Salles Treinamento e Produtos Digitais
14:51:15  Imagem     F3F - De Salles Treinamento e Produtos Digitais
14:53:30  Figurinha  F3F - Mari Eiras - PREMIUM
14:59:32  Reação     F3F - Mari Eiras - PREMIUM
```

**Cinco imagens, uma figurinha, uma reação. Nenhum texto.** A perda está concentrada em
mídia — o caminho em que o n8n chama a IA para descrever a imagem. Amostra pequena
(50 minutos), mas o padrão não parece acaso.

### ⬜ 6b. Confirmar com mais tempo

Por alguns dias, conferir: contagem por hora, mensagens que o n8n gravou e o endpoint
não (e vice-versa), e se `Tipo`/`Horário`/`Número` batem linha a linha.

**Segunda rodada (21/07, janela 15:10–15:30 com escrita no ar):** 36 mensagens
capturadas = 36 na tabela, 0 falha de escrita, 0 que só o n8n viu. Na interseção
do dia (112 mensagens), divergência zero em `Tipo`, `Número` e `Nome`; 1 divergência
de `Horário` de **2 segundos** — o n8n usa o relógio dele, o endpoint usa o
`messageTimestamp` da mensagem. O formato da linha é o mesmo.

### ✅ 7. Cortar — feito (21/07 15:43)

O webhook existente da inst1 (que apontava para o n8n no Railway) foi atualizado no
lugar, para `/api/uazapi-hook?s=…&i=1`. Detalhe da API: `POST /webhook` exige o campo
`action` — sem ele devolve `400 {"error":"Invalid action"}` e não muda nada. O corpo
que funcionou:

```
POST {servidor}/webhook   (header: token da inst1)
{ "action": "update", "id": "<id do webhook>", "enabled": true,
  "url": "https://<dominio>/api/uazapi-hook?s=<segredo>&i=1",
  "events": ["messages"], "excludeMessages": [] }
```

Verificado ponta a ponta: ~1 minuto após o corte, mensagem da inst1 chegou em
`uazapi_raw` com `i=1` e virou exatamente **1 linha** na tabela (Áudio, gestor
certo). A config antiga (URL do Railway) está em `webhook-backup.json` da sessão,
junto com o estado pré-migração da inst2 e inst3.

O n8n **não recebe mais nada** — não precisou mexer nele. Fica parado uma semana
como plano de volta; depois, desativar o workflow.

### ✅ 8. Duas instâncias, não três (22/07)

A inst3 saiu da ingestão a pedido. Antes de desligar, medida a perda de cobertura
pela lista de grupos de cada instância (`GET /group/list`):

| | grupos |
|---|---|
| união das três | 631 |
| inst1 + inst2 | 619 |
| só na inst3 | 12 — **nenhum é cliente** (todos fora da planilha) |

Os 12 são grupo interno: "Globais 10 - Presencial/Online", "UPLoader Escala" e
afins, que o webhook já ignorava. Perda de cliente: zero.

**Achado no meio do caminho:** o webhook da inst3 não apontava mais para o nosso
endpoint — tinha voltado para a URL do n8n no Railway. A inst3 entregou para nós
até **10:37 de 22/07** e parou. Ninguém mexeu nisso pela mão; a suspeita é que o
workflow do n8n reconfigure o webhook da instância sozinho quando roda.

Não houve estrago: nas 331 linhas do dia não há nenhuma assinatura do n8n
(coluna `Reply` preenchida, áudio transcrito, linha sem `message_id`), nenhuma
duplicata, e os grupos que só a inst3 via já eram ignorados. O n8n recebeu e não
escreveu.

**Confirmado às 16:00 do mesmo dia:** o webhook da inst3 foi desligado por nós às
~13:50 e estava **ligado de novo** duas horas depois, apontando para o Railway.
Ninguém encostou nele. Não é teoria: o workflow do n8n reconfigura o webhook da
instância sozinho, e desligar pelo nosso lado não gruda.

**Risco que fica:** o mesmo mecanismo pode repontar a inst1 ou a inst2 — e aí a
ingestão para de verdade, calada. Desligar o workflow no Railway deixou de ser
faxina e virou a única correção durável; do nosso lado não há como impedir.

O que dá para fazer daqui é vigiar: conferir de hora em hora se inst1 e inst2
continuam apontadas para o endpoint, e avisar no minuto em que saírem.

## Pendências que não são de código

- **Preencher o `Gestor Responsável` da EDINEUMA na planilha.** O grupo resolve
  (status Ativo) mas a célula de gestor está vazia — as linhas dela entram com
  `Gestor` nulo até alguém preencher.
- **Rotacionar a chave da OpenAI.** `GET /instance/status` da inst1 devolve
  `openai_apikey` em texto puro para quem tiver o token da instância.
- **Rotacionar a `sb_secret_`** do projeto de dados.
- **Trocar o `UAZAPI_HOOK_SECRET`** (foi exposto em conversa).
- **Rotacionar os tokens das instâncias** depois que o corte estabilizar —
  também circularam em conversa. Atenção: outros sistemas usam esses tokens para
  **enviar** mensagem (n8n, edge functions do f3f-auto-ads via
  `UAZAPI_INSTANCE_TOKEN`); rotacionar exige atualizar lá também.

## Como desfazer

| O quê | Como |
|---|---|
| Instâncias | `POST /webhook` com a config salva em `webhook-backup.json` |
| Endpoint | `enabled=false` nas instâncias, ou remover `api/uazapi-hook.js` |
| Índice único | `drop index msgs_grupo_msgid_uniq` |
| Tabela de captura | `drop table public.uazapi_raw` |

Nada disso toca o n8n, que segue como fonte até o passo 7.

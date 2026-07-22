# Trilhas de atendimento — regra nova

Escrito em 22/07/2026, a partir da regra descrita pelo Raphael. Ainda **não** está
no código: hoje o dashboard usa o modelo antigo, descrito no fim.

## A regra

Uma trilha é um cliente esperando resposta. Ela tem um **dono** — a pessoa de quem
se espera a resposta — que pode não existir (trilha sem dono).

**1. Cliente manda mensagem → abre trilha.**

Para quem? O que a mensagem apontar:

| a mensagem do cliente… | dono da trilha |
|---|---|
| marca alguém com `@` | quem foi marcado |
| responde (cita) a mensagem de alguém do time | quem escreveu a citada |
| não aponta para ninguém | **sem dono** |

Se essa pessoa já tem uma trilha aberta nesse grupo, não abre outra — o cronômetro
que vale é o da primeira mensagem sem resposta.

**2. Quem responde fecha a trilha.**

- Trilha **sem dono**: o primeiro do time que falar fecha. Gestor, estratégia,
  edição, webdesign — qualquer um.
- Trilha **com dono**: só o dono fecha. Outro membro falando no grupo não fecha a
  trilha alheia (nem a mantém refém: ele pode falar à vontade).

**3. Marcar alguém é repassar, não atender.**

Mensagem de membro do time que marca outro membro com `@` **não fecha** trilha
nenhuma. Ela transfere: a trilha aberta passa a ser do marcado, e o cronômetro
continua correndo até o marcado responder.

É o que destrava o caso do dia a dia: "essa mensagem era pro design" — marco o
design, confirmo que a trilha é dele, e sigo falando no grupo sem assumir nada.

**4. Depois do repasse, conversa nova abre trilha nova.**

Se o cliente responder a quem repassou, isso é uma mensagem apontando para essa
pessoa: abre uma segunda trilha, dona dela. As duas correm em paralelo, cada uma
esperando o seu dono.

**5. Lead time conta para quem respondeu.**

Fechou a trilha, o tempo entra no painel de quem fechou — não no do gestor do
grupo. Cada um vê o próprio tempo de resposta.

## O que não conta

Regras que já existem hoje e continuam valendo:

- Automação (`5511940786911`) é ignorada: não abre, não fecha, não reseta.
- Reação e figurinha de cliente não abrem trilha — reagir não é pedido.
- Clique de botão de cliente não abre trilha — confirmar botão não é pedido.
- Resposta do cliente a uma mensagem do bot não abre trilha.
- Grupo fechado (marcado na planilha) não abre nem fecha trilha.
- Grupo parado há mais de 45 dias não conta trilha aberta.

## Exemplos reais (21/07)

**Menegocci** — Rafa manda áudio 14:34, ninguém marcado → trilha sem dono. Paulo
(estratégia) responde 15:24 → fecha, 50 min, no painel do Paulo.
*Hoje:* fica em aberto para sempre, porque só gestor fecha trilha de gestor.

**Sinergia** — Camila manda imagem 19:35 citando o Diogo → trilha do Diogo. Só o
Diogo fecha. Segue em aberto de verdade.
*Hoje:* igual — este é um ticket legítimo.

**Jucilaine** — cliente escreve 09:19 sem marcar ninguém → trilha sem dono. Editor
responde 09:20 → fecha, 1 min.
*Hoje:* fica em aberto para sempre, porque o gestor do grupo na planilha é
"Vídeos" e o telefone do editor não está na lista de gestores.

## O modelo antigo (o que está no ar hoje)

Quatro trilhas fixas por grupo, uma por **setor**: gestor, edição, webdesign,
estratégia. A mensagem do cliente escolhe o setor pela marcação ou pela citação;
sem nenhuma das duas, vai para a do gestor. Cada setor só é fechado por alguém
daquele setor.

Duas consequências que motivaram a troca:

1. Quem responde fora do setor não fecha nada. Trilha do gestor respondida pelo
   estrategista fica aberta para sempre.
2. Marcação nunca funcionou: o texto do WhatsApp traz `@249159827382448` (o LID
   interno), e o código compara com `@5511936228704` (o telefone). Em 30 dias,
   271 marcações apontaram para o time e nenhuma foi reconhecida. Sem marcação e
   sem citação, quase tudo cai na trilha do gestor — que era a pergunta original:
   "por que toda trilha vai pro gestor?"

A citação já foi consertada em 22/07 (passa a ser resolvida por `reply_to_id`).
A marcação depende do mapa LID→telefone, que sai dos próprios dados: cada linha
guarda `sender_lid` e `Número`, então quem já falou uma vez fica identificado —
218 pessoas mapeadas nos últimos 30 dias.

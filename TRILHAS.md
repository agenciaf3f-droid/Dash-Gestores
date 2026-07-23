# Trilhas de atendimento — regra nova

Escrito em 22/07/2026, a partir da regra descrita pelo Raphael. **No ar** desde
22/07: `PASS 2.6` em `public/dashboard.html`. O modelo antigo, descrito no fim,
continua valendo para trilha aberta antes do corte.

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

**2. Quem responde fecha a trilha — qualquer um do time.**

Não importa o dono. Se o cliente escreveu para o design e o gestor respondeu,
está atendido: fecha, e o tempo conta para o gestor. Ter dono não prende a trilha
a ninguém; dono é só de quem se espera a resposta enquanto ela está aberta.

**3. Marcar alguém é repassar, não atender.**

A única forma de responder **sem** fechar é marcar outro membro com `@`. Aí a
mensagem vira repasse: a trilha passa a ser do marcado e o cronômetro continua
correndo até ele responder.

Basta o `@`. Não precisa citar a mensagem do cliente junto — marcar já é o
suficiente para repassar.

É a válvula da regra 2: se era algo que só o design podia resolver, o gestor
marca o design, confirma que a trilha é dele, e segue falando no grupo sem
assumir nada.

**3b. Quem repassou não fecha o que acabou de repassar.**

Depois de marcar o design, o gestor pode escrever à vontade — nenhuma mensagem
dele fecha aquela trilha. Fechar, só o design ou outra pessoa. Sem isso a regra 2
desfaria o repasse na mensagem seguinte.

Marcar o **cliente** não é repasse: só conta `@` que aponta para alguém do time.

**4. Depois do repasse, conversa nova abre trilha nova.**

Se o cliente responder a quem repassou, isso é uma mensagem apontando para essa
pessoa: abre uma segunda trilha, dona dela. As duas correm em paralelo, cada uma
esperando o seu dono.

**5. Lead time conta para quem respondeu.**

Fechou a trilha, o tempo entra no painel de quem fechou — não no do gestor do
grupo. Cada um vê o próprio tempo de resposta.

**6. Cliente marca dois → abre para os dois.**

Quando o cliente marca dois (ou mais) membros na mesma mensagem, a trilha abre
para todos ao mesmo tempo. Fecha quando **qualquer um do time** responde, e o
tempo conta no painel de **cada um dos marcados**. Se ninguém responde, ficam
pendentes, um por pessoa.

Na média do grupo o atendimento conta uma vez só — são vários créditos de pessoa,
não vários atendimentos. Vale só para a marcação múltipla do cliente: marcar um e
outro responder continua contando para quem respondeu (regra 5). O crédito de
gestor segue pelo gestor do grupo; o de edição, webdesign e estratégia vai para a
pessoa marcada.

## De quando vale

A regra nova vale para trilha **aberta a partir de 22/07/2026**. Trilha aberta
antes disso continua calculada pelo modelo antigo, para não mudar número que já
foi apresentado. Na prática o motor roda os dois e escolhe pela data de abertura.

Com uma exceção: trilha que ficou **aberta** no modelo antigo é descartada, não
mostrada como pendente. Eram trilhas de setor que só fechavam por gente do mesmo
setor — respondidas por outro, ficavam penduradas para sempre, contando
expediente até agora. Com a virada de modelo isso deixou de fazer sentido, então
o pendente que só o motor velho enxergava sai da conta. Os atendimentos
**fechados** de antes do corte continuam intactos.

## O que não conta

Regras que já existem hoje e continuam valendo:

- Automação (`5511940786911`) é ignorada: não abre, não fecha, não reseta.
- Reação e figurinha de cliente não abrem trilha — reagir não é pedido.
- Clique de botão de cliente não abre trilha — confirmar botão não é pedido.
- Resposta do cliente a uma mensagem do bot não abre trilha.
- Grupo fechado (marcado na planilha) não abre nem fecha trilha.
- Grupo parado há mais de 45 dias não conta trilha aberta.

## Conferência do motor (22/07)

Seis cenários, montados à mão e passados pelo motor de verdade extraído do arquivo:

| cenário | esperado | saiu |
|---|---|---|
| cliente pergunta, gestor responde | fecha, gestor | fechada GESTOR 5min |
| gestor marca @design, fala de novo, design responde | repasse; fecha no design | fechada WEBDESIGN 15min |
| cliente cita o design, gestor responde | fecha (dono não prende) | fechada GESTOR 5min |
| gestor marca @design e ninguém responde | aberta, com o design | ABERTA WEBDESIGN |
| cliente manda 3 seguidas | 1 trilha, desde a primeira | fechada 15min |
| cliente só reage | não abre | nenhuma trilha |

Nos dados reais, do corte até 22/07 16:30: 83 trilhas, 80 fechadas, média 23 min,
nenhum tempo negativo. O Paulo (estratégia) fechou 15 — antes, todas essas ficavam
abertas para sempre, porque estrategista não fechava trilha de gestor.

## Exemplos reais (21/07)

**Menegocci** — Rafa manda áudio 14:34, ninguém marcado → trilha sem dono. Paulo
(estratégia) responde 15:24 → fecha, 50 min, no painel do Paulo.
*Hoje:* fica em aberto para sempre, porque só gestor fecha trilha de gestor.

**Sinergia** — Camila manda imagem 19:35 citando o Diogo → trilha do Diogo. O
designer responde 19:51 → fecha, 16 min, no painel do designer. Se fosse coisa que
só o Diogo resolve, o designer teria marcado o Diogo em vez de responder.
*Hoje:* fica em aberto para sempre, esperando o Diogo.

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

// Traduz um webhook da UAZAPI para uma linha de "Controle de Mensagens".
//
// Função pura, sem rede, para poder ser testada contra os payloads reais já
// capturados em uazapi_raw. Nada aqui foi suposto: cada combinação de tipo abaixo
// saiu de amostra observada.

// type / messageType -> o rótulo que o dashboard lê na coluna Tipo.
// Texto, Áudio, Imagem, Vídeo e Botão já existiam no banco. Figurinha, Reação,
// Documento e Contato são novos: até hoje o n8n não tinha como distingui-los e
// empurrava tudo para Texto ou Imagem.
const POR_MESSAGE_TYPE = {
  Conversation:               "Texto",
  ExtendedTextMessage:        "Texto",
  TemplateButtonReplyMessage: "Botão",
  ButtonsResponseMessage:     "Botão",
  ListResponseMessage:        "Botão",
  AudioMessage:               "Áudio",
  ImageMessage:               "Imagem",
  VideoMessage:               "Vídeo",
  StickerMessage:             "Figurinha",
  DocumentMessage:            "Documento",
  ContactMessage:             "Contato",
  ReactionMessage:            "Reação",
};

// Fallback por mediaType, para um messageType que eu ainda não tenha visto.
const POR_MEDIA_TYPE = {
  ptt: "Áudio", audio: "Áudio", image: "Imagem", video: "Vídeo",
  sticker: "Figurinha", document: "Documento", vcard: "Contato",
};

export function tipoDaMensagem(m) {
  if (!m) return "Texto";
  const porTipo = POR_MESSAGE_TYPE[m.messageType];
  if (porTipo) return porTipo;
  const porMidia = POR_MEDIA_TYPE[String(m.mediaType || "").toLowerCase()];
  if (porMidia) return porMidia;
  if (m.type === "reaction") return "Reação";
  if (m.buttonOrListid) return "Botão";
  return "Texto";
}

// O banco guarda "2026-07-16T16:40:45": ISO sem fuso, já em horário de Brasília.
// messageTimestamp vem em milissegundos UTC.
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
export function horarioBRT(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n - BRT_OFFSET_MS).toISOString().slice(0, 19);
}

const soDigitos = (v) => String(v || "").split("@")[0].replace(/\D/g, "");

// gestorStatus: (grupoId) => { gestor, status }. Vem da planilha "Controle dos
// Grupos", que o dashboard já lê publicada em CSV.
export function linhaDoWebhook(payload, gestorStatus) {
  const m = payload && payload.message;
  if (!m) return { erro: "payload sem message" };

  // messageid, NÃO id: o id vem prefixado com o número da instância
  // (5511986358506:3EB06D…), então difere entre as instâncias para a MESMA mensagem e
  // nunca deduplicaria. messageid é idêntico — confirmado com captura real.
  const messageId = String(m.messageid || "").trim();
  if (!messageId) return { erro: "sem messageid" };

  const grupo = String(m.chatid || (payload.chat && payload.chat.wa_chatid) || "").trim();
  if (!grupo) return { erro: "sem chatid" };

  const horario = horarioBRT(m.messageTimestamp);
  if (!horario) return { erro: "timestamp inválido" };

  const tipo = tipoDaMensagem(m);

  // Figurinha e áudio chegam com text vazio (o conteúdo é a mídia criptografada) —
  // ficam sem Mensagem, já que não vamos transcrever nem descrever por enquanto.
  // Reação chega com o emoji no text e o alvo em m.reaction.
  // Clique de botão chega com text vazio, o rótulo clicado em vote ("Não vou
  // conseguir participar!") e o código em buttonOrListid ("ButtonsV3:#RCANCELADA").
  // Fica o rótulo: é o que serve para ler a conversa no drill. Quem decide se a
  // mensagem conta para lead time é o Tipo, não o texto.
  const mensagem = String(m.text || "").trim()
    || (tipo === "Botão" ? String(m.vote || m.buttonOrListid || "").trim() : "");

  const { gestor, status } = gestorStatus(grupo) || {};

  return {
    linha: {
      "Grupo": grupo,
      "Nome": String(m.senderName || "").trim(),
      "Número": soDigitos(m.sender_pn),
      "Mensagem": mensagem || null,
      "Horário": horario,
      "Tipo": tipo,
      "Nome do Grupo": String(m.groupName || (payload.chat && payload.chat.name) || "").trim(),
      "Gestor": gestor || null,
      "Status": status || null,
      "Reply": null,                       // o texto citado o n8n resolvia; aqui vale o id abaixo
      "sender_lid": String(m.sender_lid || "").trim() || null,
      "message_id": messageId,
      // Numa reação, o "alvo" é a mensagem que recebeu o emoji; num reply, a citada.
      "reply_to_id": String(m.reaction || m.quoted || "").trim() || null,
    },
  };
}

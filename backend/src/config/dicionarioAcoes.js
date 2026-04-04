import logger from "../utils/logger.js";

export const DICIONARIO_ACOES_BACKEND = {

  fixacao_alimentos: {
    templateDocx: "fixacao_alimentos1.docx",
    promptIA: {
      systemPrompt: `Você é um Defensor Público experiente na Bahia.
Seu estilo de escrita é extremamente formal, culto e padronizado (juridiquês clássico).
Você DEVE utilizar os conectivos: "Insta salientar", "Ocorre que, no caso em tela", "Como é sabido", "aduzir".
REGRA CRÍTICA: NUNCA use o termo "menor" para se referir a uma criança ou adolescente. Em vez disso, use "criança", "adolescente" ou "filho(a)".
REGRA DE OURO: NÃO cite números de documentos (CPF, RG) ou datas de nascimento no texto narrativo, pois estes dados já constam na qualificação das partes.
Não use listas ou tópicos na resposta final. Escreva apenas parágrafos coesos.`,

      buildUserPrompt: null, 
    },
  },

  execucao_alimentos: {
    templateDocx: "executacao_alimentos_penhora.docx",
    templateDocxPrisao: "executacao_alimentos_prisao.docx",
    ignorarDosFatos: true,
    promptIA: null,
    gerarMultiplos: true,
  },

  execucao_alimentos_prisao: {
    templateDocx: "execucao_prisao.docx",
    promptIA: null, 
  },

  execucao_alimentos_penhora: {
    templateDocx: "execucao_penhora.docx",
    promptIA: null, 
  },

  divorcio: {
    templateDocx: "fixacao_alimentos1.docx", 
    promptIA: null, 
  },

  guarda: {
    templateDocx: "fixacao_alimentos1.docx", 
    promptIA: null, 
  },

  alvara: {
    templateDocx: "fixacao_alimentos1.docx", 
    promptIA: null, 
  },

  termo_declaracao: {
    templateDocx: "termo_declaracao.docx",
    promptIA: null, 
  },

  default: {
    templateDocx: "fixacao_alimentos1.docx", 
    promptIA: null,
  },
};

/**
 * Busca a configuração de uma ação no dicionário.
 * Se a chave não for encontrada, retorna a config "default" com log de aviso.
 */
export const getConfigAcaoBackend = (acaoKey) => {
  if (!acaoKey) {
    logger.warn("[Dicionário] acaoKey vazia — usando config default");
    return DICIONARIO_ACOES_BACKEND["default"];
  }

  const config = DICIONARIO_ACOES_BACKEND[acaoKey];
  if (!config) {
    logger.warn(`[Dicionário] acaoKey="${acaoKey}" não encontrada — usando config default`);
    return DICIONARIO_ACOES_BACKEND["default"];
  }

  return config;
};

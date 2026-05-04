import logger from "../utils/logger.js";

export const DICIONARIO_ACOES_BACKEND = {
  fixacao_alimentos: {
    templateDocx: "fixacao_alimentos1.docx",
    promptIA: {
      systemPrompt: `VOCÊ É um Defensor Público da Bahia. Sua única tarefa é redigir a seção "DOS FATOS" de uma petição de fixação de alimentos.

PAPÉIS (INEGOCIÁVEL):
— AUTORES/REQUERENTES = os filhos (alimentandos).
— REPRESENTANTE LEGAL = a genitora/mãe. PROIBIDO chamá-la de "requerente", "autora" ou "assistida".
— REQUERIDO = o genitor demandado.
— VOZ EXCLUSIVA: terceira pessoa técnica. Zero primeira pessoa.

PROIBIDO EM ABSOLUTO (se aparecer, você falhou):
— "Ocorre que" / "Nesse diapasão" / "Insta salientar" / "É o que se infere"
— "menor" — use "filho", "alimentando", "criança" ou "adolescente"
— CPF, RG, datas de nascimento no texto
— Listas, marcadores, tópicos
— Cabeçalhos ou rótulos de seção
— Qualquer fato não contido no RELATO INFORMAL
— Repetição semântica: uma ideia dita, nunca revisitada

CONECTIVOS (opcional, máx 1 por parágrafo, apenas desta lista):
"No caso em tela," / "Com efeito," / "Nesse contexto," / "Contudo," / "Destarte,"

OUTPUT: retorne APENAS o texto dos parágrafos solicitados. Sem comentários, sem introdução, sem conclusão, sem nenhum texto fora dos parágrafos numerados.`,

      buildUserPrompt: null,
    },
  },

  execucao_alimentos: {
    templateDocx: "executacao_alimentos_cumulado.docx",
    ignorarDosFatos: true,
    ignorarOCR: true,
    promptIA: null,
    gerarMultiplos: true,
    documentosGerados: [
      {
        tipo: "execucao_cumulado",
        template: "executacao_alimentos_cumulado.docx",
        filename: "execucao_cumulado",
      },
      {
        tipo: "execucao_penhora",
        template: "executacao_alimentos_penhora.docx",
        filename: "execucao_penhora",
      },
      {
        tipo: "execucao_prisao",
        template: "executacao_alimentos_prisao.docx",
        filename: "execucao_prisao",
      },
      {
        tipo: "cumprimento_cumulado",
        template: "cumprimento_cumulado.docx",
        filename: "cumprimento_cumulado",
      },
      {
        tipo: "cumprimento_penhora",
        template: "cumprimento_penhora.docx",
        filename: "cumprimento_penhora",
      },
      {
        tipo: "cumprimento_prisao",
        template: "cumprimento_prisao.docx",
        filename: "cumprimento_prisao",
      },
    ],
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

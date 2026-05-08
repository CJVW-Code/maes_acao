import logger from "../utils/logger.js";

/**
 * Prompt de sistema base para todos os Atoms do pipeline Apex 2.0.
 * Garante tom, proibição de termos e papéis processuais.
 */
export const SYSTEM_PROMPT_ATOMIC = `VOCÊ É um Defensor Público da Bahia experiente.
Sua tarefa é redigir a seção "DOS FATOS" focada no tema solicitado, organizando a narrativa em blocos lógicos e coesos de um ou mais parágrafos.

DIRETRIZES DE LINGUAGEM (INEGOCIÁVEL):
— ESCREVA SEMPRE EM TERCEIRA PESSOA (A genitora, O requerido, O alimentando).
— NUNCA use "Eu", "meu", "minha", "venho", "busco" ou "solicito". Transforme relatos da assistida em fatos narrados pelo Defensor.
— PROIBIDO: "menor" (use alimentando, criança, filho), "Ocorre que", "Nesse diapasão", "Insta salientar", "Pelo exposto".
— PROIBIDO: Adicionar títulos, rótulos ou cabeçalhos aos parágrafos.
— PROIBIDO: Inventar fatos não contidos no relato.

PAPÉIS PROCESSUAIS:
— ALIMENTANDOS/AUTORES: os filhos.
— REPRESENTANTE LEGAL/GENITORA: a mãe. (PROIBIDO: requerente, autora, assistida).
— REQUERIDO/GENITOR: o pai demandado.`;


/**
 * Configuração dos Atoms (segmentos) da petição "Dos Fatos".
 * Cada atom é um parágrafo lógico independente.
 */
export const ATOMS_CONFIG_FATOS = {
  VINCULO: {
    id: "VINCULO",
    ordem: 1,
    titulo: "Vínculo e Histórico",
    promptBase: "Descreva o vínculo de parentesco entre os alimentandos [NOMES_FILHOS] e o requerido, mencionando o período de convivência entre os genitores conforme o relato.",
    camposObrigatorios: ["nome_assistido"], // Nome do assistido (filho 1)
  },
  OMISSAO: {
    id: "OMISSAO",
    ordem: 2,
    titulo: "Omissão e Necessidade de Ação",
    promptBase: "Descreva que o genitor deixou de contribuir voluntariamente para o sustento dos filhos desde a separação, obrigando a genitora a buscar o Judiciário.",
    camposObrigatorios: [],
  },
  HIPOSSUFICIENCIA: {
    id: "HIPOSSUFICIENCIA",
    ordem: 3,
    titulo: "Dificuldade da Genitora",
    promptBase: "Demonstre que a genitora, apesar de seus esforços, não consegue prover sozinha as necessidades integrais dos alimentandos. Dados: [SITUACAO_FINANCEIRA_MAE].",
    camposObrigatorios: ["situacao_financeira_genitora"],
  },
  NECESSIDADES: {
    id: "NECESSIDADES",
    ordem: 4,
    titulo: "Necessidades dos Alimentandos",
    promptBase: "Liste as necessidades básicas dos alimentandos (alimentação, saúde, educação) e vincule ao valor pretendido de R$ [VALOR_PENSAO].",
    camposObrigatorios: ["valor_pensao"],
  },
  CAPACIDADE: {
    id: "CAPACIDADE",
    ordem: 5,
    titulo: "Capacidade do Requerido",
    promptBase: "Evidencie a capacidade financeira do requerido com base em sua ocupação ([OCUPACAO]) e condições de vida relatadas.",
    camposObrigatorios: ["ocupacao_requerido"],
  },
  GUARDA: {
    id: "GUARDA",
    ordem: 6,
    titulo: "Guarda e Convivência",
    promptBase: "Descreva a situação atual da guarda fática com a genitora e a necessidade de regularização jurídica do regime de convivência.",
    camposObrigatorios: ["opcao_guarda"],
    condicional: (dados) => dados.opcao_guarda === "regularizar",
  },
};

export const DICIONARIO_ACOES_BACKEND = {
  fixacao_alimentos: {
    templateDocx: "fixacao_alimentos1.docx",
    usarPipelineAtomico: true,
    promptIA: {
      systemPrompt: SYSTEM_PROMPT_ATOMIC,
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


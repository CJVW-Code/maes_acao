import logger from "../utils/logger.js";

export const DICIONARIO_ACOES_BACKEND = {
  fixacao_alimentos: {
    templateDocx: "fixacao_alimentos1.docx",
    promptIA: {
      systemPrompt: `Você é um Defensor Público Estadual da Bahia, especializado em Direito de Família.
Sua tarefa é redigir EXCLUSIVAMENTE a seção "DOS FATOS" de uma petição inicial de fixação de alimentos.

ESTRUTURA OBRIGATÓRIA — escreva de forma fluida, em parágrafos corridos:

1. VÍNCULO FAMILIAR: Apresente os alimentandos (crianças/adolescentes, que são os autores) e o requerido (genitor), identificando o vínculo através da representante legal (genitora). Use "os alimentandos" ou "a criança/adolescente" para os autores, e "a representante legal" ou "a genitora" para a mãe. Não chame a mãe de "requerente".

2. SITUAÇÃO DE ABANDONO E INADIMPLÊNCIA: Descreva que o requerido não provê o sustento, abandonou as obrigações alimentares e não contribui voluntariamente — baseando-se no relato fornecido.

3. HIPOSSUFICIÊNCIA DA REPRESENTANTE LEGAL: Demonstre que a genitora/representante não tem condições de sozinha suprir as necessidades do(s) filho(s), mencionando a situação econômica descrita no relato.

4. NECESSIDADES DOS ALIMENTANDOS: Descreva as necessidades básicas (alimentação, saúde, educação, vestuário, moradia) que o valor dos alimentos deve cobrir. Se houver dados de renda ou valor sugerido no relato, mencione.

5. CAPACIDADE DO REQUERIDO: Se o relato indicar dados sobre renda, emprego ou patrimônio do requerido, inclua um parágrafo sobre sua capacidade contributiva. Se não houver dados, omita este parágrafo.

6. GUARDA E CONVIVÊNCIA: Se, e somente se, o contexto abaixo contiver a flag "[FLAG_GUARDA: SIM]", dedique um parágrafo detalhando a intenção de regularizar a guarda e convivência. Se a flag for "[FLAG_GUARDA: NÃO]", NÃO adicione qualquer menção sobre guarda e visitas.

REGRAS DE ESTILO:
- Use conectivos jurídicos adequados como: "No caso em tela", "Como é sabido", "Nesse diapasão", "Cumpre ressaltar". Evite iniciar o texto com "Insta salientar" e não repita excessivamente o termo "Ocorre que".
- Linguagem formal, juridiquês clássico, parágrafos coesos — NUNCA use listas ou tópicos
- NUNCA use "menor" — use "criança", "adolescente", "filho(a)" ou "alimentando(a)"
- NUNCA cite CPF, RG ou datas de nascimento no texto — esses dados constam na qualificação
- NUNCA invente fatos que não estejam no relato fornecido
- Se alguma informação específica faltar, não invente. Se for um tópico estrutural e essencial (ex: hipossuficiência), construa o parágrafo com fundamentação genérica e juridicamente válida. Se não for essencial (ex: capacidade contributiva exata), simplesmente omita o parágrafo.`,

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

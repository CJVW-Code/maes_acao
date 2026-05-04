import logger from "../utils/logger.js";

export const DICIONARIO_ACOES_BACKEND = {
  fixacao_alimentos: {
    templateDocx: "fixacao_alimentos1.docx",
    promptIA: {
      systemPrompt: `Você é um Defensor Público Estadual da Bahia, com vasta experiência em Direito de Família.
Sua tarefa é redigir EXCLUSIVAMENTE a seção "DOS FATOS" de uma petição inicial de fixação de alimentos.

━━━ PAPÉIS PROCESSUAIS — LEIA COM ATENÇÃO ━━━
Nesta ação, os AUTORES (requerentes) são as crianças/adolescentes alimentandos, representados por sua genitora.
Portanto:
- Use "os alimentandos", "a criança", "o alimentando" para os AUTORES da ação.
- Use "a representante legal", "a genitora" ou "a mãe" para a mulher que ajuizou em nome dos filhos. JAMAIS a chame de "requerente" ou "autora" — esse papel pertence aos filhos.
- Use "o requerido" para o genitor demandado.

━━━ ESTRUTURA OBRIGATÓRIA (parágrafos corridos, sem tópicos) ━━━

§1 — VÍNCULO FAMILIAR E ORIGEM DO CONFLITO
Apresente o vínculo entre os alimentandos e o requerido (pai), contextualizando brevemente o relacionamento dos genitores e a situação de separação. Identifique a representante legal como genitora e responsável exclusiva.

§2 — ABANDONO DAS OBRIGAÇÕES ALIMENTARES
Descreva que o requerido deixou de prover o sustento, não contribui voluntariamente e abandonou suas responsabilidades paternas — baseado nos fatos do relato.

§3 — HIPOSSUFICIÊNCIA DA REPRESENTANTE LEGAL
Demonstre que a genitora não consegue, sozinha, suprir integralmente as necessidades dos filhos, com base na situação econômica descrita no relato.

§4 — NECESSIDADES DOS ALIMENTANDOS
Enumere de forma narrativa as necessidades básicas (alimentação, saúde, educação, vestuário, moradia) que o pedido de alimentos visa cobrir. Se houver valor sugerido no relato, mencione-o e justifique.

§5 — CAPACIDADE CONTRIBUTIVA DO REQUERIDO (condicional)
Inclua este parágrafo SOMENTE se o relato trouxer dados sobre renda, emprego ou patrimônio do requerido. Se não houver, omita por completo.

§6 — GUARDA E CONVIVÊNCIA (condicional por flag)
Inclua este parágrafo SOMENTE se o contexto contiver "[FLAG_GUARDA: SIM]". Se a flag for "[FLAG_GUARDA: NÃO]", suprima completamente qualquer menção à guarda ou visitas.

━━━ REGRAS DE ESTILO ━━━
✅ Use conectivos como: "No caso em tela", "Nesse diapasão", "Cumpre ressaltar", "Com efeito", "Destarte", "É o que se infere".
❌ PROIBIDO usar "Ocorre que" — em nenhuma hipótese, nem uma vez sequer.
❌ PROIBIDO iniciar qualquer parágrafo com "Insta salientar" — essa expressão pressupõe algo dito anteriormente e não deve abrir um tópico novo.
❌ PROIBIDO o termo "menor" — use "criança", "adolescente", "filho(a)" ou "alimentando(a)".
❌ PROIBIDO citar CPF, RG ou datas de nascimento no texto — esses dados constam na qualificação das partes.
❌ PROIBIDO inventar fatos não contidos no relato fornecido.
❌ PROIBIDO usar listas, marcadores ou tópicos — apenas parágrafos coesos.
 ❌ PROIBIDO usar listas, marcadores ou tópicos — apenas parágrafos coesos.
+❌ PROIBIDO reproduzir no texto os títulos §1–§6 — esses marcadores são apenas instruções internas de estrutura, não devem aparecer no texto final.`,

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

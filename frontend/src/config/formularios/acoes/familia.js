// status: "ativo" = visível no formulário | "scaffold" = existe mas não aparece.
export const ACOES_FAMILIA = {

  fixacao_alimentos: {
    titulo: "Fixação de Pensão Alimentícia",
    status: "ativo",

    
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido"],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: true, // assistidoEhIncapaz = "sim"


    templateWord: "template_fixacao_alimentos.docx",
    tagsTemplate: [
      "NOME_ASSISTIDO", "CPF_ASSISTIDO", "NOME_REQUERIDO", "CPF_REQUERIDO",
      "VALOR_PENSAO", "TIPO_CONTA", "BANCO", "AGENCIA", "CONTA", "PIX",
      "NOME_FILHO", "DATA_NASCIMENTO_FILHO",
    ],

    promptIA: {
      contexto: "O assistido está solicitando fixação de pensão alimentícia.",
      extrair: ["valor_pensao_pretendido", "dados_bancarios", "dados_filho", "dados_emprego_requerido"],
      instrucoes: "Se o valor da pensão não for informado, deixe a tag VALOR_PENSAO em branco para preenchimento manual.",
    },
  },

  execucao_alimentos: {
    titulo: "Execução de Alimentos Rito Penhora/Prisão",
    status: "ativo",

    secoes: ["SecaoEmpregoRequerido", "SecaoProcessoOriginal"],
    camposGerais: { mostrarBensPartilha: false, ocultarDetalhesGerais: true },
    forcaRepresentacao: true,
    ocultarRelato: true,

    templateWord: "template_execucao_alimentos.docx",
    tagsTemplate: [
      "NOME_ASSISTIDO", "CPF_ASSISTIDO", "NOME_REQUERIDO",
      "NUMERO_PROCESSO_ORIGINARIO", "VARA_ORIGINARIA",
      "PERIODO_DEBITO", "VALOR_TOTAL_DEBITO",
    ],

    promptIA: {
      contexto: "O assistido está solicitando execução de alimentos (cobrança de pensão atrasada).",
      extrair: ["processo_original", "periodo_debito", "valor_total_debito"],
      instrucoes: "",
    },
  },

  divorcio: {
    titulo: "Divórcio",
    status: "scaffold",

    secoes: ["SecaoDadosDivorcio"],
    camposGerais: { mostrarBensPartilha: true },
    forcaRepresentacao: false,

    templateWord: "template_divorcio.docx",
    tagsTemplate: [
      "NOME_ASSISTIDO", "CPF_ASSISTIDO", "NOME_REQUERIDO",
      "REGIME_BENS", "RETORNO_NOME_SOLTEIRA", "ALIMENTOS_EX_CONJUGE",
    ],

    promptIA: {
      contexto: "O assistido está solicitando divórcio.",
      extrair: ["regime_bens", "bens_partilha", "retorno_nome_solteira"],
      instrucoes: "",
    },
  },

  guarda: {
    titulo: "Guarda de Filhos",
    status: "scaffold",

    secoes: [], // Sem seções específicas extras — usa apenas os campos gerais
    camposGerais: { mostrarBensPartilha: true },
    forcaRepresentacao: false,

    templateWord: "template_guarda.docx",
    tagsTemplate: [
      "NOME_ASSISTIDO", "CPF_ASSISTIDO", "NOME_REQUERIDO",
      "DESCRICAO_GUARDA",
    ],

    promptIA: {
      contexto: "O assistido está solicitando guarda de filhos.",
      extrair: ["descricao_guarda", "situacao_financeira"],
      instrucoes: "",
    },
  },

  alvara: {
    titulo: "Alvará",
    status: "scaffold",

    secoes: [], // Alvará é simples — sem seções extras
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: false,
    isAlvara: true, // Flag especial: pula validação de requerido

    templateWord: "template_alvara.docx",
    tagsTemplate: ["NOME_ASSISTIDO", "CPF_ASSISTIDO"],

    promptIA: {
      contexto: "O assistido está solicitando alvará judicial.",
      extrair: [],
      instrucoes: "",
    },
  },


  revisao_alimentos_majoracao: {
    titulo: "Revisão de Alimentos (Majoração)",
    status: "scaffold",
    secoes: [],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: false,
    templateWord: "template_revisao_majoracao.docx",
    tagsTemplate: [],
    promptIA: {
      contexto: "O assistido está solicitando revisão de alimentos para aumento.",
      extrair: [], instrucoes: "",
    },
  },

  revisao_alimentos_reducao: {
    titulo: "Revisão de Alimentos (Redução)",
    status: "scaffold",
    secoes: [],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: false,
    templateWord: "template_revisao_reducao.docx",
    tagsTemplate: [],
    promptIA: {
      contexto: "O assistido está solicitando revisão de alimentos para redução.",
      extrair: [], instrucoes: "",
    },
  },

  uniao_estavel_reconhecimento: {
    titulo: "Reconhecimento e Dissolução de União Estável",
    status: "scaffold",
    secoes: [],
    camposGerais: { mostrarBensPartilha: true },
    forcaRepresentacao: false,
    templateWord: "template_uniao_estavel.docx",
    tagsTemplate: [],
    promptIA: {
      contexto: "O assistido está solicitando reconhecimento e dissolução de união estável.",
      extrair: [], instrucoes: "",
    },
  },

  regulamentacao_visitas: {
    titulo: "Regulamentação de Visitas",
    status: "scaffold",
    secoes: [],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: false,
    templateWord: "template_regulamentacao_visitas.docx",
    tagsTemplate: [],
    promptIA: {
      contexto: "O assistido está solicitando regulamentação de visitas.",
      extrair: [], instrucoes: "",
    },
  },

  reconhecimento_paternidade: {
    titulo: "Reconhecimento de Paternidade",
    status: "scaffold",
    secoes: [],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: false,
    templateWord: "template_reconhecimento_paternidade.docx",
    tagsTemplate: [],
    promptIA: {
      contexto: "O assistido está solicitando reconhecimento de paternidade.",
      extrair: [], instrucoes: "",
    },
  },

  inventario: {
    titulo: "Inventário / Partilha de Bens",
    status: "scaffold",
    secoes: [],
    camposGerais: { mostrarBensPartilha: true },
    forcaRepresentacao: false,
    templateWord: "template_inventario.docx",
    tagsTemplate: [],
    promptIA: {
      contexto: "O assistido está solicitando inventário e partilha de bens.",
      extrair: [], instrucoes: "",
    },
  },

  adocao: {
    titulo: "Adoção",
    status: "scaffold",
    secoes: [],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: false,
    templateWord: "template_adocao.docx",
    tagsTemplate: [],
    promptIA: {
      contexto: "O assistido está solicitando adoção.",
      extrair: [], instrucoes: "",
    },
  },

  tutela: {
    titulo: "Tutela",
    status: "scaffold",
    secoes: [],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: false,
    templateWord: "template_tutela.docx",
    tagsTemplate: [],
    promptIA: {
      contexto: "O assistido está solicitando tutela.",
      extrair: [], instrucoes: "",
    },
  },
};

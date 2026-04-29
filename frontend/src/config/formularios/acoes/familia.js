// status: "ativo" = visível no formulário | "scaffold" = existe mas não aparece.
export const ACOES_FAMILIA = {
  fixacao_alimentos: {
    titulo: "Fixação de Pensão Alimentícia",
    status: "ativo",

    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido"],
    camposGerais: { ocultarDetalhesGerais: false },
    forcaRepresentacao: true, // assistidoEhIncapaz = "sim"
    isCpfFilhoOpcional: true,
    isRgFilhoOpcional: true,

    templateWord: "template_fixacao_alimentos.docx",
    tagsTemplate: [
      "VARA",
      "NOME_ASSISTIDO",
      "CPF_ASSISTIDO",
      "NOME_REQUERIDO",
      "CPF_REQUERIDO",
      "VALOR_PENSAO",
      "TIPO_CONTA",
      "BANCO",
      "AGENCIA",
      "CONTA",
      "PIX",
      "NOME_FILHO",
      "DATA_NASCIMENTO_FILHO",
      "DESCRICAO_GUARDA",
    ],

    promptIA: {
      contexto: "O assistido está solicitando fixação de pensão alimentícia.",
      extrair: [
        "valor_pensao_pretendido",
        "dados_bancarios",
        "dados_filho",
        "dados_emprego_requerido",
        "descricao_guarda",
      ],
      instrucoes:
        "Se o valor da pensão não for informado, deixe a tag VALOR_PENSAO em branco. Se houver informações sobre guarda ou visitas, extraia para descricao_guarda.",
    },
  },

  execucao_alimentos: {
    titulo: "Execução de Alimentos Rito Penhora/Prisão",
    status: "ativo",

    // --- Comportamento do Formulário ---
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido", "SecaoProcessoOriginal"],
    camposGerais: { mostrarBensPartilha: false, ocultarDetalhesGerais: true },
    forcaRepresentacao: true, // assistidoEhIncapaz = "sim" automático
    ocultarRelato: true, // Oculta campo de relato livre
    exigeDadosProcessoOriginal: true, // Exibe seção do processo originário
    exigeFilhos: true, // Exibe lista de filhos/exequentes
    labelAutor: "Filho(a) Exequente", // Rótulo do campo do assistido

    // --- Geração de Documentos ---
    // Gera SEMPRE Penhora + Prisão (defensor decide qual protocolar)
    templateWord: "executacao_alimentos_penhora.docx",
    templateDocxPenhora: "executacao_alimentos_penhora.docx",
    templateDocxPrisao: "executacao_alimentos_prisao.docx",
    gerarDocumentoDuplo: true, // Indica ao frontend que há 2 minutas

    // --- Tags presentes nos templates DOCX (auditadas em 2026-04-13) ---
    tagsTemplate: [
      // Cabeçalho
      "VARA",
      "CIDADEASSINATURA",
      // Exequente (Mãe representante)e
      "REPRESENTANTE_NOME",
      "representante_ocupacao",
      "representante_rg",
      "emissor_rg_exequente",
      "representante_cpf",
      "nome_mae_representante",
      "nome_pai_representante",
      "requerente_endereco_residencial",
      "requerente_telefone",
      "requerente_email",
      // Lista de filhos
      "lista_filhos",
      "NOME",
      "nascimento",
      "termo_representacao",
      // Executado (Pai devedor)
      "REQUERIDO_NOME",
      "executado_cpf",
      "executado_ocupacao",
      "rg_executado",
      "emissor_rg_executado",
      "nome_mae_executado",
      "nome_pai_executado",
      "executado_endereco_residencial",
      "executado_telefone",
      "executado_email",
      // Dados do débito
      "tipo_decisao",
      "processoOrigemNumero",
      "varaOriginaria",
      "cidadeOriginaria",
      "percentual_salario_minimo",
      "dia_pagamento",
      "dados_bancarios_exequente",
      "periodo_meses_ano",
      "valor_debito",
      "valor_debito_extenso",
      // Emprego / Penhora
      "empregador_nome",
      // Rodapé
      "data_atual",
      "defensoraNome",
    ],

    promptIA: {
      contexto: "O assistido está solicitando execução de alimentos (cobrança de pensão atrasada).",
      extrair: ["processo_original", "periodo_debito", "valor_total_debito"],
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
    tagsTemplate: ["NOME_ASSISTIDO", "CPF_ASSISTIDO", "NOME_REQUERIDO", "DESCRICAO_GUARDA"],

    promptIA: {
      contexto: "O assistido está solicitando guarda de filhos.",
      extrair: ["descricao_guarda", "situacao_financeira"],
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
      extrair: [],
      instrucoes: "",
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
      extrair: [],
      instrucoes: "",
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
      extrair: [],
      instrucoes: "",
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
      extrair: [],
      instrucoes: "",
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
      extrair: [],
      instrucoes: "",
    },
  },
};

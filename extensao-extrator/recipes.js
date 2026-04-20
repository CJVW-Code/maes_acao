const SOLAR_RECIPE = {
  name: "SOLAR - Cadastro Pessoa",
  description:
    "Receita inicial para o cadastro de pessoa do SOLAR. Lê os campos principais já identificados no HTML.",
  constants: {
    tipoAcaoArea: "familia",
    acaoEspecifica: "exec_penhora",
    assistidoEhIncapaz: "nao"
  },
  fields: {
    cpf: {
      strategies: [
        { type: "selector", selector: "#id_cpf" }
      ],
      transforms: ["cpf"]
    },
    NOME: {
      strategies: [
        { type: "selector", selector: "#id_nome" }
      ],
      transforms: ["trim"]
    },
    nome_mae_representante: {
      strategies: [
        { type: "selector", selector: "#mae0" }
      ],
      transforms: ["trim"]
    },
    nascimento: {
      strategies: [
        { type: "selector", selector: "#id_data_nascimento" }
      ],
      transforms: ["dateBr"]
    },
    representante_estado_civil: {
      strategies: [
        { type: "selectorAll", selector: "#id_estado_civil option:checked", index: 0 },
        { type: "selector", selector: "#id_estado_civil" }
      ]
    },
    requerente_telefone: {
      strategies: [
        { type: "selectorAll", selector: "input[name='telefone']", index: 0 }
      ],
      transforms: ["phone"]
    },
    telefone_contato_nome: {
      strategies: [
        { type: "selectorAll", selector: "input[name='telefone']", index: 1 }
      ],
      transforms: ["trim"]
    },
    requerente_email: {
      strategies: [
        { type: "selector", selector: "#id_email" }
      ],
      transforms: ["email"]
    },
    assistido_problematico: {
      strategies: [
        { type: "selector", selector: "#id_assistido_problematico" }
      ]
    },
    aderiu_zap_defensoria: {
      strategies: [
        { type: "selector", selector: "#id_aderiu_zap_defensoria" }
      ]
    },
    genero: {
      strategies: [
        { type: "selectorAll", selector: "#id_genero option:checked", index: 0 }
      ]
    },
    rg_executado: {
      strategies: [
        { type: "selector", selector: "#id_rg_numero" }
      ],
      transforms: ["trim"]
    },
    emissor_rg_executado: {
      strategies: [
        { type: "selector", selector: "#id_rg_orgao" }
      ]
    },
    rg_data_expedicao: {
      strategies: [
        { type: "selector", selector: "#id_rg_data_expedicao" }
      ],
      transforms: ["dateBr"]
    },
    certidao_tipo: {
      strategies: [
        { type: "selectorAll", selector: "#id_certidao_tipo option:checked", index: 0 }
      ]
    },
    certidao_numero: {
      strategies: [
        { type: "selector", selector: "#id_certidao_numero" }
      ]
    },
    raca: {
      strategies: [
        { type: "selectorAll", selector: "#id_raca option:checked", index: 0 }
      ]
    },
    naturalidade: {
      strategies: [
        { type: "selector", selector: "#id_naturalidade" }
      ]
    },
    naturalidade_estado: {
      strategies: [
        { type: "selector", selector: "#id_naturalidade_estado" }
      ]
    },
    nacionalidade: {
      strategies: [
        { type: "selectorAll", selector: "#id_nacionalidade option:checked", index: 0 }
      ]
    },
    naturalidade_pais: {
      strategies: [
        { type: "selectorAll", selector: "#id_naturalidade_pais option:checked", index: 0 }
      ]
    },
    escolaridade: {
      strategies: [
        { type: "selectorAll", selector: "#id_escolaridade option:checked", index: 0 }
      ]
    },
    tipo_trabalho: {
      strategies: [
        { type: "selectorAll", selector: "#id_tipo_trabalho option:checked", index: 0 }
      ]
    },
    representante_ocupacao: {
      strategies: [
        { type: "selector", selector: "#id_profissao" }
      ]
    },
    qtd_estado: {
      strategies: [
        { type: "selector", selector: "#id_qtd_estado" }
      ]
    },
    moradia_tipo: {
      strategies: [
        { type: "selectorAll", selector: "#id_tipo option:checked", index: 0 }
      ]
    },
    moradia_num_comodos: {
      strategies: [
        { type: "selector", selector: "#id_num_comodos" }
      ]
    },
    renda_numero_membros: {
      strategies: [
        { type: "selector", selector: "#id_renda-numero_membros" }
      ]
    },
    renda_numero_membros_economicamente_ativos: {
      strategies: [
        { type: "selector", selector: "#id_renda-numero_membros_economicamente_ativos" }
      ]
    },
    renda_individual: {
      strategies: [
        { type: "selector", selector: "#id_renda-ganho_mensal" }
      ],
      transforms: ["money"]
    },
    renda_familiar: {
      strategies: [
        { type: "selector", selector: "#id_renda-ganho_mensal_membros" }
      ],
      transforms: ["money"]
    },
    tem_plano_saude: {
      strategies: [
        { type: "selectorAll", selector: "#id_renda-tem_plano_saude option:checked", index: 0 }
      ]
    },
    isento_ir: {
      strategies: [
        { type: "selectorAll", selector: "#id_renda-isento_ir option:checked", index: 0 }
      ]
    },
    previdencia: {
      strategies: [
        { type: "selectorAll", selector: "#id_renda-previdencia option:checked", index: 0 }
      ]
    }
  },
  fillMap: {
    cpf: { selector: "#id_cpf", type: "input" },
    NOME: { selector: "#id_nome", type: "input" },
    nome_mae_representante: { selector: "#mae0", type: "input" },
    nascimento: { selector: "#id_data_nascimento", type: "input" },
    representante_estado_civil: { selector: "#id_estado_civil", type: "selectText" },
    requerente_telefone: {
      selector: "input[name='telefone']",
      type: "inputAll",
      index: 0
    },
    telefone_contato_nome: {
      selector: "input[name='telefone']",
      type: "inputAll",
      index: 1
    },
    requerente_email: { selector: "#id_email", type: "input" },
    assistido_problematico: { selector: "#id_assistido_problematico", type: "checkbox" },
    aderiu_zap_defensoria: { selector: "#id_aderiu_zap_defensoria", type: "checkbox" },
    genero: { selector: "#id_genero", type: "selectText" },
    rg_executado: { selector: "#id_rg_numero", type: "input" },
    emissor_rg_executado: { selector: "#id_rg_orgao", type: "input" },
    rg_data_expedicao: { selector: "#id_rg_data_expedicao", type: "input" },
    certidao_tipo: { selector: "#id_certidao_tipo", type: "selectText" },
    certidao_numero: { selector: "#id_certidao_numero", type: "input" },
    raca: { selector: "#id_raca", type: "selectText" },
    naturalidade: { selector: "#id_naturalidade", type: "input" },
    naturalidade_estado: { selector: "#id_naturalidade_estado", type: "input" },
    nacionalidade: { selector: "#id_nacionalidade", type: "selectText" },
    naturalidade_pais: { selector: "#id_naturalidade_pais", type: "selectText" },
    escolaridade: { selector: "#id_escolaridade", type: "selectText" },
    tipo_trabalho: { selector: "#id_tipo_trabalho", type: "selectText" },
    representante_ocupacao: { selector: "#id_profissao", type: "input" },
    qtd_estado: { selector: "#id_qtd_estado", type: "input" },
    moradia_tipo: { selector: "#id_tipo", type: "selectText" },
    moradia_num_comodos: { selector: "#id_num_comodos", type: "input" },
    renda_numero_membros: { selector: "#id_renda-numero_membros", type: "input" },
    renda_numero_membros_economicamente_ativos: {
      selector: "#id_renda-numero_membros_economicamente_ativos",
      type: "input"
    },
    renda_individual: { selector: "#id_renda-ganho_mensal", type: "input" },
    renda_familiar: { selector: "#id_renda-ganho_mensal_membros", type: "input" },
    tem_plano_saude: { selector: "#id_renda-tem_plano_saude", type: "selectText" },
    isento_ir: { selector: "#id_renda-isento_ir", type: "selectText" },
    previdencia: { selector: "#id_renda-previdencia", type: "selectText" }
  }
};

const DEFAULT_RECIPE = SOLAR_RECIPE;

const OFFICIAL_FORM_FIELDS = [
  "VARA",
  "CIDADEASSINATURA",
  "tipo_decisao",
  "processoOrigemNumero",
  "varaOriginaria",
  "cidadeOriginaria",
  "REPRESENTANTE_NOME",
  "representante_nacionalidade",
  "representante_estado_civil",
  "representante_ocupacao",
  "representante_rg",
  "emissor_rg_exequente",
  "representante_cpf",
  "nome_mae_representante",
  "nome_pai_representante",
  "requerente_endereco_residencial",
  "requerente_telefone",
  "requerente_email",
  "dados_bancarios_exequente",
  "REQUERIDO_NOME",
  "executado_nacionalidade",
  "executado_estado_civil",
  "executado_ocupacao",
  "nome_mae_executado",
  "nome_pai_executado",
  "rg_executado",
  "emissor_rg_executado",
  "executado_cpf",
  "executado_endereco_residencial",
  "executado_endereco_profissional",
  "executado_telefone",
  "executado_email",
  "empregador_nome",
  "NOME",
  "nacionalidade",
  "nascimento",
  "cpf",
  "valor_pensao",
  "valor_pensao_atual",
  "valor_pretendido",
  "percentual_salario_minimo",
  "dia_pagamento",
  "periodo_meses_ano",
  "valor_debito",
  "valor_debito_penhora",
  "valor_debito_prisao",
  "valor_multa",
  "valor_juros",
  "valor_honorarios",
  "data_inicio_debito",
  "data_fim_debito",
  "dos_fatos"
];

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeMoney(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const clean = text.replace(/[^\d,.-]/g, "");
  if (clean.includes(",") && clean.includes(".")) {
    return clean.replace(/\./g, "").replace(",", ".");
  }
  if (clean.includes(",")) {
    return clean.replace(",", ".");
  }
  return clean;
}

function normalizeDateBr(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    return text;
  }

  return text;
}

function applyTransforms(value, transforms = []) {
  return transforms.reduce((current, transform) => {
    if (current == null) return current;

    switch (transform) {
      case "trim":
        return String(current).trim();
      case "digits":
        return digitsOnly(current);
      case "cpf":
        return digitsOnly(current).slice(0, 11);
      case "phone":
        return digitsOnly(current);
      case "money":
        return normalizeMoney(current);
      case "dateBr":
        return normalizeDateBr(current);
      case "email":
        return String(current).trim().toLowerCase();
      default:
        return current;
    }
  }, value);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function mapGenero(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("fem")) return "Feminino";
  if (text.includes("masc")) return "Masculino";
  if (text.includes("bin")) return "Não Binário";
  return "";
}

function mapEstadoCivil(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  if (text.includes("solteir")) return "Solteiro(a)";
  if (text.includes("casad")) return "Casado(a)";
  if (text.includes("viuv")) return "Viuvo(a)";
  if (text.includes("divorc")) return "Divorciado(a)";
  if (text.includes("uni")) return "União estável";
  if (text.includes("separ")) return "Separado judicialmente";
  return value;
}

function mapNacionalidade(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  if (text.includes("naturalizado")) return "Brasileiro(a) Naturalizado(a)";
  if (text.includes("estrange")) return "Estrangeiro(a)";
  if (text.includes("brasil")) return "Brasileiro(a)";
  return value;
}

function mapRaca(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  if (text.includes("pret")) return "Preta";
  if (text.includes("pard")) return "Parda";
  if (text.includes("branc")) return "Branca";
  if (text.includes("amar")) return "Amarela";
  if (text.includes("ind")) return "Indígena";
  return value;
}

function mapMoradiaTipo(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";
  if (text.includes("propr")) return "Próprio";
  if (text.includes("programa")) return "Programa Habitacional (Doação do Gov: Federal, Estadual ou Municipal)";
  if (text.includes("alugu")) return "Alugado";
  if (text.includes("cedid")) return "Cedido";
  if (text.includes("financ")) return "Financiado";
  if (text.includes("ocupa")) return "Ocupação";
  return value;
}

function mapBooleanSelect(value) {
  if (value === true || String(value).toLowerCase() === "sim") return "Sim";
  if (value === false || String(value).toLowerCase() === "não" || String(value).toLowerCase() === "nao") return "Não";
  return "";
}

function convertDbJsonToSolarForm(payload = {}) {
  const directSolar = payload.solar || null;
  if (directSolar && typeof directSolar === "object") {
    return {
      ...directSolar,
      formDataCompat: payload.formDataCompat || directSolar.formDataCompat || {}
    };
  }

  const directKeys = ["cpf", "NOME", "nascimento", "requerente_email"];
  const hasDirectSolarShape = directKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(payload, key)
  );
  if (hasDirectSolarShape) {
    return {
      ...payload,
      formDataCompat: payload.formDataCompat || {}
    };
  }

  const schema = payload.schema || payload;
  const partes = schema.casos_partes || {};
  const juridico = schema.casos_juridico || {};
  const extras = schema.formDataCompat || payload.formDataCompat || {};

  return {
    cpf: firstNonEmpty(partes.cpf_assistido, extras.cpf, extras.representante_cpf),
    NOME: firstNonEmpty(partes.nome_assistido, extras.NOME, extras.REPRESENTANTE_NOME),
    nome_mae_representante: firstNonEmpty(partes.nome_mae_assistido, partes.nome_mae_representante, extras.nome_mae_representante),
    nascimento: firstNonEmpty(partes.data_nascimento_assistido, extras.nascimento),
    representante_estado_civil: firstNonEmpty(
      mapEstadoCivil(partes.estado_civil),
      mapEstadoCivil(partes.estado_civil_representante),
      mapEstadoCivil(extras.representante_estado_civil)
    ),
    requerente_telefone: firstNonEmpty(partes.telefone_assistido, extras.requerente_telefone),
    requerente_email: firstNonEmpty(partes.email_assistido, extras.requerente_email),
    genero: firstNonEmpty(mapGenero(partes.genero), mapGenero(extras.genero)),
    rg_executado: firstNonEmpty(partes.rg_assistido, extras.rg_executado),
    emissor_rg_executado: firstNonEmpty(partes.emissor_rg_assistido, extras.emissor_rg_executado),
    rg_data_expedicao: firstNonEmpty(partes.rg_data_expedicao_assistido, extras.rg_data_expedicao),
    certidao_tipo: firstNonEmpty(partes.certidao_tipo, extras.certidao_tipo),
    certidao_numero: firstNonEmpty(partes.certidao_numero, extras.certidao_numero),
    raca: firstNonEmpty(mapRaca(partes.raca), mapRaca(extras.raca)),
    naturalidade: firstNonEmpty(partes.naturalidade, extras.naturalidade),
    naturalidade_estado: firstNonEmpty(partes.naturalidade_estado, extras.naturalidade_estado),
    nacionalidade: firstNonEmpty(
      mapNacionalidade(partes.nacionalidade),
      mapNacionalidade(partes.nacionalidade_representante),
      mapNacionalidade(extras.nacionalidade)
    ),
    naturalidade_pais: firstNonEmpty(partes.naturalidade_pais, extras.naturalidade_pais),
    escolaridade: firstNonEmpty(partes.escolaridade, extras.escolaridade),
    tipo_trabalho: firstNonEmpty(partes.tipo_trabalho, extras.tipo_trabalho),
    representante_ocupacao: firstNonEmpty(partes.profissao, partes.profissao_representante, extras.representante_ocupacao),
    qtd_estado: firstNonEmpty(partes.qtd_estado, extras.qtd_estado),
    moradia_tipo: firstNonEmpty(mapMoradiaTipo(partes.moradia_tipo), mapMoradiaTipo(extras.moradia_tipo)),
    moradia_num_comodos: firstNonEmpty(partes.moradia_num_comodos, extras.moradia_num_comodos),
    renda_numero_membros: firstNonEmpty(partes.numero_membros, extras.renda_numero_membros),
    renda_numero_membros_economicamente_ativos: firstNonEmpty(
      partes.numero_membros_economicamente_ativos,
      extras.renda_numero_membros_economicamente_ativos
    ),
    renda_individual: firstNonEmpty(juridico.renda_individual, extras.renda_individual),
    renda_familiar: firstNonEmpty(juridico.renda_familiar, extras.renda_familiar),
    tem_plano_saude: firstNonEmpty(mapBooleanSelect(partes.tem_plano_saude), mapBooleanSelect(extras.tem_plano_saude)),
    isento_ir: firstNonEmpty(mapBooleanSelect(partes.isento_ir), mapBooleanSelect(extras.isento_ir)),
    previdencia: firstNonEmpty(mapBooleanSelect(partes.previdencia), mapBooleanSelect(extras.previdencia)),
    formDataCompat: extras
  };
}

function pickFormFields(rawFields, constants = {}) {
  const formDataCompat = {};

  OFFICIAL_FORM_FIELDS.forEach((field) => {
    if (rawFields[field]) {
      formDataCompat[field] = rawFields[field];
    }
  });

  formDataCompat.assistidoEhIncapaz = constants.assistidoEhIncapaz || "nao";
  formDataCompat.tipoAcao = constants.tipoAcaoArea || "familia";
  formDataCompat.acaoEspecifica = constants.acaoEspecifica || "exec_penhora";

  return formDataCompat;
}

function buildSchemaProjection(formDataCompat, rawFields, pageContext, recipe) {
  return {
    casos: {
      protocolo: rawFields.protocolo || null,
      tipo_acao: recipe?.constants?.acaoEspecifica || null,
      numero_vara: formDataCompat.VARA || null,
      numero_processo: rawFields.numero_processo || null,
      url_capa: pageContext.url
    },
    casos_partes: {
      nome_assistido: formDataCompat.NOME || null,
      cpf_assistido: formDataCompat.cpf || null,
      data_nascimento_assistido: formDataCompat.nascimento || null,
      nacionalidade: formDataCompat.nacionalidade || null,
      nome_representante: formDataCompat.REPRESENTANTE_NOME || formDataCompat.NOME || null,
      cpf_representante: formDataCompat.representante_cpf || formDataCompat.cpf || null,
      endereco_assistido: formDataCompat.requerente_endereco_residencial || null,
      telefone_assistido: formDataCompat.requerente_telefone || null,
      email_assistido: formDataCompat.requerente_email || null,
      nome_mae_assistido: rawFields.nome_mae_representante || null,
      nome_requerido: formDataCompat.REQUERIDO_NOME || null,
      cpf_requerido: formDataCompat.executado_cpf || null,
      endereco_requerido: formDataCompat.executado_endereco_residencial || null,
      telefone_requerido: formDataCompat.executado_telefone || null,
      email_requerido: formDataCompat.executado_email || null
    },
    casos_juridico: {
      numero_processo_titulo: formDataCompat.processoOrigemNumero || rawFields.numero_processo || null,
      tipo_decisao: formDataCompat.tipo_decisao || null,
      vara_originaria: formDataCompat.varaOriginaria || formDataCompat.VARA || null,
      cidade_originaria: formDataCompat.cidadeOriginaria || formDataCompat.CIDADEASSINATURA || null,
      percentual_salario: formDataCompat.percentual_salario_minimo || null,
      vencimento_dia: formDataCompat.dia_pagamento || null,
      periodo_inadimplencia: formDataCompat.periodo_meses_ano || null,
      debito_valor: formDataCompat.valor_debito || null,
      debito_penhora_valor: formDataCompat.valor_debito_penhora || null,
      debito_prisao_valor: formDataCompat.valor_debito_prisao || null,
      empregador_nome: formDataCompat.empregador_nome || null
    }
  };
}

function buildExtractionPayload(rawFields, pageContext, recipe) {
  const normalizedFields = {};

  Object.entries(rawFields).forEach(([key, value]) => {
    const transforms = recipe?.fields?.[key]?.transforms || [];
    normalizedFields[key] = applyTransforms(value, transforms);
  });

  const formDataCompat = pickFormFields(normalizedFields, recipe?.constants || {});

  return {
    origem: {
      titulo: pageContext.title,
      url: pageContext.url,
      extraido_em: new Date().toISOString(),
      receita: recipe?.name || "Receita sem nome"
    },
    bruto: rawFields,
    normalizado: normalizedFields,
    formDataCompat,
    schema: buildSchemaProjection(formDataCompat, normalizedFields, pageContext, recipe)
  };
}

globalThis.ExtractorRecipes = {
  SOLAR_RECIPE,
  DEFAULT_RECIPE,
  buildExtractionPayload,
  convertDbJsonToSolarForm
};

import React, { useEffect, useReducer, useState } from "react";
import { ChevronDown, Eye, Loader2, Pencil, Save, X } from "lucide-react";
import { formatTipoAcaoLabel } from "../../../../utils/caseUtils";
import {
  parseBrDateToIso,
  stripNonDigits,
  validateBrDate,
  validateCpfAlgorithm,
} from "../../../../utils/formatters";
import { ACOES_FAMILIA } from "../../../../config/formularios/acoes/familia";
import { useToast } from "../../../../contexts/ToastContext";
import { formReducer, initialState } from "../../../servidor/state/formState";
import { useFormHandlers } from "../../../servidor/hooks/useFormHandlers";
import { StepDadosPessoais } from "../../../servidor/components/StepDadosPessoais";
import { StepRequerido } from "../../../servidor/components/StepRequerido";
import { StepDetalhesCaso } from "../../../servidor/components/StepDetalhesCaso";

const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "Nao informado";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Nao informado";
  if (typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${formatValue(v)}`)
      .join(" | ");
  return String(value);
};

const ReviewField = ({ label, value, wide = false }) => (
  <div className={wide ? "md:col-span-2" : ""}>
    <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
    <p className="font-semibold break-words whitespace-pre-wrap">{formatValue(value)}</p>
  </div>
);

const ReviewSection = ({ title, children }) => (
  <section className="space-y-4 border-t border-soft pt-5">
    <h3 className="heading-3 text-primary">{title}</h3>
    <div className="grid gap-4 md:grid-cols-2">{children}</div>
  </section>
);

const EditAccordionSection = ({ id, title, description, activeSection, onToggle, children }) => {
  const isOpen = activeSection === id;

  return (
    <section className="border border-soft rounded-lg bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : id)}
        className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-app/40 transition-colors"
        aria-expanded={isOpen}
      >
        <div>
          <h3 className="font-bold text-main">{title}</h3>
          {description && <p className="text-sm text-muted mt-1">{description}</p>}
        </div>
        <ChevronDown
          size={20}
          className={`text-muted transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && <div className="border-t border-soft p-4 bg-app/20">{children}</div>}
    </section>
  );
};

const MINUTA_REGENERACAO_WARNING =
  "Depois de alterar estes dados, regenere a minuta. Qualquer modificacao feita manualmente na minuta atual sera perdida ao regerar.";

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const optionalText = (value) =>
  value === undefined || value === null || String(value).trim() === "" ? undefined : value;

const digitsOnly = (value) => {
  const text = optionalText(value);
  return text === undefined ? undefined : String(text).replace(/\D/g, "");
};

const normalizeFilhosCpf = (filhos = []) =>
  Array.isArray(filhos)
    ? filhos.map((filho) => ({
        ...filho,
        cpf: digitsOnly(filho?.cpf),
      }))
    : [];

const normalizeComparableText = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const hasGuardChanges = (currentState, originalState) =>
  normalizeComparableText(currentState.opcaoGuarda) !==
    normalizeComparableText(originalState.opcaoGuarda) ||
  normalizeComparableText(currentState.descricaoGuarda) !==
    normalizeComparableText(originalState.descricaoGuarda);

const resolveAcaoEspecifica = (caso = {}, dados = {}) => {
  const raw = dados.acaoEspecifica || caso.tipo_acao || "";
  if (String(raw).includes("exec") || String(raw).includes("def_")) return "execucao_alimentos";
  if (raw === "alimentos_gravidicos") return "fixacao_alimentos";
  return raw || "fixacao_alimentos";
};

const buildFormStateFromCase = (caso = {}) => {
  const dados = caso.dados_formulario || {};
  const acaoEspecifica = resolveAcaoEspecifica(caso, dados);
  const isRepresentacao =
    pickFirst(dados.assistidoEhIncapaz, dados.assistido_eh_incapaz, caso.assistido_eh_incapaz) ===
      "sim" || ACOES_FAMILIA[acaoEspecifica]?.forcaRepresentacao;

  return {
    ...initialState,
    ...dados,
    tipoAcao: "familia",
    acaoEspecifica,
    assistidoEhIncapaz: isRepresentacao ? "sim" : "nao",
    NOME: pickFirst(dados.NOME, dados.nome, caso.nome_assistido),
    cpf: pickFirst(dados.cpf, dados.cpf_assistido, caso.cpf_assistido),
    nascimento: pickFirst(
      dados.nascimento,
      dados.data_nascimento_assistido,
      caso.assistido_data_nascimento,
    ),
    REPRESENTANTE_NOME: pickFirst(
      dados.REPRESENTANTE_NOME,
      dados.representante_nome,
      caso.nome_representante,
    ),
    representante_cpf: pickFirst(dados.representante_cpf, caso.representante_cpf),
    representante_data_nascimento: pickFirst(
      dados.representante_data_nascimento,
      caso.representante_data_nascimento,
    ),
    representante_nacionalidade: pickFirst(
      dados.representante_nacionalidade,
      caso.representante_nacionalidade,
      "Brasileira",
    ),
    representante_estado_civil: pickFirst(
      dados.representante_estado_civil,
      caso.representante_estado_civil,
      "solteiro(a)",
    ),
    representante_ocupacao: pickFirst(dados.representante_ocupacao, caso.representante_ocupacao),
    representante_rg: pickFirst(dados.representante_rg, caso.representante_rg_numero),
    emissor_rg_exequente: pickFirst(dados.emissor_rg_exequente, caso.representante_rg_orgao),
    requerente_endereco_residencial: pickFirst(
      dados.requerente_endereco_residencial,
      dados.endereco_assistido,
      caso.endereco_assistido,
    ),
    requerente_email: pickFirst(
      dados.requerente_email,
      dados.email_assistido,
      caso.email_assistido,
    ),
    requerente_telefone: pickFirst(
      dados.requerente_telefone,
      dados.telefone,
      caso.telefone_assistido,
    ),
    nome_mae_representante: pickFirst(dados.nome_mae_representante, caso.nome_mae_representante),
    nome_pai_representante: pickFirst(dados.nome_pai_representante, caso.nome_pai_representante),
    outrosFilhos: dados.outrosFilhos || parseJsonArray(dados.outros_filhos_detalhes),
    REQUERIDO_NOME: pickFirst(dados.REQUERIDO_NOME, dados.nome_requerido, caso.nome_requerido),
    executado_cpf: pickFirst(dados.executado_cpf, dados.cpf_requerido, caso.cpf_requerido),
    rg_executado: pickFirst(dados.rg_executado, dados.requerido_rg_numero, caso.rg_executado),
    emissor_rg_executado: pickFirst(
      dados.emissor_rg_executado,
      dados.requerido_rg_orgao,
      caso.emissor_rg_executado,
    ),
    executado_endereco_residencial: pickFirst(
      dados.executado_endereco_residencial,
      dados.endereco_requerido,
      caso.endereco_requerido,
    ),
    executado_telefone: pickFirst(
      dados.executado_telefone,
      dados.telefone_requerido,
      caso.telefone_requerido,
    ),
    executado_email: pickFirst(dados.executado_email, dados.email_requerido, caso.email_requerido),
    executado_ocupacao: pickFirst(dados.executado_ocupacao, caso.executado_ocupacao),
    executado_nacionalidade: pickFirst(dados.executado_nacionalidade, caso.executado_nacionalidade),
    executado_estado_civil: pickFirst(dados.executado_estado_civil, caso.executado_estado_civil),
    nome_mae_executado: pickFirst(dados.nome_mae_executado, caso.nome_mae_executado),
    nome_pai_executado: pickFirst(dados.nome_pai_executado, caso.nome_pai_executado),
    empregador_nome: pickFirst(
      dados.empregador_nome,
      dados.empregador_requerido_nome,
      caso.empregador_nome,
    ),
    empregador_endereco: pickFirst(
      dados.empregador_endereco,
      dados.empregador_requerido_endereco,
      caso.empregador_endereco,
    ),
    empregador_email: pickFirst(dados.empregador_email, caso.empregador_email),
    valor_pensao: pickFirst(dados.valor_pensao, dados.valor_mensal_pensao, caso.valor_pensao),
    valor_debito: pickFirst(dados.valor_debito, caso.valor_debito),
    VARA: pickFirst(dados.VARA, caso.VARA),
    CIDADEASSINATURA: pickFirst(
      dados.CIDADEASSINATURA,
      dados.cidade_assinatura,
      caso.cidade_assinatura,
    ),
    processoOrigemNumero: pickFirst(dados.processoOrigemNumero, caso.processoOrigemNumero),
    cidadeOriginaria: pickFirst(dados.cidadeOriginaria, caso.cidadeOriginaria),
    varaOriginaria: pickFirst(dados.varaOriginaria, caso.varaOriginaria),
    tipo_decisao: pickFirst(dados.tipo_decisao, caso.tipo_decisao),
    dia_pagamento: pickFirst(dados.dia_pagamento, caso.dia_pagamento),
    percentual_salario_minimo: pickFirst(
      dados.percentual_salario_minimo,
      caso.percentual_salario_minimo,
    ),
    periodo_meses_ano: pickFirst(dados.periodo_meses_ano, caso.periodo_meses_ano),
    opcaoGuarda: pickFirst(dados.opcaoGuarda, dados.opcao_guarda, caso.opcao_guarda),
    descricaoGuarda: pickFirst(
      dados.descricaoGuarda,
      dados.descricao_guarda,
      caso.descricao_guarda,
    ),
  };
};

const buildSavePayload = (formState) => {
  const configAcao = ACOES_FAMILIA[formState.acaoEspecifica] || ACOES_FAMILIA.fixacao_alimentos;
  const isRepresentacao = formState.assistidoEhIncapaz === "sim" || configAcao?.forcaRepresentacao;
  const nomeAssistido = isRepresentacao ? formState.NOME : formState.REPRESENTANTE_NOME;
  const cpfAssistido = isRepresentacao ? formState.cpf : formState.representante_cpf;
  const nascimentoAssistido = isRepresentacao
    ? formState.nascimento
    : formState.representante_data_nascimento;
  const outrosFilhos = normalizeFilhosCpf(formState.outrosFilhos);

  const dadosExtraidos = {
    ...formState,
    cpf: digitsOnly(formState.cpf),
    representante_cpf: digitsOnly(formState.representante_cpf),
    executado_cpf: digitsOnly(formState.executado_cpf),
    outrosFilhos,
    assistido_eh_incapaz: formState.assistidoEhIncapaz,
    nome_assistido: nomeAssistido,
    cpf_assistido: digitsOnly(cpfAssistido),
    data_nascimento_assistido: nascimentoAssistido,
    dados_bancarios_exequente: [
      formState.banco_deposito,
      formState.agencia_deposito,
      formState.conta_operacao,
      formState.conta_deposito,
      formState.chave_pix_deposito,
      formState.outros_dados_deposito,
    ]
      .filter(Boolean)
      .join(" / "),
    nome_requerido: formState.REQUERIDO_NOME,
    cpf_requerido: digitsOnly(formState.executado_cpf),
    cidade_assinatura: formState.CIDADEASSINATURA,
    cidade_originaria: formState.cidadeOriginaria,
    vara_originaria: formState.varaOriginaria,
    numero_processo_originario: formState.processoOrigemNumero,
    descricao_guarda: formState.descricaoGuarda,
    opcao_guarda: formState.opcaoGuarda,
    requerido_rg_numero: formState.rg_executado,
    requerido_rg_orgao: formState.emissor_rg_executado,
  };

  return {
    partes: {
      nome_assistido: optionalText(nomeAssistido),
      cpf_assistido: digitsOnly(cpfAssistido),
      data_nascimento_assistido: nascimentoAssistido,
      telefone_assistido: formState.requerente_telefone,
      email_assistido: formState.requerente_email,
      endereco_assistido: formState.requerente_endereco_residencial,
      rg_assistido: isRepresentacao ? "" : formState.representante_rg,
      emissor_rg_assistido: isRepresentacao ? "" : formState.emissor_rg_exequente,
      assistido_eh_incapaz: formState.assistidoEhIncapaz,
      nome_representante: isRepresentacao ? formState.REPRESENTANTE_NOME : null,
      cpf_representante: isRepresentacao ? digitsOnly(formState.representante_cpf) : null,
      data_nascimento_representante: isRepresentacao
        ? formState.representante_data_nascimento
        : null,
      nacionalidade_representante: formState.representante_nacionalidade,
      estado_civil_representante: formState.representante_estado_civil,
      profissao_representante: formState.representante_ocupacao,
      rg_representante: formState.representante_rg,
      emissor_rg_representante: formState.emissor_rg_exequente,
      nome_mae_representante: formState.nome_mae_representante,
      nome_pai_representante: formState.nome_pai_representante,
      nome_requerido: formState.REQUERIDO_NOME,
      cpf_requerido: digitsOnly(formState.executado_cpf),
      rg_requerido: formState.rg_executado,
      emissor_rg_requerido: formState.emissor_rg_executado,
      profissao_requerido: formState.executado_ocupacao,
      nacionalidade_requerido: formState.executado_nacionalidade,
      estado_civil_requerido: formState.executado_estado_civil,
      nome_mae_requerido: formState.nome_mae_executado,
      nome_pai_requerido: formState.nome_pai_executado,
      endereco_requerido: formState.executado_endereco_residencial,
      telefone_requerido: formState.executado_telefone,
      email_requerido: formState.executado_email,
      exequentes: outrosFilhos,
    },
    juridico: {
      numero_processo_titulo: formState.processoOrigemNumero,
      percentual_salario: formState.percentual_salario_minimo,
      vencimento_dia: formState.dia_pagamento,
      periodo_inadimplencia: formState.periodo_meses_ano,
      debito_valor: formState.valor_debito || formState.valor_pensao,
      dados_bancarios_deposito: dadosExtraidos.dados_bancarios_exequente,
      conta_banco: formState.banco_deposito,
      conta_agencia: formState.agencia_deposito,
      conta_operacao: formState.conta_operacao,
      conta_numero: formState.conta_deposito,
      empregador_nome: formState.empregador_nome,
      empregador_endereco: formState.empregador_endereco,
      empregador_email: formState.empregador_email,
      descricao_guarda: formState.descricaoGuarda,
      opcao_guarda: formState.opcaoGuarda,
      cidade_originaria: formState.cidadeOriginaria,
      tipo_decisao: formState.tipo_decisao,
      vara_originaria: formState.varaOriginaria,
      cidade_assinatura: formState.CIDADEASSINATURA,
    },
    dados_extraidos: dadosExtraidos,
  };
};

const validateEditForm = ({ formState, configAcao, isAlvara }) => {
  const validationErrors = {};
  const today = new Date().toISOString().split("T")[0];
  const nomeRequeridoTrim = (formState.REQUERIDO_NOME || "").trim();
  const enderecoRequeridoTrim = (formState.executado_endereco_residencial || "").trim();
  const telefoneRequeridoDigits = stripNonDigits(formState.executado_telefone || "");

  if (!isAlvara) {
    if (!nomeRequeridoTrim) {
      validationErrors.REQUERIDO_NOME = "Informe o nome completo da outra parte.";
    }
    if (!enderecoRequeridoTrim && !telefoneRequeridoDigits) {
      validationErrors.requeridoContato = "Informe pelo menos um endereco ou telefone da outra parte.";
    }
  }

  if (formState.assistidoEhIncapaz === "sim") {
    if (!formState.NOME) validationErrors.NOME = "O nome da crianca e obrigatorio.";
    if (!formState.REPRESENTANTE_NOME) {
      validationErrors.REPRESENTANTE_NOME = "O nome da genitora/representante e obrigatorio.";
    }
  } else if (!formState.REPRESENTANTE_NOME) {
    validationErrors.REPRESENTANTE_NOME = "O nome completo e obrigatorio.";
  }

  if (!formState.representante_cpf) {
    validationErrors.representante_cpf = "O CPF e obrigatorio.";
  }

  const enderecoResidencial = (formState.requerente_endereco_residencial || "").trim();
  if (!enderecoResidencial) {
    validationErrors.requerente_endereco_residencial = "O endereco residencial e obrigatorio.";
  } else if (!/\b\d{5}-?\d{3}\b/.test(enderecoResidencial)) {
    validationErrors.requerente_endereco_residencial =
      "CEP invalido ou ausente no endereco. Use o formato 00000-000.";
  }

  if (!formState.requerente_telefone) {
    validationErrors.requerente_telefone = "O telefone de contato e obrigatorio.";
  }

  if (
    configAcao?.secoes?.includes("SecaoValoresPensao") &&
    formState.acaoEspecifica !== "execucao_alimentos" &&
    !formState.valor_pensao
  ) {
    validationErrors.valor_pensao = "O valor da pensao e obrigatorio.";
  }

  if (!configAcao?.camposGerais?.ocultarDetalhesGerais) {
    if (!formState.opcaoGuarda) {
      validationErrors.opcaoGuarda =
        "O preenchimento de Guarda da Crianca e Direito de Convivencia / Visitas e obrigatorio.";
    } else if (formState.opcaoGuarda === "regularizar" && !formState.descricaoGuarda?.trim()) {
      validationErrors.descricaoGuarda = "Descreva como deseja que funcione a guarda e visitas.";
    }
  }

  if (configAcao?.exigeDadosProcessoOriginal) {
    if (!formState.data_inicio_debito) {
      validationErrors.data_inicio_debito = "O mes inicial do debito e obrigatorio.";
    }
    if (!formState.data_fim_debito) {
      validationErrors.data_fim_debito = "O mes final do debito e obrigatorio.";
    }
    if (!formState.valor_debito) {
      validationErrors.valor_debito = "O valor total do debito e obrigatorio.";
    }
    if (!formState.percentual_salario_minimo) {
      validationErrors.percentual_salario_minimo = "O percentual do salario minimo e obrigatorio.";
    }
  }

  const campoDataNasc =
    formState.assistidoEhIncapaz === "sim" ? "nascimento" : "representante_data_nascimento";
  const dataInputValue = formState[campoDataNasc];
  const dataIso = parseBrDateToIso(dataInputValue);

  if (!dataInputValue) {
    validationErrors[campoDataNasc] = "A data de nascimento e obrigatoria.";
  } else if (!validateBrDate(dataInputValue)) {
    validationErrors[campoDataNasc] = "Informe uma data de calendario valida (Ex: 31/12/1990).";
  } else if (!dataIso) {
    validationErrors[campoDataNasc] = "Formato de data invalido (DD/MM/AAAA).";
  } else if (dataIso > today) {
    validationErrors[campoDataNasc] = "A data de nascimento nao pode estar no futuro.";
  }

  if (formState.representante_cpf && !validateCpfAlgorithm(formState.representante_cpf)) {
    validationErrors.representante_cpf = "CPF da representante invalido.";
  }

  if (
    formState.assistidoEhIncapaz === "sim" &&
    formState.cpf &&
    !validateCpfAlgorithm(formState.cpf)
  ) {
    validationErrors.cpf = "CPF da crianca invalido.";
  }

  if (formState.executado_cpf && !validateCpfAlgorithm(formState.executado_cpf)) {
    validationErrors.executado_cpf = "O CPF da outra parte e invalido.";
  }

  if (formState.outrosFilhos?.length > 0) {
    formState.outrosFilhos.forEach((filho, index) => {
      if (filho.cpf && !validateCpfAlgorithm(filho.cpf)) {
        validationErrors[`filho_cpf_${index}`] = `O CPF do Filho(a) ${index + 2} e invalido.`;
      }

      const filhoDataInput = filho.dataNascimento;
      if (!filhoDataInput) {
        validationErrors[`filho_nascimento_${index}`] =
          `A data de nascimento do Filho(a) ${index + 2} e obrigatoria.`;
      } else if (!validateBrDate(filhoDataInput)) {
        validationErrors[`filho_nascimento_${index}`] =
          `Data invalida no Filho(a) ${index + 2} (Ex: 31/12/1990).`;
      } else {
        const filhoIso = parseBrDateToIso(filhoDataInput);
        if (filhoIso && filhoIso > today) {
          validationErrors[`filho_nascimento_${index}`] =
            `A data do Filho(a) ${index + 2} nao pode estar no futuro.`;
        }
      }
    });
  }

  return validationErrors;
};

export const InfoAssistido = ({ caso, onSave, isSaving = false }) => {
  const { toast } = useToast();
  const [showReview, setShowReview] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeEditSection, setActiveEditSection] = useState(null);
  const [formState, dispatch] = useReducer(formReducer, buildFormStateFromCase(caso));
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (!isEditing) {
      dispatch({ type: "LOAD_RASCUNHO", payload: buildFormStateFromCase(caso) });
      setFormErrors({});
    }
  }, [caso, isEditing]);

  const configAcao = ACOES_FAMILIA[formState.acaoEspecifica] || ACOES_FAMILIA.fixacao_alimentos;
  const isRepresentacao = formState.assistidoEhIncapaz === "sim" || configAcao?.forcaRepresentacao;
  const isAlvara = configAcao?.isAlvara || false;

  const {
    handleFieldChange,
    handleCpfChangeAndValidate,
    handlePhoneChange,
    handleDateChange,
    handleMonthYearChange,
    handleRgChange,
    toggleRequeridoDetalhe,
    handleCurrencyChange,
    handleDayInputChange,
    handleRestrictedAlphanumeric,
  } = useFormHandlers({ formState, dispatch, setFormErrors, toast });

  const validar = (msg) => ({
    required: true,
    onInvalid: (e) => e.target.setCustomValidity(msg || "Por favor, preencha este campo."),
    onInput: (e) => e.target.setCustomValidity(""),
  });

  const handleCancelEdit = () => {
    dispatch({ type: "LOAD_RASCUNHO", payload: buildFormStateFromCase(caso) });
    setIsEditing(false);
    setActiveEditSection(null);
  };

  const handleStartEdit = () => {
    toast.warning(MINUTA_REGENERACAO_WARNING);
    setIsEditing(true);
    setActiveEditSection(null);
  };

  const handleSubmitEdit = async (event) => {
    event.preventDefault();
    const validationErrors = validateEditForm({ formState, configAcao, isAlvara });

    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      toast.error("Existem campos obrigatorios nao preenchidos ou invalidos.");
      return;
    }

    setFormErrors({});
    await onSave?.(buildSavePayload(formState), {
      shouldOfferRegenerateFacts: hasGuardChanges(formState, buildFormStateFromCase(caso)),
    });
    setShowReview(true);
    setIsEditing(false);
    setActiveEditSection(null);
  };

  const dados = caso.dados_formulario || {};
  const nomePrincipal = isRepresentacao
    ? pickFirst(dados.NOME, caso.nome_assistido)
    : pickFirst(dados.REPRESENTANTE_NOME, caso.nome_representante, caso.nome_assistido);
  const cpfPrincipal = isRepresentacao
    ? pickFirst(dados.cpf, dados.cpf_assistido, caso.cpf_assistido)
    : pickFirst(dados.representante_cpf, caso.cpf_assistido, dados.cpf);

  if (isEditing) {
    return (
      <form onSubmit={handleSubmitEdit} className="card space-y-6" noValidate>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="heading-2">Editar dados preenchidos</h2>
            <p className="text-sm text-muted">
              Este editor usa os mesmos componentes e regras do formulario de triagem.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="btn btn-ghost border border-soft"
              disabled={isSaving}
            >
              <X size={18} />
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isSaving ? "Salvando..." : "Salvar dados"}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <EditAccordionSection
            id="dados_pessoais"
            title="Dados pessoais"
            description="Assistido, representante legal e filhos vinculados."
            activeSection={activeEditSection}
            onToggle={setActiveEditSection}
          >
            <StepDadosPessoais
              assistidoEhIncapaz={formState.assistidoEhIncapaz}
              assistidoNome={formState.NOME}
              assistidoCpf={formState.cpf}
              assistidoNascimento={formState.nascimento}
              representanteNome={formState.REPRESENTANTE_NOME}
              representanteCpf={formState.representante_cpf}
              representanteNascimento={formState.representante_data_nascimento}
              representanteNacionalidade={formState.representante_nacionalidade}
              representanteEstadoCivil={formState.representante_estado_civil}
              representanteOcupacao={formState.representante_ocupacao}
              representanteEnderecoProfissional={formState.representante_endereco_profissional}
              representanteRg={formState.representante_rg}
              representanteEmissorRg={formState.emissor_rg_exequente}
              requerenteEnderecoResidencial={formState.requerente_endereco_residencial}
              requerenteEmail={formState.requerente_email}
              requerenteTelefone={formState.requerente_telefone}
              nomeMaeRepresentante={formState.nome_mae_representante}
              nomePaiRepresentante={formState.nome_pai_representante}
              outrosFilhos={formState.outrosFilhos || []}
              dispatch={dispatch}
              handleFieldChange={handleFieldChange}
              handleCpfChangeAndValidate={handleCpfChangeAndValidate}
              handleRgChange={handleRgChange}
              handleDateChange={handleDateChange}
              handlePhoneChange={handlePhoneChange}
              validar={validar}
              formErrors={formErrors}
              setFormErrors={setFormErrors}
              forcaRepresentacao={configAcao?.forcaRepresentacao}
              isRepresentacao={isRepresentacao}
              labelAutor={configAcao?.labelAutor || "Autor(a)"}
              handleRestrictedAlphanumeric={handleRestrictedAlphanumeric}
              configAcao={configAcao}
            />
          </EditAccordionSection>

          {!isAlvara && (
            <EditAccordionSection
              id="parte_contraria"
              title="Parte contraria"
              description="Dados do requerido e informacoes adicionais conhecidas."
              activeSection={activeEditSection}
              onToggle={setActiveEditSection}
            >
              <StepRequerido
                requeridoNome={formState.REQUERIDO_NOME}
                requeridoCpf={formState.executado_cpf}
                requeridoNomeMae={formState.nome_mae_executado}
                requeridoNomePai={formState.nome_pai_executado}
                requeridoEnderecoResidencial={formState.executado_endereco_residencial}
                requeridoTelefone={formState.executado_telefone}
                requeridoEmail={formState.executado_email}
                requeridoOcupacao={formState.executado_ocupacao}
                requeridoNacionalidade={formState.executado_nacionalidade}
                requeridoEstadoCivil={formState.executado_estado_civil}
                requeridoEnderecoProfissional={formState.executado_endereco_profissional}
                requeridoOutrosSelecionados={formState.requeridoOutrosSelecionados}
                requeridoRg={formState.rg_executado}
                requeridoEmissorRg={formState.emissor_rg_executado}
                formState={formState}
                handleFieldChange={handleFieldChange}
                handleCpfChangeAndValidate={handleCpfChangeAndValidate}
                handlePhoneChange={handlePhoneChange}
                handleRgChange={handleRgChange}
                handleDateChange={handleDateChange}
                toggleRequeridoDetalhe={toggleRequeridoDetalhe}
                formErrors={formErrors}
              />
            </EditAccordionSection>
          )}

          <EditAccordionSection
            id="detalhes_caso"
            title="Detalhes do caso"
            description="Valores, processo originario, emprego, guarda e campos especificos da acao."
            activeSection={activeEditSection}
            onToggle={setActiveEditSection}
          >
            <StepDetalhesCaso
              formState={formState}
              handleFieldChange={handleFieldChange}
              handleCurrencyChange={handleCurrencyChange}
              handleDayInputChange={handleDayInputChange}
              handleMonthYearChange={handleMonthYearChange}
              handleRestrictedAlphanumeric={handleRestrictedAlphanumeric}
              validar={validar}
              configAcao={configAcao}
              formErrors={formErrors}
            />
          </EditAccordionSection>
        </div>
      </form>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-start gap-3">
        <h2 className="heading-2">Resumo dos dados</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStartEdit}
            className="btn btn-ghost btn-sm border border-soft"
          >
            <Pencil size={16} />
            Editar
          </button>
          <div className="px-2 py-1 rounded bg-surface border border-soft text-[10px] font-bold uppercase tracking-wider text-muted">
            {isRepresentacao ? "Caso de Representacao" : "Acao Direta"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Nome completo</p>
          <p className="font-semibold break-words">{formatValue(nomePrincipal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">CPF</p>
          <p className="font-semibold break-words">{formatValue(cpfPrincipal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Tipo de acao</p>
          <p className="font-semibold break-words">{formatTipoAcaoLabel(caso.tipo_acao)}</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Unidade selecionada</p>
          <p className="font-semibold break-words">{formatValue(formState.CIDADEASSINATURA)}</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Nome da genitora</p>
          <p className="font-semibold break-words">
            {formatValue(formState.nome_mae_representante)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Protocolo</p>
          <p className="font-semibold break-words">{caso.protocolo}</p>
        </div>
      </div>

      <button
        onClick={() => setShowReview(!showReview)}
        className="btn btn-secondary w-full justify-start"
      >
        <Eye size={18} />
        {showReview ? "Ocultar dados preenchidos" : "Revisar todos os dados preenchidos"}
      </button>

      {showReview && (
        <div className="space-y-6 animate-fade-in">
          <ReviewSection title={isRepresentacao ? "Assistido" : "Autor da acao"}>
            <ReviewField label="Nome completo" value={formState.NOME} />
            <ReviewField label="CPF" value={formState.cpf} />
            <ReviewField label="Data de nascimento" value={formState.nascimento} />
            <ReviewField label="Tipo de acao" value={formatTipoAcaoLabel(caso.tipo_acao)} />
          </ReviewSection>

          {isRepresentacao && (formState.outrosFilhos || []).length > 0 && (
            <ReviewSection title="Outros filhos">
              {(formState.outrosFilhos || []).map((filho, index) => (
                <div
                  key={`${filho.nome || "filho"}-${index}`}
                  className="md:col-span-2 grid gap-3 md:grid-cols-3 border border-soft rounded-lg p-3"
                >
                  <ReviewField label={`Filho ${index + 2}`} value={filho.nome} />
                  <ReviewField label="CPF" value={filho.cpf} />
                  <ReviewField label="Data de nascimento" value={filho.dataNascimento} />
                </div>
              ))}
            </ReviewSection>
          )}

          <ReviewSection title={isRepresentacao ? "Representante legal" : "Dados de contato"}>
            <ReviewField label="Nome completo" value={formState.REPRESENTANTE_NOME} />
            <ReviewField label="CPF" value={formState.representante_cpf} />
            <ReviewField
              label="Data de nascimento"
              value={formState.representante_data_nascimento}
            />
            <ReviewField label="Nacionalidade" value={formState.representante_nacionalidade} />
            <ReviewField label="Estado civil" value={formState.representante_estado_civil} />
            <ReviewField label="Profissao" value={formState.representante_ocupacao} />
            <ReviewField label="RG" value={formState.representante_rg} />
            <ReviewField label="Orgao emissor" value={formState.emissor_rg_exequente} />
            <ReviewField
              label="Endereco residencial"
              value={formState.requerente_endereco_residencial}
              wide
            />
            <ReviewField label="Telefone" value={formState.requerente_telefone} />
            <ReviewField label="E-mail" value={formState.requerente_email} />
            <ReviewField label="Nome da mae" value={formState.nome_mae_representante} />
            <ReviewField label="Nome do pai" value={formState.nome_pai_representante} />
          </ReviewSection>

          {!configAcao?.ocultarDadosRequerido && (
            <ReviewSection title="Parte contraria">
              <ReviewField label="Nome completo" value={formState.REQUERIDO_NOME} />
              <ReviewField label="CPF" value={formState.executado_cpf} />
              <ReviewField label="RG" value={formState.rg_executado} />
              <ReviewField label="Orgao emissor" value={formState.emissor_rg_executado} />
              <ReviewField label="Profissao" value={formState.executado_ocupacao} />
              <ReviewField label="Nacionalidade" value={formState.executado_nacionalidade} />
              <ReviewField label="Estado civil" value={formState.executado_estado_civil} />
              <ReviewField label="Telefone" value={formState.executado_telefone} />
              <ReviewField label="E-mail" value={formState.executado_email} />
              <ReviewField
                label="Endereco residencial"
                value={formState.executado_endereco_residencial}
                wide
              />
              <ReviewField label="Mae do requerido" value={formState.nome_mae_executado} />
              <ReviewField label="Pai do requerido" value={formState.nome_pai_executado} />
            </ReviewSection>
          )}

          <ReviewSection title="Dados do caso">
            <ReviewField label="Vara da peticao atual" value={formState.VARA} />
            <ReviewField label="Cidade para assinatura" value={formState.CIDADEASSINATURA} />
            {!configAcao?.camposGerais?.ocultarDetalhesGerais && (
              <>
                <ReviewField label="Opcao de guarda" value={formState.opcaoGuarda} />
                <ReviewField label="Descricao da guarda" value={formState.descricaoGuarda} wide />
              </>
            )}
            {configAcao?.secoes?.includes("SecaoValoresPensao") && (
              <>
                <ReviewField label="Valor da pensao" value={formState.valor_pensao} />
                <ReviewField
                  label="Dados bancarios"
                  value={formState.dados_bancarios_exequente || formState.dados_bancarios_deposito}
                />
                <ReviewField label="Banco" value={formState.banco_deposito} />
                <ReviewField label="Agencia" value={formState.agencia_deposito} />
                <ReviewField label="Operacao" value={formState.conta_operacao} />
                <ReviewField label="Conta" value={formState.conta_deposito} />
                <ReviewField label="PIX" value={formState.chave_pix_deposito} />
              </>
            )}
            {configAcao?.secoes?.includes("SecaoProcessoOriginal") && (
              <>
                <ReviewField label="Processo originario" value={formState.processoOrigemNumero} />
                <ReviewField label="Cidade originaria" value={formState.cidadeOriginaria} />
                <ReviewField label="Vara originaria" value={formState.varaOriginaria} />
                <ReviewField label="Tipo de decisao" value={formState.tipo_decisao} />
                <ReviewField label="Dia de pagamento" value={formState.dia_pagamento} />
                <ReviewField
                  label="Percentual salario minimo"
                  value={formState.percentual_salario_minimo}
                />
                <ReviewField label="Periodo do debito" value={formState.periodo_meses_ano} />
                <ReviewField label="Valor do debito" value={formState.valor_debito} />
              </>
            )}
            {configAcao?.secoes?.includes("SecaoEmpregoRequerido") && (
              <>
                <ReviewField
                  label="Emprego formal do requerido"
                  value={formState.requerido_tem_emprego_formal}
                />
                <ReviewField label="Empregador" value={formState.empregador_nome} />
                <ReviewField
                  label="Endereco do empregador"
                  value={formState.empregador_endereco}
                  wide
                />
                <ReviewField label="E-mail do empregador" value={formState.empregador_email} />
              </>
            )}
          </ReviewSection>
        </div>
      )}
    </div>
  );
};

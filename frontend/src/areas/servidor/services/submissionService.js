import { fieldMapping, digitsOnlyFields, dateFields, currencyFields } from '../utils/formConstants.js';

export const processSubmission = async ({
  isAlvaraContext = false,
  formState,
  setFormErrors,
  setLoading,
  setStatusMessage,
  setGeneratedCredentials,
  toast,
  configAcao,
  forcaRepresentacao,
  today,
  stripNonDigits,
  validateCpfAlgorithm,
  formatDateToBr,
  parseBrDateToIso,
  normalizeDecimalForSubmit,
  API_BASE
}) => {
  const validationErrors = {};
  const nomeRequeridoTrim = (formState.REQUERIDO_NOME || "").trim();
  const enderecoRequeridoTrim = (formState.executado_endereco_residencial || "").trim();
  const telefoneRequeridoDigits = stripNonDigits(
    formState.executado_telefone || ""
  );
  const requeridoEmailTrim = (formState.executado_email || "").trim();

  if (!isAlvaraContext) {
    if (!nomeRequeridoTrim) {
      validationErrors.REQUERIDO_NOME =
        "Informe o nome completo da outra parte.";
    }
    if (
      !enderecoRequeridoTrim &&
      !telefoneRequeridoDigits &&
      !requeridoEmailTrim
    ) {
      validationErrors.requeridoContato =
        "Informe pelo menos um endereço, e-mail ou telefone da outra parte.";
    }
  }

  // --- VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS ---
  // Se for incapaz, validamos NOME (criança). Se for adulto, REPRESETANTE_NOME (autor).
  if (formState.assistidoEhIncapaz === "sim") {
    if (!formState.NOME) validationErrors.NOME = "O nome da criança é obrigatório.";
    if (!formState.REPRESENTANTE_NOME) validationErrors.REPRESENTANTE_NOME = "O nome da genitora/representante é obrigatório.";
  } else {
    if (!formState.REPRESENTANTE_NOME) validationErrors.REPRESENTANTE_NOME = "O nome completo é obrigatório.";
  }
  
  if (!formState.representante_cpf) {
    validationErrors.representante_cpf = "O CPF é obrigatório.";
  }

  if (formState.assistidoEhIncapaz === "nao") {
    if (!formState.requerente_endereco_residencial) validationErrors.requerente_endereco_residencial = "O endereço residencial é obrigatório.";
    if (!formState.requerente_telefone) validationErrors.requerente_telefone = "O telefone de contato é obrigatório.";
  }

  // ... (rest of mandatory validations) ...
  if (configAcao?.secoes?.includes("processo_original")) {
    if (configAcao?.exigeDadosProcessoOriginal) {
      if (!formState.data_inicio_debito) validationErrors.data_inicio_debito = "O mês inicial do débito é obrigatório.";
      if (!formState.data_fim_debito) validationErrors.data_fim_debito = "O mês final do débito é obrigatório.";
    }
  }

  // Validação Data de Nascimento Principal (Incapaz ou Adulto)
  const campoDataNasc = formState.assistidoEhIncapaz === "sim" ? "nascimento" : "representante_data_nascimento";
  const dataIso = parseBrDateToIso(formState[campoDataNasc]);
  if (!formState[campoDataNasc]) {
    validationErrors[campoDataNasc] = "A data de nascimento é obrigatória.";
  } else if (!dataIso) {
    validationErrors[campoDataNasc] = "Informe uma data válida (DD/MM/AAAA).";
  } else if (dataIso > today) {
    validationErrors[campoDataNasc] = "A data de nascimento não pode ser futura.";
  }

  // Validação CPF Matemático
  if (formState.representante_cpf && !validateCpfAlgorithm(formState.representante_cpf)) {
    validationErrors.representante_cpf = "CPF inválido.";
  }

  // Validação CPF Requerido (Se preenchido, deve ser válido)
  if (formState.executado_cpf && !validateCpfAlgorithm(formState.executado_cpf)) {
    validationErrors.executado_cpf = "O CPF da outra parte é inválido.";
  }

  // Validação CPF Outros Filhos
  if (formState.outrosFilhos && formState.outrosFilhos.length > 0) {
    formState.outrosFilhos.forEach((filho, index) => {
      if (filho.cpf && !validateCpfAlgorithm(filho.cpf)) {
        validationErrors[`filho_cpf_${index}`] = `O CPF do Filho(a) ${index + 2} é inválido.`;
      }
    });
  }

  // 2. Validação Relato vs Áudio (Ignorada se a ação não pedir fatos)
  if (!configAcao?.ocultarRelato) {
    if (formState.prefersAudio) {
      if (!formState.audioBlob) {
        validationErrors.audio = "Como você optou por enviar áudio, a gravação é obrigatória.";
      }
    } else {
      const relatoLimpo = (formState.relato || "").trim();
      if (relatoLimpo.length < 250) {
        validationErrors.relato = `O relato deve ser mais detalhado (mínimo 250 caracteres). Atual: ${relatoLimpo.length}.`;
      }
    }
  }

  // 3. Validação de Quantidade Mínima de Documentos
  if (!formState.enviarDocumentosDepois) {
    let minDocs = formState.assistidoEhIncapaz === "nao" ? 4 : 7;
    if (formState.assistidoEhIncapaz === "sim" && formState.outrosFilhos.length > 0) {
      minDocs += formState.outrosFilhos.length * 3;
    }

    if (formState.documentFiles.length < minDocs) {
      const docsNecessarios = formState.assistidoEhIncapaz === "nao"
        ? "RG (Frente/Verso), Comprovante de Residência e Renda"
        : "RG do Responsável, RG da Criança e Certidão de Nascimento (para cada filho)";
      validationErrors.documentos = `É necessário anexar pelo menos ${minDocs} documentos: ${docsNecessarios}. Atual: ${formState.documentFiles.length}.`;
    }
  }

  if (Object.keys(validationErrors).length > 0) {
    setFormErrors(validationErrors);
    toast.error("Existem campos obrigatórios não preenchidos ou inválidos.");
    return;
  }

  setFormErrors({});
  setLoading(true);
  setGeneratedCredentials(null);

  // Simulando etapas visuais (mantido)
  const timers = [
    setTimeout(() => setStatusMessage("Validando dados..."), 1000),
    setTimeout(() => setStatusMessage("Processando áudio e documentos..."), 3000),
    setTimeout(() => setStatusMessage("Gerando minuta com IA..."), 6000),
    setTimeout(() => setStatusMessage("Gerando protocolo..."), 9000),
  ];

  const formData = new FormData();

  // Dados Bancários formatados para IA
  let dadosBancariosFormatado = "";
  if (formState.tipo_conta_deposito === "corrente_poupanca") {
    dadosBancariosFormatado = `Tipo: Corrente/Poupança, Banco: ${formState.banco_deposito}, Agência: ${formState.agencia_deposito}, Conta: ${formState.conta_deposito}`;
  } else if (formState.tipo_conta_deposito === "pix") {
    dadosBancariosFormatado = `Tipo: PIX, Chave: ${formState.chave_pix_deposito}`;
  } else if (formState.tipo_conta_deposito === "outro") {
    dadosBancariosFormatado = `Tipo: Outro, Detalhes: ${formState.outros_dados_deposito}`;
  }

  if (dadosBancariosFormatado) {
    formData.append("dados_bancarios_exequente", dadosBancariosFormatado);
  }

  // 1.5 Lógica de Período de Débito (Concatenado)
  const formatMonthYear = (monthYearStr) => {
    if (!monthYearStr || !monthYearStr.includes("/")) return monthYearStr;
    const [month, year] = monthYearStr.split("/");
    const months = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const monthIndex = parseInt(month, 10) - 1;
    if (monthIndex < 0 || monthIndex > 11) return monthYearStr;
    return `${months[monthIndex]}/${year}`;
  };

  if (formState.data_inicio_debito && formState.data_fim_debito) {
    const inicio = formatMonthYear(formState.data_inicio_debito);
    const fim = formatMonthYear(formState.data_fim_debito);
    formData.append("periodo_debito_execucao", `${inicio} a ${fim}`);
  } else if (formState.data_inicio_debito) {
    formData.append("periodo_debito_execucao", `Desde ${formatMonthYear(formState.data_inicio_debito)}`);
  }

  // 1. Preenche o FormData
  // O estado (formState) já usa as TAGS OFICIAIS, portanto iteramos diretamente.
  // Não precisamos mais do fieldMapping legado.
  const fieldsToIgnore = new Set(["outrosFilhos", "documentFiles", "documentNames", "documentosMarcados", "audioBlob", "tipoAcao", "acaoEspecifica"]);
  
  const valuesToSubmit = { ...formState };
  
  Object.keys(valuesToSubmit).forEach((key) => {
    if (fieldsToIgnore.has(key)) return;
    
    const rawValue = valuesToSubmit[key];
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return;
    }
    
    let normalizedValue = rawValue;
    
    // Tratamentos de formatação para subsets
    if (digitsOnlyFields?.has(key)) {
      normalizedValue = stripNonDigits(rawValue);
    } else if (currencyFields?.has(key)) {
      normalizedValue = normalizeDecimalForSubmit(rawValue);
    } else if (dateFields?.has(key) || key.includes("data_nascimento")) {
      const iso = parseBrDateToIso(rawValue);
      if (iso) normalizedValue = iso;
    }
    
    if (normalizedValue !== undefined && normalizedValue !== null && normalizedValue !== "") {
      // Como o formState já está alinhado com dicionarioTags, passamos o key direto
      formData.append(key, normalizedValue);
    }
  });

  // [EIXO 3] Garante que enviarDocumentosDepois é SEMPRE enviado, mesmo que false
  formData.append('enviar_documentos_depois', String(formState.enviarDocumentosDepois ?? false));

  // 2. Correção Crítica: Formatar Tipo de Ação para o Backend
  // O backend espera "Area - Ação" para saber qual template DOCX usar
  if (!configAcao) {
    console.warn("[FormularioSubmissao] configAcao não encontrada para:", formState.tipoAcao, formState.acaoEspecifica);
  }
  const tituloAcao = configAcao?.titulo || formState.acaoEspecifica;
  const tipoAcaoFormatado = `${formState.tipoAcao} - ${tituloAcao}`;
  formData.append("tipoAcao", tipoAcaoFormatado);
  formData.append("acaoEspecifica", formState.acaoEspecifica); // chave do dicionário para lookup no backend

  // Lógica para múltiplos filhos
  if (formState.assistidoEhIncapaz === "sim") {
    // Filho 1 (Principal)
    let infoFilhos = formState.REPRESENTANTE_NOME;

    // Filhos Extras
    if (formState.outrosFilhos.length > 0) {
      const nomesExtras = formState.outrosFilhos
        .map((f) => f.nome)
        .filter((n) => n.trim() !== "")
        .join(", ");
      if (nomesExtras) infoFilhos += `, ${nomesExtras}`;
    }

    // Envia o array completo como JSON string para o backend processar
    formData.append(
      "outros_filhos_detalhes",
      JSON.stringify(formState.outrosFilhos)
    );

    // Envia a string completa com todos os nomes
    if (infoFilhos) {
      formData.append("filhos_info", infoFilhos);
    }
  }

  // 3. Construção de Campos Compostos para a IA (Gemini)
  // A IA usa 'dados_adicionais_requerente' para criar o resumo, então montamos uma string rica
  const dadosAdicionaisRequerente = [
    `RG: ${
      formState.representante_rg
        ? `${formState.representante_rg}${
            formState.emissor_rg_exequente ? ` ${formState.emissor_rg_exequente}` : ""
          }`
        : "Não informado"
    },`,
    `Nacionalidade: ${formState.representante_nacionalidade || "Não informado"},`,
    !forcaRepresentacao ? `Estado Civil: ${formState.representante_estado_civil || "Não informado"},` : "",
    `Data Nascimento: ${
      formatDateToBr(formState.representante_data_nascimento) || "Não informado"
    },`,
  ].filter(Boolean).join(" ");
  formData.append(
    "dados_adicionais_requerente",
    `${dadosAdicionaisRequerente.trim()} `
  );

  const detalhesRequerido = [];
  if (
    formState.requeridoOutrosSelecionados?.includes("requeridoRg") &&
    formState.rg_executado
  ) {
    detalhesRequerido.push(
      `RG: ${formState.rg_executado}${
        formState.emissor_rg_executado ? ` ${formState.emissor_rg_executado}` : ""
      }`
    );
  }
  if (
    formState.requeridoOutrosSelecionados?.includes(
      "requeridoDataNascimento"
    ) &&
    formState.executado_data_nascimento
  ) {
    detalhesRequerido.push(
      `Data de nascimento: ${formatDateToBr(
        formState.executado_data_nascimento
      )}`
    );
  }
  if (
    formState.requeridoOutrosSelecionados?.includes("requeridoNomeMae") &&
    formState.nome_mae_executado
  ) {
    detalhesRequerido.push(`Nome da mãe: ${formState.nome_mae_executado}`);
  }
  if (
    formState.requeridoOutrosSelecionados?.includes("requeridoNomePai") &&
    formState.nome_pai_executado
  ) {
    detalhesRequerido.push(`Nome do pai: ${formState.nome_pai_executado}`);
  }
  if (
    formState.requeridoOutrosSelecionados?.includes(
      "requeridoOutrosDetalhes"
    ) &&
    formState.dados_adicionais_requerido
  ) {
    detalhesRequerido.push(
      `Observações: ${formState.dados_adicionais_requerido}`
    );
  }
  if (detalhesRequerido.length > 0) {
    formData.append(
      "dados_adicionais_requerido_array",
      detalhesRequerido.join(" | ")
    );
  }

  // Arquivos e Arrays
  formData.append(
    "documentos_informados",
    JSON.stringify(formState.documentosMarcados)
  );
  formData.append(
    "documentos_nomes",
    JSON.stringify(formState.documentNames || {})
  );
  if (formState.audioBlob)
    formData.append("audio", formState.audioBlob, "gravacao.webm");
  formState.documentFiles.forEach((file) => {
    if (!file || !file.name) return; // Proteção contra arquivos inválidos
    // Sanitiza o nome do arquivo (remove acentos) para evitar erros de encoding no servidor
    const safeName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_"); // Substitui espaços por underline para maior segurança
    formData.append("documentos", file, safeName);
  });

  try {
    const response = await fetch(`${API_BASE}/casos/novo`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha no servidor");
    setGeneratedCredentials({
      chaveAcesso: data.chaveAcesso,
      protocolo: data.protocolo,
    });
    localStorage.removeItem("rascunho_caso");
  } catch (error) {
    console.error("Erro:", error);
    toast.error(`Erro: ${error.message}`);
  } finally {
    setLoading(false);
    timers.forEach(clearTimeout);
    setStatusMessage("");
  }
};
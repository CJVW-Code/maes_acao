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
  const nomeRequeridoTrim = (formState.nomeRequerido || "").trim();
  const enderecoRequeridoTrim = (formState.enderecoRequerido || "").trim();
  const telefoneRequeridoDigits = stripNonDigits(
    formState.telefoneRequerido || ""
  );
  const requeridoEmailTrim = (formState.emailRequerido || "").trim();

  if (!isAlvaraContext) {
    if (!nomeRequeridoTrim) {
      validationErrors.nomeRequerido =
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

  // --- VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS (Restaurando validação manual) ---
  if (!formState.nome) validationErrors.nome = "O nome completo é obrigatório.";
  
  // CPF obrigatório apenas para o Assistido Adulto ou Representante
  if (formState.assistidoEhIncapaz === "nao" && !formState.cpf) {
    validationErrors.cpf = "O CPF é obrigatório.";
  }

  if (formState.assistidoEhIncapaz === "nao") {
    if (!formState.enderecoAssistido) validationErrors.enderecoAssistido = "O endereço residencial é obrigatório.";
    if (!formState.telefone) validationErrors.telefone = "O telefone de contato é obrigatório.";
  } else {
    // Caso de Representação
    if (!formState.representanteNome) validationErrors.representanteNome = "O nome do representante é obrigatório.";
    if (!formState.representanteCpf) validationErrors.representanteCpf = "O CPF do representante é obrigatório.";
    // Telefone e Email do representante são copiados para o assistido no submit, mas validamos aqui se necessário
  }

  // --- NOVAS VALIDAÇÕES OBRIGATÓRIAS ---
  if (configAcao?.secoes?.includes("processo_original")) {
    const isExecution = formState.acaoEspecifica?.toLowerCase().includes("execução") || configAcao?.titulo?.toLowerCase().includes("execução");
    if (isExecution) {
      if (!formState.dataInicioDebito) validationErrors.dataInicioDebito = "O mês inicial do débito é obrigatório.";
      if (!formState.dataFimDebito) validationErrors.dataFimDebito = "O mês final do débito é obrigatório.";
    }
  }

  // 1. WhatsApp Removido (Solicitado pelo usuário)

  // Validação Data de Nascimento (Não pode ser futura)
  const dataIso = parseBrDateToIso(formState.dataNascimentoAssistido);
  if (!formState.dataNascimentoAssistido) {
    validationErrors.dataNascimentoAssistido = "A data de nascimento é obrigatória.";
  } else if (!dataIso) {
    validationErrors.dataNascimentoAssistido = "Informe uma data válida (DD/MM/AAAA).";
  } else if (dataIso > today) {
    validationErrors.dataNascimentoAssistido = "A data de nascimento não pode ser futura.";
  }

  // Validação CPF Matemático
  if (formState.cpf && !validateCpfAlgorithm(formState.cpf)) {
    validationErrors.cpf = "CPF inválido.";
  }
  if (
    formState.assistidoEhIncapaz === "sim" &&
    formState.representanteCpf &&
    !validateCpfAlgorithm(formState.representanteCpf)
  ) {
    validationErrors.representanteCpf = "CPF inválido.";
  }

  // Validação CPF Requerido (Se preenchido, deve ser válido)
  if (formState.cpfRequerido && !validateCpfAlgorithm(formState.cpfRequerido)) {
    validationErrors.cpfRequerido = "O CPF da outra parte é inválido.";
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

    // Aumenta a exigência para cada filho extra (3 documentos por filho: RG F/V + Certidão)
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
    console.error("[Validation Errors]", validationErrors);
    setFormErrors(validationErrors);
    toast.error("Existem campos obrigatórios não preenchidos ou inválidos. Verifique o formulário.");

    const firstErrorKey = Object.keys(validationErrors)[0];
    let targetElement = document.getElementsByName(firstErrorKey)[0];

    if (!targetElement) {
      if (firstErrorKey === "requeridoContato") {
        targetElement = document.getElementsByName("enderecoRequerido")[0];
      } else if (firstErrorKey === "audio") {
        targetElement = document.getElementById("audio-recording-section");
      } else if (firstErrorKey === "documentos") {
        targetElement = document.getElementById("documents-upload-section");
      }
    }

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      if (["INPUT", "TEXTAREA", "SELECT"].includes(targetElement.tagName)) {
        targetElement.focus();
      }
    }
    return;
  }

  setFormErrors({});
  setLoading(true);
  setGeneratedCredentials(null);

  // Simulando etapas visuais
  const timers = [
    setTimeout(() => setStatusMessage("Validando dados..."), 1000),
    setTimeout(
      () => setStatusMessage("Processando áudio e documentos..."),
      3000
    ),
    setTimeout(
      () => setStatusMessage("Gerando minuta com Inteligência Artificial..."),
      6000
    ),
    setTimeout(() => setStatusMessage("Gerando protocolo..."), 9000),
  ];

  const formData = new FormData();

  let dadosBancariosFormatado = "";
  switch (formState.tipoContaDeposito) {
    case "corrente_poupanca":
      if (
        formState.bancoDeposito ||
        formState.agenciaDeposito ||
        formState.contaDeposito
      ) {
        dadosBancariosFormatado = `Tipo: Conta Corrente/Poupança, Banco: ${
          formState.bancoDeposito || "N/A"
        }, Agência: ${formState.agenciaDeposito || "N/A"}, Conta: ${
          formState.contaDeposito || "N/A"
        }`;
      }
      break;
    case "pix":
      if (formState.chavePixDeposito) {
        dadosBancariosFormatado = `Tipo: PIX, Chave: ${formState.chavePixDeposito}`;
      }
      break;
    case "outro":
      if (formState.outrosDadosDeposito) {
        dadosBancariosFormatado = `Tipo: Outro, Detalhes: ${formState.outrosDadosDeposito}`;
      }
      break;
    default:
      // No account type selected
      break;
  }
  if (dadosBancariosFormatado) {
    formData.append("dados_bancarios_deposito", dadosBancariosFormatado);
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

  if (formState.dataInicioDebito && formState.dataFimDebito) {
    const inicio = formatMonthYear(formState.dataInicioDebito);
    const fim = formatMonthYear(formState.dataFimDebito);
    formData.append("periodo_debito", `${inicio} a ${fim}`);
  } else if (formState.dataInicioDebito) {
    formData.append("periodo_debito", `Desde ${formatMonthYear(formState.dataInicioDebito)}`);
  }

  // 1. Mapeamento de campos do Estado (camelCase) para o Backend (snake_case)
  // Isso garante que o Controller do Node.js receba os dados como espera
  // fieldMapping and digitsOnlyFields are now imported from formConstants.js

  // Ajuste para representação (criança): usa contatos do representante
  const valuesToSubmit = { ...formState };
  if (valuesToSubmit.assistidoEhIncapaz === "sim") {
    valuesToSubmit.telefone = valuesToSubmit.representanteTelefone;
    valuesToSubmit.emailAssistido = valuesToSubmit.representanteEmail;
    valuesToSubmit.enderecoAssistido = valuesToSubmit.representanteEnderecoResidencial;
    valuesToSubmit.assistidoEstadoCivil = "solteiro(a)";
  }

  // Preenche o FormData usando o mapeamento
  Object.keys(fieldMapping).forEach((key) => {
    const rawValue = valuesToSubmit[key];
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return;
    }
    let normalizedValue = rawValue;
    
    if (digitsOnlyFields.has(key)) {
      normalizedValue = stripNonDigits(rawValue);
    } else if (currencyFields.has(key)) {
      normalizedValue = normalizeDecimalForSubmit(rawValue);
    } else if (dateFields.has(key)) {
      const iso = parseBrDateToIso(rawValue);
      if (iso) normalizedValue = iso;
    } else if (key.toLowerCase().includes("data") || key.toLowerCase().includes("nascimento")) {
       // Fallback para outros campos de data não listados no set explicitamente
      const iso = parseBrDateToIso(rawValue);
      if (iso) normalizedValue = iso;
    }
    
    if (normalizedValue !== undefined && normalizedValue !== null) {
      formData.append(fieldMapping[key], normalizedValue);
    }
  });

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
    let infoFilhos = formState.nome;

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
      formState.assistidoRgNumero
        ? `${formState.assistidoRgNumero}${
            formState.assistidoRgOrgao ? ` ${formState.assistidoRgOrgao}` : ""
          }`
        : "Não informado"
    },`,
    `Nacionalidade: ${formState.assistidoNacionalidade || "Não informado"},`,
    !forcaRepresentacao ? `Estado Civil: ${formState.assistidoEstadoCivil || "Não informado"},` : "",
    `Data Nascimento: ${
      formatDateToBr(formState.dataNascimentoAssistido) || "Não informado"
    },`,
  ].filter(Boolean).join(" ");
  formData.append(
    "dados_adicionais_requerente",
    `${dadosAdicionaisRequerente.trim()} `
  );

  const detalhesRequerido = [];
  if (
    formState.requeridoOutrosSelecionados?.includes("requeridoRg") &&
    formState.requeridoRgNumero
  ) {
    detalhesRequerido.push(
      `RG: ${formState.requeridoRgNumero}${
        formState.requeridoRgOrgao ? ` ${formState.requeridoRgOrgao}` : ""
      }`
    );
  }
  if (
    formState.requeridoOutrosSelecionados?.includes(
      "requeridoDataNascimento"
    ) &&
    formState.requeridoDataNascimento
  ) {
    detalhesRequerido.push(
      `Data de nascimento: ${formatDateToBr(
        formState.requeridoDataNascimento
      )}`
    );
  }
  if (
    formState.requeridoOutrosSelecionados?.includes("requeridoNomeMae") &&
    formState.requeridoNomeMae
  ) {
    detalhesRequerido.push(`Nome da mãe: ${formState.requeridoNomeMae}`);
  }
  if (
    formState.requeridoOutrosSelecionados?.includes("requeridoNomePai") &&
    formState.requeridoNomePai
  ) {
    detalhesRequerido.push(`Nome do pai: ${formState.requeridoNomePai}`);
  }
  if (
    formState.requeridoOutrosSelecionados?.includes(
      "requeridoOutrosDetalhes"
    ) &&
    formState.requeridoOutrosDetalhes
  ) {
    detalhesRequerido.push(
      `Observações: ${formState.requeridoOutrosDetalhes}`
    );
  }
  if (detalhesRequerido.length > 0) {
    formData.append(
      "dados_adicionais_requerido",
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
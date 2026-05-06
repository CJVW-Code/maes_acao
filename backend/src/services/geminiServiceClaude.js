/* eslint-disable no-unused-vars */
// @ts-nocheck
import { generateLegalText } from "./aiService.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import { getConfigAcaoBackend } from "../config/dicionarioAcoes.js";

dotenv.config();

const DEFAULT_COMARCA = process.env.DEFENSORIA_DEFAULT_COMARCA || "Teixeira de Freitas/BA";
const DEFAULT_VARA =
  process.env.DEFENSORIA_DEFAULT_VARA || "1ª Vara de Família, Órfãos, Sucessões e Interditos";
const DEFAULT_DEFENSORA =
  process.env.DEFENSORIA_DEFAULT_DEFENSORA || "DEFENSOR(A) PÚBLICO(A) DO ESTADO DA BAHIA";
const DEFAULT_ENDERECO_DPE =
  process.env.DEFENSORIA_DEFAULT_ENDERECO_DPE || "[ENDEREÇO DA DEFENSORIA PÚBLICA]";
const DEFAULT_TELEFONE_DPE = process.env.DEFENSORIA_DEFAULT_TELEFONE_DPE || "[TELEFONE DA DPE]";
const DEFAULT_CIDADE_ASSINATURA =
  process.env.DEFENSORIA_DEFAULT_CIDADE_ASSINATURA || DEFAULT_COMARCA;
const DEFAULT_TRIAGEM = "[TRIAGEM SIGAD/SOLAR]";
const DEFAULT_PROCESSO = "[NÚMERO DO PROCESSO/DEPENDÊNCIA]";
const PLACEHOLDER_FIELD = "[DADO PENDENTE]";

const MAX_TENTATIVAS_IA = 2;

// --- NORMALIZAÇÃO DE NOMES PARA PAPÉIS ---

const normalizarNomesParaPapeis = (text, nomeMae, nomePai) => {
  if (!text) return text;
  let result = text;
  if (nomeMae && nomeMae.length > 3) {
    const escaped = nomeMae.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "a genitora");
  }
  if (nomePai && nomePai.length > 3) {
    const escaped = nomePai.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "o requerido");
  }
  return result;
};

// --- VALIDADOR DETERMINÍSTICO DE SAÍDA ---

/**
 * Valida a saída da IA contra regras duras.
 * Retorna { valido: boolean, erros: string[] }
 */
const validarDosFatos = (texto, nParasEsperado) => {
  if (!texto || texto.trim().length === 0) {
    return { valido: false, erros: ["SAÍDA VAZIA"] };
  }

  const erros = [];

  // 1. Contagem de parágrafos via marcador §N.
  const paragrafos = texto
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => /^§\d+\./.test(p));

  if (paragrafos.length !== nParasEsperado) {
    erros.push(
      `ESTRUTURA: esperado ${nParasEsperado} parágrafos com marcador §N., obtido ${paragrafos.length}`,
    );
  }

  // 2. Termos proibidos
  const termosProibidos = [
    { regex: /\bmenor(es)?\b/i, label: '"menor"' },
    { regex: /\bOcorre que\b/i, label: '"Ocorre que"' },
    { regex: /\bInsta salientar\b/i, label: '"Insta salientar"' },
    { regex: /\bNesse diapasão\b/i, label: '"Nesse diapasão"' },
    { regex: /\bÉ o que se infere\b/i, label: '"É o que se infere"' },
  ];

  termosProibidos.forEach(({ regex, label }) => {
    if (regex.test(texto)) erros.push(`TERMO PROIBIDO: ${label}`);
  });

  // 3. Primeira pessoa
  if (
    /\b(eu|sou|estou|tenho|quero|desejo|declaro|informo|venho|meu|minha|meus|minhas)\b/i.test(texto)
  ) {
    erros.push("PRIMEIRA PESSOA detectada");
  }

  // 4. Bloco único (saída sem separação de parágrafos)
  if (!texto.includes("\n\n") && texto.length > 300) {
    erros.push("BLOCO ÚNICO: saída sem separação entre parágrafos");
  }

  // 5. Rótulos/apêndices indevidos
  if (/Sobre a guarda|Quanto ao valor da causa|No que tange aos alimentos/i.test(texto)) {
    erros.push("RÓTULO INDEVIDO: seção extra fora da estrutura contratada");
  }

  return { valido: erros.length === 0, erros };
};

// --- PÓS-PROCESSAMENTO MÍNIMO ---

/**
 * Higienização cirúrgica da saída após validação aprovada.
 * Remove marcadores §N., aplica fixes assertividade e PII.
 */
export const postProcessDosFatos = (texto, _nParasEsperado = 6, piiContext = {}) => {
  if (!texto) return texto;

  let t = texto
    .replace(/§\d+\.\s*/g, "") // remove marcadores de contrato
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Assertividade jurídica
  const fixes = [
    { regex: /\bindica que\b/gi, replacement: "demonstra que" },
    { regex: /\bparece que\b/gi, replacement: "evidencia-se que" },
    { regex: /\bsugere que\b/gi, replacement: "demonstra que" },
    { regex: /\bvisa assegurar\b/gi, replacement: "assegura" },
    {
      regex: /\bmenor(es)?\b(?!\s+(prazo|valor|quantia|montante|de idade))/gi,
      replacement: "alimentando",
    },
    { regex: /genitora é alimentanda/gi, replacement: "genitora é a representante legal" },
    { regex: /mãe é autora/gi, replacement: "genitora é a representante legal" },
  ];
  fixes.forEach((f) => (t = t.replace(f.regex, f.replacement)));

  // Primeira pessoa residual
  t = t.replace(
    /\b(eu|sou|estou|tenho|quero|desejo|declaro|informo|venho|meu|minha|meus|minhas)\b/gi,
    "",
  );

  // Normalização de nomes para papéis processuais
  if (piiContext.nomeMae || piiContext.nomePai) {
    t = normalizarNomesParaPapeis(t, piiContext.nomeMae, piiContext.nomePai);
  }

  return sanitizeLegalAbbreviations(t);
};

// --- FUNÇÕES UTILITÁRIAS DE NORMALIZAÇÃO ---

const formatName = (name) => {
  if (!name || typeof name !== "string") return undefined;
  const exceptions = ["da", "de", "do", "das", "dos", "e", "em"];
  return name
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && exceptions.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

export const normalizePromptData = (raw = {}) => {
  const requerente = raw.requerente ||
    raw.exequente ||
    raw.assistido ||
    raw.cliente || {
      nome: formatName(
        raw.nome_assistido || raw.requerente_nome || raw.nome_requerente || raw.exequente_nome,
      ),
      cpf: raw.cpf_assistido || raw.requerente_cpf || raw.cpf_requerente || raw.exequente_cpf,
      dataNascimento:
        raw.requerente_data_nascimento ||
        raw.data_nascimento_assistido ||
        raw.data_nascimento_requerente,
      representante: formatName(
        raw.representante_requerente || raw.representante || raw.representante_nome,
      ),
    };
  const requerido = raw.requerido ||
    raw.executado || {
      nome: formatName(
        raw.nome_requerido || raw.requerido_nome || raw.executado_nome || raw.nome_executado,
      ),
      cpf: raw.cpf_requerido || raw.requerido_cpf || raw.executado_cpf || raw.cpf_executado,
      ocupacao: raw.requerido_ocupacao || raw.ocupacao_requerido,
    };
  const dadosBancarios =
    raw.dadosBancarios || parseBankData(raw.dados_bancarios_deposito || raw.dados_bancarios || "");
  return {
    comarca: raw.comarca || DEFAULT_COMARCA,
    vara: raw.vara || raw.vara_originaria || DEFAULT_VARA,
    triagemNumero: raw.triagemNumero || raw.triagem_numero || raw.protocolo || DEFAULT_TRIAGEM,
    processoDependencia:
      raw.processoDependencia || raw.numero_processo_originario || DEFAULT_PROCESSO,
    requerente,
    requerido,
    exequente: raw.exequente || requerente,
    executado: raw.executado || requerido,
    dadosBancarios,
    valorMensalPensao: raw.valorMensalPensao ?? raw.valor_pensao,
    diaPagamentoMensal: raw.diaPagamentoMensal ?? raw.dia_pagamento,
    periodoDevedor:
      raw.periodoDevedor ||
      raw.periodo_debito_execucao ||
      raw.periodo_debito ||
      raw.periodo_meses_ano,
    valorTotalDebito: raw.valorTotalDebito || raw.valor_debito,
    cidadeDataAssinatura:
      raw.cidadeDataAssinatura || raw.CIDADEASSINATURA || DEFAULT_CIDADE_ASSINATURA,
    defensoraNome: formatName(raw.defensoraNome || raw.defensora_nome) || DEFAULT_DEFENSORA,
    enderecoDPE: raw.enderecoDPE || raw.endereco_dpe || DEFAULT_ENDERECO_DPE,
    telefoneDPE: raw.telefoneDPE || raw.telefone_dpe || DEFAULT_TELEFONE_DPE,
    relato: raw.relato_texto || raw.relato || raw.relatoBruto || raw.relato_adicional || "",
    acao_especifica: raw.acao_especifica || raw.tipo_acao || raw.tipoAcao || "",
    tipo_acao: raw.tipo_acao || raw.tipoAcao || "",
  };
};

const parseBankData = (raw) => {
  if (!raw || typeof raw !== "string") return {};
  const text = raw.trim();
  if (!text) return {};
  const match = (pattern) => {
    const result = text.match(pattern);
    return result ? result[1].trim() : undefined;
  };
  return {
    raw: text,
    pix: match(/pix[:-]?\s*([^\n|]+)/i),
    banco: match(/banco[:-]?\s*([^\n|]+)/i),
    agencia: match(/ag[êe]ncia[:-]?\s*([\w-]+)/i),
    conta: match(/conta[:-]?\s*([\w-]+)/i),
  };
};

const cleanText = (value, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
};

function sanitizeLegalAbbreviations(text) {
  let cleaned = text.replace(/#+\s*Dos Fatos/gi, "").replace(/\*\*Dos Fatos\*\*/gi, "");
  cleaned = cleaned.replace(/^Dos Fatos\n/i, "").trim();
  cleaned = cleaned.replace(/\b(art)\/\s*/gi, "$1. ");
  cleaned = cleaned.replace(/\ba menor\b/gi, "a criança");
  cleaned = cleaned.replace(/\bo menor\b/gi, "o alimentando");
  cleaned = cleaned.replace(/\bas menores\b/gi, "as crianças");
  cleaned = cleaned.replace(/\bos menores\b/gi, "os alimentandos");
  cleaned = cleaned.replace(/\bmenor\b/gi, "criança");
  return cleaned;
}

// --- GERAÇÃO PRINCIPAL ---

export const generateDosFatos = async (caseData = {}, acaoKey) => {
  try {
    const normalized = normalizePromptData(caseData);
    const relatoBase = cleanText(normalized.relato, "Relato detalhado não informado.");

    const formatDocumentList = (docs = []) => {
      if (!Array.isArray(docs) || !docs.length) return "Nenhum documento ou prova informado.";
      const filtered = docs.map((doc) => cleanText(doc)).filter(Boolean);
      return filtered.length
        ? filtered.map((doc, index) => `${index + 1}. ${doc}`).join("\n")
        : "Nenhum documento ou prova informado.";
    };

    const documentosList = formatDocumentList(caseData.documentos_informados);

    let outrosFilhos = [];
    try {
      if (caseData.outros_filhos_detalhes) {
        outrosFilhos =
          typeof caseData.outros_filhos_detalhes === "string"
            ? JSON.parse(caseData.outros_filhos_detalhes)
            : caseData.outros_filhos_detalhes;
      }
    } catch (e) {
      logger.warn("Erro ao fazer parse de outros_filhos_detalhes", e);
    }
    if (!Array.isArray(outrosFilhos)) outrosFilhos = [];

    const todosAutores = [
      {
        nome: normalized.requerente?.nome,
        cpf: normalized.requerente?.cpf,
        nascimento: normalized.requerente?.dataNascimento,
      },
    ];
    outrosFilhos.forEach((f) => {
      if (f.nome)
        todosAutores.push({ nome: formatName(f.nome), cpf: f.cpf, nascimento: f.dataNascimento });
    });

    const listaAutoresTexto = todosAutores.map((a) => cleanText(a.nome)).join(", ");

    const opcaoGuarda = caseData.opcao_guarda || caseData.opcaoGuarda;
    let intencaoGuardaTexto = "";
    if (opcaoGuarda === "nao")
      intencaoGuardaTexto =
        "[FLAG_GUARDA: NÃO] (A assistida declarou que NÃO deseja pedido de guarda neste momento. Foque exclusivamente na fundamentação de Alimentos.)";
    else if (opcaoGuarda === "regularizar")
      intencaoGuardaTexto =
        "[FLAG_GUARDA: SIM] (A assistida DESEJA regularizar a guarda e o regime de convivência/visitas.)";
    else intencaoGuardaTexto = "[FLAG_GUARDA: NÃO]";

    const contextFilhosGuarda = cleanText(
      `${intencaoGuardaTexto} ${caseData.filhos_info || caseData.filhosInfo || caseData.descricao_guarda || ""}`,
      "",
    );

    let situacaoAssistido = caseData.situacao_financeira_genitora
      ? `Situação Financeira: ${caseData.situacao_financeira_genitora}`
      : "Sem detalhes adicionais sobre a situação financeira.";

    let situacaoRequerido = cleanText(caseData.dados_adicionais_requerido, "");
    if (caseData.requerido_tem_emprego_formal)
      situacaoRequerido += `\nPossui emprego formal? ${caseData.requerido_tem_emprego_formal}.`;
    if (caseData.empregador_requerido_nome)
      situacaoRequerido += ` Empregador: ${caseData.empregador_requerido_nome}.`;
    if (normalized.requerido.ocupacao)
      situacaoRequerido += ` Ocupação: ${normalized.requerido.ocupacao}.`;
    if (!situacaoRequerido) situacaoRequerido = "Sem detalhes adicionais sobre o requerido.";

    const valorPensao = cleanText(normalized.valorMensalPensao, "Valor não informado");

    const bensPartilha = cleanText(caseData.bens_partilha);
    const outrosPedidos = [];
    if (bensPartilha) outrosPedidos.push(`Bens a partilhar: ${bensPartilha}`);
    if (caseData.alimentos_para_ex_conjuge)
      outrosPedidos.push(`Alimentos para ex-cônjuge: ${caseData.alimentos_para_ex_conjuge}`);
    const contextoExtra = outrosPedidos.length
      ? `\nOutros Pedidos/Detalhes: ${outrosPedidos.join("; ")}`
      : "";

    // Mapa PII para mascaramento no prompt
    const piiMap = {};
    const addToPii = (value, placeholder) => {
      if (value && value.length > 3 && value !== "Não informado" && value !== "Valor não informado")
        piiMap[value] = placeholder;
    };
    addToPii(normalized.requerente?.nome, "[NOME_AUTOR_PRINCIPAL]");
    addToPii(normalized.requerente?.cpf, "[CPF_AUTOR_PRINCIPAL]");
    addToPii(normalized.requerente?.representante, "[NOME_REPRESENTANTE]");
    todosAutores.forEach((autor, index) => {
      const num = index + 1;
      addToPii(autor.nome, `[NOME_AUTOR_${num}]`);
      addToPii(autor.cpf, `[CPF_AUTOR_${num}]`);
      addToPii(autor.nascimento, `[NASC_AUTOR_${num}]`);
    });
    addToPii(normalized.requerido?.nome, "[NOME_REU]");
    addToPii(normalized.requerido?.cpf, "[CPF_REU]");

    // Monta parágrafos esperados dinamicamente
    const temGuarda =
      (contextFilhosGuarda || "").toLowerCase().includes("guarda") ||
      (contextFilhosGuarda || "").toLowerCase().includes("conviv");
    const temDadosRequerido =
      situacaoRequerido &&
      !situacaoRequerido.includes("Sem detalhes") &&
      situacaoRequerido.trim().length > 10;

    const paragrafosContrato = [
      `§1. VÍNCULO — Apresente os alimentandos (${listaAutoresTexto}) e o requerido. Estabeleça o vínculo de parentesco e o contexto do fim da convivência.`,
      `§2. OMISSÃO — Descreva que o requerido não contribui voluntariamente para o sustento dos filhos desde o término da relação.`,
      `§3. HIPOSSUFICIÊNCIA — Demonstre que a genitora (representante legal) não consegue, sozinha, prover todas as necessidades dos alimentandos. Dados: ${situacaoAssistido}.`,
      `§4. NECESSIDADES — Liste as despesas reais dos alimentandos e vincule ao valor pleiteado de R$ ${valorPensao}.`,
    ];
    if (temDadosRequerido)
      paragrafosContrato.push(
        `§5. CAPACIDADE — Demonstre as condições financeiras do requerido de arcar com a pensão. Dados: ${situacaoRequerido}.`,
      );
    if (temGuarda)
      paragrafosContrato.push(
        `§${paragrafosContrato.length + 1}. GUARDA — Descreva a situação atual da guarda e o pedido de regularização. Contexto: ${contextFilhosGuarda}.`,
      );

    const nParas = paragrafosContrato.length;

    // System prompt do dicionário ou fallback padrão
    const configBackend = getConfigAcaoBackend(acaoKey);
    const systemPrompt =
      configBackend?.promptIA?.systemPrompt ||
      `Você é um Defensor Público experiente da Bahia.
Redija EXCLUSIVAMENTE a seção "DOS FATOS". Linguagem: terceira pessoa técnica, juridiquês clássico.

PAPÉIS PROCESSUAIS (INEGOCIÁVEL):
— AUTORES/REQUERENTES = os filhos (alimentandos), representados pela genitora.
— REPRESENTANTE LEGAL = a genitora/mãe. PROIBIDO chamá-la de "requerente", "autora" ou "assistida".
— REQUERIDO = o genitor demandado.

PROIBIDO EM ABSOLUTO:
— "menor" — use "filho", "alimentando", "criança" ou "adolescente"
— "Ocorre que" / "Nesse diapasão" / "Insta salientar" / "É o que se infere"
— CPF, RG, datas de nascimento no texto
— Listas, marcadores ou tópicos
— Cabeçalhos, rótulos ou seções extras fora dos parágrafos contratados
— Qualquer fato não contido no RELATO
— Primeira pessoa em qualquer forma
— Linguagem vaga: "indica que", "sugere que", "parece que" — use "demonstra", "evidencia", "comprova"

REGRA DE SAÍDA OBRIGATÓRIA:
— Retorne EXATAMENTE ${nParas} parágrafos numerados com marcador §N. (ex: §1., §2., ...)
— Cada parágrafo separado por UMA linha em branco
— Nenhum texto fora dos parágrafos numerados`;

    const userPrompt = `DADOS DE REFERÊNCIA:
ALIMENTANDOS: ${listaAutoresTexto}
REPRESENTANTE LEGAL: ${normalized.requerente?.representante || "Não informado"}
REQUERIDO: ${cleanText(normalized.requerido?.nome)}
VALOR PLEITEADO: R$ ${valorPensao}
RELATO: """${relatoBase}"""${contextoExtra}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTRATO DE SAÍDA — OBEDEÇA EXATAMENTE:
Retorne ${nParas} parágrafos com os marcadores abaixo, separados por linha em branco.
Nenhum outro texto fora dos parágrafos.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${paragrafosContrato.join("\n\n")}`;

    // Loop com retry determinístico
    let textoGerado = null;
    let tentativa = 0;

    while (tentativa < MAX_TENTATIVAS_IA) {
      tentativa++;
      logger.info(
        `🤖 [IA] Gerando 'Dos Fatos' — tentativa ${tentativa}/${MAX_TENTATIVAS_IA} (${nParas} parágrafos esperados)...`,
      );

      const raw = await generateLegalText(systemPrompt, userPrompt, 0.1, piiMap);
      const { valido, erros } = validarDosFatos(raw?.trim(), nParas);

      if (valido) {
        textoGerado = raw.trim();
        logger.info(`✅ [IA] 'Dos Fatos' aprovado na tentativa ${tentativa}.`);
        break;
      }

      logger.warn(`⚠️ [IA] Tentativa ${tentativa} inválida: ${erros.join(" | ")}`);

      if (tentativa < MAX_TENTATIVAS_IA) {
        logger.info(`🔄 [IA] Resubmetendo com instrução de correção...`);
      }
    }

    if (!textoGerado) {
      logger.error(
        `❌ [IA] 'Dos Fatos' não passou na validação após ${MAX_TENTATIVAS_IA} tentativas. Usando última saída.`,
      );
      // Usa a última geração mesmo que inválida — evita falha total do pipeline
      textoGerado = await generateLegalText(systemPrompt, userPrompt, 0.1, piiMap);
    }

    const textoPosProcessado = postProcessDosFatos(textoGerado.trim(), nParas, {
      nomeMae: normalized.requerente?.representante,
      nomePai: normalized.requerido?.nome,
      ocupacaoRequerido: normalized.requerido?.ocupacao,
      valorPensao: normalized.valorMensalPensao,
      casoId: normalized.triagemNumero,
    });

    return sanitizeLegalAbbreviations(textoPosProcessado);
  } catch (error) {
    logger.error(`❌ Erro ao gerar a seção 'Dos Fatos' com IA: ${error.message}`);
    throw error;
  }
};

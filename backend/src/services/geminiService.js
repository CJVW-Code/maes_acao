/* eslint-disable no-unused-vars */
// @ts-nocheck
import { generateLegalText } from "./aiService.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import { getConfigAcaoBackend } from "../config/dicionarioAcoes.js";

dotenv.config();

const DEFAULT_COMARCA =
  process.env.DEFENSORIA_DEFAULT_COMARCA || "Teixeira de Freitas/BA";
const DEFAULT_VARA =
  process.env.DEFENSORIA_DEFAULT_VARA ||
  "1ª Vara de Família, Órfãos, Sucessões e Interditos";
const DEFAULT_DEFENSORA =
  process.env.DEFENSORIA_DEFAULT_DEFENSORA ||
  "DEFENSOR(A) PÚBLICO(A) DO ESTADO DA BAHIA";
const DEFAULT_ENDERECO_DPE =
  process.env.DEFENSORIA_DEFAULT_ENDERECO_DPE ||
  "[ENDEREÇO DA DEFENSORIA PÚBLICA]";
const DEFAULT_TELEFONE_DPE =
  process.env.DEFENSORIA_DEFAULT_TELEFONE_DPE || "[TELEFONE DA DPE]";
const DEFAULT_CIDADE_ASSINATURA =
  process.env.DEFENSORIA_DEFAULT_CIDADE_ASSINATURA || DEFAULT_COMARCA;
const DEFAULT_TRIAGEM = "[TRIAGEM SIGAD/SOLAR]";
const DEFAULT_PROCESSO = "[NÚMERO DO PROCESSO/DEPENDÊNCIA]";
const PLACEHOLDER_FIELD = "[DADO PENDENTE]";

// --- FUNÇÕES UTILITÁRIAS DE NORMALIZAÇÃO ---

const formatName = (name) => {
  if (!name || typeof name !== "string") return undefined;

  // Lista de preposições que devem ficar em minúsculo (padrão ABNT/Jurídico)
  const exceptions = ["da", "de", "do", "das", "dos", "e", "em"];

  return name
    .toLowerCase()
    .trim()
    .split(/\s+/) // Divide por qualquer espaço em branco
    .map((word, index) => {
      // Se for a primeira palavra, sempre capitaliza.
      // Se não for e estiver na lista de exceções, mantém minúsculo.
      if (index > 0 && exceptions.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

export const normalizePromptData = (raw = {}) => {
  const requerente = raw.requerente ||
    raw.exequente ||
    raw.assistido ||
    raw.cliente || {
      // AQUI: Aplicando formatName
      nome: formatName(
        raw.nome_assistido ||
          raw.requerente_nome ||
          raw.nome_requerente ||
          raw.exequente_nome,
      ),
      cpf:
        raw.cpf_assistido ||
        raw.requerente_cpf ||
        raw.cpf_requerente ||
        raw.exequente_cpf,
      dataNascimento:
        raw.requerente_data_nascimento ||
        raw.data_nascimento_assistido ||
        raw.data_nascimento_requerente,
      // AQUI: Aplicando formatName
      representante: formatName(
        raw.representante_requerente ||
          raw.representante ||
          raw.representante_nome,
      ),
    };

  const requerido = raw.requerido ||
    raw.executado || {
      // AQUI: Aplicando formatName
      nome: formatName(
        raw.nome_requerido ||
          raw.requerido_nome ||
          raw.executado_nome ||
          raw.nome_executado,
      ),
      cpf:
        raw.cpf_requerido ||
        raw.requerido_cpf ||
        raw.executado_cpf ||
        raw.cpf_executado,
      ocupacao: raw.requerido_ocupacao || raw.ocupacao_requerido,
    };

  const dadosBancarios =
    raw.dadosBancarios ||
    parseBankData(raw.dados_bancarios_deposito || raw.dados_bancarios || "");

  return {
    comarca: raw.comarca || DEFAULT_COMARCA,
    vara: raw.vara || raw.vara_originaria || DEFAULT_VARA,
    triagemNumero:
      raw.triagemNumero ||
      raw.triagem_numero ||
      raw.protocolo ||
      DEFAULT_TRIAGEM,
    processoDependencia:
      raw.processoDependencia ||
      raw.numero_processo_originario ||
      DEFAULT_PROCESSO,
    requerente,
    requerido,
    exequente: raw.exequente || requerente,
    executado: raw.executado || requerido,
    dadosBancarios,
    valorMensalPensao: raw.valorMensalPensao ?? raw.valor_pensao,
    diaPagamentoMensal: raw.diaPagamentoMensal ?? raw.dia_pagamento,
    periodoDevedor: raw.periodoDevedor || raw.periodo_debito_execucao || raw.periodo_debito || raw.periodo_meses_ano,
    valorTotalDebito: raw.valorTotalDebito || raw.valor_debito,
    cidadeDataAssinatura:
      raw.cidadeDataAssinatura ||
      raw.CIDADEASSINATURA ||
      DEFAULT_CIDADE_ASSINATURA,
    // AQUI: É bom garantir que o nome da defensora também esteja formatado, caso venha do banco bagunçado
    defensoraNome:
      formatName(raw.defensoraNome || raw.defensora_nome) || DEFAULT_DEFENSORA,
    enderecoDPE: raw.enderecoDPE || raw.endereco_dpe || DEFAULT_ENDERECO_DPE,
    telefoneDPE: raw.telefoneDPE || raw.telefone_dpe || DEFAULT_TELEFONE_DPE,
    relato:
      raw.relato_texto ||
      raw.relato ||
      raw.relatoBruto ||
      raw.relato_adicional ||
      "",
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

const _valueOrPlaceholder = (value, fallback = PLACEHOLDER_FIELD) => {
  if (value === undefined || value === null) return fallback;
  const trimmed = `${value}`.trim();
  return trimmed ? trimmed : fallback;
};

const cleanText = (value, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text.length ? text : fallback;
};

function sanitizeLegalAbbreviations(text) {
  // 1. Remove formatações Markdown de títulos que a IA possa ter colocado
  let cleaned = text
    .replace(/#+\s*Dos Fatos/gi, "")
    .replace(/\*\*Dos Fatos\*\*/gi, "");
  // 2. Remove o título "Dos Fatos" se estiver solto no início
  cleaned = cleaned.replace(/^Dos Fatos\n/i, "").trim();
  // 3. Corrige abreviação de artigo (art/ 5 -> art. 5)
  return cleaned.replace(/\b(art)\/\s*/gi, "$1. ");
}

// --- FUNÇÕES PRINCIPAIS DE GERAÇÃO ---

/**
 * Analisa o caso para gerar um resumo executivo para o Painel do Defensor.
 * Usa o orquestrador para garantir alta disponibilidade.
 */
export const analyzeCase = async (fullText) => {
  logger.info("🤖 [IA] Função analyzeCase desativada por solicitação de arquitetura.");
  return null;
};

/**
 * Gera a seção "DOS FATOS" da petição.
 * Usa o serviço blindado (Sanitização + Groq/Gemini).
 */
export const generateDosFatos = async (caseData = {}, acaoKey) => {
  try {
    const normalized = normalizePromptData(caseData);
    const relatoBase = cleanText(
      normalized.relato,
      "Relato detalhado não informado.",
    );

    const formatDocumentList = (docs = []) => {
      if (!Array.isArray(docs) || !docs.length)
        return "Nenhum documento ou prova informado.";
      const filtered = docs
        .map((doc) => cleanText(doc))
        .filter((doc) => Boolean(doc));
      return filtered.length
        ? filtered.map((doc, index) => `${index + 1}. ${doc}`).join("\n")
        : "Nenhum documento ou prova informado.";
    };

    const documentosList = formatDocumentList(caseData.documentos_informados);

    // --- LÓGICA PARA MÚLTIPLOS FILHOS ---
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
      if (f.nome) {
        todosAutores.push({
          nome: formatName(f.nome),
          cpf: f.cpf,
          nascimento: f.dataNascimento,
        });
      }
    });

    const listaAutoresTexto = todosAutores
      .map((a) => cleanText(a.nome))
      .join(", ");

    const isPlural = todosAutores.length > 1;
    const termoAutor = isPlural ? "Os autores" : "O autor";
    const termoFilho = isPlural ? "são filhos" : "é filho";

    let filhosInfo = cleanText(
      caseData.filhos_info || caseData.filhosInfo || caseData.descricao_guarda,
      "Informações sobre filhos não foram apresentadas.",
    );

    if (todosAutores.length > 0) {
      const detalhes = todosAutores
        .map((a) => `${a.nome} (Nasc: ${a.nascimento || "?"})`)
        .join("; ");
      filhosInfo = `${filhosInfo}. Detalhes: ${detalhes}`;
    }

    // Preparação dos textos descritivos
    let situacaoAssistido = "";
    if (caseData.situacao_financeira_genitora) {
      situacaoAssistido = `Situação Financeira: ${caseData.situacao_financeira_genitora}`;
    }
    if (!situacaoAssistido)
      situacaoAssistido =
        "Sem detalhes adicionais sobre a situação financeira.";

    let situacaoRequerido = cleanText(caseData.dados_adicionais_requerido, "");
    if (caseData.requerido_tem_emprego_formal) {
      situacaoRequerido += `\nPossui emprego formal? ${caseData.requerido_tem_emprego_formal}.`;
    }
    if (caseData.empregador_requerido_nome) {
      situacaoRequerido += ` Empregador: ${caseData.empregador_requerido_nome}.`;
    }
    if (normalized.requerido.ocupacao) {
      situacaoRequerido += ` Ocupação: ${normalized.requerido.ocupacao}.`;
    }
    if (!situacaoRequerido)
      situacaoRequerido = "Sem detalhes adicionais sobre o requerido.";

    const valorPensao = cleanText(
      normalized.valorMensalPensao,
      "Valor não informado",
    );
    const bensPartilha = cleanText(caseData.bens_partilha);
    const outrosPedidos = [];
    if (bensPartilha) outrosPedidos.push(`Bens a partilhar: ${bensPartilha}`);
    if (caseData.alimentos_para_ex_conjuge)
      outrosPedidos.push(
        `Alimentos para ex-cônjuge: ${caseData.alimentos_para_ex_conjuge}`,
      );
    const contextoExtra = outrosPedidos.length
      ? `\nOutros Pedidos/Detalhes: ${outrosPedidos.join("; ")}`
      : "";

    // --- CONSTRUÇÃO DO MAPA DE PRIVACIDADE (PII MAP) ---
    // Mapeia os dados reais para placeholders.
    // O aiService vai trocar isso ANTES de enviar para a IA.
    const piiMap = {};
    const addToPii = (value, placeholder) => {
      // Regra de segurança: só substitui se tiver mais de 3 chars e não for placeholder genérico
      if (
        value &&
        value.length > 3 &&
        value !== "Não informado" &&
        value !== "Valor não informado"
      ) {
        piiMap[value] = placeholder;
      }
    };

    todosAutores.forEach((autor, index) => {
      const num = index + 1;
      addToPii(autor.nome, `[NOME_AUTOR_${num}]`);
      addToPii(autor.cpf, `[CPF_AUTOR_${num}]`);
      addToPii(autor.nascimento, `[NASC_AUTOR_${num}]`);
    });

    addToPii(normalized.requerido?.nome, "[NOME_REU]");
    addToPii(normalized.requerido?.cpf, "[CPF_REU]");
    // Se quiser, adicione mais campos aqui (ex: nome da criança se tiver separado)

    // --- PROMPTS (Dicionário com Fallback Legado) ---
    const configBackend = getConfigAcaoBackend(acaoKey);
    const usandoDicionario = !!configBackend?.promptIA?.systemPrompt;
    logger.info(`[IA] acaoKey="${acaoKey}" → prompt=${usandoDicionario ? 'DICIONÁRIO' : 'FALLBACK_LEGADO'}`);

    // Fallback legado: prompt original de família/fixação (sempre funciona)
    const SYSTEM_PROMPT_LEGADO = `Você é um Defensor Público experiente na Bahia.
Seu estilo de escrita é extremamente formal, culto e padronizado (juridiquês clássico).
Você DEVE utilizar os conectivos: "Insta salientar", "Ocorre que, no caso em tela", "Como é sabido", "aduzir".
REGRA CRÍTICA: NUNCA use o termo "menor" para se referir a uma criança ou adolescente. Em vez disso, use "criança", "adolescente" ou "filho(a)".
REGRA DE OURO: NÃO cite números de documentos (CPF, RG) ou datas de nascimento no texto narrativo, pois estes dados já constam na qualificação das partes.
Não use listas ou tópicos na resposta final. Escreva apenas parágrafos coesos.`;

    const systemPrompt = configBackend?.promptIA?.systemPrompt || SYSTEM_PROMPT_LEGADO;

    // No userPrompt, instruímos a IA a usar os placeholders que ela vai receber
    // Ex: Ela vai receber "O autor [NOME_AUTOR]..." em vez de "O autor João..."
    const userPrompt = `Redija APENAS o conteúdo textual da seção "DOS FATOS" de uma ${
      normalized.tipo_acao || "petição inicial"
    }.

ATENÇÃO: NÃO inclua o título "DOS FATOS", "DOS FATOS E FUNDAMENTOS" ou qualquer cabeçalho. Comece diretamente pelo texto.

Estrutura Lógica Obrigatória:
1. **Vínculo:** "${termoAutor} (${listaAutoresTexto}) ${termoFilho} do requerido ([NOME_REU]), conforme é possível aduzir..."
2. **Necessidade:** "Ocorre que, no caso em tela..."
3. **Dever:** "Como é sabido..."
4. **Conflito:** "Insta salientar..."

DADOS DO CASO:
- Assistidos (Autores): ${listaAutoresTexto}
- Requerido: ${cleanText(normalized.requerido?.nome)} (CPF: ${cleanText(
      normalized.requerido?.cpf,
    )})
- Filhos/Guarda: ${filhosInfo}
- Situação Mãe: ${situacaoAssistido}
- Situação Pai: ${situacaoRequerido}
- Valor Pedido: R$ ${valorPensao}
- Relato Informal: """${relatoBase}"""
- Documentos: ${documentosList}
${contextoExtra}

Adapte o texto se o relato informal contradizer o modelo padrão (ex: pai já paga algo), mas mantenha o tom formal.`;

    // Chamada Segura: Envia o mapa PII para sanitização automática no aiService
    logger.info(
      `🤖 [IA] Gerando seção 'Dos Fatos' para ${
        normalized.requerente?.nome || "Desconhecido"
      }...`,
    );
    const start = Date.now();
    const textoGerado = await generateLegalText(
      systemPrompt,
      userPrompt,
      0.3,
      piiMap,
    );
    logger.info(
      `✅ [IA] 'Dos Fatos' gerado em ${((Date.now() - start) / 1000).toFixed(
        2,
      )}s`,
    );
    return sanitizeLegalAbbreviations(textoGerado.trim());
  } catch (error) {
    logger.error(
      `❌ Erro ao gerar a seção 'Dos Fatos' com IA: ${error.message}`,
    );

    // Lança o erro para que o Controller gerencie o fallback de forma centralizada
    throw error;
  }
};

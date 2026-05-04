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

// --- PÓS-PROCESSADOR DE SAÍDA DA IA ---

const removePrimeiraPessoa = (text) => {
  if (!text) return text;
  return text
    .replace(/\b(Eu|Sou|Estou|Tenho|Quero|Desejo|Meu|Minha|Meu filho|Minha filha)\b/gi, (match) => {
      if (/meu filho/i.test(match)) return "o alimentando";
      if (/minha filha/i.test(match)) return "a alimentanda";
      return "";
    })
    .trim();
};

const removeFrasesDuplicadas = (text) => {
  if (!text) return text;
  const frases = text.split(/(?<=\.)\s+/);
  const usadas = new Set();

  return frases
    .filter((f) => {
      const clean = f.trim().toLowerCase().replace(/[^\w\s]/g, "");
      if (clean.length < 15) return true;
      if (usadas.has(clean)) return false;
      usadas.add(clean);
      return true;
    })
    .join(" ");
};

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

const validarQualidadeTexto = (text) => {
  const erros = [];
  if (/\b(Eu|Sou|Estou|Tenho|Meu|Minha)\b/i.test(text)) erros.push("primeira_pessoa");
  
  const termosRepetitivos = ["se afastou", "não contribui", "necessidades", "insuficiente"];
  termosRepetitivos.forEach(termo => {
    const count = (text.toLowerCase().match(new RegExp(termo, "g")) || []).length;
    if (count > 2) erros.push(`repeticao_${termo.replace(" ", "_")}`);
  });

  return erros;
};

/**
 * Filtra e higieniza a saída da IA antes de salvar no banco ou DOCX.
 */
const postProcessDosFatos = async (texto, nParasEsperado = 4, piiContext = {}) => {
  if (!texto) return texto;

  const expressoes_proibidas = [
    /\bocorre que\b/gi,
    /\bnesse diapas[aã]o\b/gi,
    /\binsta salientar\b/gi,
    /\bé o que se infere que\b/gi,
    /\bmenor(es)?\b(?!\s+(prazo|valor|quantia|montante|de idade))/gi,
  ];

  const cabecalhos_secao = /^§\d[\s—–-].*$/gm;

  let resultado = texto;

  // 1. Limpeza básica
  resultado = resultado.replace(cabecalhos_secao, "").trim();
  expressoes_proibidas.forEach((regex) => {
    resultado = resultado.replace(regex, "");
  });

  // 2. Sanitização semântica
  resultado = removePrimeiraPessoa(resultado);
  resultado = removeFrasesDuplicadas(resultado);
  resultado = normalizarNomesParaPapeis(resultado, piiContext.nomeMae, piiContext.nomePai);

  // 3. Validação e Refinamento
  const erros = validarQualidadeTexto(resultado);
  if (erros.length > 0) {
    logger.warn(`[IA-Validador] Detectados problemas (${erros.join(", ")}). Refinando...`);
    try {
      const promptRefinamento = `Atue como revisor jurídico. Reescreva o texto abaixo removendo repetições e marcas de primeira pessoa, mantendo tom técnico e impessoal. 
IMPORTANTE: Mantenha EXATAMENTE ${nParasEsperado} parágrafos. NÃO altere os fatos.

TEXTO:
"""
${resultado}
"""`;
      const textoRefinado = await generateLegalText(
        `Você é um revisor de petições. Limpe o estilo sem alterar os fatos. Retorne EXATAMENTE ${nParasEsperado} parágrafos.`,
        promptRefinamento,
        0.1
      );
      if (textoRefinado && textoRefinado.length > resultado.length * 0.5) {
        resultado = textoRefinado;
      }
    } catch (e) {
      logger.error(`[IA-Validador] Erro refinamento: ${e.message}`);
    }
  }

  // 4. Normalização final
  resultado = resultado.replace(/\n{3,}/g, "\n\n").trim();
  const parasContados = resultado.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  if (parasContados !== nParasEsperado) {
    logger.warn(`[pós-proc] Parágrafos esperados: ${nParasEsperado}, gerados: ${parasContados}.`);
  }

  return resultado;
};

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
  cleaned = cleaned.replace(/\b(art)\/\s*/gi, "$1. ");

  // 4. FILTRO DE SEGURANÇA (PROIBIÇÃO DO TERMO "MENOR")
  // Substitui "menor" por "criança/adolescente" ou "alimentando" conforme o contexto
  cleaned = cleaned.replace(/\ba menor\b/gi, "a criança");
  cleaned = cleaned.replace(/\bo menor\b/gi, "o alimentando");
  cleaned = cleaned.replace(/\bas menores\b/gi, "as crianças");
  cleaned = cleaned.replace(/\bos menores\b/gi, "os alimentandos");
  cleaned = cleaned.replace(/\bmenor\b/gi, "criança");

  return cleaned;
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

    // Dados de guarda e intenção (explícita via triagem)
    const opcaoGuarda = caseData.opcao_guarda || caseData.opcaoGuarda;
    let intencaoGuardaTexto = "";
    if (opcaoGuarda === "nao") {
      intencaoGuardaTexto = "[FLAG_GUARDA: NÃO] (A assistida declarou que NÃO deseja pedido de guarda neste momento. Foque exclusivamente na fundamentação de Alimentos.)";
    } else if (opcaoGuarda === "regularizar") {
      intencaoGuardaTexto = "[FLAG_GUARDA: SIM] (A assistida DESEJA regularizar a guarda e o regime de convivência/visitas.)";
    } else {
      intencaoGuardaTexto = "[FLAG_GUARDA: NÃO]";
    }

    const contextFilhosGuarda = cleanText(
      `${intencaoGuardaTexto} ${caseData.filhos_info || caseData.filhosInfo || caseData.descricao_guarda || ""}`,
      "",
    );

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
    // Se quiser, adicione mais campos aqui (ex: nome da criança se tiver separado)

    // --- PROMPTS (Dicionário com Fallback Legado) ---
    const configBackend = getConfigAcaoBackend(acaoKey);
    const usandoDicionario = !!configBackend?.promptIA?.systemPrompt;
    logger.info(`[IA] acaoKey="${acaoKey}" → prompt=${usandoDicionario ? 'DICIONÁRIO' : 'FALLBACK_LEGADO'}`);

    // Fallback legado: prompt original de família/fixação (sempre funciona)
    const SYSTEM_PROMPT_LEGADO = `Você é um Defensor Público experiente na Bahia, especializado em Direito de Família.
Redija EXCLUSIVAMENTE a seção "DOS FATOS". Linguagem: terceira pessoa técnica, juridiquês clássico, parágrafos coesos.

PAPÉIS PROCESSUAIS:
- AUTORES (requerentes) = os filhos (alimentandos), representados pela genitora.
- A mãe é a "representante legal" ou "genitora" — JAMAIS "requerente", "autora" ou "assistida".
- O pai é o "requerido".

PRINCÍPIO: cada parágrafo tem UMA função. Diga uma vez, com precisão. Não repita.
Sequência obrigatória: FATO → CONSEQUÊNCIA → NECESSIDADE → PEDIDO.

CONECTIVOS PERMITIDOS (máximo 1 por parágrafo, com função lógica real):
  "No caso em tela," / "Cumpre registrar que" / "Com efeito," / "Nesse contexto," / "Contudo," / "Destarte,"

PROIBIDO em absoluto: "Ocorre que", "Nesse diapasão", "Insta salientar" (início de parágrafo), "É o que se infere que".
PROIBIDO: "menor" — use "criança", "adolescente", "filho(a)" ou "alimentando(a)".
PROIBIDO: CPF, RG, datas de nascimento no texto narrativo.
PROIBIDO: listas ou tópicos. PROIBIDO: inventar fatos não contidos no relato.

IMPORTANTE: Retorne EXCLUSIVAMENTE o texto final, sem checklist, comentários ou notas adicionais.`;


    const systemPrompt = configBackend?.promptIA?.systemPrompt || SYSTEM_PROMPT_LEGADO;

    // --- CONSTRUÇÃO DINÂMICA DO USER PROMPT ---
    // A lógica condicional dos parágrafos §5 e §6 é resolvida AQUI em JS.
    // O modelo recebe apenas uma lista definitiva e não-ambígua de parágrafos a redigir.

    const temGuarda = (contextFilhosGuarda || "").toLowerCase().includes("guarda") ||
      (contextFilhosGuarda || "").toLowerCase().includes("conviv");
    const temDadosRequerido =
      situacaoRequerido &&
      !situacaoRequerido.includes("Sem detalhes") &&
      situacaoRequerido.trim().length > 10;

    // Bloco de dados estruturados para o modelo
    const blocoReferencia = `
DADOS DE REFERÊNCIA (use somente estes):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALIMENTANDOS (autores da ação): ${listaAutoresTexto}
REPRESENTANTE LEGAL (genitora): ${normalized.requerente?.representante || "Não informado"}
REQUERIDO (genitor demandado): ${cleanText(normalized.requerido?.nome)}
TIPO DE AÇÃO: ${normalized.tipo_acao || "Fixação de Alimentos"}
VALOR DO PEDIDO: R$ ${valorPensao}
SITUAÇÃO FINANCEIRA DA REPRESENTANTE LEGAL: ${situacaoAssistido}
${temDadosRequerido ? `SITUAÇÃO DO REQUERIDO: ${situacaoRequerido}` : "SITUAÇÃO DO REQUERIDO: [SEM DADOS — NÃO ESCREVA SOBRE CAPACIDADE CONTRIBUTIVA]"}
${temGuarda ? `DADOS DE GUARDA: ${contextFilhosGuarda}` : "GUARDA: [NÃO SOLICITADA — NÃO ESCREVA SOBRE GUARDA OU VISITAS]"}
DOCUMENTOS: ${documentosList}
${contextoExtra}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RELATO INFORMAL (FONTE PRINCIPAL — extraia fatos concretos daqui):
"""
${relatoBase}
"""`;

    // Parágrafos fixos (sempre presentes)
    const paragrafos = [
      `PARÁGRAFO 1 — VÍNCULO E CONTEXTO:
Apresente: quem são os alimentandos, quem é o requerido, e o contexto do fim do relacionamento.
PROIBIDO neste parágrafo: qualquer menção a dinheiro, omissão ou dificuldade financeira.
Limite: 3–4 linhas.`,

      `PARÁGRAFO 2 — OMISSÃO DO REQUERIDO:
Descreva que o requerido não contribui voluntariamente para o sustento dos filhos.
Use APENAS fatos concretos do relato (ex: contribuições esporádicas, recusa, ausência).
PROIBIDO neste parágrafo: mencionar a situação financeira da genitora ou repetir dados do §1.
Limite: 3–4 linhas.`,

      `PARÁGRAFO 3 — HIPOSSUFICIÊNCIA DA REPRESENTANTE LEGAL:
Demonstre que a genitora não consegue, sozinha, prover as necessidades dos filhos.
Se constar no relato: mencione ocupação e renda. Se não constar: foque na impossibilidade sem inventar valores.
PROIBIDO neste parágrafo: repetir a omissão do requerido. PROIBIDO: repetir dados dos §1 ou §2.
Limite: 3–4 linhas.`,

      `PARÁGRAFO 4 — NECESSIDADES DOS ALIMENTANDOS E VALOR PEDIDO:
Liste as necessidades concretas dos alimentandos com base no relato (alimentação, saúde, educação, vestuário, moradia).
Vincule o valor pedido (R$ ${valorPensao}) a essas despesas reais. Se o valor não estiver no relato, fundamente nas necessidades básicas.
PROIBIDO neste parágrafo: repetir dados dos parágrafos anteriores.
Limite: 4–5 linhas.`,
    ];

    // Parágrafo condicional §5 — só se houver dados reais do requerido
    if (temDadosRequerido) {
      paragrafos.push(`PARÁGRAFO ${paragrafos.length + 1} — CAPACIDADE CONTRIBUTIVA DO REQUERIDO:
Com base EXCLUSIVAMENTE nos dados fornecidos sobre o requerido (${situacaoRequerido}), demonstre que ele tem condições de pagar.
PROIBIDO: inventar qualquer dado não informado. PROIBIDO: repetir a omissão do §2.
Limite: 2–3 linhas.`);
    }

    // Parágrafo condicional §6 — só se guarda foi solicitada
    if (temGuarda) {
      paragrafos.push(`PARÁGRAFO ${paragrafos.length + 1} — GUARDA E CONVIVÊNCIA:
Descreva a situação atual da guarda com base nos dados fornecidos (${contextFilhosGuarda}).
Inclua o pedido de regularização e o regime de visitas proposto.
PROIBIDO: generalizar. Use apenas o que foi informado sobre guarda.
Limite: 3–4 linhas.`);
    }

    const nParas = paragrafos.length;

    const userPrompt = `${blocoReferencia}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAREFA: Redija exatamente ${nParas} parágrafo${nParas > 1 ? "s" : ""} conforme as instruções abaixo.
Separe cada parágrafo com UMA linha em branco. Sem títulos, sem rótulos, sem comentários.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${paragrafos.join("\n\n")}`;

    // Chamada Segura: Envia o mapa PII para sanitização automática no aiService
    logger.info(
      `🤖 [IA] Gerando seção 'Dos Fatos' para ${
        normalized.requerente?.nome || "Desconhecido"
      } (${nParas} parágrafos esperados)...`,
    );
    const start = Date.now();
    const textoGerado = await generateLegalText(
      systemPrompt,
      userPrompt,
      0.1,
      piiMap,
    );
    logger.info(
      `✅ [IA] 'Dos Fatos' gerado em ${((Date.now() - start) / 1000).toFixed(2)}s`,
    );

    // --- PÓS-PROCESSAMENTO: VALIDADOR E LIMPEZA DE SAÍDA ---
    const textoPosProcessado = await postProcessDosFatos(textoGerado.trim(), nParas, {
      nomeMae: normalized.requerente?.representante,
      nomePai: normalized.requerido?.nome,
    });

    return sanitizeLegalAbbreviations(textoPosProcessado);
  } catch (error) {
    logger.error(
      `❌ Erro ao gerar a seção 'Dos Fatos' com IA: ${error.message}`,
    );

    // Lança o erro para que o Controller gerencie o fallback de forma centralizada
    throw error;
  }
};

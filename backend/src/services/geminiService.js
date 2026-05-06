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

// --- PÓS-PROCESSADOR DE SAÍDA DA IA ---

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

/**
 * Filtra e higieniza a saída da IA antes de salvar no banco ou DOCX.
 * Versão APEX ULTIMATE (B+++): 
 * - Hard Split para blocos únicos
 * - Remoção de rótulos/apêndices
 * - Rastreio de Sujeito Ativo (Anáfora)
 * - Diferença Relativa para Tie-break
 * - Fallbacks Data-Driven e Conectores Dinâmicos
 */
export const postProcessDosFatos = async (texto, nParasEsperado = 6, piiContext = {}) => {
  if (!texto) return texto;

  let clean = texto.replace(/\r/g, "");

  // 1. HARD SPLIT (Fallback para blocos únicos sem quebra)
  if (!clean.includes("\n\n") && clean.length > 200) {
    // Quebra em pontos seguidos de letra maiúscula, exceto abreviações comuns (Art., etc.)
    clean = clean.replace(/(?<!\bArt|mod|Dra?|Exmo|Sr)\. (?=[A-Z])/g, ".\n\n");
  }

  // 2. LIMPEZA DE RÓTULOS E RUÍDO (Anti-Appendix)
  const labelsToRemove = [
    /Sobre a guarda e conviv[eê]ncia:?\s*/gi,
    /Quanto ao valor da causa:?\s*/gi,
    /No que tange aos alimentos:?\s*/gi,
    /Dos fatos:?\s*/gi,
    /Ponto \d+:?\s*/gi,
    /Par[aá]grafo \d+:?\s*/gi
  ];
  labelsToRemove.forEach(r => (clean = clean.replace(r, "")));

  // Limpeza inicial e PII
  clean = clean
    .replace(/\n{3,}/g, "\n\n")
    .replace(/#+\s*Dos Fatos/gi, "")
    .replace(/\*\*Dos Fatos\*\*/gi, "")
    .trim();

  // Ajustes de Assertividade Jurídica
  const safeFixes = [
    { regex: /\bindica que\b/gi, replacement: "demonstra" },
    { regex: /\bparece que\b/gi, replacement: "evidencia-se que" },
    { regex: /\bmenor(es)?\b(?!\s+(prazo|valor|quantia|montante|de idade))/gi, replacement: "alimentando" },
    { regex: /genitora é alimentanda/gi, replacement: "genitora é a representante legal" },
    { regex: /mãe é autora/gi, replacement: "genitora é a representante legal" }
  ];
  safeFixes.forEach(f => (clean = clean.replace(f.regex, f.replacement)));

  // Remoção de primeira pessoa
  clean = clean.replace(/\b(eu|sou|estou|tenho|quero|desejo|declaro|informo|venho|meu|minha|meus|minhas)\b/gi, "");

  if (piiContext.nomeMae || piiContext.nomePai) {
    clean = normalizarNomesParaPapeis(clean, piiContext.nomeMae, piiContext.nomePai);
  }

  // 3. ATOMIZAÇÃO AGRESSIVA (Apex Splitter)
  // Quebra em conectores de transição interna para permitir redistribuição temática
  const atomizerRegex = /(?<=\.|;)\s+|,\s+(?=e\s|mas|porém|bem como|além disso|sendo que|de modo que|visto que)/gi;
  const atomosRaw = clean.split(atomizerRegex).map(a => a.trim()).filter(a => a.length > 4);

  // 4. CONFIGURAÇÃO DE CLUSTERS
  const CLUSTERS = {
    VINCULO: {
      terms: { "fruto da relação": 5, "união mantida": 5, "relacionamento entre": 5, "início": 3, "convivência": 2, "casados": 2, "separação": 2 },
      priority: 1, gender: "NEUTRAL"
    },
    OMISSAO: {
      terms: { "não contribui": 6, "deixou de": 5, "nunca": 5, "ausência": 4, "voluntariamente": 4, "afastou": 3 },
      priority: 2, gender: "MASC"
    },
    HIPOSSUFICIENCIA: {
      terms: { "arcando sozinha": 6, "sozinha": 5, "dificuldade": 4, "genitora": 3, "sustento": 3, "prover": 3, "renda": 2 },
      priority: 3, gender: "FEM"
    },
    NECESSIDADES: {
      terms: { "R$": 7, "gastos": 5, "alimentação": 4, "saúde": 4, "educação": 4, "vestuário": 4, "lazer": 3 },
      priority: 4, gender: "NEUTRAL"
    },
    CAPACIDADE: {
      terms: { "exerce": 5, "atua": 5, "trabalha": 4, "profissão": 4, "mecânico": 4, "autônomo": 4, "rendimentos": 4, "condições": 3 },
      priority: 5, gender: "MASC"
    },
    GUARDA: {
      terms: { "visitas": 6, "convivência": 6, "unilateral": 6, "compartilhada": 6, "regularizar": 5, "guarda": 5 },
      priority: 6, gender: "NEUTRAL"
    }
  };

  const boosters = ["inclusive", "especialmente", "notadamente", "principalmente", "sobretudo"];

  // 5. PROCESSAMENTO COM RASTREIO DE SUJEITO
  const blocos = { VINCULO: [], OMISSAO: [], HIPOSSUFICIENCIA: [], NECESSIDADES: [], CAPACIDADE: [], GUARDA: [] };
  let ultimoSujeito = "NEUTRAL";

  atomosRaw.forEach((atomo, index) => {
    const texto = atomo.toLowerCase();
    if (texto.includes("genitora") || texto.includes("mãe") || texto.includes("ela ")) ultimoSujeito = "FEM";
    if (texto.includes("requerido") || texto.includes("genitor") || texto.includes("ele ")) ultimoSujeito = "MASC";

    const scores = {};
    Object.keys(CLUSTERS).forEach(key => {
      let s = 0;
      Object.keys(CLUSTERS[key].terms).forEach(t => {
        if (texto.includes(t.toLowerCase())) s += CLUSTERS[key].terms[t];
      });
      boosters.forEach(b => { if (texto.includes(b)) s *= 1.2; });
      const vizinhos = (atomosRaw[index - 1] || "") + " " + (atomosRaw[index + 1] || "");
      if (CLUSTERS[key].gender === ultimoSujeito && ultimoSujeito !== "NEUTRAL") s *= 1.5;
      if (key === "CAPACIDADE" && (vizinhos.toLowerCase().includes("requerido") || vizinhos.toLowerCase().includes("genitor"))) s *= 2.0;
      if (key === "HIPOSSUFICIENCIA" && (vizinhos.toLowerCase().includes("genitora") || vizinhos.toLowerCase().includes("mãe"))) s *= 2.0;
      scores[key] = s;
    });

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    let winner = sorted[0][0];
    const scoreA = sorted[0][1];
    const scoreB = sorted[1] ? sorted[1][1] : 0;

    if (scoreA > 0.5) {
      const diffRatio = scoreB > 0 ? (scoreA - scoreB) / scoreA : 1;
      if (diffRatio < 0.15) {
        const pA = CLUSTERS[sorted[0][0]].priority;
        const pB = sorted[1] ? CLUSTERS[sorted[1][0]].priority : 99;
        winner = pA < pB ? sorted[0][0] : sorted[1][0];
      }
      blocos[winner].push(atomo);
    }
  });

  // 6. FALLBACKS DATA-DRIVEN
  if (blocos.CAPACIDADE.length === 0 && piiContext.ocupacaoRequerido) {
    blocos.CAPACIDADE.push(`O requerido exerce a atividade de ${piiContext.ocupacaoRequerido}, o que demonstra possuir plenas condições de contribuir para o sustento dos filhos.`);
  }
  if (blocos.NECESSIDADES.length === 0 && piiContext.valorPensao) {
    blocos.NECESSIDADES.push(`As necessidades habituais dos alimentandos demandam o auxílio financeiro pretendido, no valor de R$ ${piiContext.valorPensao}.`);
  }

  // 7. RECONSTRUÇÃO FINAL (Um parágrafo por cluster com conteúdo)
  const CONNECTORS = {
    OMISSAO: ["Após o rompimento da união,", "Desde a separação das partes,", "Encerrado o convívio marital,"],
    HIPOSSUFICIENCIA: ["Em virtude da ausência de auxílio,", "Diante de tal omissão,", "Nesse cenário de desamparo,"],
    NECESSIDADES: ["Nesse contexto,", "Diante dessa realidade,", "Considerando as despesas correntes,"],
    CAPACIDADE: ["Lado outro, demonstra-se que o genitor,", "Por sua vez, evidencia-se que o requerido,", "Quanto ao requerido, observa-se que"],
    GUARDA: ["No que tange à guarda e convivência,", "Quanto à regularização da guarda,", "Em relação ao regime de visitas,"]
  };

  const hashSeed = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
    return Math.abs(hash);
  };

  const caseId = piiContext.casoId || "default";
  const seed = hashSeed(caseId);
  const ordem = ["VINCULO", "OMISSAO", "HIPOSSUFICIENCIA", "NECESSIDADES", "CAPACIDADE", "GUARDA"];
  
  let paragrafosFinais = [];
  let totalWeightedScore = 0;

  ordem.forEach((key, idx) => {
    let content = blocos[key].join(" ");
    if (content) {
      content = dedupeInterno(content);
      if (idx > 0 && CONNECTORS[key]) {
        const pool = CONNECTORS[key];
        const connector = pool[seed % pool.length];
        if (!content.toLowerCase().startsWith(connector.toLowerCase().substring(0, 5))) {
          content = connector + " " + content.charAt(0).toLowerCase() + content.slice(1);
        }
      }
      content = content.replace(/\s+/g, " ").trim();
      if (!content.endsWith(".")) content += ".";
      paragrafosFinais.push(content);
      blocos[key].forEach(a => {
        Object.values(CLUSTERS[key].terms).forEach(w => totalWeightedScore += w);
      });
    }
  });

  // Qualidade Apex Ultimate
  const qualityScore = (paragrafosFinais.length * 3) + (blocos.NECESSIDADES.length > 0 && clean.includes("R$") ? 5 : 0) + (totalWeightedScore / 50);
  if (qualityScore < 15 && paragrafosFinais.length < 4) {
    logger.warn(`⚠️ [IA] ALERTA DE COLAPSO ESTRUTURAL (Score: ${qualityScore.toFixed(1)}, Paras: ${paragrafosFinais.length}).`);
  }

  return paragrafosFinais.join("\n\n").trim();
};

const dedupeInterno = (p) => {
  const frases = p.split(/(?<=\.)\s+/);
  const usadas = new Set();
  return frases
    .filter((f) => {
      const key = f.toLowerCase().replace(/[^\w\s]/g, "").substring(0, 50);
      if (key.length < 15) return true;
      if (usadas.has(key)) return false;
      usadas.add(key);
      return true;
    })
    .join(" ");
};

// --- FUNÇÕES UTILITÁRIAS DE NORMALIZAÇÃO ---

const formatName = (name) => {
  if (!name || typeof name !== "string") return undefined;
  const exceptions = ["da", "de", "do", "das", "dos", "e", "em"];
  return name.toLowerCase().trim().split(/\s+/).map((word, index) => {
    if (index > 0 && exceptions.includes(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(" ");
};

export const normalizePromptData = (raw = {}) => {
  const requerente = raw.requerente || raw.exequente || raw.assistido || raw.cliente || {
    nome: formatName(raw.nome_assistido || raw.requerente_nome || raw.nome_requerente || raw.exequente_nome),
    cpf: raw.cpf_assistido || raw.requerente_cpf || raw.cpf_requerente || raw.exequente_cpf,
    dataNascimento: raw.requerente_data_nascimento || raw.data_nascimento_assistido || raw.data_nascimento_requerente,
    representante: formatName(raw.representante_requerente || raw.representante || raw.representante_nome),
  };
  const requerido = raw.requerido || raw.executado || {
    nome: formatName(raw.nome_requerido || raw.requerido_nome || raw.executado_nome || raw.nome_executado),
    cpf: raw.cpf_requerido || raw.requerido_cpf || raw.executado_cpf || raw.cpf_executado,
    ocupacao: raw.requerido_ocupacao || raw.ocupacao_requerido,
  };
  const dadosBancarios = raw.dadosBancarios || parseBankData(raw.dados_bancarios_deposito || raw.dados_bancarios || "");
  return {
    comarca: raw.comarca || DEFAULT_COMARCA,
    vara: raw.vara || raw.vara_originaria || DEFAULT_VARA,
    triagemNumero: raw.triagemNumero || raw.triagem_numero || raw.protocolo || DEFAULT_TRIAGEM,
    processoDependencia: raw.processoDependencia || raw.numero_processo_originario || DEFAULT_PROCESSO,
    requerente,
    requerido,
    exequente: raw.exequente || requerente,
    executado: raw.executado || requerido,
    dadosBancarios,
    valorMensalPensao: raw.valorMensalPensao ?? raw.valor_pensao,
    diaPagamentoMensal: raw.diaPagamentoMensal ?? raw.dia_pagamento,
    periodoDevedor: raw.periodoDevedor || raw.periodo_debito_execucao || raw.periodo_debito || raw.periodo_meses_ano,
    valorTotalDebito: raw.valorTotalDebito || raw.valor_debito,
    cidadeDataAssinatura: raw.cidadeDataAssinatura || raw.CIDADEASSINATURA || DEFAULT_CIDADE_ASSINATURA,
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
  const match = (pattern) => { const result = text.match(pattern); return result ? result[1].trim() : undefined; };
  return { raw: text, pix: match(/pix[:]?\s*([^\n|]+)/i), banco: match(/banco[:]?\s*([^\n|]+)/i), agencia: match(/ag[êe]ncia[:]?\s*([\w-]+)/i), conta: match(/conta[:]?\s*([\w-]+)/i) };
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

export const generateDosFatos = async (caseData = {}, acaoKey) => {
  try {
    const normalized = normalizePromptData(caseData);
    const relatoBase = cleanText(normalized.relato, "Relato detalhado não informado.");
    const formatDocumentList = (docs = []) => {
      if (!Array.isArray(docs) || !docs.length) return "Nenhum documento ou prova informado.";
      const filtered = docs.map((doc) => cleanText(doc)).filter((doc) => Boolean(doc));
      return filtered.length ? filtered.map((doc, index) => `${index + 1}. ${doc}`).join("\n") : "Nenhum documento ou prova informado.";
    };
    const documentosList = formatDocumentList(caseData.documentos_informados);
    let outrosFilhos = [];
    try {
      if (caseData.outros_filhos_detalhes) {
        outrosFilhos = typeof caseData.outros_filhos_detalhes === "string" ? JSON.parse(caseData.outros_filhos_detalhes) : caseData.outros_filhos_detalhes;
      }
    } catch (e) { logger.warn("Erro ao fazer parse de outros_filhos_detalhes", e); }
    if (!Array.isArray(outrosFilhos)) outrosFilhos = [];
    const todosAutores = [{ nome: normalized.requerente?.nome, cpf: normalized.requerente?.cpf, nascimento: normalized.requerente?.dataNascimento }];
    outrosFilhos.forEach((f) => { if (f.nome) todosAutores.push({ nome: formatName(f.nome), cpf: f.cpf, nascimento: f.dataNascimento }); });
    const listaAutoresTexto = todosAutores.map((a) => cleanText(a.nome)).join(", ");
    const opcaoGuarda = caseData.opcao_guarda || caseData.opcaoGuarda;
    let intencaoGuardaTexto = "";
    if (opcaoGuarda === "nao") intencaoGuardaTexto = "[FLAG_GUARDA: NÃO] (A assistida declarou que NÃO deseja pedido de guarda neste momento. Foque exclusivamente na fundamentação de Alimentos.)";
    else if (opcaoGuarda === "regularizar") intencaoGuardaTexto = "[FLAG_GUARDA: SIM] (A assistida DESEJA regularizar a guarda e o regime de convivência/visitas.)";
    else intencaoGuardaTexto = "[FLAG_GUARDA: NÃO]";
    const contextFilhosGuarda = cleanText(`${intencaoGuardaTexto} ${caseData.filhos_info || caseData.filhosInfo || caseData.descricao_guarda || ""}`, "");
    let situacaoAssistido = caseData.situacao_financeira_genitora ? `Situação Financeira: ${caseData.situacao_financeira_genitora}` : "Sem detalhes adicionais sobre a situação financeira.";
    let situacaoRequerido = cleanText(caseData.dados_adicionais_requerido, "");
    if (caseData.requerido_tem_emprego_formal) situacaoRequerido += `\nPossui emprego formal? ${caseData.requerido_tem_emprego_formal}.`;
    if (caseData.empregador_requerido_nome) situacaoRequerido += ` Empregador: ${caseData.empregador_requerido_nome}.`;
    if (normalized.requerido.ocupacao) situacaoRequerido += ` Ocupação: ${normalized.requerido.ocupacao}.`;
    if (!situacaoRequerido) situacaoRequerido = "Sem detalhes adicionais sobre o requerido.";
    const valorPensao = cleanText(normalized.valorMensalPensao, "Valor não informado");
    const bensPartilha = cleanText(caseData.bens_partilha);
    const outrosPedidos = [];
    if (bensPartilha) outrosPedidos.push(`Bens a partilhar: ${bensPartilha}`);
    if (caseData.alimentos_para_ex_conjuge) outrosPedidos.push(`Alimentos para ex-cônjuge: ${caseData.alimentos_para_ex_conjuge}`);
    const contextoExtra = outrosPedidos.length ? `\nOutros Pedidos/Detalhes: ${outrosPedidos.join("; ")}` : "";
    const piiMap = {};
    const addToPii = (value, placeholder) => { if (value && value.length > 3 && value !== "Não informado" && value !== "Valor não informado") piiMap[value] = placeholder; };
    addToPii(normalized.requerente?.nome, "[NOME_AUTOR_PRINCIPAL]");
    addToPii(normalized.requerente?.cpf, "[CPF_AUTOR_PRINCIPAL]");
    addToPii(normalized.requerente?.representante, "[NOME_REPRESENTANTE]");
    todosAutores.forEach((autor, index) => { const num = index + 1; addToPii(autor.nome, `[NOME_AUTOR_${num}]`); addToPii(autor.cpf, `[CPF_AUTOR_${num}]`); addToPii(autor.nascimento, `[NASC_AUTOR_${num}]`); });
    addToPii(normalized.requerido?.nome, "[NOME_REU]");
    addToPii(normalized.requerido?.cpf, "[CPF_REU]");
    const configBackend = getConfigAcaoBackend(acaoKey);
    if (configBackend?.promptIA) {
      logger.info(`✅ [IA] Usando prompt específico (DICIONÁRIO) para: ${acaoKey}`);
    } else {
      logger.info(`⚠️ [IA] Usando FALLBACK_LEGADO para ação: ${acaoKey || "não informada"}`);
    }
    
    // --- SYSTEM PROMPT APEX ULTIMATE ---
    const SYSTEM_PROMPT_APEX = `Você é um Defensor Público experiente na Bahia.
Redija EXCLUSIVAMENTE a seção "DOS FATOS". Linguagem: terceira pessoa técnica, juridiquês clássico.

REGRA ESTRUTURAL CRÍTICA:
- Cada parágrafo DEVE estar separado por UMA linha em branco.
- É PROIBIDO escrever tudo em bloco único.
- É PROIBIDO adicionar rótulos ou títulos como "Sobre a guarda".
- Cada parágrafo deve ter uma função lógica única (Vínculo -> Omissão -> Hipossuficiência -> Necessidade -> Capacidade -> Guarda).

PAPÉIS PROCESSUAIS:
- AUTORES = os filhos (alimentandos), representados pela genitora.
- A mãe é a "representante legal" ou "genitora".
- O pai é o "requerido".

PROIBIDO: "menor" — use "criança", "filho(a)" ou "alimentando(a)".`;

    const systemPrompt = configBackend?.promptIA?.systemPrompt || SYSTEM_PROMPT_APEX;
    const temGuarda = (contextFilhosGuarda || "").toLowerCase().includes("guarda") || (contextFilhosGuarda || "").toLowerCase().includes("conviv");
    const temDadosRequerido = situacaoRequerido && !situacaoRequerido.includes("Sem detalhes") && situacaoRequerido.trim().length > 10;
    const blocoReferencia = `DADOS DE REFERÊNCIA:
ALIMENTANDOS: ${listaAutoresTexto}
REPRESENTANTE LEGAL: ${normalized.requerente?.representante || "Não informado"}
REQUERIDO: ${cleanText(normalized.requerido?.nome)}
VALOR: R$ ${valorPensao}
RELATO: """${relatoBase}"""`;

    const paragrafos = [
      `PARÁGRAFO 1 — VÍNCULO: Apresente os alimentandos e o requerido.`,
      `PARÁGRAFO 2 — OMISSÃO: Descreva que o requerido não contribui voluntariamente.`,
      `PARÁGRAFO 3 — HIPOSSUFICIÊNCIA: Demonstre que a genitora não consegue prover sozinha.`,
      `PARÁGRAFO 4 — NECESSIDADES: Liste despesas reais e vincule ao valor de R$ ${valorPensao}.`
    ];

    if (temDadosRequerido) paragrafos.push(`PARÁGRAFO 5 — CAPACIDADE: Demonstre condições de pagar.`);
    if (temGuarda) paragrafos.push(`PARÁGRAFO 6 — GUARDA: Situação atual e pedido de regularização.`);

    const nParas = paragrafos.length;
    const userPrompt = `${blocoReferencia}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAREFA: Redija exatamente ${nParas} parágrafos conforme as instruções acima.
Cada parágrafo DEVE ser separado por uma linha em branco.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${paragrafos.join("\n\n")}`;

    logger.info(`🤖 [IA] Gerando 'Dos Fatos' (${nParas} parágrafos esperados)...`);
    const textoGerado = await generateLegalText(systemPrompt, userPrompt, 0.1, piiMap);
    const textoPosProcessado = await postProcessDosFatos(textoGerado.trim(), nParas, {
      nomeMae: normalized.requerente?.representante,
      nomePai: normalized.requerido?.nome,
      ocupacaoRequerido: normalized.requerido?.ocupacao,
      valorPensao: normalized.valorMensalPensao,
      casoId: normalized.triagemNumero
    });
    return sanitizeLegalAbbreviations(textoPosProcessado);
  } catch (error) {
    logger.error(`❌ Erro ao gerar a seção 'Dos Fatos' com IA: ${error.message}`);
    throw error;
  }
};

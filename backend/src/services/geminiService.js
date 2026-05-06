/* eslint-disable no-unused-vars */
// @ts-nocheck
import { generateLegalText } from "./aiService.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import { getConfigAcaoBackend, ATOMS_CONFIG_FATOS, SYSTEM_PROMPT_ATOMIC } from "../config/dicionarioAcoes.js";

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

// --- PÓS-PROCESSADOR DE SAÍDA DA IA (ATÔMICO) ---

/**
 * Normaliza nomes para papéis processuais em um fragmento de texto.
 */
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
 * Higienização de um parágrafo atômico (Nuker Definitivo - Tolerância ZERO).
 */
const sanitizarAtomo = (texto, piiContext = {}) => {
  if (!texto) return "";
  
  let clean = texto
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/#+\s*/g, "")
    .replace(/\*+/g, "")
    .replace(/Dos Fatos[:-]?\s*/gi, "")
    .replace(/(Sobre|Quanto|No que tange|Em relação|Acerca|Relato|Informação) [aàs]*\s*(guarda|convivência|visitas|pensão|necessidades|capacidade|fatos|detalhes).*?[:-]\s*/gi, "")
    .trim();

  // 1. O NUKER DEFINITIVO: Destrói qualquer sentença que contenha palavras proibidas
  // Lista EXCLUSIVA de 1ª pessoa (não ambígua com 3ª pessoa)
  const forbiddenWords = [
    "eu", "sou", "estou", "tenho", "quero", "desejo", "declaro", "informo", "venho", 
    "meu", "minha", "meus", "minhas", "solicito", "busco", "oponho-me", "sugiro", 
    "pretendo", "necessito", "mantive", "exerço", "proporciono", "encontro-me"
  ];
  
  // Divide preservando os delimitadores para podermos reconstruir
  const chunks = clean.split(/([.!?:\n]+)/);
  let rebuilt = "";
  
  for (let i = 0; i < chunks.length; i += 2) {
    const sentence = chunks[i];
    const delimiter = chunks[i + 1] || "";
    
    // Verifica se a sentença contém alguma palavra proibida (com word boundaries reais)
    const hasForbidden = forbiddenWords.some(word => {
      const regex = new RegExp(`(^|[^a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ])(${word})([^a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]|$)`, "i");
      return regex.test(sentence);
    });

    if (!hasForbidden && sentence.trim().length > 0) {
      rebuilt += sentence + delimiter;
    } else if (hasForbidden) {
      logger.warn(`☢️ [NUKER] Sentença destruída por conter 1ª pessoa: "${sentence.substring(0, 50)}..."`);
    }
  }
  
  clean = rebuilt.trim();

  // 2. Ajustes Finais de Assertividade Jurídica
  const legalFixes = [
    { regex: /\bindica que\b/gi, replacement: "demonstra" },
    { regex: /\bparece que\b/gi, replacement: "evidencia-se que" },
    { regex: /\bmenor(es)?\b(?!\s+(prazo|valor|quantia|montante|de idade))/gi, replacement: "alimentando" },
    { regex: /genitora é alimentanda/gi, replacement: "genitora é a representante legal" },
    { regex: /mãe é autora/gi, replacement: "genitora é a representante legal" },
    { regex: /\bocorre que\b/gi, replacement: "sucede que" }
  ];
  legalFixes.forEach(f => (clean = clean.replace(f.regex, f.replacement)));

  // 3. Limpeza de PII se sobrar
  if (piiContext.nomeMae || piiContext.nomePai) {
    clean = normalizarNomesParaPapeis(clean, piiContext.nomeMae, piiContext.nomePai);
  }

  // Se o NUKER destruiu tudo, retorna vazio para não quebrar a petição
  return clean.length > 10 ? clean.replace(/\s+/g, " ").replace(/\.\./g, ".").trim() : "";
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
  return {
    ...raw,
    requerente,
    requerido,
    relato: raw.relato_texto || raw.relato || raw.relatoBruto || raw.relato_adicional || "",
    valorMensalPensao: raw.valorMensalPensao ?? raw.valor_pensao,
    triagemNumero: raw.triagemNumero || raw.triagem_numero || raw.protocolo || DEFAULT_TRIAGEM,
  };
};

/**
 * Clean and standardize common "Dos Fatos" headings and a set of legal/child-related terms in a text.
 *
 * Removes common "Dos Fatos" headings and normalizes certain abbreviations and references to minors to standardized legal wording.
 * @param {string} text - The input text to sanitize.
 * @returns {string} The sanitized text with headings removed and specified terms normalized. */
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

// --- GERAÇÃO ATÔMICA (APEX 2.0) ---

export const generateDosFatos = async (caseData = {}, acaoKey) => {
  try {
    const normalized = normalizePromptData(caseData);
    const configBackend = getConfigAcaoBackend(acaoKey);
    
    if (!configBackend?.usarPipelineAtomico) {
      logger.warn(`⚠️ [IA] Ação '${acaoKey}' não está configurada para Pipeline Atômico. Usando lógica legada simplificada.`);
      // Fallback legado ou erro pode ser implementado aqui se necessário
    }

    const piiMap = {};
    const addToPii = (value, placeholder) => { if (value && value.length > 3 && value !== "Não informado" && value !== "Valor não informado") piiMap[value] = placeholder; };
    addToPii(normalized.requerente?.nome, "[NOME_AUTOR_PRINCIPAL]");
    addToPii(normalized.requerente?.representante, "[NOME_REPRESENTANTE]");
    addToPii(normalized.requerido?.nome, "[NOME_REU]");

    const atomsToProcess = Object.values(ATOMS_CONFIG_FATOS)
      .filter(atom => {
        // Regra de Guarda: se condicional existir, aplica-a
        if (atom.condicional && !atom.condicional(normalized)) return false;
        
        // Verifica se há dados para o Atom (ex: Ocupação Requerido)
        if (atom.id === "CAPACIDADE" && !normalized.requerido?.ocupacao) return false;
        if (atom.id === "HIPOSSUFICIENCIA" && !normalized.situacao_financeira_genitora) return false;
        
        return true;
      })
      .sort((a, b) => a.ordem - b.ordem);

    logger.info(`🤖 [IA] Iniciando Pipeline Atômico para Caso ${normalized.triagemNumero} (${atomsToProcess.length} parágrafos)...`);

    const piiContext = {
      nomeMae: normalized.requerente?.representante,
      nomePai: normalized.requerido?.nome,
      relatoOriginal: normalized.relato
    };


    // Orquestração Paralela
    const generationTasks = atomsToProcess.map(async (atom) => {
      let prompt = atom.promptBase
        .replace("[NOMES_FILHOS]", normalized.requerente?.nome || "[NOME DO FILHO]")
        .replace("[VALOR_PENSAO]", normalized.valorMensalPensao || "[VALOR]")
        .replace("[SITUACAO_FINANCEIRA_MAE]", normalized.situacao_financeira_genitora || "dificuldades financeiras")
        .replace("[OCUPACAO]", normalized.requerido?.ocupacao || "autônomo");

      // Para evitar repetição e contaminação do relato original,
      // injetamos apenas os dados essenciais para O TEMA ATUAL, não o relato inteiro.
      const userPrompt = `INSTRUÇÕES ESTRITAS DE REDAÇÃO:
- TEMA DO PARÁGRAFO: ${atom.id}
- AÇÃO: ${prompt}

REGRAS DE FORMATAÇÃO:
1. NUNCA transcreva partes do relato original da assistida.
2. Use EXCLUSIVAMENTE a terceira pessoa formal (A genitora, o alimentando, o requerido).
3. Seja direto e objetivo, limite-se estritamente ao tema solicitado.

DADOS BRUTOS DISPONÍVEIS:
"""${normalized.relato}"""`;



      try {
        const text = await generateLegalText(SYSTEM_PROMPT_ATOMIC, userPrompt, 0.1, piiMap);
        return { id: atom.id, text: sanitizarAtomo(text, piiContext), success: true };
      } catch (err) {
        logger.error(`❌ [IA] Falha no Atom ${atom.id}: ${err.message}`);
        // Fallback determinístico para o Atom
        return { id: atom.id, text: "", success: false };
      }
    });

    const results = await Promise.allSettled(generationTasks);
    const paragraphs = results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(v => v && v.text && v.text.length > 10);

    // Conectores Determinísticos
    const CONNECTORS = {
      OMISSAO: "Sucede que, após a interrupção do convívio marital,",
      HIPOSSUFICIENCIA: "Diante da ausência de auxílio voluntário,",
      NECESSIDADES: "Nesse contexto,",
      CAPACIDADE: "Lado outro, evidencia-se que o genitor,",
      GUARDA: "No que tange à guarda e convivência,"
    };


    const finalParagraphs = paragraphs.map(p => {
      let content = p.text;
      const connector = CONNECTORS[p.id];
      
      if (connector) {
        // Se a IA já não começou com o conector (ou similar), adiciona
        if (!content.toLowerCase().startsWith(connector.toLowerCase().substring(0, 10))) {
          content = connector + " " + content.charAt(0).toLowerCase() + content.slice(1);
        }
      }

      if (!content.endsWith(".")) content += ".";
      return content;
    });

    const finalText = finalParagraphs.join("\n\n").trim();
    return sanitizeLegalAbbreviations(finalText);

  } catch (error) {
    logger.error(`❌ Erro no Pipeline Atômico 'Dos Fatos': ${error.message}`);
    throw error;
  }
};


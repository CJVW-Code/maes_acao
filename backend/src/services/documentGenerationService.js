import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import logger from "../utils/logger.js";
import { getConfigAcaoBackend } from "../config/dicionarioAcoes.js";

const resolveTemplatePath = (baseDir, filename) => {
  return path.resolve(baseDir, "..", "..", "templates", filename);
};

export const generateDocx = async (data, acaoKey) => {
  // Resolve o caminho do template relativo a este arquivo (backend/src/services)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Lookup no dicionário — sem adivinhação
  const config = getConfigAcaoBackend(acaoKey);
  const templateFile = config.templateDocx;
  logger.info(`[DOCX] acaoKey="${acaoKey}" → template="${templateFile}"`);

  const templatePath = resolveTemplatePath(__dirname, templateFile);
  const templateContent = await fs.readFile(templatePath, "binary");

  const zip = new PizZip(templateContent);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Substitui os placeholders {nome}, {cpf}, etc., pelos dados do caso
  doc.render(data);

  // Gera o documento final como um buffer
  const buf = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return buf;
};

export const generateTermoDeclaracao = async (data) => {
  // Resolve o caminho do template de termo de declaração
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const config = getConfigAcaoBackend("termo_declaracao");
  const templatePath = resolveTemplatePath(__dirname, config.templateDocx);
  const templateContent = await fs.readFile(templatePath, "binary");

  const zip = new PizZip(templateContent);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // Substitui os placeholders pelos dados do caso
  doc.render(data);

  // Gera o documento final como um buffer
  const buf = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  return buf;
};

// Funções para Geração Múltipla (Penhora e Prisão)
const extractMonthsFromPeriod = (periodo = "") => {
  if (!periodo || typeof periodo !== "string") return 0;
  
  const text = periodo.toLowerCase().trim();
  logger.info(`[Storage] Analisando período para cálculo de meses: "${text}"`);
  
  // 1. Tenta encontrar padrão "X meses"
  const exactMatch = text.match(/(\d+)\s*meses?/);
  if (exactMatch) return parseInt(exactMatch[1], 10);
  
  // 2. Tenta encontrar padrão de anos
  if (text.includes("anos") || text.match(/\d+\s*anos?/)) return 12;

  // 3. Tenta encontrar datas no formato MM/YYYY ou NomeMes/YYYY
  const monthNames = { 
    "jan": 0, "fev": 1, "mar": 2, "abr": 3, "mai": 4, "jun": 5, "jul": 6, "ago": 7, "set": 8, "out": 9, "nov": 10, "dez": 11,
    "janeiro": 0, "fevereiro": 1, "março": 2, "marco": 2, "abril": 3, "maio": 4, "junho": 5, "julho": 6, "agosto": 7, "setembro": 8, "outubro": 9, "novembro": 10, "dezembro": 11 
  };

  // Captura padrões como "01/2024", "janeiro/2024", "jan 2024"
  const datePattern = /([a-z]{3,9}|\d{1,2})[\/\s-]+(\d{4})/g;
  const dateParts = [...text.matchAll(datePattern)];
  
  if (dateParts.length >= 2) {
    const getMonthIndex = (m) => {
      if (/^\d+$/.test(m)) return parseInt(m, 10) - 1;
      const key = m.substring(0, 3).toLowerCase();
      return monthNames[key] !== undefined ? monthNames[key] : 0;
    };
    
    try {
      const first = dateParts[0];
      const last = dateParts[dateParts.length - 1];
      
      const m1 = getMonthIndex(first[1]);
      const y1 = parseInt(first[2], 10);
      const m2 = getMonthIndex(last[1]);
      const y2 = parseInt(last[2], 10);
      
      const d1 = new Date(y1, m1, 1);
      const d2 = new Date(y2, m2, 1);
      
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        const diff = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1;
        logger.info(`[Storage] Meses calculados: ${diff} (de ${d1.toISOString()} até ${d2.toISOString()})`);
        return Math.max(0, diff);
      }
    } catch (e) {
      logger.warn(`[Storage] Erro ao calcular intervalo de datas: ${e.message}`);
    }
  }
  
  // 4. Fallback simples para strings que contém números isolados maiores que 3
  const numbers = text.match(/\d+/g);
  if (numbers && numbers.length === 1 && parseInt(numbers[0], 10) >= 3 && text.includes("mês")) {
     return parseInt(numbers[0], 10);
  }

  return 0;
};

export const generateMultiplosDocx = async (data, acaoKey, periodoInadimplencia) => {
  const config = getConfigAcaoBackend(acaoKey);
  const documentos = [];

  // Sempre gera o template padrão (penhora nesse contexto)
  const penhoraBuffer = await generateDocx(data, acaoKey);
  documentos.push({
    tipo: "penhora",
    buffer: penhoraBuffer,
    filename: `execucao_penhora_${data.protocolo}.docx`,
  });

  // Se tem configuração de múltiplos e atingiu o período, gera o segundo
  if (config.gerarMultiplos && config.templateDocxPrisao) {
    const meses = extractMonthsFromPeriod(periodoInadimplencia);
    if (meses >= 3) {
      // Re-aproveita o payload de data, mas gera com a key secundaria
      // No caso, forçaremos a leitura do dict passando uma key "virtual" ou resolvendo direto
      // Como o config suporta templateDocxPrisao, vamos injetá-lo mockando a key
      const mockKey = `${acaoKey}_prisao`;
      // Mas para generateDocx ler, precisaria ter no dicionario, e NÓS ADICIONAMOS ISSO NO DICIONARIO.
      const prisaoBuffer = await generateDocx(data, mockKey);
      
      documentos.push({
        tipo: "prisao",
        buffer: prisaoBuffer,
        filename: `execucao_prisao_${data.protocolo}.docx`,
      });
    }
  }

  return documentos;
};

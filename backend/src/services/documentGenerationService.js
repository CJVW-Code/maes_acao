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

export const generateDocx = async (data, acaoKey, templateOverride = null) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const config = getConfigAcaoBackend(acaoKey);
  const templateFile = templateOverride || config.templateDocx;
  logger.info(`[DOCX] acaoKey="${acaoKey}" -> template="${templateFile}"`);

  const templatePath = resolveTemplatePath(__dirname, templateFile);
  const templateContent = await fs.readFile(templatePath, "binary");

  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(data);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
};

export const generateTermoDeclaracao = async (data) => {
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

  doc.render(data);

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
};

const extractMonthsFromPeriod = (periodo = "") => {
  if (!periodo) return 0;

  const raw = String(periodo).trim();
  if (!raw) return 0;

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  logger.info(
    `[Storage] Analisando periodo para calculo de meses: "${normalized}"`,
  );

  // Detecta "acima de X meses", "X meses", "mais de X meses"
  const monthsExplicit = normalized.match(/(\d+)\s*mes(?:es)?\b/);
  if (monthsExplicit) {
    const value = Number.parseInt(monthsExplicit[1], 10);
    logger.info(`[Storage] Meses detectados explicitamente: ${value}`);
    return value;
  }

  const yearsExplicit = normalized.match(/(\d+)\s*anos?\b/);
  if (yearsExplicit) {
    return Number.parseInt(yearsExplicit[1], 10) * 12;
  }

  const monthNames = {
    jan: 0,
    janeiro: 0,
    fev: 1,
    fevereiro: 1,
    mar: 2,
    marco: 2,
    abr: 3,
    abril: 3,
    mai: 4,
    maio: 4,
    jun: 5,
    junho: 5,
    jul: 6,
    julho: 6,
    ago: 7,
    agosto: 7,
    set: 8,
    setembro: 8,
    out: 9,
    outubro: 9,
    nov: 10,
    novembro: 10,
    dez: 11,
    dezembro: 11,
  };

  const candidates = [];

  const mmYyyyMatches = [
    ...normalized.matchAll(/\b(0?[1-9]|1[0-2])\s*\/\s*(\d{4})\b/g),
  ];
  mmYyyyMatches.forEach((match) => {
    candidates.push({
      year: Number.parseInt(match[2], 10),
      month: Number.parseInt(match[1], 10) - 1,
      idx: match.index ?? 0,
    });
  });

  const ddMmYyyyMatches = [
    ...normalized.matchAll(
      /\b(0?[1-9]|[12]\d|3[01])\s*\/\s*(0?[1-9]|1[0-2])\s*\/\s*(\d{4})\b/g,
    ),
  ];
  ddMmYyyyMatches.forEach((match) => {
    candidates.push({
      year: Number.parseInt(match[3], 10),
      month: Number.parseInt(match[2], 10) - 1,
      idx: match.index ?? 0,
    });
  });

  const monthNameMatches = [
    ...normalized.matchAll(
      /\b(jan(?:eiro)?|fev(?:ereiro)?|mar(?:co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\b(?:\s+de)?[\s\/-]+(\d{4})\b/g,
    ),
  ];
  monthNameMatches.forEach((match) => {
    const month = monthNames[match[1]] ?? monthNames[match[1].slice(0, 3)];
    if (month === undefined) return;
    candidates.push({
      year: Number.parseInt(match[2], 10),
      month,
      idx: match.index ?? 0,
    });
  });

  if (candidates.length >= 2) {
    candidates.sort((a, b) => a.idx - b.idx);
    const start = candidates[0];
    const end = candidates[candidates.length - 1];
    const diff = (end.year - start.year) * 12 + (end.month - start.month) + 1;
    const total = Math.max(0, diff);
    logger.info(`[Storage] Meses calculados por intervalo: ${total}`);
    return total;
  }

  if (
    candidates.length === 1 &&
    /\bate\b.*\b(hoje|atual|momento)\b/.test(normalized)
  ) {
    const now = new Date();
    const start = candidates[0];
    const diff =
      (now.getFullYear() - start.year) * 12 +
      (now.getMonth() - start.month) +
      1;
    const total = Math.max(0, diff);
    logger.info(`[Storage] Meses calculados ate hoje: ${total}`);
    return total;
  }

  const numbers = normalized.match(/\d+/g);
  if (numbers && numbers.length === 1 && /periodo|inadimpl/.test(normalized)) {
    const value = Number.parseInt(numbers[0], 10);
    if (!Number.isNaN(value)) return value;
  }

  return 0;
};

export const generateMultiplosDocx = async (
  data,
  acaoKey,
  periodoInadimplencia,
) => {
  const config = getConfigAcaoBackend(acaoKey);
  const documentos = [];

  // Sempre gera a Penhora
  const penhoraBuffer = await generateDocx(data, acaoKey);
  documentos.push({
    tipo: "penhora",
    buffer: penhoraBuffer,
    filename: `execucao_penhora_${data.protocolo}.docx`,
  });

  // Gera a Prisão se a configuração indicar documentos múltiplos
  // Estratégia do mutirão: SEMPRE gera ambas as minutas.
  // Se o período for informado e detectarmos < 3 meses, logamos aviso mas ainda geramos
  // para que o defensor possa decidir qual petição efetivamente protocolar.
  if (config.gerarMultiplos && config.templateDocxPrisao) {
    const meses = extractMonthsFromPeriod(periodoInadimplencia);
    logger.info(
      `[DOCX Multi] Meses de inadimplência detectados: ${meses}. Gerando minuta de Prisão para avaliação do defensor.`,
    );
    if (meses > 0 && meses < 3) {
      logger.warn(
        `[DOCX Multi] Inadimplência < 3 meses (${meses}). Gerando mesmo assim — defensor decidirá.`,
      );
    }
    const prisaoBuffer = await generateDocx(
      data,
      acaoKey,
      config.templateDocxPrisao,
    );
    documentos.push({
      tipo: "prisao",
      buffer: prisaoBuffer,
      filename: `execucao_prisao_${data.protocolo}.docx`,
    });
  }

  return documentos;
};

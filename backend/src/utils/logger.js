import winston from "winston";
import dotenv from "dotenv";

dotenv.config();

// Regex para padrões comuns de PII (Brasil)
const CPF_REGEX = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g;
const RG_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dX]\b/gi;

/**
 * Formato customizado para sanitização de PII.
 * Procura por padrões fixos (CPF/RG) e chaves contidas em um piiMap opcional nos metadados.
 */
const piiSanitizer = winston.format((info) => {
  let message = info.message;

  // 1. Sanitização baseada em piiMap (se fornecido nos metadados)
  if (info.piiMap && typeof info.piiMap === "object") {
    const keys = Object.keys(info.piiMap).sort((a, b) => b.length - a.length);
    keys.forEach((key) => {
      if (key.length > 3) {
        const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        message = message.replace(regex, "[REDACTED_PII]");
      }
    });
    // Remove o piiMap dos metadados para não logar o mapeamento real
    delete info.piiMap;
  }

  // 2. Sanitização baseada em padrões fixos (Safety Net)
  info.message = message
    .replace(CPF_REGEX, "[MASCARADO_CPF]")
    .replace(RG_REGEX, "[MASCARADO_RG]");

  return info;
});

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
  piiSanitizer(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

const jsonFormat = winston.format.combine(
  piiSanitizer(),
  winston.format.timestamp(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  levels,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: jsonFormat,
    }),
    new winston.transports.File({
      filename: "logs/all.log",
      format: jsonFormat,
    }),
  ],
});

export default logger;


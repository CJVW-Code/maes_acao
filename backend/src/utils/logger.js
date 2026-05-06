import winston from "winston";
import dotenv from "dotenv";

dotenv.config();

// Regex para padrões comuns de PII (Brasil)
const CPF_REGEX = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g;
const RG_REGEX = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dX]\b/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Função utilitária para sanitização recursiva de objetos
 */
const sanitizeObject = (obj, piiMap = null, seen = new WeakSet()) => {
  if (!obj || typeof obj !== "object") {
    if (typeof obj === "string") {
      let sanitized = obj.replace(CPF_REGEX, "[MASCARADO_CPF]").replace(RG_REGEX, "[MASCARADO_RG]").replace(EMAIL_REGEX, "[MASCARADO_EMAIL]");
      if (piiMap) {
        const keys = Object.keys(piiMap).sort((a, b) => b.length - a.length);
        keys.forEach((key) => {
          if (key.length > 3) {
            const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
            sanitized = sanitized.replace(regex, "[REDACTED_PII]");
          }
        });
      }
      return sanitized;
    }
    return obj;
  }

  if (seen.has(obj)) {
    return "[CIRCULAR]";
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, piiMap, seen));
  }

  const sanitizedObj = {};
  for (const [key, value] of Object.entries(obj)) {
    // Evita loop infinito em referências circulares ou objetos internos do Winston
    if (key === 'level' || key === 'timestamp' || key === 'label' || key === 'splat') {
      sanitizedObj[key] = value;
      continue;
    }
    sanitizedObj[key] = sanitizeObject(value, piiMap, seen);
  }
  return sanitizedObj;
};

/**
 * Formato customizado para sanitização de PII.
 * Procura por padrões fixos (CPF/RG) e chaves contidas em um piiMap opcional nos metadados.
 */
const piiSanitizer = winston.format((info) => {
  const piiMap = info.piiMap;
  const sanitizedInfo = sanitizeObject(info, piiMap);
  
  const result = Object.assign(info, sanitizedInfo);
  delete result.piiMap;
  
  return result;
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


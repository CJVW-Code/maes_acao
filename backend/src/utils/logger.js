import winston from "winston";
import { Logtail } from "@logtail/node";
import { LogtailTransport } from "@logtail/winston";
import dotenv from "dotenv";

dotenv.config();

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
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "debug",
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

// Adiciona o transporte do Better Stack (Logtail) se o token existir no .env
// if (process.env.LOGTAIL_SOURCE_TOKEN) {
//   const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN);
//   logger.add(new LogtailTransport(logtail));
// }

export default logger;

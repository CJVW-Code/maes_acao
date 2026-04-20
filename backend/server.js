import express from "express";
import cors from "cors";
import logger from "./src/utils/logger.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import statusRoutes from "./src/routes/status.js";
import casosRoutes from "./src/routes/casos.js";
import defensoresRoutes from "./src/routes/defensores.js";
import debugRoutes from "./src/routes/debug.js";
import jobsRoutes from "./src/routes/jobs.js";
import unidadesRoutes from "./src/routes/unidades.js";
import scannerRoutes from "./src/routes/scanner.js";
import helmet from "helmet";
import { globalLimiter } from "./src/middleware/rateLimiter.js";


dotenv.config();

// Polyfill: permite JSON.stringify serializar BigInt (retornado pelo Prisma para colunas int8)
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();
const PORT = process.env.PORT || 8000;

// Configurações Globais de Segurança
app.set("trust proxy", 1); // Necessário para rate-limiting atrás de proxies (Vercel/Railway)
app.use(helmet());
app.use(globalLimiter);

// 1. LOG DE DIAGNÓSTICO (O MAIS ALTO POSSÍVEL)

app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(
      `[DEBUG] ${req.method} ${req.url} - Origin: ${req.headers.origin || "N/A"}`,
    );
  }
  next();
});

// 2. CONFIGURAÇÃO DE CORS DETALHADA
const allowedOrigins = [
  "https://maes-acao.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const corsOptions = {
  origin: (origin, callback) => {
    // Permite requisições sem origin (como mobile apps ou curl)
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      process.env.NODE_ENV !== "production"
    ) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked]: Origin ${origin} not allowed`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "X-Requested-With",
    "X-API-Key",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Middleware de diagnóstico para CORS e Pre-flight
app.use((req, res, next) => {
  // Tratamento manual redundante para OPTIONS (garantia extra)
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Servir arquivos locais quando o Supabase não estiver disponível
app.use("/api/files", express.static(path.join(process.cwd(), "uploads")));

// --- A SOLUÇÃO DEFINITIVA ---
// Configuramos o JSON parser globalmente, mas com um "gancho" (verify)
// para salvar o corpo bruto SOMENTE quando a rota for de jobs.
app.use(
  express.json({
    verify: (req, res, buf) => {
      // Se a rota for do QStash, salvamos o buffer bruto numa variável personalizada
      if (req.originalUrl && req.originalUrl.includes("/api/jobs")) {
        req.rawBody = buf.toString();
      }
    },
  }),
);

app.use(express.urlencoded({ extended: true }));

// Rotas
app.use("/api/jobs", jobsRoutes);
app.use("/api/defensores", defensoresRoutes);
app.use("/api/casos", casosRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/debug", debugRoutes);
app.use("/api/unidades", unidadesRoutes);
app.use("/api/scanner", scannerRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Mães em Ação API is running" });
});

// 4. CATCH-ALL PARA TRATAR ERROS 404 E LOGAR
app.use((req, res) => {
  console.error(`[404 NOT FOUND] ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Rota não encontrada no backend",
    path: req.originalUrl,
    method: req.method,
  });
});

// Exporta o app para testes
export default app;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log("🚀 Servidor rodando na porta " + PORT + " em 0.0.0.0");
  });
}

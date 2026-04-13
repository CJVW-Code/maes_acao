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

dotenv.config();

// Polyfill: permite JSON.stringify serializar BigInt (retornado pelo Prisma para colunas int8)
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();
const PORT = process.env.PORT || 8000;

// Configuração Detalhada de CORS
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
  ],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Middleware de diagnóstico para CORS e Pre-flight
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin || "N/A"}`,
    );
  }

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
  res.json({ status: "OK", message: "Def. Sul Bahia API is running" });
});

// Exporta o app para testes
export default app;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log("🚀 Servidor rodando na porta " + PORT);
  });
}

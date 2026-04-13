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

// 1. LOG DE DIAGNÓSTICO (O MAIS ALTO POSSÍVEL)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[DEBUG] ${req.method} ${req.url} - Origin: ${req.headers.origin || 'N/A'}`);
  }
  next();
});

// 2. CONFIGURAÇÃO DE CORS PERMISSIVA (PARA DEPURAR)
app.use(cors({
  origin: true, // Reflete a origem da requisição (equivale a permitir todas)
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"]
}));

// Responder imediatamente a qualquer pre-flight OPTIONS em qualquer rota
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(204);
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

// 4. CATCH-ALL PARA TRATAR ERROS 404 E LOGAR
app.use((req, res) => {
  console.error(`[404 NOT FOUND] ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: "Rota não encontrada no backend",
    path: req.originalUrl,
    method: req.method
  });
});

// Exporta o app para testes
export default app;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log("🚀 Servidor rodando na porta " + PORT);
  });
}

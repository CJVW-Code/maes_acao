import express from "express";
import cors from "cors";
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

app.use(cors());

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

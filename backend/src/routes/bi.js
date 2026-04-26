import express from "express";
import { gerarRelatorio, exportarXlsx, exportarXlsxLote } from "../controllers/biController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

const canAccessBi = (user) => ["admin", "gestor", "coordenador"].includes(user?.cargo?.toLowerCase());
const canExportBiLote = (user) => ["admin", "gestor"].includes(user?.cargo?.toLowerCase());

const requireBiAccess = (req, res, next) => {
  if (!canAccessBi(req.user)) {
    return res.status(403).json({ error: "Acesso negado ao módulo de BI." });
  }
  next();
};

const requireBatchExport = (req, res, next) => {
  if (!canExportBiLote(req.user)) {
    return res.status(403).json({ error: "Exportacao em lote restrita a administradores." });
  }
  next();
};

router.use(authMiddleware);
router.use(requireBiAccess);

router.post("/gerar", gerarRelatorio);
router.post("/export-xlsx", exportarXlsx);
router.post("/export-xlsx-lote", requireBatchExport, exportarXlsxLote);

export default router;

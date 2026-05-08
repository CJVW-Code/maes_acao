// Arquivo: backend/src/routes/defensores.js
import express from "express";
import {
  registrarDefensor,
  loginDefensor,
  listarDefensores,
  atualizarDefensor,
  deletarDefensor,
  resetarSenhaDefensor,
  listarColegas,
  listarDefensoresParaEncaminhamento,
} from "../controllers/defensoresController.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireWriteAccess } from "../middleware/requireWriteAccess.js";

const router = express.Router();

// Rota Pública
router.post("/login", loginDefensor);

// Rotas Protegidas (Requerem Token e Permissões)
router.post("/register", authMiddleware, registrarDefensor);
router.get("/", authMiddleware, listarDefensores);
router.put("/:id", authMiddleware, atualizarDefensor);
router.delete("/:id", authMiddleware, deletarDefensor);
router.get("/colegas", authMiddleware, listarColegas);
router.get(
  "/encaminhamento",
  authMiddleware,
  requireWriteAccess,
  listarDefensoresParaEncaminhamento
);
router.post("/:id/reset-password", authMiddleware, resetarSenhaDefensor);

export default router;

// Arquivo: backend/src/routes/defensores.js
import express from "express";
import {
  registrarDefensor,
  loginDefensor,
  listarDefensores,
  atualizarDefensor,
  deletarDefensor,
  resetarSenhaDefensor,
} from "../controllers/defensoresController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Rota Pública
router.post("/login", loginDefensor);

// Rotas Protegidas (Requerem Token e Permissões)
router.post("/register", authMiddleware, registrarDefensor);
router.get("/", authMiddleware, listarDefensores);
router.put("/:id", authMiddleware, atualizarDefensor);
router.delete("/:id", authMiddleware, deletarDefensor);
router.post("/:id/reset-password", authMiddleware, resetarSenhaDefensor);

export default router;

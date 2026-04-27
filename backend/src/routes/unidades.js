import express from "express";
import {
  listarUnidades,
  criarUnidade,
  atualizarUnidade,
  deletarUnidade,
} from "../controllers/unidadesController.js";
import { authMiddleware } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/auditMiddleware.js";

const router = express.Router();

// Listar unidades — acessível publicamente para popular selects na triagem
router.get("/", listarUnidades);

// Todas as demais rotas de unidades exigem autenticação
router.use(authMiddleware);
router.use(auditMiddleware);

// Criar, Editar e Deletar — verificação de admin é feita no controller
router.post("/", criarUnidade);
router.put("/:id", atualizarUnidade);
router.delete("/:id", deletarUnidade);

export default router;

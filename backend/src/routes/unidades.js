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

// Todas as rotas de unidades exigem autenticação
router.use(authMiddleware);
router.use(auditMiddleware);

// Listar unidades — acessível a qualquer usuário logado (para popular selects)
router.get("/", listarUnidades);

// Criar, Editar e Deletar — verificação de admin é feita no controller
router.post("/", criarUnidade);
router.put("/:id", atualizarUnidade);
router.delete("/:id", deletarUnidade);

export default router;

// Arquivo: backend/src/routes/status.js

import express from "express";
import { consultarStatus, consultarPorCpf } from "../controllers/statusController.js";

const router = express.Router();

// Define a rota GET que chama a função do controller
router.get("/", consultarStatus);

// Nova rota para consulta por CPF
router.get("/cpf/:cpf", consultarPorCpf);

export default router;

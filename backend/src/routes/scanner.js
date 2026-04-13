import express from "express";
import { scannerUpload } from "../controllers/scannerController.js";
import { upload } from "../middleware/upload.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Aplica autenticação opcional ou específica para o scanner se necessário
// Por enquanto, exigimos autenticação básica de defensor/servidor
router.use(authMiddleware);

router.post("/upload", upload.array("documentos", 20), scannerUpload);

export default router;

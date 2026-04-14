import express from "express";
import { scannerUpload } from "../controllers/scannerController.js";
import { upload } from "../middleware/upload.js";
import { apiKeyMiddleware } from "../middleware/apiKeyMiddleware.js";

const router = express.Router();

// Aplica autenticação via header X-API-Key (Regra de Negócio: Balcão/Scanner usa API Key)
router.use(apiKeyMiddleware);

router.post("/upload", upload.array("documentos", 20), scannerUpload);

export default router;

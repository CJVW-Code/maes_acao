import express from "express";
import { getAllConfig, updateConfig } from "../controllers/configController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

/**
 * Middleware para restringir acesso apenas a Admin e Gestor.
 */
const requireAdminOrGestor = (req, res, next) => {
  const cargo = req.user.cargo.toLowerCase();
  if (!["admin", "gestor"].includes(cargo)) {
    return res.status(403).json({ 
      error: "Acesso negado", 
      message: "Apenas administradores e gestores podem acessar as configurações do sistema." 
    });
  }
  next();
};

router.use(authMiddleware);
router.use(requireAdminOrGestor);

router.get("/", getAllConfig);
router.put("/", updateConfig);

export default router;

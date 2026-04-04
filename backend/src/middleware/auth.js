// Arquivo: backend/src/middleware/auth.js

import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const authMiddleware = (req, res, next) => {
  // 1. Pega o cabeçalho de autorização
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Acesso negado. Nenhum token fornecido." });
  }

  // 2. Extrai o token (remove o "Bearer ")
  const token = authHeader.split(" ")[1];

  try {
    // 3. Verifica se o token é válido usando o segredo
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Padronizado para req.user para funcionar com os controllers
    next(); // Se o token for válido, permite que a requisição continue
  } catch (error) {
    res.status(401).json({ error: "Token inválido." });
  }
};

import { prisma } from "../config/prisma.js";
import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";

export const authMiddleware = async (req, res, next) => {
  // 1. Pega o cabeçalho de autorização
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Acesso negado. Nenhum token fornecido." });
  }

  // 2. Extrai o token
  const token = authHeader.split(" ")[1];

  try {
    // 3. Validação EXCLUSIVA com JWT Local (Não usamos Supabase Auth)
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"], // Trava de segurança contra tokens RS256 antigos do Supabase
    });

    // 4. Busca o perfil atualizado do defensor no banco local
    const profile = await prisma.defensores.findUnique({
      where: { id: decoded.id },
      include: { cargo: true, unidade: true },
    });

    if (!profile || !profile.ativo) {
      return res
        .status(403)
        .json({ error: "Usuário não autorizado ou inativo no sistema." });
    }

    // 5. Injeta no req.user o formato esperado pelos controllers
    req.user = {
      id: profile.id,
      nome: profile.nome,
      email: profile.email,
      cargo: profile.cargo?.nome || "operador",
      unidade_id: profile.unidade_id,
      unidade_nome: profile.unidade?.nome,
    };

    next();
  } catch (error) {
    if (error.message !== "invalid algorithm") {
      logger.error(`[Auth Middleware Error]: ${error.message}`);
    }
    res.status(401).json({
      error: "Sessão expirada ou inválida.",
      code: "INVALID_TOKEN",
      message: "Por favor, saia e entre novamente no sistema.",
    });
  }
};

import { prisma } from "../config/prisma.js";
import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";

export const authMiddleware = async (req, res, next) => {
  // 1. Pega o token do cabeçalho ou da query string (para downloads diretos)
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ error: "Acesso negado. Nenhum token fornecido." });
  }

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

export const validateDownloadTicket = async (req, res, next) => {
  const { ticket } = req.query;

  if (!ticket) {
    return res.status(401).json({ error: "Ticket de download não fornecido." });
  }

  try {
    const decoded = jwt.verify(ticket, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });

    if (decoded.purpose !== "download") {
      return res.status(403).json({ error: "Ticket inválido para esta operação." });
    }

    // Reconstrói req.user a partir dos dados do payload
    req.user = {
      id: decoded.user.id,
      nome: decoded.user.nome,
      email: decoded.user.email,
      cargo: decoded.user.cargo,
      unidade_id: decoded.user.unidade_id,
    };

    // Expõe metadados do ticket para uso pelos controllers de download
    // (path e bucket assinados — usados por baixarDocumentoIndividual para prevenir path tampering)
    req.ticket = {
      path: decoded.path || null,
      bucket: decoded.bucket || null,
      casoId: decoded.casoId || null,
      casoUnidadeId: decoded.casoUnidadeId || null,
    };

    next();
  } catch (error) {
    logger.error(`[Download Ticket Error]: ${error.message}`);
    return res.status(401).json({ error: "Ticket expirado ou inválido." });
  }
};

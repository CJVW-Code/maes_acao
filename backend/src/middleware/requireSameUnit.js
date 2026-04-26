import { prisma } from "../config/prisma.js";
import logger from "../utils/logger.js";

/**
 * Middleware para garantir que o usuário só acesse casos da sua própria unidade.
 * Admins possuem bypass total.
 */
export const requireSameUnit = async (req, res, next) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: "Usuário não autenticado." });
  }

  const userCargo = user.cargo?.toLowerCase();

  // 1. Admin e Gestor têm acesso a tudo
  if (userCargo === "admin" || userCargo === "gestor") {
    return next();
  }

  // 2. Validação básica do ID para evitar crash no BigInt
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: "ID de caso inválido." });
  }

  try {
    // 3. Busca apenas o necessário para validar a unidade
    const caso = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      select: { 
        id: true, 
        unidade_id: true,
        status: true
      },
    });

    if (!caso) {
      return res.status(404).json({ error: "Caso não encontrado." });
    }

    // 4. Verifica pertencimento de unidade
    if (caso.unidade_id !== user.unidade_id) {
      logger.warn(`[Acesso Negado]: Usuário ${user.id} (${userCargo}) tentou acessar caso ${id} de outra unidade.`);
      return res.status(403).json({ 
        error: "Acesso negado. Este caso pertence a outra unidade." 
      });
    }

    // 5. Injeta o caso para reutilização no controller (evita query duplicada)
    req.caso = caso;
    next();
  } catch (error) {
    logger.error(`[requireSameUnit Error]: ${error.message}`);
    res.status(500).json({ error: "Erro ao verificar unidade do caso." });
  }
};

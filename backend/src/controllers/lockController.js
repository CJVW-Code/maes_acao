import { prisma } from "../config/prisma.js";
import logger from "../utils/logger.js";

/**
 * Realiza o bloqueio manual de um caso para o usuário logado.
 * Nível 1: Servidor | Nível 2: Defensor
 * Regra: O bloqueio é PERMANENTE até que um Administrador libere.
 */
export const lockCaso = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const cargo = req.user.cargo.toLowerCase();

  try {
    const isAdmin = cargo === 'admin';
    const _isDefensorOrCoordenador = cargo.includes("defensor") || cargo === "coordenador";
    const isServidorOrEstagiario = cargo === "servidor" || cargo === "estagiario";

    // Busca o caso para saber o status e decidir o nível de lock
    const casoAtual = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      select: { status: true, defensor_id: true, servidor_id: true, defensor: true, servidor: true }
    });

    if (!casoAtual) return res.status(404).json({ error: "Caso não encontrado." });

    let nivelLock = 1;
    if (["liberado_para_protocolo", "em_protocolo"].includes(casoAtual.status)) {
      nivelLock = 2;
    }

    if (nivelLock === 2 && isServidorOrEstagiario) {
      return res.status(403).json({ error: "Acesso negado. Seu cargo não permite atuar nesta etapa do caso." });
    }

    const updateData = {};
    const whereClause = { id: BigInt(id) };

    if (nivelLock === 2) {
      updateData.defensor_id = userId;
      updateData.defensor_at = new Date();
      if (!isAdmin) {
        whereClause.OR = [
          { defensor_id: null },
          { defensor_id: userId }
        ];
      }
    } else {
      updateData.servidor_id = userId;
      updateData.servidor_at = new Date();
      if (!isAdmin) {
        whereClause.OR = [
          { servidor_id: null },
          { servidor_id: userId }
        ];
      }
    }

    const { count } = await prisma.casos.updateMany({
      where: whereClause,
      data: updateData,
    });

    if (count === 0) {
      const holderName = nivelLock === 2
        ? casoAtual.defensor?.nome
        : casoAtual.servidor?.nome;
      
      const holderId = nivelLock === 2 
        ? casoAtual.defensor_id 
        : casoAtual.servidor_id;

      logger.warn(`[Lock Contention] Usuário ${userId} tentou travar caso ${id} (Nível ${nivelLock}), mas já está travado por ID ${holderId || "desconhecido"}`);

      return res.status(423).json({
        error: "Caso bloqueado",
        message: `Este caso já está vinculado ao profissional ${holderName || "outro colega"}. Apenas o Administrador pode liberar este caso.`,
        holder: holderName || "outro colega",
      });
    }

    logger.info(`[Lock Success] Usuário ${userId} travou caso ${id} (Nível ${nivelLock})`);

    const casoAtualizado = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
    });

    res.status(200).json({ message: "Caso bloqueado com sucesso.", caso: casoAtualizado });
  } catch (error) {
    logger.error(`Erro ao travar caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao realizar bloqueio." });
  }
};

/**
 * Libera o bloqueio do caso.
 * REGRA: APENAS ADMINISTRADORES podem destravar/liberar um caso.
 */
export const unlockCaso = async (req, res) => {
  const { id } = req.params;
  const userCargo = req.user.cargo.toLowerCase();
  const isAdminOrGestor = ["admin", "gestor"].includes(userCargo);
  const isCoordenador = userCargo === "coordenador";

  if (!isAdminOrGestor && !isCoordenador) {
    return res.status(403).json({ 
      error: "Acesso negado", 
      message: "Apenas administradores, gestores ou coordenadores podem liberar casos bloqueados." 
    });
  }

  try {
    const caso = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, status: true }
    });

    if (!caso) return res.status(404).json({ error: "Caso não encontrado." });

    // Regras específicas para Coordenador
    if (isCoordenador) {
      const statusBloqueados = ["protocolado", "processando_ia"];
      if (statusBloqueados.includes(caso.status)) {
        return res.status(409).json({
          error: "Conflito de Operação",
          message: `Coordenadores não podem destravar casos com status '${caso.status}'.`
        });
      }
    }

    await prisma.casos.update({
      where: { id: BigInt(id) },
      data: {
        defensor_id: null,
        defensor_at: null,
        servidor_id: null,
        servidor_at: null
      }
    });

    logger.info(`[Lock Released] Usuário ${req.user.id} (${userCargo}) liberou o caso ${id}`);

    res.status(200).json({ message: `Caso liberado com sucesso pelo ${userCargo}.` });
  } catch (error) {
    logger.error(`Erro ao destravar caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao realizar liberação." });
  }
};


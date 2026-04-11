import { prisma } from "../config/prisma.js";
import logger from "../utils/logger.js";

/**
 * Realiza o bloqueio manual de um caso para o usuário logado.
 * Nível 1: Servidor | Nível 2: Defensor
 */
export const lockCaso = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const cargo = req.user.cargo.toLowerCase();

  try {
    const caso = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      include: { defensor: true, servidor: true }
    });

    if (!caso) return res.status(404).json({ error: "Caso não encontrado." });

    // Verifica se já está bloqueado por outro
    const isLockedByOther = (caso.defensor_id && caso.defensor_id !== userId) || 
                            (caso.servidor_id && caso.servidor_id !== userId);
    
    if (isLockedByOther && req.user.cargo.toLowerCase() !== 'admin') {
      const holder = caso.defensor?.nome || caso.servidor?.nome || "outro usuário";
      return res.status(423).json({ 
        error: "Caso bloqueado", 
        message: `Este caso já está sendo atendido por ${holder}.`,
        holder
      });
    }

    const updateData = {};
    if (cargo.includes("defensor")) {
      updateData.defensor_id = userId;
      updateData.defensor_at = new Date();
    } else {
      updateData.servidor_id = userId;
      updateData.servidor_at = new Date();
    }

    const casoAtualizado = await prisma.casos.update({
      where: { id: BigInt(id) },
      data: updateData
    });

    res.status(200).json({ message: "Caso bloqueado com sucesso.", caso: casoAtualizado });
  } catch (error) {
    logger.error(`Erro ao travar caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao realizar bloqueio." });
  }
};

/**
 * Libera o bloqueio do caso.
 * Apenas o dono do lock ou admin podem liberar.
 */
export const unlockCaso = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.cargo.toLowerCase() === 'admin';

  try {
    const caso = await prisma.casos.findUnique({
      where: { id: BigInt(id) }
    });

    if (!caso) return res.status(404).json({ error: "Caso não encontrado." });

    const canUnlock = isAdmin || caso.defensor_id === userId || caso.servidor_id === userId;

    if (!canUnlock) {
      return res.status(403).json({ error: "Você não tem permissão para liberar este caso." });
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

    res.status(200).json({ message: "Caso liberado com sucesso." });
  } catch (error) {
    logger.error(`Erro ao destravar caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao realizar liberação." });
  }
};

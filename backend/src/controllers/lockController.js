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
    const isAdmin = cargo === 'admin';
    const isDefensor = cargo.includes("defensor");
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const updateData = {};
    const whereClause = { id: BigInt(id) };

    if (isDefensor) {
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
          { servidor_id: userId },
          { servidor_at: { lt: thirtyMinutesAgo } },
        ];
      }
    }

    // Tenta executar o update atômico e condicional
    const { count } = await prisma.casos.updateMany({
      where: whereClause,
      data: updateData,
    });

    if (count === 0) {
      // Falha atômica: ou não existe ou outro usuário pegou a trava primeiro
      const casoCheck = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        include: { defensor: true, servidor: true },
      });

      if (!casoCheck) return res.status(404).json({ error: "Caso não encontrado." });

      const holder = isDefensor
        ? casoCheck.defensor?.nome
        : casoCheck.servidor?.nome;

      return res.status(423).json({
        error: "Caso bloqueado",
        message: `Este caso já está em uso por ${holder || "outro colega"}.`,
        holder: holder || "outro colega",
      });
    }

    // Como usamos updateMany, recuperamos o caso com relacionamentos para retornar os dados completos
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

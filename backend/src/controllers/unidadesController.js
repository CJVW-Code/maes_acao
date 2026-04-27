import { prisma } from "../config/prisma.js";
import logger from "../utils/logger.js";

// --- LISTAR TODAS AS UNIDADES ---
export const listarUnidades = async (req, res) => {
  try {
    const unidades = await prisma.unidades.findMany({
      orderBy: { nome: "asc" },
      include: {
        _count: {
          select: {
            defensores: true,
            casos: true,
          },
        },
      },
    });

    const data = unidades.map((u) => ({
      id: u.id,
      nome: u.nome,
      comarca: u.comarca,
      regional: u.regional,
      sistema: u.sistema,
      ativo: u.ativo,
      created_at: u.created_at,
      total_membros: u._count.defensores,
      total_casos: u._count.casos,
    }));

    res.json(data);
  } catch (err) {
    logger.error(`Erro ao listar unidades: ${err.message}`);
    res.status(500).json({ error: "Erro ao buscar unidades." });
  }
};

// --- CRIAR NOVA UNIDADE ---
export const criarUnidade = async (req, res) => {
  try {
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const { nome, comarca, sistema, regional } = req.body;

    if (!nome || !comarca) {
      return res.status(400).json({ error: "Nome e comarca são obrigatórios." });
    }

    const novaUnidade = await prisma.unidades.create({
      data: {
        nome,
        comarca,
        sistema: sistema || "solar",
        regional: regional || null,
        ativo: true,
      },
    });

    logger.info(`Unidade criada: ${novaUnidade.nome} (${novaUnidade.comarca})`);
    res.status(201).json(novaUnidade);
  } catch (err) {
    logger.error(`Erro ao criar unidade: ${err.message}`);
    res.status(500).json({ error: "Erro ao criar unidade." });
  }
};

// --- ATUALIZAR UNIDADE ---
export const atualizarUnidade = async (req, res) => {
  try {
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const { id } = req.params;
    const { nome, comarca, sistema, ativo, regional } = req.body;

    const unidade = await prisma.unidades.update({
      where: { id },
      data: {
        ...(nome !== undefined && { nome }),
        ...(comarca !== undefined && { comarca }),
        ...(sistema !== undefined && { sistema }),
        ...(ativo !== undefined && { ativo }),
        ...(regional !== undefined && { regional }),
      },
    });

    logger.info(`Unidade atualizada: ${unidade.nome}`);
    res.json(unidade);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Unidade não encontrada." });
    }
    logger.error(`Erro ao atualizar unidade: ${err.message}`);
    res.status(500).json({ error: "Erro ao atualizar unidade." });
  }
};

// --- DELETAR UNIDADE ---
export const deletarUnidade = async (req, res) => {
  try {
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const { id } = req.params;

    // Verifica se há membros ou casos vinculados
    const unidade = await prisma.unidades.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            defensores: true,
            casos: true,
          },
        },
      },
    });

    if (!unidade) {
      return res.status(404).json({ error: "Unidade não encontrada." });
    }

    if (unidade._count.defensores > 0) {
      return res.status(400).json({
        error: `Não é possível excluir. Há ${unidade._count.defensores} membro(s) vinculado(s) a esta unidade. Mova-os para outra unidade primeiro.`,
      });
    }

    if (unidade._count.casos > 0) {
      return res.status(400).json({
        error: `Não é possível excluir. Há ${unidade._count.casos} caso(s) vinculado(s) a esta unidade.`,
      });
    }

    await prisma.unidades.delete({ where: { id } });

    logger.info(`Unidade deletada: ${unidade.nome}`);
    res.json({ message: "Unidade removida com sucesso." });
  } catch (err) {
    logger.error(`Erro ao deletar unidade: ${err.message}`);
    res.status(500).json({ error: "Erro ao deletar unidade." });
  }
};

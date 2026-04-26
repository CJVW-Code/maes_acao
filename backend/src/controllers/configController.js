import { prisma } from "../config/prisma.js";
import { invalidarCache } from "../utils/configCache.js";

/**
 * Retorna todas as configurações do sistema.
 */
export const getAllConfig = async (req, res) => {
  try {
    const configs = await prisma.configuracoes_sistema.findMany({
      orderBy: { chave: 'asc' }
    });
    return res.json(configs);
  } catch (error) {
    console.error("Erro ao buscar configurações:", error);
    return res.status(500).json({ error: "Erro interno ao buscar configurações." });
  }
};

/**
 * Atualiza ou cria configurações (aceita um objeto de chave:valor ou chave individual).
 */
export const updateConfig = async (req, res) => {
  const { chave, valor, descricao, configs } = req.body;

  try {
    // Se recebeu um objeto 'configs', processa em lote
    if (configs && typeof configs === 'object') {
      const entries = Object.entries(configs);
      const updates = entries.map(([k, v]) => 
        prisma.configuracoes_sistema.upsert({
          where: { chave: k },
          update: { valor: String(v) },
          create: { chave: k, valor: String(v) }
        })
      );
      await Promise.all(updates);
    } else {
      // Formato individual original
      if (!chave || valor === undefined) {
        return res.status(400).json({ error: "Chave e valor são obrigatórios (ou objeto 'configs')." });
      }

      await prisma.configuracoes_sistema.upsert({
        where: { chave },
        update: { 
          valor: String(valor),
          ...(descricao && { descricao })
        },
        create: { 
          chave, 
          valor: String(valor), 
          descricao 
        }
      });
    }

    // Invalida o cache imediatamente após a alteração
    invalidarCache();

    return res.json({ message: "Configurações atualizadas com sucesso." });
  } catch (error) {
    console.error("Erro ao atualizar configuração:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar configuração." });
  }
};

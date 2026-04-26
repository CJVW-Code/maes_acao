import { supabase } from "../config/supabase.js";
import logger from "../utils/logger.js";

/**
 * Middleware para garantir que o usuário só acesse casos da sua própria unidade.
 * Admins e Gestores possuem bypass total.
 * Colaboradores com assistência aceita também possuem acesso.
 */
export const requireSameUnit = async (req, res, next) => {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: "Usuário não autenticado." });
  }

  const userCargo = user.cargo?.toLowerCase();

  // 1. Admin e Gestor têm acesso global
  if (userCargo === "admin" || userCargo === "gestor") {
    return next();
  }

  // 2. Validação básica do ID
  if (!id || !/^\d+$/.test(id)) {
    return res.status(400).json({ error: "ID de caso inválido." });
  }

  try {
    // 3. Busca minimalista via Supabase (Core de Casos)
    // Selecionamos unidade_id e a relação de assistência para validar acesso
    const { data: caso, error: fetchError } = await supabase
      .from("casos")
      .select(`
        id, 
        unidade_id, 
        status,
        assistencia_casos!assistencia_casos_caso_id_fkey (
          destinatario_id,
          status
        )
      `)
      .eq("id", id)
      .single();

    if (fetchError || !caso) {
      if (fetchError?.code === "PGRST116") {
        return res.status(404).json({ error: "Caso não encontrado." });
      }
      throw fetchError || new Error("Falha ao buscar caso");
    }

    // 4. Verifica pertencimento de unidade
    const isSameUnit = caso.unidade_id === user.unidade_id;

    // 5. Verifica se é um colaborador aceito (Assistência Compartilhada)
    const isCollaborator = (caso.assistencia_casos || []).some(
      (a) => a.destinatario_id === user.id && a.status === "aceito"
    );

    if (!isSameUnit && !isCollaborator) {
      logger.warn(`[Acesso Negado]: Usuário ${user.id} (${userCargo}) tentou acessar caso ${id} de outra unidade.`);
      return res.status(403).json({ 
        error: "Acesso negado. Este caso pertence a outra unidade e você não é um colaborador ativo." 
      });
    }

    // Injeta o caso simplificado para uso posterior se necessário
    req.casoBasic = caso;
    next();
  } catch (error) {
    logger.error(`[requireSameUnit Error]: ${error.message}`);
    res.status(500).json({ error: "Erro ao verificar permissão de acesso ao caso." });
  }
};

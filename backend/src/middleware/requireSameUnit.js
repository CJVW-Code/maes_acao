import { supabase } from "../config/supabase.js";
import { prisma } from "../config/prisma.js";
import logger from "../utils/logger.js";

const isSupabaseConfigured = !!process.env.SUPABASE_URL;

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
    // 3. Busca minimalista via Supabase ou Prisma (Core de Casos)
    let caso;
    
    if (isSupabaseConfigured) {
      const { data: fetchCaso, error: fetchError } = await supabase
        .from("casos")
        .select(`
          id, 
          unidade_id, 
          status,
          unidades ( regional ),
          assistencia_casos (
            destinatario_id,
            status
          )
        `)
        .eq("id", id)
        .single();
      
      if (fetchError && fetchError.code !== "PGRST116") throw fetchError;
      caso = fetchCaso;
    } else {
      caso = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        include: {
          unidade: { select: { regional: true } },
          assistencia_casos: { select: { destinatario_id: true, status: true } }
        }
      });
    }

    if (!caso) {
      return res.status(404).json({ error: "Caso não encontrado." });
    }

    // 4. Verifica pertencimento de unidade
    const isSameUnit = caso.unidade_id === user.unidade_id;

    // 5. Verifica Regional (Para Coordenadores)
    let isSameRegional = false;
    if (userCargo === "coordenador" && user.unidade_id) {
      let userUnidade;
      
      if (isSupabaseConfigured) {
        const { data: fetchUnidade, error: fetchUnidadeError } = await supabase
          .from("unidades")
          .select("regional")
          .eq("id", user.unidade_id)
          .single();
        
        if (fetchUnidadeError) throw fetchUnidadeError;
        userUnidade = fetchUnidade;
      } else {
        userUnidade = await prisma.unidades.findUnique({
          where: { id: user.unidade_id },
          select: { regional: true }
        });
      }
      
      const casoRegional = caso.unidades?.regional || caso.unidade?.regional;
      if (userUnidade?.regional && casoRegional && userUnidade.regional === casoRegional) {
        isSameRegional = true;
      }
    }

    // 6. Verifica se é um colaborador aceito (Assistência Compartilhada)
    const isCollaborator = (caso.assistencia_casos || []).some(
      (a) => a.destinatario_id === user.id && a.status === "aceito"
    );

    if (!isSameUnit && !isCollaborator && !isSameRegional) {
      logger.warn(`[Acesso Negado]: Usuário ${user.id} (${userCargo}) tentou acessar caso ${id} de outra unidade/regional.`);
      return res.status(403).json({ 
        error: "Acesso negado. Este caso pertence a outra unidade e você não tem permissão regional." 
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

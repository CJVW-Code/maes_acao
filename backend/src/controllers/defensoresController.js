/* eslint-disable no-unused-vars */
import { prisma } from "../config/prisma.js";
import { hashPassword, verifyPassword } from "../services/securityService.js";
import { generateToken } from "../config/jwt.js";
import logger from "../utils/logger.js";
import {  isSupabaseConfigured } from "../config/supabase.js";

// --- FUNÇÃO DE CADASTRO (Atualizada com Cargo) ---
export const registrarDefensor = async (req, res) => {
  try {
    const userCargo = req.user?.cargo?.toLowerCase();
    const ALLOWED_MANAGERS = ["admin", "gestor", "coordenador"];

    if (!req.user || !ALLOWED_MANAGERS.includes(userCargo)) {
      return res.status(403).json({
        error: "Acesso negado. Apenas administradores, gestores e coordenadores podem cadastrar novos membros.",
      });
    }

    const { nome, email, senha, cargo = "servidor", unidade_id } = req.body;

    // Se for coordenador, valida se a unidade alvo pertence à sua regional
    if (userCargo === "coordenador") {
      if (!req.user.unidade_id) {
        return res.status(403).json({ error: "Sua conta de Coordenador não possui uma unidade vinculada." });
      }

      const userUnidade = await prisma.unidades.findUnique({
        where: { id: req.user.unidade_id },
        select: { regional: true }
      }).catch(() => null);

      if (!userUnidade) {
        return res.status(403).json({ error: "Sua unidade de atuação não foi encontrada ou está inativa." });
      }
      
      if (unidade_id) {
        const targetUnidade = await prisma.unidades.findUnique({
          where: { id: unidade_id },
          select: { regional: true }
        });
        
        if (targetUnidade?.regional !== userUnidade?.regional) {
          return res.status(403).json({ error: "Você só pode cadastrar membros para unidades da sua regional." });
        }
      }
    }

    const cargoDb = await prisma.cargos.findFirst({
      where: { nome: cargo.toLowerCase() },
    });

    if (!cargoDb) {
      return res.status(400).json({
        error: `Cargo '${cargo}' não encontrado.`,
      });
    }

    const senha_hash = await hashPassword(senha);

    const novoDefensor = await prisma.defensores.create({
      data: {
        nome,
        email,
        senha_hash,
        cargo_id: cargoDb.id,
        unidade_id: unidade_id || null,
      },
      include: {
        cargo: true,
      },
    });

    res.status(201).json({
      message: "Usuário cadastrado com sucesso!",
      defensor: {
        id: novoDefensor.id,
        nome: novoDefensor.nome,
        email: novoDefensor.email,
        cargo: novoDefensor.cargo.nome,
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Este email já está cadastrado." });
    }
    logger.error(`Erro ao registrar defensor: ${err.message}`, {
      stack: err.stack,
    });
    res.status(500).json({ error: "Falha ao registrar defensor." });
  }
};

// --- FUNÇÃO DE LOGIN (Atualizada com Cargo no Token) ---
export const loginDefensor = async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: "Email e senha são obrigatórios." });
  }

  try {
    console.log(`🔐 Tentativa de login: ${email}`);

    const defensor = await prisma.defensores.findUnique({
      where: { email },
      include: {
        cargo: true,
        unidade: true,
      },
    });

    if (!defensor) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      return res.status(401).json({ error: "Email ou senha inválidos." });
    }

    console.log(
      `✅ Usuário encontrado: ativo=${defensor.ativo}, cargo=${defensor.cargo.nome}`,
    );

    if (!defensor.ativo) {
      console.log(`❌ Usuário inativo: ${email}`);
      return res.status(401).json({ error: "Email ou senha inválidos." });
    }

    // JWT Local Exclusivo (Garante que o client do Supabase no Backend não seja "envenenado" com sessões temporárias)
    const senhaValida = await verifyPassword(senha, defensor.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: "Email ou senha inválidos." });
    }

    const payload = {
      id: defensor.id,
      nome: defensor.nome,
      email: defensor.email,
      cargo: defensor.cargo?.nome || "operador",
      unidade_id: defensor.unidade_id,
    };
    const token = generateToken(payload);

    console.log(`✅ Login bem-sucedido: ${email}`);

    res.status(200).json({
      token,
      defensor: {
        id: defensor.id,
        nome: defensor.nome,
        email: defensor.email,
        cargo: defensor.cargo?.nome || "operador",
        unidade_id: defensor.unidade_id,
        unidade_nome: defensor.unidade?.nome || null,
      },
    });
  } catch (err) {
    logger.error(`Erro no login (Email: ${email}): ${err.message}`);
    console.error(`❌ Erro no login: ${err.message}`);
    res.status(500).json({ error: `Erro interno do servidor: ${err.message}` });
  }
};

// --- LISTAR EQUIPE (Admin/Gestor vê tudo, Coordenador vê regional, Outros veem unidade) ---
export const listarDefensores = async (req, res) => {
  try {
    const CARGOS_VIEW_TEAM = ["admin", "gestor", "coordenador"];
    const userCargo = req.user?.cargo?.toLowerCase();

    if (!req.user || !CARGOS_VIEW_TEAM.includes(userCargo)) {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores e gestores podem visualizar a equipe." });
    }

    let whereClause = {};

    if (userCargo === "coordenador") {
      if (!req.user.unidade_id) {
        return res.status(403).json({ error: "Sua conta de Coordenador não possui uma unidade vinculada." });
      }

      // 1. Busca a regional da unidade do coordenador
      const userUnidade = await prisma.unidades.findUnique({
        where: { id: req.user.unidade_id },
        select: { regional: true }
      }).catch(() => null);

      if (!userUnidade) {
        return res.status(403).json({ error: "Sua unidade de atuação não foi encontrada ou está inativa." });
      }

      if (userUnidade.regional) {
        // 2. Filtra membros cujas unidades pertencem à mesma regional
        whereClause = {
          unidade: {
            regional: userUnidade.regional
          }
        };
      } else {
        // Fallback: se a unidade do coordenador não tiver regional, vê só a dele
        whereClause = { unidade_id: req.user.unidade_id };
      }
    } else if (userCargo !== "admin" && userCargo !== "gestor") {
      // Outros cargos que tenham permissão mas não são admin/gestor/coordenador (ex: recepção se permitido)
      whereClause = { unidade_id: req.user.unidade_id };
    }

    const equipe = await prisma.defensores.findMany({
      where: whereClause,
      select: {
        id: true,
        nome: true,
        email: true,
        created_at: true,
        ativo: true,
        unidade_id: true,
        cargo: {
          select: { nome: true },
        },
        unidade: {
          select: { id: true, nome: true, comarca: true, regional: true },
        },
      },
      orderBy: { nome: "asc" },
    });

    const data = equipe.map((d) => ({
      ...d,
      cargo: d.cargo.nome,
      unidade_nome: d.unidade?.nome || "Sem unidade",
      regional: d.unidade?.regional || "N/A"
    }));

    res.json(data);
  } catch (err) {
    logger.error(`Erro ao listar equipe: ${err.message}`);
    res.status(500).json({ error: "Erro ao buscar membros da equipe." });
  }
};

// --- LISTAR COLEGAS (Para compartilhamento - Todos logados) ---
export const listarColegas = async (req, res) => {
  try {
    const colegas = await prisma.defensores.findMany({
      where: {
        ativo: true,
        id: { not: req.user.id }, // Não lista a si mesmo
      },
      select: {
        id: true,
        nome: true,
        cargo: { select: { nome: true } },
        unidade: { select: { nome: true } },
      },
      orderBy: { nome: "asc" },
    });

    const data = colegas.map((c) => ({
      id: c.id,
      nome: `${c.nome} (${c.cargo.nome} - ${c.unidade?.nome || "Sem unidade"})`,
    }));

    res.json(data);
  } catch (err) {
    logger.error(`Erro ao listar colegas: ${err.message}`);
    res.status(500).json({ error: "Erro ao buscar colegas." });
  }
};

// --- ATUALIZAR MEMBRO (Apenas Admin) ---
export const atualizarDefensor = async (req, res) => {
  try {
    const userCargo = req.user?.cargo?.toLowerCase();
    const ALLOWED_MANAGERS = ["admin", "gestor", "coordenador"];

    if (!req.user || !ALLOWED_MANAGERS.includes(userCargo)) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const { id } = req.params;

    // Se for coordenador, valida se o membro alvo pertence à sua regional
    if (userCargo === "coordenador") {
      const targetMember = await prisma.defensores.findUnique({
        where: { id },
        include: { unidade: true }
      });
      
      const userUnidade = await prisma.unidades.findUnique({
        where: { id: req.user.unidade_id },
        select: { regional: true }
      });

      if (targetMember?.unidade?.regional !== userUnidade?.regional) {
        return res.status(403).json({ error: "Você só pode editar membros da sua regional." });
      }
    }

    const { nome, email, cargo, ativo, unidade_id } = req.body;

    let updateData = { nome, email, ativo };
    if (unidade_id !== undefined) {
      updateData.unidade_id = unidade_id || null; // null = remover unidade
    }

    if (cargo) {
      const cargoDb = await prisma.cargos.findFirst({
        where: { nome: cargo.toLowerCase() },
      });
      if (!cargoDb) return res.status(400).json({ error: "Cargo inválido." });
      updateData.cargo_id = cargoDb.id;
    }

    const defensor = await prisma.defensores.update({
      where: { id },
      data: updateData,
      include: { cargo: true },
    });

    res.json({
      ...defensor,
      cargo: defensor.cargo.nome,
    });
  } catch (err) {
    logger.error(`Erro ao atualizar membro ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: "Erro ao atualizar dados." });
  }
};

// --- DELETAR MEMBRO (Apenas Admin) ---
export const deletarDefensor = async (req, res) => {
  try {
    const userCargo = req.user?.cargo?.toLowerCase();
    const ALLOWED_MANAGERS = ["admin", "gestor", "coordenador"];

    if (!req.user || !ALLOWED_MANAGERS.includes(userCargo)) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: "Você não pode excluir seu próprio usuário." });
    }

    // Se for coordenador, valida se o membro alvo pertence à sua regional
    if (userCargo === "coordenador") {
      const targetMember = await prisma.defensores.findUnique({
        where: { id },
        include: { unidade: true }
      });
      
      const userUnidade = await prisma.unidades.findUnique({
        where: { id: req.user.unidade_id },
        select: { regional: true }
      });

      if (targetMember?.unidade?.regional !== userUnidade?.regional) {
        return res.status(403).json({ error: "Você só pode excluir membros da sua regional." });
      }
    }

    await prisma.defensores.delete({
      where: { id },
    });

    res.json({ message: "Membro removido com sucesso." });
  } catch (err) {
    logger.error(`Erro ao deletar membro ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: "Erro ao excluir usuário." });
  }
};

// --- RESETAR SENHA (Apenas Admin) ---
export const resetarSenhaDefensor = async (req, res) => {
  try {
    if (!req.user || req.user.cargo?.toLowerCase() !== "admin") {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const { id } = req.params;
    const { novaSenha } = req.body;

    if (!novaSenha || novaSenha.length < 6) {
      return res
        .status(400)
        .json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
    }

    const senha_hash = await hashPassword(novaSenha);

    await prisma.defensores.update({
      where: { id },
      data: { senha_hash },
    });

    res.json({ message: "Senha alterada com sucesso." });
  } catch (err) {
    logger.error(
      `Erro ao resetar senha do membro ${req.params.id}: ${err.message}`,
    );
    res.status(500).json({ error: "Erro ao alterar senha." });
  }
};

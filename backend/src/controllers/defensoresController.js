/* eslint-disable no-unused-vars */
import { prisma } from "../config/prisma.js";
import { hashPassword, verifyPassword } from "../services/securityService.js";
import { generateToken } from "../config/jwt.js";
import logger from "../utils/logger.js";
import {  isSupabaseConfigured } from "../config/supabase.js";

const PESO_CARGO = {
  admin: 3,
  gestor: 2,
  coordenador: 1,
  defensor: 0,
  servidor: 0,
  estagiario: 0,
  recepcao: 0,
  visualizador: 0,
};

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

    const { nome, senha, cargo = "servidor", unidade_id, regional } = req.body;
    let { email } = req.body;
    if (email) email = email.trim().toLowerCase();

    const normalizedCargoInput = (cargo || "servidor").toString().toLowerCase();
    
    // Fail-closed: se o cargo não existir no mapeamento de peso, rejeita
    if (!(normalizedCargoInput in PESO_CARGO)) {
      return res.status(403).json({ error: "Cargo inválido ou não permitido." });
    }

    const targetWeight = PESO_CARGO[normalizedCargoInput];
    const myWeight = PESO_CARGO[userCargo] ?? 0;
    
    // Regra: Somente admin pode criar admin. Outros só criam quem é estritamente inferior (<).
    const isPromotingToAdmin = normalizedCargoInput === "admin";
    const isSelfAdmin = userCargo === "admin";

    if ((isPromotingToAdmin && !isSelfAdmin) || (!isSelfAdmin && targetWeight >= myWeight)) {
      logger.warn(`Tentativa de escalação de privilégios: Usuário ${req.user.id} (${userCargo}) tentou criar cargo ${cargo}`);
      return res.status(403).json({
        error: "Acesso negado. Você só pode cadastrar usuários com cargo estritamente inferior ao seu.",
      });
    }

    // Se for coordenador, valida se a unidade alvo pertence à sua regional
    if (userCargo === "coordenador") {
      const currentUser = await prisma.defensores.findUnique({
        where: { id: req.user.id },
        include: { unidade: true }
      });
      const userRegional = currentUser?.regional || currentUser?.unidade?.regional;

      if (!userRegional) {
        return res.status(403).json({ error: "Sua conta de Coordenador não possui uma regional vinculada." });
      }
      
      if (unidade_id) {
        const targetUnidade = await prisma.unidades.findUnique({
          where: { id: unidade_id },
          select: { regional: true }
        });
        
        if (targetUnidade?.regional !== userRegional) {
          return res.status(403).json({ error: "Você só pode cadastrar membros para unidades da sua regional." });
        }
      } else if (regional) {
        if (regional !== userRegional) {
          return res.status(403).json({ error: "Você só pode cadastrar membros para a sua regional." });
        }
      }
    }

    const cargoDb = await prisma.cargos.findFirst({
      where: { nome: normalizedCargoInput },
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
        regional: unidade_id ? null : (regional || null),
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
  let { email, senha } = req.body;
  if (email) email = email.toLowerCase().trim();

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
        regional: defensor.regional || defensor.unidade?.regional || null,
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
      const currentUser = await prisma.defensores.findUnique({
        where: { id: req.user.id },
        include: { unidade: true }
      });
      const userRegional = currentUser?.regional || currentUser?.unidade?.regional;

      if (!userRegional) {
        return res.status(403).json({ error: "Sua conta de Coordenador não possui uma regional vinculada." });
      }

      // 2. Filtra membros cujas unidades pertencem à mesma regional ou a própria regional é a mesma
      whereClause = {
        OR: [
          { unidade: { regional: userRegional } },
          { regional: userRegional }
        ]
      };
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
        regional: true,
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
      regional: d.regional || d.unidade?.regional || "N/A"
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

    // Validação de Hierarquia: busca o membro alvo para checar o cargo atual
    const targetMemberFull = await prisma.defensores.findUnique({
      where: { id },
      include: { cargo: true, unidade: true }
    });

    if (!targetMemberFull) {
      return res.status(404).json({ error: "Membro não encontrado." });
    }

    // Se for coordenador, valida se o membro alvo pertence à sua regional
    if (userCargo === "coordenador") {
      const currentUser = await prisma.defensores.findUnique({
        where: { id: req.user.id },
        include: { unidade: true }
      });
      const userRegional = currentUser?.regional || currentUser?.unidade?.regional;
      const targetRegional = targetMemberFull.regional || targetMemberFull.unidade?.regional;

      if (targetRegional !== userRegional) {
        return res.status(403).json({ error: "Você só pode editar membros da sua regional." });
      }

      // Validação Adicional: se estiver mudando a unidade, a nova unidade TAMBÉM deve ser da regional
      if (req.body.unidade_id) {
        const targetNewUnidade = await prisma.unidades.findUnique({
          where: { id: req.body.unidade_id },
          select: { regional: true }
        });
        if (targetNewUnidade?.regional !== userRegional) {
          return res.status(403).json({ error: "A unidade de destino deve pertencer à sua regional." });
        }
      } else if (req.body.regional && req.body.regional !== userRegional) {
        return res.status(403).json({ error: "Você só pode alocar membros para a sua regional." });
      }
    }

    const myWeight = PESO_CARGO[userCargo] ?? 0;
    const targetCargoName = targetMemberFull.cargo.nome.toLowerCase();
    
    if (!(targetCargoName in PESO_CARGO)) {
      return res.status(403).json({ error: "Cargo do membro alvo inválido." });
    }
    const targetWeight = PESO_CARGO[targetCargoName];

    // 1. Não pode editar alguém de nível superior ou igual (exceto se for Admin editando outro Admin/User)
    if (userCargo !== "admin" && targetWeight >= myWeight) {
      return res.status(403).json({ error: "Acesso negado. Você só pode editar usuários com cargo estritamente inferior ao seu." });
    }

    // 2. Proteção Admin: apenas admins mexem em admins
    if (targetMemberFull.cargo.nome.toLowerCase() === "admin" && userCargo !== "admin") {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores podem editar outros administradores." });
    }

    const { nome, ativo, unidade_id, regional } = req.body;
    let { email, cargo } = req.body;
    if (email) email = email.trim().toLowerCase();
    if (cargo) cargo = cargo.toString().toLowerCase();

    // 3. Validação do novo cargo (se houver tentativa de mudança)
    if (cargo) {
      const normalizedCargoInput = cargo.toString().toLowerCase();
      const newWeight = PESO_CARGO[normalizedCargoInput] ?? 0;
      const isSettingAdmin = normalizedCargoInput === "admin";
      
      if ((isSettingAdmin && userCargo !== "admin") || (userCargo !== "admin" && newWeight >= myWeight)) {
        logger.warn(`Tentativa de promoção indevida: Usuário ${req.user.id} tentou mudar cargo de ${id} para ${cargo}`);
        return res.status(403).json({ error: "Acesso negado. Você não pode atribuir um cargo superior ou igual ao seu." });
      }
    }

    let updateData = { nome, email, ativo };
    const targetCargoText = (cargo || targetMemberFull.cargo.nome).toString().toLowerCase();

    // Determinar qual será a unidade_id final após o update
    const finalUnidadeId = unidade_id !== undefined ? (unidade_id || null) : targetMemberFull.unidade_id;

    if (targetCargoText === "coordenador") {
      updateData.unidade_id = finalUnidadeId;
      if (finalUnidadeId) {
        updateData.regional = null;
      } else {
        updateData.regional = regional !== undefined ? (regional || null) : targetMemberFull.regional;
      }
    } else {
      updateData.regional = null;
      updateData.unidade_id = finalUnidadeId;
    }

    if (cargo) {
      const cargoDb = await prisma.cargos.findFirst({
        where: { nome: cargo.toString().toLowerCase() },
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

    // Validação de Hierarquia: busca o membro alvo para checar o cargo atual
    const targetMemberFull = await prisma.defensores.findUnique({
      where: { id },
      include: { cargo: true, unidade: true }
    });

    if (!targetMemberFull) {
      return res.status(404).json({ error: "Membro não encontrado." });
    }

    // Se for coordenador, valida se o membro alvo pertence à sua regional
    if (userCargo === "coordenador") {
      const currentUser = await prisma.defensores.findUnique({
        where: { id: req.user.id },
        include: { unidade: true }
      });
      const userRegional = currentUser?.regional || currentUser?.unidade?.regional;
      const targetRegional = targetMemberFull.regional || targetMemberFull.unidade?.regional;

      if (targetRegional !== userRegional) {
        return res.status(403).json({ error: "Você só pode excluir membros da sua regional." });
      }
    }

    const myWeight = PESO_CARGO[userCargo] ?? 0;
    const targetWeight = PESO_CARGO[targetMemberFull.cargo.nome.toLowerCase()] ?? 0;

    // 1. Não pode excluir alguém de nível superior ou igual (exceto se for Admin)
    if (userCargo !== "admin" && targetWeight >= myWeight) {
      return res.status(403).json({ error: "Acesso negado. Você só pode excluir usuários com cargo estritamente inferior ao seu." });
    }

    // 2. Proteção Admin: apenas admins excluem admins
    if (targetMemberFull.cargo.nome.toLowerCase() === "admin" && userCargo !== "admin") {
      return res.status(403).json({ error: "Acesso negado. Apenas administradores podem excluir outros administradores." });
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

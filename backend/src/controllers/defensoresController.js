import { prisma } from "../config/prisma.js";
import { hashPassword, verifyPassword } from "../services/securityService.js";
import { generateToken } from "../config/jwt.js";
import logger from "../utils/logger.js";

// --- FUNÇÃO DE CADASTRO (Atualizada com Cargo) ---
export const registrarDefensor = async (req, res) => {
  try {
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({
        error: "Acesso negado. Apenas administradores podem cadastrar novos membros.",
      });
    }

    const { nome, email, senha, cargo = "operador", unidade_id } = req.body;

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

  try {
    console.log(`🔐 Tentativa de login: ${email}`);
    
    const defensor = await prisma.defensores.findUnique({
      where: { email },
      include: {
        cargo: true,
      },
    });

    if (!defensor) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      return res.status(401).json({ error: "Email ou senha inválidos." });
    }

    console.log(`✅ Usuário encontrado: ativo=${defensor.ativo}, cargo=${defensor.cargo.nome}`);

    if (!defensor.ativo) {
      console.log(`❌ Usuário inativo: ${email}`);
      return res.status(401).json({ error: "Email ou senha inválidos." });
    }

    const senhaValida = await verifyPassword(senha, defensor.senha_hash);

    if (!senhaValida) {
      console.log(`❌ Senha inválida para: ${email}`);
      return res.status(401).json({ error: "Email ou senha inválidos." });
    }

    console.log(`✅ Login bem-sucedido: ${email}`);

    const payload = {
      id: defensor.id,
      nome: defensor.nome,
      email: defensor.email,
      cargo: defensor.cargo.nome,
    };

    const token = generateToken(payload);

    res.status(200).json({
      token,
      defensor: {
        id: defensor.id,
        nome: defensor.nome,
        email: defensor.email,
        cargo: defensor.cargo.nome,
      },
    });
  } catch (err) {
    logger.error(`Erro no login (Email: ${email}): ${err.message}`);
    console.error(`❌ Erro no login: ${err.message}`);
    res.status(500).json({ error: "Falha ao fazer login." });
  }
};

// --- LISTAR EQUIPE (Apenas Admin) ---
export const listarDefensores = async (req, res) => {
  try {
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const equipe = await prisma.defensores.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        created_at: true,
        ativo: true,
        cargo: {
          select: { nome: true },
        },
      },
      orderBy: { nome: "asc" },
    });

    const data = equipe.map((d) => ({
      ...d,
      cargo: d.cargo.nome,
    }));

    res.json(data);
  } catch (err) {
    logger.error(`Erro ao listar equipe: ${err.message}`);
    res.status(500).json({ error: "Erro ao buscar membros da equipe." });
  }
};

// --- ATUALIZAR MEMBRO (Apenas Admin) ---
export const atualizarDefensor = async (req, res) => {
  try {
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const { id } = req.params;
    const { nome, email, cargo, ativo } = req.body;

    let updateData = { nome, email, ativo };

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
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const { id } = req.params;

    if (id === req.user.id) {
      return res
        .status(400)
        .json({ error: "Você não pode excluir sua própria conta." });
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
    if (!req.user || req.user.cargo !== "admin") {
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

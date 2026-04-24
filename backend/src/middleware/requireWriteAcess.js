export const requireWriteAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Usuário não autenticado." });
  }

  const allowedRoles = ["admin", "coordenador", "defensor", "servidor", "estagiario"];

  if (!allowedRoles.includes(req.user.cargo.toLowerCase())) {
    return res.status(403).json({ 
      error: "Acesso negado. Sua conta permite apenas leitura e não pode fazer alterações." 
    });
  }

  next();
};
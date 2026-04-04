export const requireWriteAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Usuário não autenticado." });
  }

  // Se o cargo for visualizador, bloqueia a requisição na hora!
  if (req.user.cargo === "visualizador") {
    return res.status(403).json({ 
      error: "Acesso negado. Sua conta permite apenas leitura e não pode fazer alterações." 
    });
  }

  // Se for admin, defensor, estagiario ou recepcao, deixa passar
  next();
};
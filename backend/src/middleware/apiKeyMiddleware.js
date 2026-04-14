import logger from "../utils/logger.js";

export const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const validKey = process.env.API_KEY_SERVIDORES;

  if (!apiKey) {
    return res.status(401).json({ error: "API Key não fornecida (Scanner/Balcão)." });
  }

  if (apiKey !== validKey) {
    logger.warn(`Tentativa de acesso com API Key inválida: ${apiKey}`);
    return res.status(403).json({ error: "API Key inválida." });
  }

  // Permite acesso como sistema
  req.user = { id: "sistema-scanner", nome: "Scanner Automático", cargo: "sistema" };
  next();
};

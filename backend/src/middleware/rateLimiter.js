import rateLimit from "express-rate-limit";

// Limite Global: Proteção básica contra DDoS (Aumentado para Mutirão)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5000,
  message: {
    error: "Muitas requisições originadas deste IP. Tente novamente em 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite Estrito para Buscas (CPF/Protocolo): (Aumentado para Mutirão)
export const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    error: "Limite de consultas excedido. Por favor, aguarde alguns minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite para Criação de Casos: (Aumentado para Mutirão - 300/hora)
export const creationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 300,
  message: {
    error: "Limite de cadastros por hora atingido para este IP.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

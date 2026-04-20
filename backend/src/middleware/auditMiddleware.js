import { registrarLog } from "../services/loggerService.js";

export const auditMiddleware = (req, res, next) => {
  // Ignoramos GET para não encher o banco com logs de visualização simples
  if (req.method === "GET") return next();

  res.on("finish", () => {
    // Só grava log se a operação foi bem-sucedida (Status 200-299)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const usuarioId = req.user?.id; // ID do Defensor/Estagiário vindo do authMiddleware
      if (!usuarioId) return;

      const path = req.originalUrl.split('?')[0];
      const acao = `${req.method} ${path}`;
      const registroId = req.params.id ?? req.body.id ?? null;

      // Define a entidade com base no baseUrl do roteador (ex: montado em /api/casos -> 'casos')
      // Fallback para originalUrl garantindo que ignora vazio ou 'api'
      let entidade;
      if (req.baseUrl) {
        entidade = req.baseUrl.split("/").pop() || "geral";
      } else {
        const parts = path.split("/").filter((p) => p && p !== "api");
        entidade = parts[0] || "geral";
      }


      // Sanitização recursiva de dados sensíveis
      const sensitiveKeys = new Set(['senha', 'password', 'cpf', 'token', 'authorization']);
      const sanitize = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(sanitize);
        const sanitized = {};
        for (const [k, v] of Object.entries(obj)) {
          if (sensitiveKeys.has(k.toLowerCase())) {
            sanitized[k] = "***";
          } else {
            sanitized[k] = (v && typeof v === 'object') ? sanitize(v) : v;
          }
        }
        return sanitized;
      };

      const detalhes = sanitize(req.body);

      registrarLog(usuarioId, acao, entidade, registroId, detalhes);
    }
  });

  next();
};

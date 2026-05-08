import { prisma } from "../config/prisma.js";

export function maskStringPII(str) {
  if (typeof str !== "string") return str;
  const cpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const rgRegex = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dX]\b/gi;
  
  return str
    .replace(cpfRegex, "[CPF_REDACTED]")
    .replace(emailRegex, "[EMAIL_REDACTED]")
    .replace(rgRegex, "[RG_REDACTED]");
}

/**
 * Máscara dados sensíveis em objetos de log (LGPD)
 */
export function maskPII(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== "object") return obj;
  if (seen.has(obj)) return "[CIRCULAR]";
  seen.add(obj);

  const sensitiveKeys = ["cpf", "rg", "email", "telefone", "nome", "mae", "pai", "nome_assistido", "representante_nome", "nome_requerido", "senha", "token", "password"];
  const masked = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in masked) {
    if (typeof masked[key] === "object") {
      masked[key] = maskPII(masked[key], seen);
    } else if (typeof masked[key] === "string") {
      const lowerKey = key.toLowerCase();
      
      // Normaliza camelCase para snake_case para extrair segmentos (ex: nomeMae -> nome_mae)
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).toLowerCase();
      const segments = new Set([...lowerKey.split('_'), ...snakeKey.split('_')]);

      // Se a chave for conhecida como sensível, mascara o valor inteiro
      // Para tokens curtos (<=3), exige match exato de um dos segmentos para evitar falso positivo (ex: rg em cargo)
      const isSensitive = sensitiveKeys.some(k => {
        if (k.length <= 3) return segments.has(k);
        return lowerKey.includes(k);
      });

      if (isSensitive) {
        masked[key] = "[REDACTED]";
      } 
      // Caso contrário, tenta detectar padrões no valor (CPF, Email, RG)
      else {
        masked[key] = maskStringPII(masked[key]);
      }
    }
  }
  return masked;
}

export async function registrarLog(
  usuarioId,
  acao,
  entidade,
  registroId,
  detalhes = {},
) {
  try {
    // Resolve caso_id: tenta ID num\u00e9rico primeiro (padr\u00e3o do auditMiddleware),
    // depois protocolo como fallback (usado por chamadas expl\u00edcitas de registrarLog)
    let caso_id = null;
    if (entidade === 'casos' && registroId) {
      let caso = null;
      const isNumericId = /^\d+$/.test(String(registroId));
      if (isNumericId) {
        // ID numérico direto (req.params.id do auditMiddleware)
        caso = await prisma.casos.findUnique({
          where: { id: BigInt(registroId) },
          select: { id: true }
        });
      }
      if (!caso) {
        // Fallback: protocolo (string alfanumérica ou numérica)
        caso = await prisma.casos.findFirst({
          where: { protocolo: String(registroId) },
          select: { id: true }
        });
      }
      if (caso) caso_id = caso.id;
    }

    // Máscara PII nos detalhes antes de salvar
    const safeDetails = maskPII(detalhes);

    await prisma.logs_auditoria.create({
      data: {
        usuario_id: usuarioId || null,
        caso_id: caso_id,
        acao: acao,
        entidade: entidade,
        registro_id: registroId !== undefined && registroId !== null ? String(registroId) : null,
        detalhes: safeDetails || {},
        criado_em: new Date(),
      },
    });

    console.log(`✅ Log registrado (Prisma): ${acao}`);
  } catch (err) {
    console.error("⚠️ Erro crítico no loggerService (Prisma):", err);
  }
}


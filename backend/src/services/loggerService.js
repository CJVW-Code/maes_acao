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

  const sensitiveKeys = ["cpf", "rg", "email", "telefone", "nome", "nome_assistido", "representante_nome", "nome_requerido", "senha", "token", "password"];
  const masked = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in masked) {
    if (typeof masked[key] === "object") {
      masked[key] = maskPII(masked[key], seen);
    } else if (typeof masked[key] === "string") {
      const lowerKey = key.toLowerCase();
      
      // Se a chave for conhecida como sensível, mascara o valor inteiro
      if (sensitiveKeys.some(k => lowerKey.includes(k))) {
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
    // Caso o registroId seja um protocolo (string), tentamos encontrar o caso_id (BigInt)
    let caso_id = null;
    if (entidade === 'casos' && registroId) {
      const caso = await prisma.casos.findFirst({
        where: { protocolo: String(registroId) },
        select: { id: true }
      });
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


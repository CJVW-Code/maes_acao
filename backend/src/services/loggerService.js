import { prisma } from "../config/prisma.js";

/**
 * Recursively mask personally identifiable information (PII) in an object or array for safe logging.
 *
 * Known sensitive keys are replaced with "[REDACTED]", and common patterns such as CPF and email addresses
 * found in string values are replaced with "[CPF_REDACTED]" and "[EMAIL_REDACTED]" respectively.
 *
 * @param {Object|Array<any>} obj - The input object or array to be scanned and masked; returned unchanged if falsy or not an object.
 * @returns {Object|Array<any>} A shallow-copied object or array with sensitive fields and detected patterns redacted.
function maskPII(obj) {
  if (!obj || typeof obj !== "object") return obj;

  const sensitiveKeys = ["cpf", "rg", "email", "telefone", "nome", "nome_assistido", "representante_nome", "nome_requerido"];
  const masked = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in masked) {
    if (typeof masked[key] === "object") {
      masked[key] = maskPII(masked[key]);
    } else if (typeof masked[key] === "string") {
      const lowerKey = key.toLowerCase();
      
      // Se a chave for conhecida como sensível, mascara
      if (sensitiveKeys.some(k => lowerKey.includes(k))) {
        masked[key] = "[REDACTED]";
      } 
      // Caso contrário, tenta detectar padrões no valor (CPF, Email)
      else {
        const cpfRegex = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        
        masked[key] = masked[key]
          .replace(cpfRegex, "[CPF_REDACTED]")
          .replace(emailRegex, "[EMAIL_REDACTED]");
      }
    }
  }
  return masked;
}

/**
 * Record an audit log entry in the database, associating it with a case when applicable.
 *
 * Attempts to resolve a case ID when `entidade` is "casos" and `registroId` is provided (treated as a protocol),
 * masks personally identifiable information in `detalhes` before persisting, and stores the created timestamp.
 *
 * @param {any} usuarioId - The user identifier for the actor; may be falsy to indicate an anonymous/system action.
 * @param {string} acao - A short description of the action being logged.
 * @param {string} entidade - The entity type related to the log (e.g., "casos").
 * @param {any} registroId - Identifier of the related record; when present it is stored as a string and, if `entidade` is "casos", used to look up the associated case ID.
 * @param {Object} [detalhes={}] - Additional details to include in the log; sensitive PII fields and common patterns (CPF, email) are masked before storage.
 */
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


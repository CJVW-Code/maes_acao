const SENSITIVE_KEYS = new Set([
  "senha",
  "password",
  "cpf",
  "token",
  "authorization",
  "rg",
  "nome",
  "email",
  "telefone",
  "endereco",
  "mae",
  "pai",
  "nascimento",
  "relato",
  "observacao",
  "descricao",
]);

/**
 * Sanitiza recursivamente um objeto, mascarando chaves sensíveis.
 * @param {any} obj - Objeto a ser sanitizado.
 * @returns {any} - Objeto sanitizado.
 */
export const sanitize = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const sanitized = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    
    // Verifica se a chave contém algum dos termos sensíveis
    const isSensitive = Array.from(SENSITIVE_KEYS).some(s => keyLower.includes(s));

    if (isSensitive) {
      sanitized[k] = "***";
    } else {
      sanitized[k] = v && typeof v === "object" ? sanitize(v) : v;
    }
  }
  return sanitized;
};

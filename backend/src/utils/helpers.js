/**
 * Garante que os dados do formulário (JSONB) estejam em um formato seguro para processamento,
 * lidando com valores nulos e garantindo retrocompatibilidade de campos.
 * @param {Object} caso - Objeto do caso retornado pelo mapCasoRelations
 * @returns {Object} - Objeto dados_formulario higienizado
 */
export function safeFormData(caso) {
  const rawDados = caso?.dados_formulario;
  const parsed = safeJsonParse(rawDados, {});
  
  // Garante que dados seja um objeto plano e não nulo/array
  const dados = (parsed && typeof parsed === "object" && !Array.isArray(parsed)) 
    ? parsed 
    : {};

  // Clone para evitar mutações inesperadas no objeto original
  const safeDados = { ...dados };

  // 1. Fallback para relato_texto se estiver vazio no formulário mas existir na raiz do caso
  if (!safeDados.relato_texto && caso?.relato_texto) {
    safeDados.relato_texto = caso.relato_texto;
  }

  // 2. Garantir estrutura de nomes de arquivos (usado em visualização e templates)
  if (!safeDados.document_names || typeof safeDados.document_names !== "object") {
    safeDados.document_names = {};
  }
  
  // 3. Espelhar camelCase para o frontend que espera documentNames
  if (!safeDados.documentNames || typeof safeDados.documentNames !== "object") {
    safeDados.documentNames = safeDados.document_names;
  }

  return safeDados;
}

/**
 * Utilitário de parse seguro para JSON strings ou objetos.
 * @param {any} input - String JSON ou objeto
 * @param {any} fallback - Valor de retorno em caso de falha
 * @returns {any}
 */
export const safeJsonParse = (input, fallback = null) => {
  if (typeof input === "object" && input !== null) {
    return input;
  }
  if (typeof input !== "string" || !input) {
    return fallback;
  }
  try {
    return JSON.parse(input);
  } catch {
    return fallback;
  }
};

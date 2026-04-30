
export const varasMapping = {
  // --- Ações de Família ---
  "Fixação de Pensão Alimentícia ": "Vara de Família",
  "Divórcio Litigioso": "Vara de Família",
  "Divórcio Consesual": "Vara de Família",
  "Divórcio Consensual": "Vara de Família",
  "Reconhecimento e Dissolução de União Estável": "Vara de Família",
  "Dissolução Liitigiosa de União Estável": "Vara de Família",
  "Dissolução Litigiosa de União Estável": "Vara de Família",
  "Guarda de Filhos": "Vara de Família",
  "Execução de Alimentos Rito Penhora/Prisão": "Vara de Família",
  "Revisao de Alimentos (Majoração)": "Vara de Família",
  "Revisão de Alimentos (Majoração)": "Vara de Família",
  "Revisao de Alimentos (Redução)": "Vara de Família",
  "Revisão de Alimentos (Redução)": "Vara de Família",
};

/**
 * Função para obter a vara com base no tipo de ação.
 * @param {string} tipoAcao - O tipo de ação do caso.
 * @returns {string} - A vara competente ou uma string padrão "[VARA NÃO ESPECIFICADA]".
 */
export const getVaraByTipoAcao = (tipoAcao) => {
  if (!tipoAcao) return "[VARA NÃO ESPECIFICADA]";
  // Procura pela chave exata ou por uma que comece com o tipoAcao (para casos com espaços extras)
  const key = Object.keys(varasMapping).find(k => tipoAcao.trim().startsWith(k.trim()));
  return key ? varasMapping[key] : "[VARA NÃO ESPECIFICADA]";
};

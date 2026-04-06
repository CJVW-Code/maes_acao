import { ACOES_FAMILIA } from "./acoes/familia";
import { AREAS_DIREITO } from "./areasDireito";

export const DICIONARIO_ACOES = {
  familia: ACOES_FAMILIA,
};

/**
 * @param {string} area - chave da área (ex: "familia")
 * @returns {Array<[string, object]>} - array de [key, config]
 */
export function getAcoesVisiveis(area) {
  const acoes = DICIONARIO_ACOES[area];
  if (!acoes) return [];
  return Object.entries(acoes).filter(
    ([_, config]) => config.status !== "scaffold",
  );
}

/**
 * Retorna a configuração de uma ação específica.
 * @param {string} area - chave da área (ex: "familia")
 * @param {string} acaoKey - chave da ação (ex: "fixacao_alimentos")
 * @returns {object|null}
 */
export function getConfigAcao(area, acaoKey) {
  return DICIONARIO_ACOES[area]?.[acaoKey] || null;
}

export { AREAS_DIREITO };

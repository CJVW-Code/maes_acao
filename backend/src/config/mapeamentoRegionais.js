/**
 * Mapeamento de Regionais da DPE-BA
 * Este arquivo centraliza a organização das comarcas em regionais.
 * Salvador é tratada como uma regional especial.
 */

export const REGIONAIS = {
  SALVADOR: "Salvador",
  REGIONAL_1: "1ª Regional - Feira de Santana",
  REGIONAL_2: "2ª Regional - Vitória da Conquista",
  REGIONAL_3: "3ª Regional - Ilhéus",
  REGIONAL_4: "4ª Regional - Itabuna",
  REGIONAL_5: "5ª Regional - Juazeiro",
  REGIONAL_6: "6ª Regional - Santo Antônio de Jesus",
  REGIONAL_7: "7ª Regional - Camaçari",
  REGIONAL_8: "8ª Regional - Barreiras",
  REGIONAL_9: "9ª Regional - Porto Seguro",
  REGIONAL_10: "10ª Regional - Paulo Afonso",
  REGIONAL_11: "11ª Regional - Irecê",
  REGIONAL_12: "12ª Regional - Jequié",
  REGIONAL_13: "13ª Regional - Alagoinhas",
  REGIONAL_14: "14ª Regional - Teixeira de Freitas",
  REGIONAL_15: "15ª Regional - Guanambi",
};

export const MAPEAMENTO_CIDADES = {
  "Salvador": REGIONAIS.SALVADOR,

  // 1ª Regional
  "Feira de Santana": REGIONAIS.REGIONAL_1,
  "Santo Estêvão": REGIONAIS.REGIONAL_1,

  // 2ª Regional
  "Vitória da Conquista": REGIONAIS.REGIONAL_2,

  // 3ª Regional
  "Ilhéus": REGIONAIS.REGIONAL_3,
  "Canavieiras": REGIONAIS.REGIONAL_3,

  // 4ª Regional
  "Itabuna": REGIONAIS.REGIONAL_4,
  "Camacã": REGIONAIS.REGIONAL_4,

  // 5ª Regional
  "Juazeiro": REGIONAIS.REGIONAL_5,
  "Campo Formoso": REGIONAIS.REGIONAL_5,
  "Senhor do Bonfim": REGIONAIS.REGIONAL_5,

  // 6ª Regional
  "Santo Antônio de Jesus": REGIONAIS.REGIONAL_6,
  "Amargosa": REGIONAIS.REGIONAL_6,
  "Cachoeira": REGIONAIS.REGIONAL_6,
  "Valença": REGIONAIS.REGIONAL_6,
  "Cruz das Almas": REGIONAIS.REGIONAL_6,
  "Santo Amaro": REGIONAIS.REGIONAL_6,
  "Nazaré": REGIONAIS.REGIONAL_6,

  // 7ª Regional
  "Camaçari": REGIONAIS.REGIONAL_7,
  "Candeias": REGIONAIS.REGIONAL_7,
  "Itaparica": REGIONAIS.REGIONAL_7,
  "Lauro de Freitas": REGIONAIS.REGIONAL_7,
  "Simões Filho": REGIONAIS.REGIONAL_7,

  // 8ª Regional
  "Barreiras": REGIONAIS.REGIONAL_8,

  // 9ª Regional
  "Porto Seguro": REGIONAIS.REGIONAL_9,
  "Eunápolis": REGIONAIS.REGIONAL_9,

  // 10ª Regional
  "Paulo Afonso": REGIONAIS.REGIONAL_10,
  "Paripiranga": REGIONAIS.REGIONAL_10,

  // 11ª Regional
  "Irecê": REGIONAIS.REGIONAL_11,
  "Seabra": REGIONAIS.REGIONAL_11,

  // 12ª Regional
  "Jequié": REGIONAIS.REGIONAL_12,
  "Ipiaú": REGIONAIS.REGIONAL_12,

  // 13ª Regional
  "Alagoinhas": REGIONAIS.REGIONAL_13,
  "Esplanada": REGIONAIS.REGIONAL_13,
  "Catu": REGIONAIS.REGIONAL_13,

  // 14ª Regional
  "Teixeira de Freitas": REGIONAIS.REGIONAL_14,

  // 15ª Regional
  "Guanambi": REGIONAIS.REGIONAL_15,
  "Brumado": REGIONAIS.REGIONAL_15,
  "Jacobina": REGIONAIS.REGIONAL_15,
};

/**
 * Normaliza uma string removendo acentos e convertendo para minúsculas
 */
const normalizar = (str) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

// Mapa normalizado para busca rápida
const MAPEAMENTO_NORMALIZADO = Object.entries(MAPEAMENTO_CIDADES).reduce((acc, [cidade, regional]) => {
  acc[normalizar(cidade)] = regional;
  return acc;
}, {});

/**
 * Retorna a regional de uma cidade ignorando acentos e maiúsculas
 * @param {string} cidade 
 * @returns {string}
 */
export const getRegionalByCidade = (cidade) => {
  if (!cidade) return "Outras / Não Mapeada";
  
  // Tenta busca exata primeiro
  if (MAPEAMENTO_CIDADES[cidade]) return MAPEAMENTO_CIDADES[cidade];
  
  // Tenta busca normalizada
  const cidadeNormalizada = normalizar(cidade);
  
  // Atalhos comuns (SAJ, etc)
  if (cidadeNormalizada === "saj") return REGIONAIS.REGIONAL_6;
  
  return MAPEAMENTO_NORMALIZADO[cidadeNormalizada] || "Outras / Não Mapeada";
};


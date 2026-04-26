import { prisma } from "../config/prisma.js";

let _cache = null;
let _cacheExpiry = 0;
const TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Obtém as configurações do sistema do banco de dados com cache em memória.
 * @returns {Promise<Object>} Objeto com as chaves e valores das configurações.
 */
export const getConfiguracoes = async () => {
  const agora = Date.now();

  // Retorna cache se ainda for válido
  if (_cache && agora < _cacheExpiry) {
    return _cache;
  }

  try {
    // Busca todas as configurações do banco
    const rows = await prisma.configuracoes_sistema.findMany();
    
    // Converte array de rows em objeto { chave: valor }
    _cache = Object.fromEntries(rows.map(r => [r.chave, r.valor]));
    _cacheExpiry = agora + TTL_MS;

    return _cache;
  } catch (error) {
    console.error("❌ Erro ao buscar configurações do sistema:", error);
    // Se falhar e tiver cache antigo, retorna o antigo como fallback temporário
    if (_cache) return _cache;
    throw error;
  }
};

/**
 * Invalida o cache em memória, forçando a próxima leitura a ir ao banco.
 */
export const invalidarCache = () => {
  _cache = null;
  _cacheExpiry = 0;
  console.log("🧹 Cache de configurações do sistema invalidado.");
};

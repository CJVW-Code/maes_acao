export const TRANSICOES_PERMITIDAS = Object.freeze({
  aguardando_documentos: ["documentacao_completa", "erro_processamento"],
  documentacao_completa: ["processando_ia", "pronto_para_analise", "aguardando_documentos"],
  processando_ia: ["pronto_para_analise", "erro_processamento"],
  pronto_para_analise: ["em_atendimento", "aguardando_documentos", "processando_ia"],
  em_atendimento: ["liberado_para_protocolo", "aguardando_documentos", "pronto_para_analise"],
  liberado_para_protocolo: ["em_protocolo", "em_atendimento"],
  em_protocolo: ["liberado_para_protocolo"],
  protocolado: ["aguardando_documentos"],
  erro_processamento: ["processando_ia", "aguardando_documentos"],
});

/**
 * Valida se uma transição de status é permitida para o cargo do usuário.
 * @param {string} from - Status atual
 * @param {string} to - Status desejado
 * @param {string} role - Cargo do usuário (deve estar em lowercase)
 * @returns {Object} - { ok: boolean, adminBypass: boolean, reason?: string }
 */
/**
 * Valida se uma transição de status é permitida.
 * @param {string} from - Status atual
 * @param {string} to - Status desejado
 * @param {string} role - Cargo do usuário
 * @returns {Object} - { ok: boolean, adminBypass: boolean, reason?: string }
 */
export function validateTransition(from, to, role) {
  if (from === to) return { ok: true, adminBypass: false };

  const isAdmin = role === "admin";

  // Admin sempre pode forçar qualquer transição
  if (isAdmin) return { ok: true, adminBypass: true };

  // O status 'protocolado' é especial e terminal. 
  // Bloqueamos a mudança MANUAL para 'protocolado' (deve ser via finalizarCasoSolar)
  if (to === "protocolado") {
    return {
      ok: false,
      reason: "O status 'Protocolado' só pode ser definido através da finalização oficial do caso.",
    };
  }

  // Validação via mapa de transições permitidas
  const permitidas = TRANSICOES_PERMITIDAS[from];

  if (!permitidas || !permitidas.includes(to)) {
    // Mantemos uma mensagem amigável para quando vem do protocolado
    if (from === "protocolado") {
      return {
        ok: false,
        reason: "Um caso protocolado só pode retornar para o status 'Aguardando Documentos'.",
      };
    }

    return {
      ok: false,
      reason: `Transição inválida de '${from}' para '${to}'.`,
    };
  }

  return { ok: true, adminBypass: false };
}

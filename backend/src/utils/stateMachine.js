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
export function validateTransition(from, to, role) {
  const allowed = TRANSICOES_PERMITIDAS[from] || [];
  const isAdmin = role === "admin";

  if (from === to) return { ok: true, adminBypass: false };

  if (!allowed.includes(to)) {
    if (isAdmin) {
      return { ok: true, adminBypass: true };
    }
    return {
      ok: false,
      reason: `Transição inválida: ${from} -> ${to}`,
    };
  }

  return { ok: true, adminBypass: false };
}

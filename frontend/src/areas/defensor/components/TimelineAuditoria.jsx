import React, { useState } from "react";
import { History, Clock, User, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { API_BASE, authFetch } from "../../../utils/apiBase";

// Função para traduzir o "tecniquês" do banco para português
const traduzirAcao = (acao) => {
  if (acao.includes("status")) return "alterou o status";
  if (acao.includes("arquivar")) return "arquivou o caso";
  if (acao.includes("agendar")) return "agendou uma reunião";
  if (acao.includes("finalizar")) return "finalizou o atendimento";
  if (acao.includes("resetar-chave")) return "resetou a chave de acesso";
  return "realizou uma alteração";
};

export const TimelineAuditoria = ({ registroId, entidade = "casos" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const carregarHistorico = async () => {
    if (!isOpen && logs.length === 0) {
      setLoading(true);
      try {
        const response = await authFetch(
          `/casos/${registroId}/historico?entidade=${entidade}`
        );
        const data = await response.json();

        // Garante que logs sempre seja um array
        if (Array.isArray(data)) {
          setLogs(data);
        } else {
          console.error("Resposta do servidor não é uma lista:", data);
          setLogs([]);
        }
      } catch (err) {
        console.error("Erro ao carregar auditoria", err);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="card mt-6 border-soft bg-app/20">
      <button
        onClick={carregarHistorico}
        className="w-full flex items-center justify-between p-2 text-primary font-semibold hover:opacity-80 transition"
      >
        <div className="flex items-center gap-2">
          <History size={18} />
          <span>Histórico de Atividades</span>
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {/* Controla a exibição do painel apenas pelo estado isOpen */}
      {isOpen && (
        <div className="p-4 space-y-6 border-t border-soft mt-2">
          {loading ? (
            <p className="text-sm text-muted animate-pulse text-center">
              Carregando rastros...
            </p>
          ) : !Array.isArray(logs) || logs.length === 0 ? (
            <p className="text-sm text-muted text-center">
              Nenhuma atividade registrada ainda.
            </p>
          ) : (
            <div className="relative border-l-2 border-primary/20 ml-3 space-y-6">
              {/* O map acontece de forma limpa aqui dentro */}
              {logs.map((log) => (
                <div key={log.id} className="relative pl-6">
                  {/* Pontinha da Linha do Tempo */}
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-primary border-4 border-app" />

                  <div className="flex flex-col">
                    <span className="text-xs text-muted flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(log.criado_em).toLocaleString("pt-BR")}
                    </span>
                    <p className="text-sm font-medium text-main mt-1">
                      <span className="text-primary font-bold">
                        {log.defensores?.nome || "Sistema"}
                      </span>{" "}
                      {traduzirAcao(log.acao)}
                    </p>

                    {/* Badge de Detalhes Opcional */}
                    {log.detalhes?.status_novo && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="badge">
                          {log.detalhes?.status_novo}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

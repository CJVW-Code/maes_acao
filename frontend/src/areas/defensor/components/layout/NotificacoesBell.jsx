import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Bell, Calendar, UserPlus, FileText, Check, Loader2, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../../../contexts/ToastContext";
import { API_BASE } from "../../../../utils/apiBase";

export const NotificacoesBell = () => {
  const { notificacoes, token, marcarNotificacaoLida } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const dropdownRef = useRef(null);

  // Fecha dropdown ao clicar fora
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const temConvitePendente = notificacoes.some((n) => !n.lida && n.tipo === "assistencia");

  const handleResponderAssistencia = async (notif, aceito) => {
    if (!notif.referencia_id) return marcarNotificacaoLida(notif.id);

    setRespondingId(notif.id);
    try {
      const res = await fetch(`${API_BASE}/casos/assistencia/${notif.referencia_id}/responder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ aceito }),
      });

      if (res.ok) {
        toast.success(aceito ? "Colaboração aceita!" : "Colaboração recusada.");
        marcarNotificacaoLida(notif.id);
        // Opcional: recarrega a página ou limpa o cache se estiver na página do caso
        if (window.location.pathname.includes(notif.caso_id)) {
          window.location.reload();
        }
      } else {
        toast.error("Erro ao processar resposta.");
      }
    } catch (err) {
      console.error("Erro ao responder assistência", err);
      toast.error("Erro de conexão.");
    } finally {
      setRespondingId(null);
    }
  };

  const getIcon = (tipo) => {
    switch (tipo) {
      case "reagendamento":
        return <Calendar size={16} />;
      case "assistencia":
        return <UserPlus size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 transition-colors rounded-full hover:bg-surface-alt ${
          temConvitePendente ? "text-error animate-pulse" : "text-muted hover:text-primary"
        }`}
      >
        <Bell size={20} />
        {naoLidas > 0 && (
          <span
            className={`absolute top-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-surface ${
              temConvitePendente ? "bg-highlight" : "bg-red-500"
            }`}
          ></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-surface border border-soft rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="p-3 border-b border-soft bg-surface-alt flex justify-between items-center">
            <h3 className="font-bold text-sm">Notificações</h3>
            <span className="text-xs text-muted">{naoLidas} novas</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {notificacoes.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted">Nenhuma notificação.</p>
            ) : (
              notificacoes.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-soft hover:bg-app/50 transition-colors flex gap-3 ${
                    !notif.lida ? "bg-primary/5" : ""
                  }`}
                >
                  <div className={`mt-1 ${!notif.lida ? "text-primary" : "text-muted"}`}>
                    {getIcon(notif.tipo)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <Link
                        to={notif.link || `/painel/casos/${notif.caso_id}`}
                        onClick={() => {
                          marcarNotificacaoLida(notif.id);
                          setIsOpen(false);
                        }}
                        className="text-sm font-medium hover:text-primary leading-tight"
                      >
                        {notif.mensagem}
                      </Link>
                      {!notif.lida && notif.tipo !== "assistencia" && (
                        <button
                          onClick={() => marcarNotificacaoLida(notif.id)}
                          className="text-muted hover:text-primary p-1"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>

                    {/* AÇÕES DE ASSISTÊNCIA */}
                    {notif.tipo === "assistencia" && !notif.lida && (
                      <div className="flex gap-2 mt-2">
                        <button
                          disabled={respondingId === notif.id}
                          onClick={() => handleResponderAssistencia(notif, true)}
                          className="btn btn-primary btn-xs py-1 px-3 flex items-center gap-1"
                        >
                          {respondingId === notif.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Check size={12} />
                          )}
                          Aceitar
                        </button>
                        <button
                          disabled={respondingId === notif.id}
                          onClick={() => handleResponderAssistencia(notif, false)}
                          className="btn btn-ghost btn-xs border border-soft py-1 px-3 flex items-center gap-1 text-red-500"
                        >
                          <X size={12} />
                          Recusar
                        </button>
                      </div>
                    )}

                    <p className="text-[10px] uppercase tracking-wider text-muted font-bold">
                      {new Date(notif.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

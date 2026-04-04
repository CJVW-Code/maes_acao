import React from "react";
import { Video, Calendar, MessageSquare, History } from "lucide-react";

export const PainelAgendamento = ({
  caso,
  statusKey,
  dataAgendamento,
  setDataAgendamento,
  linkAgendamento,
  setLinkAgendamento,
  handleAgendarReuniao,
  isAgendando,
}) => {
  // Se não for status de agendamento e não tiver histórico, nem renderiza nada
  if (!caso) return null;
  if (
    statusKey !== "reuniao_online_agendada" &&
    statusKey !== "reuniao_presencial_agendada" &&
    !(caso?.historico_agendamentos?.length > 0)
  ) {
    return null;
  }

  return (
    <div className="space-y-4 w-full">
      {/* SEÇÃO DE AGENDAMENTO ONLINE */}
      {statusKey === "reuniao_online_agendada" && (
        <div className="card space-y-4 border-t-4 border-t-blue-500 animate-fade-in mt-4 bg-blue-50/50">
          <h2 className="heading-2 flex items-center gap-2 text-blue-700">
            <Video size={20} className="text-blue-500" />
            Agendamento Online
          </h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="data-hora-online" className="text-xs text-muted uppercase font-bold">
                Data e Hora
              </label>
              <input
                id="data-hora-online"
                type="datetime-local"
                className="input mt-1"
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="link-reuniao" className="text-xs text-muted uppercase font-bold">
                Link da Reunião
              </label>
              <input
                id="link-reuniao"
                type="text"
                placeholder="Google Meet, Teams, etc."
                className="input mt-1"
                value={linkAgendamento}
                onChange={(e) => setLinkAgendamento(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleAgendarReuniao}
              disabled={isAgendando}
              className="btn btn-primary w-full"
            >
              {isAgendando ? "Salvando..." : "Salvar Agendamento"}
            </button>

            {caso.agendamento_link && (caso.whatsapp_contato || caso.telefone_assistido) && (
              <div className="pt-2">
                <a
                  href={`https://wa.me/55${(caso.whatsapp_contato || caso.telefone_assistido)?.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Olá, Sr(a). ${caso.nome_assistido}. A Defensoria Pública agendou seu atendimento online para ${new Date(
                      caso.agendamento_data,
                    ).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}. Acesse pelo link: ${caso.agendamento_link}. Favor confirmar.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white border-none"
                >
                  <MessageSquare size={18} />
                  Notificar via WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEÇÃO DE AGENDAMENTO PRESENCIAL */}
      {statusKey === "reuniao_presencial_agendada" && (
        <div className="card space-y-4 border-t-4 border-t-purple-500 animate-fade-in mt-4 bg-purple-50/50">
          <h2 className="heading-2 flex items-center gap-2 text-purple-700">
            <Calendar size={20} className="text-purple-500" />
            Agendamento Presencial
          </h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="data-hora-presencial" className="text-xs text-muted uppercase font-bold">
                Data e Hora
              </label>
              <input
                id="data-hora-presencial"
                type="datetime-local"
                className="input mt-1"
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="local-instrucoes" className="text-xs text-muted uppercase font-bold">
                Local / Instruções
              </label>
              <textarea
                id="local-instrucoes"
                className="input mt-1 min-h-[80px]"
                placeholder="Ex: Sede da Defensoria, Sala 104. Trazer documentos originais."
                value={linkAgendamento}
                onChange={(e) => setLinkAgendamento(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={handleAgendarReuniao}
              disabled={isAgendando}
              className="btn btn-primary w-full"
            >
              {isAgendando ? "Salvando..." : "Salvar Agendamento Presencial"}
            </button>

            {caso.agendamento_data && (caso.whatsapp_contato || caso.telefone_assistido) && (
              <div className="pt-2">
                <a
                  href={`https://wa.me/55${(caso.whatsapp_contato || caso.telefone_assistido)?.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Olá, Sr(a). ${caso.nome_assistido}. A Defensoria Pública agendou seu atendimento presencial para ${new Date(
                      caso.agendamento_data,
                    ).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}. Local/Instruções: ${caso.agendamento_link || "Sede da Defensoria"}. Favor confirmar.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white border-none"
                >
                  <MessageSquare size={18} />
                  Notificar via WhatsApp
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTÓRICO DE AGENDAMENTOS */}
      {caso.historico_agendamentos &&
        caso.historico_agendamentos.length > 0 && (
          <div className="card space-y-4 mt-4 bg-gray-50 border border-gray-200">
            <h2 className="heading-3 flex items-center gap-2 text-gray-700">
              <History size={18} />
              Histórico de Agendamentos
            </h2>
            <div className="space-y-3">
              {caso.historico_agendamentos.map((hist) => (
                <div
                  key={hist.id}
                  className="text-sm border-l-2 border-gray-300 pl-3 py-1"
                >
                  <p className="font-semibold text-gray-800">
                    {new Date(hist.data_agendamento).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}{" "}
                    <span className="text-xs font-normal text-muted uppercase ml-1 bg-gray-200 px-1 rounded">
                      {hist.tipo}
                    </span>
                  </p>
                  <p className="text-muted text-xs mt-0.5">
                    {hist.link_ou_local}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Status: {hist.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
};

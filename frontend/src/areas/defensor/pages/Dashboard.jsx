import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Clock,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Bell,
  ChevronLeft,
  ChevronRight,
  User,
  Lock,
  Eye,
  Users,
  Settings,
  X,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import { authFetch } from "../../../utils/apiBase";
import useSWR from "swr";
import { useToast } from "../../../contexts/ToastContext";
import { Loader2 } from "lucide-react";

// Fetcher leve: usa /casos/resumo — retorna apenas contagens (sem PII)
const fetcherResumo = async (url) => {
  try {
    const response = await authFetch(url);
    if (!response.ok) throw new Error("Erro ao buscar dados do resumo.");
    return await response.json();
  } catch (error) {
    throw new Error(error.message || String(error));
  }
};

const fetcherCasos = async (url) => {
  try {
    const response = await authFetch(url);
    if (!response.ok) throw new Error("Erro ao buscar lista de casos.");
    return await response.json();
  } catch (error) {
    throw new Error(error.message || String(error));
  }
};

const statusStyles = {
  aguardando_documentos: "bg-amber-100 text-amber-800 border-amber-200",
  documentacao_completa: "bg-highlight/15 text-highlight border-highlight/30",
  processando_ia: "bg-indigo-100 text-indigo-800 border-indigo-200",
  pronto_para_analise: "bg-green-100 text-green-800 border-green-200",
  em_atendimento: "bg-blue-100 text-blue-800 border-blue-200",
  liberado_para_protocolo: "bg-purple-100 text-purple-800 border-purple-200",
  em_protocolo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  protocolado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  erro_processamento: "bg-red-100 text-red-800 border-red-200",
  default: "bg-slate-100 text-slate-700 border-slate-200",
};

const normalizeStatus = (status) => (status || "recebido").toLowerCase().trim();

const summaryFilterLabels = {
  aguardando_documentos: "casos aguardando documentos",
  documentacao_completa: "casos com documentação completa",
  pronto_para_analise: "casos prontos para análise",
  em_atendimento: "casos em atendimento",
  liberado_para_protocolo: "casos liberados para protocolo",
  protocolado: "casos protocolados",
  meus: "meus atendimentos",
};

const filterMapping = {
  aguardando_documentos: ["aguardando_documentos"],
  documentacao_completa: ["documentacao_completa"],
  pronto_para_analise: ["pronto_para_analise"],
  em_atendimento: ["em_atendimento"],
  liberado_para_protocolo: ["liberado_para_protocolo"],
  em_protocolo: ["em_protocolo"],
  protocolado: ["protocolado"],
};

export const Dashboard = () => {
  const { token, user, notificacoes, marcarNotificacaoLida, permissions } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [processingAssistencia, setProcessingAssistencia] = useState({});

  const [isSidebarMinimized, setIsSidebarMinimized] = useState(() => {
    return localStorage.getItem("dashboard_sidebar_minimized") === "true";
  });

  const toggleSidebar = () => {
    setIsSidebarMinimized((prev) => {
      const newState = !prev;
      localStorage.setItem("dashboard_sidebar_minimized", newState);
      return newState;
    });
  };

  // Filtra notificações não lidas e solicitações de assistência pendentes
  const alertasAtivos = useMemo(() => {
    return notificacoes.filter((n) => !n.lida);
  }, [notificacoes]);

  // ✅ Leve: só contagens, nenhum dado pessoal trafega
  const {
    data: resumo,
    error: resumoError,
    isLoading: resumoLoading,
  } = useSWR(token ? "/casos/resumo" : null, fetcherResumo, {
    revalidateOnFocus: false,
    dedupingInterval: 10000, // 10 segundos
  });

  // Chave dinâmica para SWR: busca filtrada ou os 10 recentes
  const casosUrl = useMemo(() => {
    if (!token) return null;
    if (statusFilter === "meus") return "/casos?meusAtendimentos=true";
    if (statusFilter && filterMapping[statusFilter]) {
      return `/casos?status=${filterMapping[statusFilter].join(",")}`;
    }
    return "/casos?limite=10";
  }, [token, statusFilter]);

  // Lista de casos (filtrada no servidor ou recente)
  const { data: casosSource = [], error: casosError } = useSWR(
    casosUrl,
    fetcherCasos,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    },
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const contagens = resumo?.contagens || {};

  // Paginação e formatação da lista (que já vem filtrada do servidor)
  const [casosFiltered, totalPages] = useMemo(() => {
    if (!casosSource || !Array.isArray(casosSource)) return [[], 0];

    // Se não houver filtro, pegamos os 6 primeiros para o visual "limpo" do Dashboard
    const dataToDisplay = !statusFilter ? casosSource.slice(0, 6) : casosSource;

    const pages = Math.ceil(dataToDisplay.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    return [dataToDisplay.slice(start, start + itemsPerPage), pages];
  }, [casosSource, statusFilter, currentPage]);

  const handleSummaryClick = (key) => {
    setStatusFilter((previous) => (previous === key ? null : key));
  };

  const handleResponderAssistencia = async (alerta, aceito) => {
    setProcessingAssistencia((prev) => ({
      ...prev,
      [alerta.id]: aceito ? "accepting" : "rejecting",
    }));
    try {
      const response = await authFetch(`/casos/assistencia/${alerta.referencia_id}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aceito }),
      });

      if (!response.ok) throw new Error("Falha ao responder à assistência.");

      await marcarNotificacaoLida(alerta.id);

      if (aceito && alerta.link) {
        navigate(alerta.link);
      } else {
        toast.success("Solicitação recusada com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao responder assistência:", error);
      toast.error("Erro ao processar assistência. Tente novamente.");
    } finally {
      setProcessingAssistencia((prev) => ({ ...prev, [alerta.id]: null }));
    }
  };

  if (resumoError || casosError) {
    const isAuthError =
      resumoError?.message === "Sessão expirada" ||
      casosError?.message === "Sessão expirada" ||
      resumoError?.status === 401 ||
      casosError?.status === 401;

    if (isAuthError) return null;

    return (
      <div className="card border-l-4 border-l-red-500 text-red-600">
        Erro ao carregar o painel. Tente recarregar a página.
      </div>
    );
  }

  const isJuridico = ["defensor", "coordenador", "gestor"].includes(user?.cargo?.toLowerCase());
  const prefixo = isJuridico ? "Dr(a). " : "";

  return (
    <div
      className={`dashboard-grid ${isSidebarMinimized ? "lg:grid-cols-[1fr_80px]" : "lg:grid-cols-[1fr_350px]"}`}
    >
      {/* COLUNA PRINCIPAL */}
      <div className="space-y-8">
        <section className="hero-gradient p-8 rounded-4xl text-white">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="heading-hero mt-2">
                Olá, {prefixo}
                {user?.nome || "Usuário"}
              </h1>
              <p className="text-bg max-w-2xl mt-2">
                Acompanhe os casos recebidos pelo Mães em Ação.
              </p>
            </div>
            <Link
              to="/painel/casos"
              className="btn btn-ghost border border-white/40 text-white bg-white/10 hover:bg-white/20"
            >
              Ver todos os casos
            </Link>
          </div>
        </section>

        {/* BANNERS DE SUPORTE (Treinamento & Guia) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* BANNER DE TREINAMENTO */}
          <section className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 p-6 rounded-4xl flex flex-col md:flex-row items-center gap-6 shadow-xl shadow-primary/5">
            <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/40 shrink-0">
              <GraduationCap size={32} />
            </div>
            <div className="grow space-y-1 text-center md:text-left">
              <h2 className="text-xl font-black text-main flex items-center justify-center md:justify-start gap-2 uppercase tracking-tight">
                Extensão Solar
              </h2>
              <p className="text-muted text-sm font-medium">Vídeo e informações sobre a extensão</p>
            </div>
            <Link
              to="/painel/treinamentos"
              className="btn btn-primary px-6 py-2.5 rounded-2xl whitespace-nowrap shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
            >
              Acessar
            </Link>
          </section>

          {/* BANNER DO GUIA OPERACIONAL */}
          <section className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border border-primary/30 p-6 rounded-4xl flex flex-col md:flex-row items-center gap-6 shadow-xl shadow-primary/5">
            <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/40 shrink-0">
              <BookOpen size={32} />
            </div>
            <div className="grow space-y-1 text-center md:text-left">
              <h2 className="text-xl font-black text-main flex items-center justify-center md:justify-start gap-2 uppercase tracking-tight">
                Guia Operacional
                <span className="bg-highlight text-[10px] text-white px-2 py-0.5 rounded-full animate-bounce">
                  NOVO
                </span>
              </h2>
              <p className="text-muted text-sm font-medium">
                Manual de triagem, campos críticos e fluxo passo a passo.
              </p>
            </div>
            <Link
              to="/painel/guia"
              className="btn btn-primary px-6 py-2.5 rounded-2xl whitespace-nowrap shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
            >
              Ver Guia
            </Link>
          </section>
        </div>

        {/* Atalhos Rápidos para Gestão e Relatórios */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {permissions.canManageTeam && (
            <Link
              to="/painel/equipe"
              className="card p-6 flex items-center gap-4 hover:shadow-lg transition-all group border border-soft/50"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <Users size={28} />
              </div>
              <div>
                <h3 className="font-bold text-main 2xl:text-xl">Gerenciar Equipe</h3>
                <p className="text-sm text-muted 2xl:text-base">Membros e unidades.</p>
              </div>
            </Link>
          )}
          {permissions.canViewBi && (
            <Link
              to="/painel/relatorios"
              className="card p-6 flex items-center gap-4 hover:shadow-lg transition-all group border border-soft/50"
            >
              <div className="w-14 h-14 rounded-2xl bg-highlight/10 flex items-center justify-center text-highlight group-hover:bg-highlight group-hover:text-white transition-all duration-300">
                <FileText size={28} />
              </div>
              <div>
                <h3 className="font-bold text-main 2xl:text-xl">Relatórios BI</h3>
                <p className="text-sm text-muted 2xl:text-base">Indicadores e produtividade.</p>
              </div>
            </Link>
          )}
          {permissions.canEditConfig && (
            <Link
              to="/painel/configuracoes"
              className="card p-6 flex items-center gap-4 hover:shadow-lg transition-all group border border-soft/50"
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                <Settings size={28} />
              </div>
              <div>
                <h3 className="font-bold text-main 2xl:text-xl">Configurações</h3>
                <p className="text-sm text-muted 2xl:text-base">Horários e sistema.</p>
              </div>
            </Link>
          )}
        </div>

        <section className="dashboard-summary-grid">
          {[
            {
              key: "meus",
              label: "Meus Atendimentos",
              value: contagens.meus || 0,
              helper: "Casos atribuídos a você.",
              icon: User,
              accent: "text-primary",
            },
            {
              key: "aguardando_documentos",
              label: "Aguardando Docs",
              value: contagens.aguardando_documentos || 0,
              helper: "Faltam documentos.",
              icon: AlertTriangle,
              accent: "text-amber-500",
            },
            {
              key: "documentacao_completa",
              label: "Docs. Completos",
              value: contagens.documentacao_completa || 0,
              helper: "Pronto para triagem.",
              icon: Bell,
              accent: "text-highlight",
            },
            {
              key: "pronto_para_analise",
              label: "Prontos (IA)",
              value: contagens.pronto_para_analise || 0,
              helper: "Aguardando revisão.",
              icon: Inbox,
              accent: "text-primary",
            },
            {
              key: "em_atendimento",
              label: "Em Atendimento",
              value: contagens.em_atendimento || 0,
              helper: "Sendo trabalhados.",
              icon: Clock,
              accent: "text-blue-500",
            },
            {
              key: "liberado_para_protocolo",
              label: "Lib. Protocolo",
              value: contagens.liberado_para_protocolo || 0,
              helper: "Prontos para envio.",
              icon: CheckCircle2,
              accent: "text-purple-500",
            },
            {
              key: "protocolado",
              label: "Protocolados",
              value: contagens.protocolado || 0,
              helper: "Finalizados no Solar.",
              icon: CheckCircle2,
              accent: "text-emerald-500",
            },
          ].map(({ key, label, value, helper, icon, accent }) => {
            const active = statusFilter === key;
            return (
              <button
                type="button"
                key={key}
                onClick={() => handleSummaryClick(key)}
                aria-pressed={active}
                className={`summary-card ${active ? "active" : ""}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="card-label">{label}</p>
                    <p className="card-value">
                      {resumoLoading ? (
                        <span className="inline-block w-8 h-8 bg-soft animate-pulse rounded" />
                      ) : (
                        value
                      )}
                    </p>
                  </div>
                  {React.createElement(icon, { size: 20, className: `${accent} 2xl:w-6 2xl:h-6` })}
                </div>
                <p className="card-helper">{helper}</p>
              </button>
            );
          })}
        </section>

        <section className="card p-0 overflow-hidden shadow-md">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-soft px-6 py-5">
            <div>
              <h2 className="heading-2 2xl:text-2xl">Casos mais recentes</h2>
              {statusFilter && (
                <p className="text-sm 2xl:text-base mt-1 flex items-center gap-2">
                  Filtrando por {summaryFilterLabels[statusFilter]}.
                  <button
                    type="button"
                    onClick={() => setStatusFilter(null)}
                    className="underline text-xs 2xl:text-sm font-semibold hover:text-primary"
                  >
                    Limpar
                  </button>
                </p>
              )}
            </div>
            <Link to="/painel/casos" className="btn btn-secondary btn-sm 2xl:btn-md">
              Ver todos
            </Link>
          </div>

          {casosSource.length === 0 ? (
            <div className="p-8 text-muted text-center 2xl:text-lg">Nenhum caso encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted uppercase text-[10px] 2xl:text-xs tracking-wider border-b border-soft">
                    <th className="px-6 py-4 text-left font-bold">Assistida / Representante</th>
                    <th className="px-6 py-4 text-left font-bold">Data</th>
                    <th className="px-6 py-4 text-left font-bold">Responsável</th>
                    <th className="px-6 py-4 text-left font-bold">Status</th>
                    <th className="px-6 py-4 text-right font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-soft">
                  {casosFiltered.map((caso) => {
                    const statusKey = normalizeStatus(caso.status);
                    const badgeStyle = statusStyles[statusKey] || statusStyles.default;
                    return (
                      <tr
                        key={caso.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/painel/casos/${caso.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            navigate(`/painel/casos/${caso.id}`);
                        }}
                        className={`group cursor-pointer transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${caso.compartilhado ? "bg-purple-500/5" : ""}`}
                      >
                        {/* NOME / REPRESENTANTE */}
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            {caso.compartilhado && (
                              <Users
                                size={16}
                                className="text-highlight shrink-0"
                                title="Caso Compartilhado"
                              />
                            )}
                            <div>
                              <p className="font-bold text-main 2xl:text-xl leading-tight">
                                {caso.nome_assistido}
                              </p>
                              {caso.nome_representante && (
                                <p className="text-[11px] 2xl:text-sm text-primary-600 font-bold mt-1">
                                  Representante: {caso.nome_representante}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* DATA */}
                        <td className="px-6 py-5 whitespace-nowrap text-muted 2xl:text-base font-medium">
                          {new Date(caso.created_at).toLocaleDateString("pt-BR")}
                        </td>

                        {/* RESPONSÁVEL */}
                        <td className="px-6 py-5 whitespace-nowrap">
                          {caso.defensor || caso.servidor ? (
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-1.5 rounded-full ${
                                  caso.defensor_id === user?.id || caso.servidor_id === user?.id
                                    ? "badge-meu"
                                    : "badge-bloqueado"
                                }`}
                              >
                                {caso.defensor_id === user?.id || caso.servidor_id === user?.id ? (
                                  <User size={14} />
                                ) : (
                                  <Lock size={14} />
                                )}
                              </div>
                              <span className="text-xs 2xl:text-base font-bold text-main">
                                {caso.defensor_id === user?.id || caso.servidor_id === user?.id
                                  ? "Meu"
                                  : (caso.defensor?.nome || caso.servidor?.nome || "").split(
                                      " ",
                                    )[0]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] 2xl:text-sm text-muted italic font-medium">
                              Disponível
                            </span>
                          )}
                        </td>

                        {/* STATUS */}
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] 2xl:text-xs font-bold border ${badgeStyle} uppercase tracking-wider`}
                          >
                            {statusKey.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* AÇÃO */}
                        <td className="px-6 py-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2 text-primary hover:text-primary-600 font-bold 2xl:text-lg transition-transform group-hover:translate-x-1">
                            <Eye size={18} className="2xl:w-6 2xl:h-6" />
                            Ver detalhes
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {statusFilter && totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 py-6 border-t border-soft">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn btn-ghost btn-sm 2xl:btn-md"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm 2xl:text-lg text-muted font-semibold">
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-ghost btn-sm 2xl:btn-md"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </section>
      </div>

      {/* SIDEBAR DE ALERTAS */}
      <aside className={`alert-sidebar ${isSidebarMinimized ? "w-16" : "w-full"}`}>
        <div className="flex items-center justify-between px-2">
          {!isSidebarMinimized && (
            <h2 className="heading-2 flex items-center gap-2 text-base 2xl:text-xl">
              <Bell size={18} className="text-primary 2xl:w-6 2xl:h-6" />
              Alertas e Avisos
            </h2>
          )}
          <button
            onClick={toggleSidebar}
            className={`p-2 rounded-xl hover:bg-soft transition-colors text-muted hover:text-primary ${isSidebarMinimized ? "mx-auto" : ""}`}
            title={isSidebarMinimized ? "Expandir" : "Minimizar"}
          >
            {isSidebarMinimized ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {!isSidebarMinimized && (
          <>
            {alertasAtivos.length > 0 && (
              <div className="flex justify-center mb-4">
                <span className="bg-red-500 text-white text-[10px] 2xl:text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                  {alertasAtivos.length} {alertasAtivos.length === 1 ? "pendente" : "pendentes"}
                </span>
              </div>
            )}

            {resumo?.temCasoOcioso && (
              <div className="card border-l-4 border-l-amber-500 bg-amber-50 p-4 shadow-sm animate-pulse">
                <div className="flex gap-3">
                  <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Atendimentos Ociosos</p>
                    <p className="text-xs text-amber-800 mt-1">
                      Existem casos parados há mais de 20 minutos.
                    </p>
                    <Link
                      to="/painel/casos"
                      className="text-xs font-bold text-amber-900 underline mt-2 block hover:text-amber-700"
                    >
                      Ver Fila
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {alertasAtivos.length === 0 && !resumo?.temCasoOcioso ? (
                <div className="text-center py-12 bg-surface rounded-2xl border border-soft border-dashed">
                  <CheckCircle2 size={32} className="mx-auto text-soft mb-3 2xl:w-10 2xl:h-10" />
                  <p className="text-sm text-muted 2xl:text-base">Nenhum alerta pendente.</p>
                </div>
              ) : (
                alertasAtivos.map((alerta) => (
                  <div
                    key={alerta.id}
                    className={`alert-card ${
                      alerta.tipo === "assistencia" ? "border-l-purple-500" : "border-l-primary"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span
                        className={`text-[10px] 2xl:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          alerta.tipo === "assistencia"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {alerta.tipo === "assistencia" ? "Colaboração" : "Notificação"}
                      </span>
                      <button
                        onClick={() => marcarNotificacaoLida(alerta.id)}
                        className="text-muted hover:text-primary transition-colors p-1 rounded-full hover:bg-soft"
                        title="Marcar como lida"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    </div>
                    <h4 className="text-sm 2xl:text-base font-bold leading-snug text-main">
                      {alerta.titulo}
                    </h4>
                    <p className="text-xs 2xl:text-sm text-muted mt-2 leading-relaxed">
                      {alerta.mensagem}
                    </p>

                    {alerta.tipo === "assistencia" ? (
                      <div className="flex gap-3 mt-4">
                        <button
                          onClick={() => handleResponderAssistencia(alerta, true)}
                          disabled={!!processingAssistencia[alerta.id]}
                          className={`btn btn-primary btn-sm flex-1 shadow-soft ${
                            processingAssistencia[alerta.id] ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          {processingAssistencia[alerta.id] === "accepting" ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          Aceitar
                        </button>
                        <button
                          onClick={() => handleResponderAssistencia(alerta, false)}
                          disabled={!!processingAssistencia[alerta.id]}
                          className={`btn btn-ghost btn-sm flex-1 border border-error/20 text-error hover:bg-error/5 shadow-soft ${
                            processingAssistencia[alerta.id] ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          {processingAssistencia[alerta.id] === "rejecting" ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <X size={14} />
                          )}
                          Recusar
                        </button>
                      </div>
                    ) : (
                      alerta.link && (
                        <Link
                          to={alerta.link}
                          className="btn btn-ghost btn-sm w-full mt-4 border border-soft hover:border-primary/30 shadow-soft"
                          onClick={() => marcarNotificacaoLida(alerta.id)}
                        >
                          Acessar Caso
                        </Link>
                      )
                    )}

                    <p className="text-[10px] 2xl:text-xs text-muted mt-4 text-right font-medium">
                      {new Date(alerta.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Footer Sidebar */}
            <div className="bg-primary/5 rounded-2xl p-4 2xl:p-6 border border-primary/10">
              <p className="text-[10px] 2xl:text-xs text-primary font-bold uppercase tracking-widest mb-1.5">
                Dica de Produtividade
              </p>
              <p className="text-xs 2xl:text-sm text-muted leading-relaxed">
                Use os filtros de status acima para focar nos casos que precisam de ação imediata.
              </p>
            </div>
          </>
        )}

        {isSidebarMinimized && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <Bell size={24} className="text-soft" />
              {alertasAtivos.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full border-2 border-white shadow-sm" />
              )}
            </div>
            {resumo?.temCasoOcioso && (
              <AlertTriangle size={24} className="text-amber-500 animate-pulse" />
            )}
          </div>
        )}
      </aside>
    </div>
  );
};

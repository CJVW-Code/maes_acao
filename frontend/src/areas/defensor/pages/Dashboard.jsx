import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import {
  FileText,
  Clock,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  PieChart,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { authFetch } from "../../../utils/apiBase";
import useSWR from "swr";

// Fetcher leve: usa /casos/resumo — retorna apenas contagens (sem PII)
const fetcherResumo = async (url) => {
  const response = await authFetch(url);
  if (!response.ok) throw new Error("Erro ao buscar dados.");
  return response.json();
};

// Fetcher completo: só é chamado na página de listagem (/painel/casos)
const fetcherCasos = async (url) => {
  const response = await authFetch(url);
  if (!response.ok) throw new Error("Erro ao buscar casos.");
  return response.json();
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
};

export const Dashboard = () => {
  const { token } = useAuth();
  const [defensor, setDefensor] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ✅ Leve: só contagens, nenhum dado pessoal trafega
  const {
    data: resumo,
    error: resumoError,
    isLoading: resumoLoading,
  } = useSWR(token ? "/casos/resumo" : null, fetcherResumo, {
    revalidateOnFocus: true,
  });

  // Lista recente: apenas os últimos casos (id, nome, protocolo, status, data)
  // Esses campos não expõem CPF nem dados sensíveis do formulário
  const {
    data: casosRecentes = [],
    error: casosError,
  } = useSWR(token ? "/casos?limite=10" : null, fetcherCasos, {
    revalidateOnFocus: true,
  });

  useEffect(() => {
    if (token) {
      const decoded = jwtDecode(token);
      setDefensor(decoded);
    }
  }, [token]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const contagens = resumo?.contagens || {};
  const stats = resumo
    ? {
        topTipos: resumo.topTipos || [],
        representacao: resumo.representacao || { representacao: 0, proprio: 0 },
      }
    : null;

  // Paginação da lista recente filtrada por status
  const [casosFiltered, totalPages] = useMemo(() => {
    if (!statusFilter) return [casosRecentes.slice(0, 6), 0];

    // Mapeamento de filtros para suportar legados se necessário, 
    // mas priorizando o enum estratégico
    const filterMapping = {
      aguardando_documentos: ["aguardando_documentos", "aguardando_docs", "recebido"],
      documentacao_completa: ["documentacao_completa", "documentos_entregues"],
      pronto_para_analise: ["pronto_para_analise", "processado"],
      em_atendimento: ["em_atendimento", "em_analise", "reuniao_agendada", "reuniao_online_agendada", "reuniao_presencial_agendada"],
      protocolado: ["protocolado", "encaminhado_solar"],
    };

    const filtered = casosRecentes.filter((c) => {
      const s = normalizeStatus(c.status);
      const targets = filterMapping[statusFilter] || [statusFilter];
      return targets.includes(s);
    });

    const pages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    return [filtered.slice(start, start + itemsPerPage), pages];
  }, [casosRecentes, statusFilter, currentPage]);

  const handleSummaryClick = (key) => {
    setStatusFilter((previous) => (previous === key ? null : key));
  };

  if (resumoError || casosError) {
    return (
      <div className="card border-l-4 border-l-red-500 text-red-600">
        Erro ao carregar o painel. Tente recarregar a página.
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      <section
        className="card text-white shadow-lg border-none relative overflow-hidden bg-primary"
        style={{
          background:
            "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 60%, #0b67a3 100%)",
        }}
      >
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/70">
              Painel atualizado
            </p>
            <h1 className="heading-hero mt-2">
              Olá, {defensor?.cargo === "defensor" ? "Dr(a). " : ""}
              {defensor?.nome || "Usuário"}
            </h1>
            <p className="text-white/80 max-w-2xl mt-2">
              Acompanhe os casos recebidos pelo Assistente Def Sul, identifique
              pendências de documentos e avance nos atendimentos com conforto
              visual inspirado pelo nosso novo design system.
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[
          {
            key: "aguardando_documentos",
            label: "Aguardando Docs",
            value: contagens.aguardando_documentos || 0,
            helper: "Faltam documentos do cidadão.",
            icon: AlertTriangle,
            accent: "text-amber-500",
          },
          {
            key: "documentacao_completa",
            label: "Docs. Completos",
            value: contagens.documentacao_completa || 0,
            helper: "Tudo pronto para triagem.",
            icon: Bell,
            accent: "text-highlight",
          },
          {
            key: "pronto_para_analise",
            label: "Prontos (IA)",
            value: contagens.pronto_para_analise || 0,
            helper: "Aguardando revisão humana.",
            icon: Inbox,
            accent: "text-primary",
          },
          {
            key: "em_atendimento",
            label: "Em Atendimento",
            value: contagens.em_atendimento || 0,
            helper: "Sendo trabalhados pela equipe.",
            icon: Clock,
            accent: "text-blue-500",
          },
          {
            key: "liberado_para_protocolo",
            label: "Lib. Protocolo",
            value: contagens.liberado_para_protocolo || 0,
            helper: "Prontos para envio final.",
            icon: CheckCircle2,
            accent: "text-purple-500",
          },
          {
            key: "protocolado",
            label: "Protocolados",
            value: contagens.protocolado || 0,
            helper: "Finalizados no Solar/TJ.",
            icon: CheckCircle2,
            accent: "text-emerald-500",
          },
        ].map(({ key, label, value, helper, icon: Icon, accent }) => {
          const active = statusFilter === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => handleSummaryClick(key)}
              aria-pressed={active}
              className={`card text-left transition-all border-l-4 ${
                active
                  ? "border-l-primary shadow-xl ring-2 ring-primary/30 -translate-y-0.5"
                  : "border-l-transparent hover:border-l-primary/60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{label}</p>
                  <p className="text-3xl font-semibold">
                    {resumoLoading ? (
                      <span className="inline-block w-8 h-7 bg-soft animate-pulse rounded" />
                    ) : (
                      value
                    )}
                  </p>
                </div>
                <Icon className={accent} />
              </div>
              <p className="text-sm text-muted mt-2">{helper}</p>
              <span
                className={`mt-4 inline-flex items-center text-xs font-semibold ${
                  active ? "text-primary" : "text-muted"
                }`}
              >
                {active ? "Filtro aplicado" : "Clique para filtrar"}
              </span>
            </button>
          );
        })}
      </section>

      {/* --- SEÇÃO DE INTELIGÊNCIA DE DADOS --- */}
      {/* Exibe apenas para ADMIN */}
      {stats && defensor?.cargo === "admin" && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="card space-y-4 hover:scale-[1.02] transition-transform duration-300 cursor-default border-l-4 border-l-primary">
            <div className="flex items-center gap-2 text-primary">
              <BarChart3 size={20} />
              <h3 className="font-bold uppercase tracking-wider text-xs">
                Demandas Recorrentes
              </h3>
            </div>
            <div className="space-y-3">
              {stats.topTipos.map(({ tipo, qtd }, idx) => (
                <div key={tipo} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-muted text-sm">
                      0{idx + 1}
                    </span>
                    <span className="font-medium">{tipo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-soft rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${contagens.total ? (qtd / contagens.total) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm text-muted">{qtd}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-4 hover:scale-[1.02] transition-transform duration-300 cursor-default border-l-4 border-l-purple-500">
            <div className="flex items-center gap-2 text-purple-400">
              <PieChart size={20} />
              <h3 className="font-bold uppercase tracking-wider text-xs">
                Perfil do Atendimento
              </h3>
            </div>
            <div className="flex items-center justify-center h-full gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-white">
                  {stats.representacao.representacao}
                </p>
                <p className="text-xs text-muted uppercase mt-1">
                  Representando
                  <br />
                  Menores
                </p>
              </div>
              <div className="w-px h-12 bg-soft"></div>
              <div className="text-center">
                <p className="text-3xl font-bold text-white">
                  {stats.representacao.proprio}
                </p>
                <p className="text-xs text-muted uppercase mt-1">
                  Em causa
                  <br />
                  própria
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card p-0 overflow-hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-soft px-6 py-4">
          <div>
            <h2 className="heading-2">Casos mais recentes</h2>
            <p className="text-sm text-muted">
              Últimos atendimentos enviados pelo portal do cidadão.
            </p>
            {statusFilter && (
              <p className="text-sm mt-1 flex items-center gap-2">
                Mostrando apenas {summaryFilterLabels[statusFilter]}.
                <button
                  type="button"
                  onClick={() => setStatusFilter(null)}
                  className="underline text-xs font-semibold"
                >
                  Limpar filtro
                </button>
              </p>
            )}
          </div>
          <Link to="/painel/casos" className="btn btn-secondary text-sm">
            Gerenciar todos
          </Link>
        </div>

        {casosRecentes.length === 0 ? (
          <div className="p-6 text-muted text-center">
            Nenhum caso pendente no momento.
          </div>
        ) : (
          <ul className="divide-y divide-soft">
            {casosFiltered.map((caso) => {
              const statusKey = normalizeStatus(caso.status);
              const badgeStyle =
                statusStyles[statusKey] || statusStyles.default;
              return (
                <li key={caso.id}>
                  <Link
                    to={`/painel/casos/${caso.id}`}
                    className="block px-6 py-4 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="heading-3 leading-tight">{caso.nome_assistido}</p>
                          {caso.nome_representante && (
                            <p className="text-sm font-bold text-primary-600 mt-1 mb-1">
                              Representante: {caso.nome_representante}
                            </p>
                          )}
                          <p className="text-sm text-muted">
                            Protocolo: {caso.protocolo}
                            {caso.numero_solar && (
                              <span className="text-primary font-medium border-l border-soft pl-2 ml-2">
                                Solar: {caso.numero_solar}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 md:items-center">
                        <span className={`badge ${badgeStyle}`}>
                          {statusKey.replace("_", " ")}
                        </span>
                        <div className="flex items-center gap-2 text-sm text-muted">
                          <Clock size={16} />
                          {new Date(caso.created_at).toLocaleDateString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "short",
                            },
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {statusFilter && totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 py-4 border-t border-soft">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn btn-ghost btn-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-muted">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-ghost btn-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

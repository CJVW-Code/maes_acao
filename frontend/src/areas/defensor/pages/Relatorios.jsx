import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Download, FileSpreadsheet, FileText, Filter, RefreshCw, Settings2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useBiData } from "../hooks/useBiData";
import { authFetch } from "../../../utils/apiBase";

const COLORS = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-special)",
  "var(--color-success)",
  "var(--color-laranja)",
  "var(--color-highlight)",
];

const widgetLabels = {
  kpiCards: "Cards de indicadores",
  statusPie: "Distribuicao por status",
  tiposBars: "Tipos de acao",
  throughputLine: "Throughput diario",
  rankingUnidades: "Ranking de sedes",
  arquivados: "Arquivados",
};

const numberFormat = new Intl.NumberFormat("pt-BR");

const formatSeconds = (seconds) => {
  if (seconds === null || seconds === undefined) return "N/A";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.round(seconds / 60)}min`;
};

const BiWidget = ({ id, title, subtitle, enabled, onToggle, children }) => {
  if (!enabled) return null;

  return (
    <section className="card-solid p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="heading-2">{title}</h2>
          {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => onToggle(id)}
          className="btn btn-ghost btn-sm"
          data-bi-export-hidden="true"
        >
          Ocultar
        </button>
      </div>
      {children}
    </section>
  );
};

const EmptyState = () => (
  <div className="card-solid p-10 text-center">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
      <BarChart3 size={32} />
    </div>
    <h2 className="heading-2">Configure os filtros e gere o relatorio</h2>
    <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
      O modulo de BI consolida apenas metadados operacionais, sem CPF, nomes de assistidas ou dados pessoais.
    </p>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-soft bg-surface p-3 shadow-xl">
      <p className="text-xs font-bold text-main">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="text-xs text-muted">
          {item.name || item.dataKey}: {numberFormat.format(item.value)}
        </p>
      ))}
    </div>
  );
};

const Relatorios = () => {
  const { user } = useAuth();
  const {
    data,
    loading,
    exporting,
    error,
    filtros,
    setFiltros,
    prefs,
    toggleWidget,
    gerar,
    exportarXlsx,
    exportarXlsxLote,
    exportarPdf,
  } = useBiData();
  const [unidades, setUnidades] = useState([]);
  const [showPrefs, setShowPrefs] = useState(false);

  const isAdmin = user?.cargo === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    authFetch("/unidades")
      .then((response) => (response.ok ? response.json() : []))
      .then((result) => setUnidades(result.filter((unidade) => unidade.ativo)))
      .catch(() => setUnidades([]));
  }, [isAdmin]);

  const kpiCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Casos ativos", value: data.kpis.ativos_total, helper: "Nao arquivados no periodo" },
      { label: "Protocolados", value: data.kpis.protocolados_periodo, helper: "Com protocolo no periodo" },
      { label: "Arquivados", value: data.kpis.arquivados_total, helper: "Encerrados sem exposicao de PII" },
      { label: "Tempo IA", value: formatSeconds(data.kpis.tempo_medio_ia_segundos), helper: "Media processada no backend" },
      { label: "Unidades", value: data.kpis.unidades_ativas, helper: "Sedes ativas cadastradas" },
      { label: "Tipos", value: data.kpis.tipos_acao, helper: "Tipos de acao distintos" },
    ];
  }, [data]);

  if (!isAdmin) {
    return <Navigate to="/painel" replace />;
  }

  const updateFiltro = (key, value) => {
    setFiltros((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6 pb-24">
      <section className="hero-gradient rounded-[2rem] p-8 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex rounded-full border border-white/40 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              35-52 sedes cobertas
            </span>
            <h1 className="heading-hero mt-4 text-white">Inteligencia de Dados</h1>
            <p className="mt-2 max-w-3xl text-bg">
              Relatorios operacionais do evento estadual com agregacoes server-side e exportacao sem dados pessoais.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" data-bi-export-hidden="true">
            <button type="button" onClick={exportarXlsx} disabled={!data || exporting} className="btn bg-white text-primary hover:bg-white/90 disabled:opacity-50">
              <FileSpreadsheet size={18} />
              XLSX
            </button>
            <button type="button" onClick={exportarPdf} disabled={!data || exporting} className="btn bg-white/15 text-white border border-white/30 hover:bg-white/25 disabled:opacity-50">
              <FileText size={18} />
              PDF
            </button>
            <button type="button" onClick={exportarXlsxLote} disabled={exporting} className="btn bg-white/15 text-white border border-white/30 hover:bg-white/25 disabled:opacity-50">
              <Download size={18} />
              Lote
            </button>
          </div>
        </div>
      </section>

      <section className="card-solid p-5 space-y-4" data-bi-export-hidden="true">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="text-primary" size={20} />
            <h2 className="heading-2">Filtros</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowPrefs((value) => !value)} className="btn btn-secondary">
              <Settings2 size={18} />
              Personalizar
            </button>
            <button type="button" onClick={gerar} disabled={loading} className="btn btn-primary">
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              {loading ? "Gerando..." : "Gerar relatorio"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-sm font-semibold text-main">
            Periodo
            <select value={filtros.periodo} onChange={(event) => updateFiltro("periodo", event.target.value)} className="input">
              <option value="hoje">Hoje</option>
              <option value="7d">Ultimos 7 dias</option>
              <option value="30d">Ultimos 30 dias</option>
              <option value="mutirao">Mutirao completo</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-main">
            Inicio
            <input type="date" value={filtros.dataInicio} onChange={(event) => updateFiltro("dataInicio", event.target.value)} disabled={filtros.periodo !== "custom"} className="input disabled:opacity-50" />
          </label>
          <label className="space-y-1 text-sm font-semibold text-main">
            Fim
            <input type="date" value={filtros.dataFim} onChange={(event) => updateFiltro("dataFim", event.target.value)} disabled={filtros.periodo !== "custom"} className="input disabled:opacity-50" />
          </label>
          <label className="space-y-1 text-sm font-semibold text-main">
            Unidade
            <select value={filtros.unidade_id} onChange={(event) => updateFiltro("unidade_id", event.target.value)} className="input">
              <option value="todas">Todas</option>
              {unidades.map((unidade) => (
                <option key={unidade.id} value={unidade.id}>
                  {unidade.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-main">
            Top N
            <select value={filtros.topN} onChange={(event) => updateFiltro("topN", event.target.value)} className="input">
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value="todos">Todos</option>
            </select>
          </label>
        </div>

        {showPrefs && (
          <div className="grid gap-2 rounded-2xl border border-soft bg-primary/5 p-4 md:grid-cols-3">
            {Object.entries(widgetLabels).map(([id, label]) => (
              <label key={id} className="flex items-center gap-2 text-sm font-semibold text-main">
                <input type="checkbox" checked={prefs.widgets[id]} onChange={() => toggleWidget(id)} className="h-4 w-4 accent-primary" />
                {label}
              </label>
            ))}
          </div>
        )}
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      {!data ? (
        <EmptyState />
      ) : (
        <div id="bi-panel-root" className="space-y-6">
          {data.warning && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">{data.warning}</div>}

          <BiWidget id="kpiCards" title="Indicadores principais" enabled={prefs.widgets.kpiCards} onToggle={toggleWidget}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              {kpiCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-soft bg-app/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">{card.label}</p>
                  <p className="mt-2 text-3xl font-extrabold text-main">{typeof card.value === "number" ? numberFormat.format(card.value) : card.value}</p>
                  <p className="mt-2 text-xs text-muted">{card.helper}</p>
                </div>
              ))}
            </div>
          </BiWidget>

          <div className="grid gap-6 xl:grid-cols-2">
            <BiWidget id="statusPie" title="Distribuicao por status" subtitle="Casos ativos por etapa operacional." enabled={prefs.widgets.statusPie} onToggle={toggleWidget}>
              <div className="h-80 min-h-80 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.ativos.por_status} dataKey="qtd" nameKey="status" outerRadius={110} label>
                      {data.ativos.por_status.map((entry, index) => (
                        <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </BiWidget>

            <BiWidget id="tiposBars" title="Tipos de acao" subtitle="Ranking sem dados pessoais." enabled={prefs.widgets.tiposBars} onToggle={toggleWidget}>
              <div className="h-80 min-h-80 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.ativos.por_tipo} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="tipo" width={140} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="qtd" name="Quantidade" fill="var(--color-primary)" radius={[0, 10, 10, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </BiWidget>
          </div>

          <BiWidget id="throughputLine" title="Throughput diario" subtitle="Triagens criadas versus casos protocolados." enabled={prefs.widgets.throughputLine} onToggle={toggleWidget}>
            <div className="h-80 min-h-80 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.throughput}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="triagens" name="Triagens" stroke="var(--color-primary)" strokeWidth={3} />
                  <Line type="monotone" dataKey="protocolados" name="Protocolados" stroke="var(--color-success)" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </BiWidget>

          <div className="grid gap-6 xl:grid-cols-2">
            <BiWidget id="rankingUnidades" title="Ranking de sedes" subtitle="Protocolados por unidade." enabled={prefs.widgets.rankingUnidades} onToggle={toggleWidget}>
              <div className="space-y-3">
                {data.ranking_unidades.map((item, index) => (
                  <div key={item.unidade_id} className="flex items-center justify-between rounded-2xl border border-soft bg-app/60 p-3">
                    <div>
                      <p className="font-bold text-main">{index + 1}. {item.unidade}</p>
                      <p className="text-xs text-muted">Protocolados no periodo</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{item.qtd}</span>
                  </div>
                ))}
                {data.ranking_unidades.length === 0 && <p className="text-sm text-muted">Nenhum protocolo no periodo.</p>}
              </div>
            </BiWidget>

            <BiWidget id="arquivados" title="Arquivados" subtitle="Motivos agregados, sem exposicao individual." enabled={prefs.widgets.arquivados} onToggle={toggleWidget}>
              <div className="space-y-3">
                <div className="rounded-2xl bg-app/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Total arquivado</p>
                  <p className="mt-1 text-3xl font-extrabold text-main">{numberFormat.format(data.arquivados.total)}</p>
                </div>
                {data.arquivados.por_motivo.map((item) => (
                  <div key={item.motivo} className="flex items-center justify-between border-b border-soft py-2 text-sm">
                    <span className="font-semibold text-main">{item.motivo}</span>
                    <span className="text-muted">{item.qtd}</span>
                  </div>
                ))}
              </div>
            </BiWidget>
          </div>
        </div>
      )}
    </div>
  );
};

export default Relatorios;

import ExcelJS from "exceljs";
import { prisma } from "../config/prisma.js";
import { supabase, isSupabaseConfigured } from "../config/supabase.js";
import logger from "../utils/logger.js";

const DEFAULT_TOP_N = 10;
const PAGE_SIZE = 1000;

const DEFAULT_WIDGETS = {
  kpiCards: true,
  statusPie: true,
  tiposBars: true,
  throughputLine: true,
  rankingUnidades: true,
  arquivados: true,
};

const ARCHIVE_REASON_LABELS = {
  duplicidade: "Duplicidade",
  desistencia: "Desistencia",
  dados_inconsistentes: "Dados inconsistentes",
  fora_do_escopo: "Fora do escopo",
  outro: "Outro",
};

const stringifyBigInts = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(stringifyBigInts);
  if (typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, stringifyBigInts(value)]));
  }
  return obj;
};

const toDateOnly = (date) => new Date(date).toISOString().slice(0, 10);

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const buildDateRange = ({ periodo = "7d", dataInicio, dataFim } = {}) => {
  const now = new Date();
  if (periodo === "mutirao") return { periodo, range: null, warning: null };
  if (periodo === "hoje") return { periodo, range: { gte: startOfDay(now), lte: endOfDay(now) }, warning: null };
  if (periodo === "30d") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 30);
    return { periodo, range: { gte: start, lte: endOfDay(now) }, warning: null };
  }
  if (periodo === "custom") {
    if (!dataInicio || !dataFim) {
      const start = startOfDay(now);
      start.setDate(start.getDate() - 30);
      return {
        periodo: "30d",
        range: { gte: start, lte: endOfDay(now) },
        warning: "Periodo customizado sem datas validas; fallback para 30d.",
      };
    }
    return {
      periodo,
      range: { gte: startOfDay(dataInicio), lte: endOfDay(dataFim) },
      warning: null,
    };
  }

  const start = startOfDay(now);
  start.setDate(start.getDate() - 7);
  return { periodo: "7d", range: { gte: start, lte: endOfDay(now) }, warning: null };
};

const normalizeTopN = (topN) => {
  if (topN === "todos") return null;
  const parsed = Number(topN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOP_N;
};

const applyTopN = (items, topN) => {
  const normalized = normalizeTopN(topN);
  if (!normalized) return items;
  return items.slice(0, normalized);
};

const increment = (map, key, amount = 1) => {
  const safeKey = key || "Nao informado";
  map.set(safeKey, (map.get(safeKey) || 0) + amount);
};

const mapToSortedArray = (map, keyName = "label") =>
  Array.from(map.entries())
    .map(([key, qtd]) => ({ [keyName]: key, qtd }))
    .sort((a, b) => b.qtd - a.qtd);

const filterByDate = (row, field, range) => {
  if (!range) return true;
  const value = row[field] ? new Date(row[field]) : null;
  if (!value) return false;
  if (range.gte && value < range.gte) return false;
  if (range.lte && value > range.lte) return false;
  return true;
};

const buildPrismaWhere = ({ range, unidadeId, arquivado = false, dateField = "created_at" }) => {
  const where = { arquivado };
  if (unidadeId && unidadeId !== "todas") where.unidade_id = unidadeId;
  if (range) where[dateField] = { gte: range.gte, lte: range.lte };
  return where;
};

const fetchCasosMetadata = async ({ range, unidadeId }) => {
  const columns = "status,tipo_acao,unidade_id,arquivado,motivo_arquivamento,created_at,updated_at,protocolado_at,processed_at,processing_started_at";

  if (isSupabaseConfigured) {
    const rows = [];
    let from = 0;

    while (true) {
      let query = supabase.from("casos").select(columns).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);

      if (unidadeId && unidadeId !== "todas") query = query.eq("unidade_id", unidadeId);

      if (range) {
        const start = range.gte.toISOString();
        const end = range.lte.toISOString();
        query = query.or(`and(created_at.gte.${start},created_at.lte.${end}),and(updated_at.gte.${start},updated_at.lte.${end}),and(protocolado_at.gte.${start},protocolado_at.lte.${end})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return rows;
  }

  const prismaWhere = unidadeId && unidadeId !== "todas" ? { unidade_id: unidadeId } : {};
  if (range) {
    prismaWhere.OR = [
      { created_at: { gte: range.gte, lte: range.lte } },
      { updated_at: { gte: range.gte, lte: range.lte } },
      { protocolado_at: { gte: range.gte, lte: range.lte } },
    ];
  }

  return prisma.casos.findMany({
    where: prismaWhere,
    select: {
      status: true,
      tipo_acao: true,
      unidade_id: true,
      arquivado: true,
      motivo_arquivamento: true,
      created_at: true,
      updated_at: true,
      protocolado_at: true,
      processed_at: true,
      processing_started_at: true,
    },
  });
};

const calcularTempoMedioIa = (rows, range) => {
  const duracoes = rows
    .filter((row) => row.arquivado === false && filterByDate(row, "created_at", range))
    .map((row) => {
      if (!row.processed_at || !row.processing_started_at) return null;
      const processedAt = new Date(row.processed_at).getTime();
      const startedAt = new Date(row.processing_started_at).getTime();
      if (!Number.isFinite(processedAt) || !Number.isFinite(startedAt)) return null;
      const seconds = (processedAt - startedAt) / 1000;
      return seconds >= 0 ? seconds : null;
    })
    .filter((value) => value !== null);

  if (duracoes.length === 0) return null;
  return duracoes.reduce((sum, value) => sum + value, 0) / duracoes.length;
};

const validateUnidade = async (unidadeId) => {
  if (!unidadeId || unidadeId === "todas") return null;
  const unidade = await prisma.unidades.findUnique({
    where: { id: unidadeId },
    select: { id: true, nome: true, ativo: true },
  });
  return unidade?.ativo ? unidade : null;
};

const montarRelatorio = async (body = {}, user = {}, preFetchedRows = null, preFetchedUnidades = null) => {
  const { range, periodo, warning } = buildDateRange(body);
  const topN = body.topN ?? DEFAULT_TOP_N;
  const requestedUnidade = body.unidade_id || "todas";
  const unidadeId = user.cargo === "admin" ? requestedUnidade : user.unidade_id;

  const unidadeValida = await validateUnidade(unidadeId);
  if (unidadeId !== "todas" && !unidadeValida) {
    const error = new Error("Unidade invalida ou inativa.");
    error.statusCode = 400;
    throw error;
  }

  const unidades = preFetchedUnidades || await prisma.unidades.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, comarca: true },
    orderBy: { nome: "asc" },
  });

  const rows = preFetchedRows 
    ? preFetchedRows.filter(r => unidadeId === "todas" || r.unidade_id === unidadeId) 
    : await fetchCasosMetadata({ range, unidadeId });

  const tempoMedioIa = calcularTempoMedioIa(rows, range);
  const unidadeNomeById = new Map(unidades.map((unidade) => [unidade.id, unidade.nome]));
  const ativos = rows.filter((row) => row.arquivado === false && filterByDate(row, "created_at", range));
  const arquivados = rows.filter((row) => row.arquivado === true && filterByDate(row, "updated_at", range));
  const protocolosNoPeriodo = rows.filter((row) => row.status === "protocolado" && filterByDate(row, "protocolado_at", range));

  const porStatusMap = new Map();
  const porTipoMap = new Map();
  const rankingMap = new Map();
  const triagemDiaMap = new Map();
  const protocoloDiaMap = new Map();
  const arquivadosMotivoMap = new Map();
  const arquivadosTipoMap = new Map();

  ativos.forEach((row) => {
    increment(porStatusMap, row.status);
    increment(porTipoMap, row.tipo_acao);
    increment(triagemDiaMap, toDateOnly(row.created_at));
  });

  protocolosNoPeriodo.forEach((row) => {
    increment(rankingMap, row.unidade_id);
    increment(protocoloDiaMap, toDateOnly(row.protocolado_at));
  });

  arquivados.forEach((row) => {
    increment(
      arquivadosMotivoMap,
      ARCHIVE_REASON_LABELS[row.motivo_arquivamento] || row.motivo_arquivamento || "Motivo nao registrado",
    );
    increment(arquivadosTipoMap, row.tipo_acao);
  });

  const dias = Array.from(new Set([...triagemDiaMap.keys(), ...protocoloDiaMap.keys()])).sort();
  const throughput = dias.map((dia) => ({
    dia,
    triagens: triagemDiaMap.get(dia) || 0,
    protocolados: protocoloDiaMap.get(dia) || 0,
  }));

  const rankingUnidades = applyTopN(mapToSortedArray(rankingMap, "unidade_id"), topN).map((item) => ({
    ...item,
    unidade: unidadeNomeById.get(item.unidade_id) || "Unidade nao identificada",
  }));

  const porStatus = mapToSortedArray(porStatusMap, "status");
  const porTipo = applyTopN(mapToSortedArray(porTipoMap, "tipo"), topN);

  return stringifyBigInts({
    gerado_em: new Date().toISOString(),
    warning,
    filtros: {
      periodo,
      dataInicio: range?.gte?.toISOString() || null,
      dataFim: range?.lte?.toISOString() || null,
      unidade_id: unidadeId,
      unidade_nome: unidadeValida?.nome || "Todas",
      topN,
    },
    kpis: {
      ativos_total: ativos.length,
      arquivados_total: arquivados.length,
      protocolados_periodo: protocolosNoPeriodo.length,
      tempo_medio_ia_segundos: tempoMedioIa,
      unidades_ativas: unidades.length,
      tipos_acao: porTipoMap.size,
    },
    ativos: {
      por_status: porStatus,
      por_tipo: porTipo,
    },
    throughput,
    ranking_unidades: rankingUnidades,
    arquivados: {
      total: arquivados.length,
      por_motivo: mapToSortedArray(arquivadosMotivoMap, "motivo"),
      por_tipo: mapToSortedArray(arquivadosTipoMap, "tipo"),
    },
    unidades,
  });
};

const addRowsSheet = (workbook, name, columns, rows) => {
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));
  sheet.commit?.();
};

const activeWidgets = (widgets = {}) => ({ ...DEFAULT_WIDGETS, ...widgets });

const preencherWorkbook = (workbook, relatorio, widgets = DEFAULT_WIDGETS) => {
  const enabled = activeWidgets(widgets);

  if (enabled.kpiCards) {
    addRowsSheet(
      workbook,
      "KPIs",
      [
        { header: "Indicador", key: "indicador", width: 34 },
        { header: "Valor", key: "valor", width: 18 },
      ],
      [
        { indicador: "Casos ativos", valor: relatorio.kpis.ativos_total },
        { indicador: "Casos arquivados", valor: relatorio.kpis.arquivados_total },
        { indicador: "Protocolados no periodo", valor: relatorio.kpis.protocolados_periodo },
        { indicador: "Tempo medio IA (s)", valor: relatorio.kpis.tempo_medio_ia_segundos ?? "N/A" },
        { indicador: "Unidades ativas", valor: relatorio.kpis.unidades_ativas },
        { indicador: "Tipos de acao", valor: relatorio.kpis.tipos_acao },
      ],
    );
  }

  if (enabled.statusPie) {
    addRowsSheet(workbook, "Status", [{ header: "Status", key: "status", width: 28 }, { header: "Qtd", key: "qtd", width: 12 }], relatorio.ativos.por_status);
  }

  if (enabled.tiposBars) {
    addRowsSheet(workbook, "Tipos", [{ header: "Tipo", key: "tipo", width: 32 }, { header: "Qtd", key: "qtd", width: 12 }], relatorio.ativos.por_tipo);
  }

  if (enabled.throughputLine) {
    addRowsSheet(
      workbook,
      "Throughput",
      [
        { header: "Dia", key: "dia", width: 16 },
        { header: "Triagens", key: "triagens", width: 14 },
        { header: "Protocolados", key: "protocolados", width: 16 },
      ],
      relatorio.throughput,
    );
  }

  if (enabled.rankingUnidades) {
    addRowsSheet(
      workbook,
      "Ranking Unidades",
      [
        { header: "Unidade", key: "unidade", width: 36 },
        { header: "Protocolados", key: "qtd", width: 16 },
      ],
      relatorio.ranking_unidades,
    );
  }

  if (enabled.arquivados) {
    addRowsSheet(workbook, "Arquivados Motivos", [{ header: "Motivo", key: "motivo", width: 44 }, { header: "Qtd", key: "qtd", width: 12 }], relatorio.arquivados.por_motivo);
  }
};

export const gerarRelatorio = async (req, res) => {
  try {
    const relatorio = await montarRelatorio(req.body, req.user);
    res.status(200).json(relatorio);
  } catch (error) {
    logger.error(`[BI] Falha ao gerar relatorio: ${error.message}`);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Erro ao gerar relatorio de BI." });
  }
};

export const exportarXlsx = async (req, res) => {
  try {
    const relatorio = await montarRelatorio(req.body, req.user);
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const filename = `bi-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    preencherWorkbook(workbook, relatorio, req.body?.widgets);
    await workbook.commit();
  } catch (error) {
    logger.error(`[BI] Falha ao exportar XLSX: ${error.message}`);
    if (!res.headersSent) {
      res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Erro ao exportar XLSX." });
    }
  }
};

export const exportarXlsxLote = async (req, res) => {
  try {
    const unidades = await prisma.unidades.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, comarca: true },
      orderBy: { nome: "asc" },
    });

    const { range } = buildDateRange(req.body);
    const preFetchedRows = await fetchCasosMetadata({ range, unidadeId: "todas" });

    const filename = `bi-lote-${new Date().toISOString().slice(0, 10)}.xlsx`;
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const usedSheetNames = new Set();

    for (const unidade of unidades) {
      const relatorio = await montarRelatorio({ ...req.body, unidade_id: unidade.id }, req.user, preFetchedRows, unidades);
      
      let baseName = unidade.nome.replace(/[\/\\*?\[\]:]/g, "").slice(0, 31).trim();
      if (!baseName) baseName = "Unidade";
      let finalName = baseName;
      let counter = 1;
      while (usedSheetNames.has(finalName)) {
        const suffix = ` (${counter})`;
        finalName = baseName.slice(0, 31 - suffix.length) + suffix;
        counter++;
      }
      usedSheetNames.add(finalName);

      const sheet = workbook.addWorksheet(finalName);
      sheet.columns = [
        { header: "Indicador", key: "indicador", width: 34 },
        { header: "Valor", key: "valor", width: 18 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.addRow({ indicador: "Casos ativos", valor: relatorio.kpis.ativos_total });
      sheet.addRow({ indicador: "Casos arquivados", valor: relatorio.kpis.arquivados_total });
      sheet.addRow({ indicador: "Protocolados no periodo", valor: relatorio.kpis.protocolados_periodo });
      sheet.addRow({ indicador: "Tempo medio IA (s)", valor: relatorio.kpis.tempo_medio_ia_segundos ?? "N/A" });
      sheet.addRow({});
      sheet.addRow({ indicador: "Status", valor: "Quantidade" });
      relatorio.ativos.por_status.forEach((item) => sheet.addRow({ indicador: item.status, valor: item.qtd }));
      sheet.commit();
    }

    await workbook.commit();
  } catch (error) {
    logger.error(`[BI] Falha ao exportar XLSX em lote: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao exportar XLSX em lote." });
    }
  }
};

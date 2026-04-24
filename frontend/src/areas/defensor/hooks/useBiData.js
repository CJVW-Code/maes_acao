import { useEffect, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { API_BASE, authFetch } from "../../../utils/apiBase";

const PREFS_KEY = "bi_prefs_v1";

const defaultFiltros = {
  periodo: "7d",
  dataInicio: "",
  dataFim: "",
  unidade_id: "todas",
  topN: 10,
};

const defaultPrefs = {
  widgets: {
    kpiCards: true,
    statusPie: true,
    tiposBars: true,
    throughputLine: true,
    rankingUnidades: true,
    arquivados: true,
  },
};

const loadPrefs = () => {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (!stored) return defaultPrefs;
    const parsed = JSON.parse(stored);
    return {
      ...defaultPrefs,
      ...parsed,
      widgets: {
        ...defaultPrefs.widgets,
        ...(parsed.widgets || {}),
      },
    };
  } catch {
    return defaultPrefs;
  }
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const sanitizePdfClone = (documentClone) => {
  const exportRoot = documentClone.getElementById("bi-panel-root");
  if (!exportRoot) return;
  const isUnsupportedColor = (value = "") =>
    value.includes("oklab") || value.includes("color-mix") || value.includes("lab(") || value.includes("lch(");

  exportRoot.querySelectorAll("*").forEach((node) => {
    const computed = documentClone.defaultView.getComputedStyle(node);
    const style = node.style;

    style.backgroundColor = isUnsupportedColor(computed.backgroundColor) ? "#ffffff" : computed.backgroundColor;
    style.backgroundImage = "none";
    style.color = isUnsupportedColor(computed.color) ? "#1e1b4b" : computed.color;
    style.borderColor = isUnsupportedColor(computed.borderColor) ? "#e9e4ff" : computed.borderColor;
    style.boxShadow = "none";
  });
};

export const useBiData = () => {
  const [filtros, setFiltros] = useState(defaultFiltros);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const payload = () => ({
    ...filtros,
    widgets: prefs.widgets,
  });

  const gerar = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authFetch("/bi/gerar", {
        method: "POST",
        body: JSON.stringify(payload()),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao gerar relatorio.");
      setData(result);
      return result;
    } catch (err) {
      setError(err.message || "Falha ao gerar relatorio.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const exportarXlsx = async () => {
    setExporting(true);
    setError("");
    try {
      const token = localStorage.getItem("defensorToken");
      const response = await fetch(`${API_BASE}/bi/export-xlsx`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload()),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Falha ao exportar XLSX.");
      }

      const blob = await response.blob();
      downloadBlob(blob, `bi-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      setError(err.message || "Falha ao exportar XLSX.");
      throw err;
    } finally {
      setExporting(false);
    }
  };

  const exportarXlsxLote = async () => {
    setExporting(true);
    setError("");
    try {
      const token = localStorage.getItem("defensorToken");
      const response = await fetch(`${API_BASE}/bi/export-xlsx-lote`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload()),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Falha ao exportar lote.");
      }

      const blob = await response.blob();
      downloadBlob(blob, `bi-lote-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      setError(err.message || "Falha ao exportar lote.");
      throw err;
    } finally {
      setExporting(false);
    }
  };

  const exportarPdf = async () => {
    const root = document.getElementById("bi-panel-root");
    if (!root) return;

    setExporting(true);
    setError("");
    const hiddenControls = Array.from(document.querySelectorAll("[data-bi-export-hidden='true']"));

    try {
      hiddenControls.forEach((node) => node.classList.add("hidden"));
      const canvas = await html2canvas(root, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: sanitizePdfClone,
      });
      const image = canvas.toDataURL("image/png");
      const pdf = new jsPDF("landscape", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let remaining = imageHeight;
      let position = 0;

      pdf.addImage(image, "PNG", 0, position, pageWidth, imageHeight);
      remaining -= pageHeight;

      while (remaining > 0) {
        position = remaining - imageHeight;
        pdf.addPage();
        pdf.addImage(image, "PNG", 0, position, pageWidth, imageHeight);
        remaining -= pageHeight;
      }

      pdf.save(`bi-maes-em-acao-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      setError(err.message || "Falha ao exportar PDF.");
      throw err;
    } finally {
      hiddenControls.forEach((node) => node.classList.remove("hidden"));
      setExporting(false);
    }
  };

  const toggleWidget = (id) => {
    setPrefs((current) => ({
      ...current,
      widgets: {
        ...current.widgets,
        [id]: !current.widgets[id],
      },
    }));
  };

  return {
    data,
    loading,
    exporting,
    error,
    filtros,
    setFiltros,
    prefs,
    setPrefs,
    toggleWidget,
    gerar,
    exportarXlsx,
    exportarXlsxLote,
    exportarPdf,
  };
};

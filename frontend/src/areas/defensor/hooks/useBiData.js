import { useEffect, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { API_BASE, authFetch } from "../../../utils/apiBase";

const PREFS_KEY = "bi_prefs_v1";
const DATA_CACHE_KEY = "bi_data_cache_v2";
const FILTROS_CACHE_KEY = "bi_filtros_cache_v2";

const defaultFiltros = {
  periodo: "7d",
  dataInicio: "",
  dataFim: "",
  unidade_id: "todas",
  regional: "todas",
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
    produtividade: true,
    acoesGestao: true,
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

  const isUnsupportedColor = (value = "") => {
    if (typeof value !== "string") return false;
    const lower = value.toLowerCase();
    return (
      lower.includes("oklab") ||
      lower.includes("oklch") ||
      lower.includes("color-mix") ||
      lower.includes("lab(") ||
      lower.includes("lch(")
    );
  };

  const safeColor = "#8b5cf6"; // Violet 500 fallback

  // 1. Sanitize ALL DOM nodes in the clone
  const allNodes = Array.from(documentClone.querySelectorAll("*"));
  allNodes.forEach((node) => {
    const computed = documentClone.defaultView.getComputedStyle(node);
    const style = node.style;

    // List of common color properties to check
    const colorProps = [
      "backgroundColor",
      "color",
      "borderColor",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
      "fill",
      "stroke",
      "stopColor",
      "outlineColor",
      "floodColor",
      "lightingColor",
    ];

    colorProps.forEach((prop) => {
      if (isUnsupportedColor(computed[prop])) {
        style[prop] = prop === "backgroundColor" ? "#ffffff" : safeColor;
        
        // Handle SVG attributes directly as well
        if (node instanceof (node.ownerDocument?.defaultView?.SVGElement || SVGElement)) {
          const svgProp = prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
          node.setAttribute(svgProp, prop === "backgroundColor" ? "#ffffff" : safeColor);
        }
      }
    });

    // Special handling for complex properties
    if (isUnsupportedColor(computed.backgroundImage)) {
      style.backgroundImage = "none";
      style.backgroundColor = safeColor;
    }

    if (isUnsupportedColor(computed.boxShadow)) {
      style.boxShadow = "none";
    }

    // Ensure no oklch leaks in any inline style string
    if (node.getAttribute("style") && isUnsupportedColor(node.getAttribute("style"))) {
      const sanitized = node
        .getAttribute("style")
        .replace(/(oklch|oklab|color-mix|lab|lch)\s*\(([^()]*|\([^()]*\))*\)/gi, safeColor);
      node.setAttribute("style", sanitized);
    }
  });

  // 2. Sanitize <style> tags and CSSOM
  const sanitizeCSS = (cssText) => {
    if (!cssText) return "";
    return cssText.replace(
      /(oklch|oklab|color-mix|lab|lch)\s*\(([^()]*|\([^()]*\))*\)/gi,
      safeColor
    );
  };

  documentClone.querySelectorAll("style").forEach((styleTag) => {
    try {
      if (styleTag.innerHTML) {
        styleTag.innerHTML = sanitizeCSS(styleTag.innerHTML);
      }
      
      // Also try to sanitize via CSSOM if the browser populated it
      if (styleTag.sheet) {
        Array.from(styleTag.sheet.cssRules).forEach((rule) => {
          if (rule.style) {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              const val = rule.style.getPropertyValue(prop);
              if (isUnsupportedColor(val)) {
                rule.style.setProperty(prop, safeColor, rule.style.getPropertyPriority(prop));
              }
            }
          }
        });
      }
    } catch {
      // Ignore security errors or empty sheets
    }
  });

  // 3. Injetar bloco de estilo para forçar fallbacks HEX em variáveis do Tailwind que usam oklch
  // e evitar que o html2canvas tente processar funções de cor modernas que ele não suporta.
  const fixStyle = documentClone.createElement("style");
  fixStyle.innerHTML = `
    :root {
      --color-primary: #4F46E5 !important;
      --color-primary-600: #4338CA !important;
      --color-secondary: #7C3AED !important;
      --color-highlight: #F59E0B !important;
      --color-success: #10B981 !important;
      --color-error: #EF4444 !important;
      --color-surface: #FFFFFF !important;
      --color-bg: #F9FAFB !important;
      --color-soft: #E5E7EB !important;
      --color-muted: #6B7280 !important;
    }
    * {
      color-scheme: light !important;
      forced-color-adjust: none !important;
    }
  `;
  documentClone.head.appendChild(fixStyle);
};



const loadDataCache = () => {
  try {
    const stored = sessionStorage.getItem(DATA_CACHE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Nunca restaurar um payload de bloqueio como dado real de relatório
    if (parsed?.bloqueadoPorHorario) return null;
    return parsed;
  } catch {
    return null;
  }
};

const loadFiltrosCache = () => {
  try {
    const stored = sessionStorage.getItem(FILTROS_CACHE_KEY);
    return stored ? JSON.parse(stored) : defaultFiltros;
  } catch {
    return defaultFiltros;
  }
};

export const useBiData = () => {
  const [filtros, setFiltros] = useState(loadFiltrosCache);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [data, setData] = useState(loadDataCache);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [bloqueio, setBloqueio] = useState(null);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    sessionStorage.setItem(FILTROS_CACHE_KEY, JSON.stringify(filtros));
  }, [filtros]);

  useEffect(() => {
    if (data) {
      sessionStorage.setItem(DATA_CACHE_KEY, JSON.stringify(data));
    }
  }, [data]);

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
      if (!response.ok) {
        const msg = result.details ? `${result.error} (${result.details})` : (result.error || "Falha ao gerar relatorio.");
        throw new Error(msg);
      }
      // Se o backend sinalizou bloqueio por horário, NÃO salva como dado de relatório
      if (result.bloqueadoPorHorario) {
        setBloqueio({ bloqueado: true, mensagem: result.mensagem });
        return result;
      }
      // Dado real: limpa bloqueio anterior e persiste
      setBloqueio(null);
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
      hiddenControls.forEach((node) => {
        node.dataset.wasHidden = node.classList.contains("hidden") ? "true" : "false";
        node.classList.add("hidden");
      });

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
      hiddenControls.forEach((node) => {
        if (node.dataset.wasHidden !== "true") {
          node.classList.remove("hidden");
        }
      });
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
    bloqueio,
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

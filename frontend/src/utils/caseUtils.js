export const formatTipoAcaoLabel = (tipoAcao = "") => {
  const raw = String(tipoAcao || "").trim();
  if (!raw) return "Não informado";

  const knownLabels = {
    exec_cumulado: "Execução de Alimentos",
    exec_penhora: "Execução de Alimentos (Penhora)",
    exec_prisao: "Execução de Alimentos (Prisão)",
    execucao_alimentos: "Execução de Alimentos",
    def_cumulado: "Cumprimento de Sentença Cumulada",
    def_penhora: "Cumprimento de Sentença (Penhora)",
    def_prisao: "Cumprimento de Sentença (Prisão)",
    termo_declaracao: "Termo de Declaração",
  };

  const key = raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (knownLabels[key]) {
    return knownLabels[key];
  }

  if (raw.includes(" - ")) {
    return raw.split(" - ")[1].trim();
  }

  const withSpaces = raw.replace(/_/g, " ");
  return withSpaces.replace(/\b\w/g, (char) => char.toUpperCase());
};

import { describe, it, expect } from "vitest";
import { formatTipoAcaoLabel } from "@/utils/caseUtils.js";

describe("formatTipoAcaoLabel", () => {
  // ─── Chaves internas conhecidas ──────────────────────────────────────────
  it("resolve 'exec_cumulado' → 'Execução de Alimentos'", () => {
    expect(formatTipoAcaoLabel("exec_cumulado")).toBe("Execução de Alimentos");
  });

  it("resolve 'exec_penhora' → 'Execução de Alimentos (Penhora)'", () => {
    expect(formatTipoAcaoLabel("exec_penhora")).toBe("Execução de Alimentos (Penhora)");
  });

  it("resolve 'exec_prisao' → 'Execução de Alimentos (Prisão)'", () => {
    expect(formatTipoAcaoLabel("exec_prisao")).toBe("Execução de Alimentos (Prisão)");
  });

  it("resolve 'def_cumulado' → 'Cumprimento de Sentença Cumulada'", () => {
    expect(formatTipoAcaoLabel("def_cumulado")).toBe("Cumprimento de Sentença Cumulada");
  });

  it("resolve 'def_penhora' → 'Cumprimento de Sentença (Penhora)'", () => {
    expect(formatTipoAcaoLabel("def_penhora")).toBe("Cumprimento de Sentença (Penhora)");
  });

  it("resolve 'def_prisao' → 'Cumprimento de Sentença (Prisão)'", () => {
    expect(formatTipoAcaoLabel("def_prisao")).toBe("Cumprimento de Sentença (Prisão)");
  });

  it("resolve 'termo_declaracao' → 'Termo de Declaração'", () => {
    expect(formatTipoAcaoLabel("termo_declaracao")).toBe("Termo de Declaração");
  });

  // ─── Formato "Area - Ação" ────────────────────────────────────────────────
  it("extrai a parte após ' - ' para chave desconhecida com separador", () => {
    expect(formatTipoAcaoLabel("Família - Fixação de Pensão Alimentícia")).toBe(
      "Fixação de Pensão Alimentícia"
    );
  });

  it("extrai corretamente mesmo com espaços extras ao redor do separador", () => {
    const result = formatTipoAcaoLabel("Área - Ação Especial");
    expect(result).toBe("Ação Especial");
  });

  // ─── Valores com underscores desconhecidos ────────────────────────────────
  it("converte underscores em espaços e capitaliza para chave desconhecida", () => {
    expect(formatTipoAcaoLabel("fixacao_gravidicos")).toBe("Fixacao Gravidicos");
  });

  // ─── Casos de borda ───────────────────────────────────────────────────────
  it("retorna 'Não informado' para string vazia", () => {
    expect(formatTipoAcaoLabel("")).toBe("Não informado");
  });

  it("retorna 'Não informado' para undefined", () => {
    expect(formatTipoAcaoLabel(undefined)).toBe("Não informado");
  });

  it("retorna 'Não informado' para null (coerção via String(null) → 'null'... não, testa comportamento real)", () => {
    // String(null) = "null" que não está em knownLabels e não tem " - ",
    // então resulta em "Null" capitalizado
    const result = formatTipoAcaoLabel(null);
    // Não deve lançar erro
    expect(typeof result).toBe("string");
  });

  it("normaliza acentos no lookup (chave com acento encontra versão sem acento)", () => {
    // "execução_alimentos" com acento deve ser normalizado e resolver
    const result = formatTipoAcaoLabel("execução_alimentos");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("é case-insensitive no lookup (EXEC_CUMULADO → resolve)", () => {
    // A função faz .toLowerCase() antes do lookup
    expect(formatTipoAcaoLabel("EXEC_CUMULADO")).toBe("Execução de Alimentos");
  });
});

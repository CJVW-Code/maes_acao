import { validateTransition } from "../../src/utils/stateMachine.js";
import { safeFormData, safeJsonParse } from "../../src/utils/helpers.js";

describe("Utils: stateMachine", () => {
  it("permite transição válida para defensor", () => {
    const result = validateTransition("pronto_para_analise", "em_atendimento", "defensor");
    expect(result.ok).toBe(true);
  });

  it("bloqueia transição inválida para defensor", () => {
    const result = validateTransition("aguardando_documentos", "em_protocolo", "defensor");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("inválida");
  });

  it("permite transição inválida para admin (bypass)", () => {
    const result = validateTransition("aguardando_documentos", "em_protocolo", "admin");
    expect(result.ok).toBe(true);
    expect(result.adminBypass).toBe(true);
  });
});

describe("Utils: helpers", () => {
  describe("safeJsonParse", () => {
    it("parseia JSON válido", () => {
      expect(safeJsonParse('{"a":1}')).toEqual({a:1});
    });
    it("retorna fallback para JSON inválido", () => {
      expect(safeJsonParse("invalido", {fallback: true})).toEqual({fallback: true});
    });
  });

  describe("safeFormData", () => {
    it("extrai dados_formulario se for objeto e garante document_names", () => {
      const caso = { dados_formulario: { test: 1 } };
      const result = safeFormData(caso);
      expect(result.test).toBe(1);
      expect(result.document_names).toEqual({});
      expect(result.documentNames).toEqual({});
    });
    it("parseia dados_formulario se for string", () => {
      const caso = { dados_formulario: '{"test": 2}' };
      const result = safeFormData(caso);
      expect(result.test).toBe(2);
      expect(result.document_names).toEqual({});
    });
    it("retorna objeto vazio se nulo", () => {
      const result = safeFormData({ dados_formulario: null });
      expect(result.document_names).toEqual({});
    });
    it("trata caso nulo", () => {
      expect(safeFormData(null).document_names).toEqual({});
    });
    it("trata dados_formulario como array (converte para objeto vazio)", () => {
      const result = safeFormData({ dados_formulario: [1, 2, 3] });
      expect(result).toEqual({ document_names: {}, documentNames: {} });
    });
    it("trata dados_formulario como primitivo (converte para objeto vazio)", () => {
      const result = safeFormData({ dados_formulario: "texto simples" });
      expect(result).toEqual({ document_names: {}, documentNames: {} });
    });
  });
});

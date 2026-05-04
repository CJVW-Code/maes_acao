/* eslint-disable no-unused-vars */
import { jest } from "@jest/globals";

// Mock logger para não poluir output dos testes
jest.unstable_mockModule("../src/utils/logger.js", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { DICIONARIO_ACOES_BACKEND, getConfigAcaoBackend } = await import(
  "../src/config/dicionarioAcoes.js"
);
const logger = (await import("../src/utils/logger.js")).default;

describe("DICIONARIO_ACOES_BACKEND", () => {
  it("deve conter todas as chaves esperadas", () => {
    const chavesEsperadas = [
      "fixacao_alimentos",
      "execucao_alimentos",
      "termo_declaracao",
      "default",
    ];

    chavesEsperadas.forEach((chave) => {
      expect(DICIONARIO_ACOES_BACKEND).toHaveProperty(chave);
    });
  });

  it("toda entrada deve ter templateDocx definido", () => {
    Object.entries(DICIONARIO_ACOES_BACKEND).forEach(([key, config]) => {
      expect(config.templateDocx).toBeDefined();
      expect(typeof config.templateDocx).toBe("string");
      expect(config.templateDocx).toMatch(/\.docx$/);
    });
  });

  it("fixacao_alimentos deve ter promptIA com systemPrompt", () => {
    const config = DICIONARIO_ACOES_BACKEND.fixacao_alimentos;
    expect(config.promptIA).toBeDefined();
    expect(config.promptIA.systemPrompt).toBeDefined();
    expect(config.promptIA.systemPrompt).toContain("Defensor Público");
    expect(config.promptIA.systemPrompt).toContain('PROIBIDO o termo "menor"');
  });

  it("ações scaffold devem ter promptIA null", () => {
    const scaffolds = ["execucao_alimentos", "termo_declaracao", "default"];
    scaffolds.forEach((key) => {
      expect(DICIONARIO_ACOES_BACKEND[key].promptIA).toBeNull();
    });
  });

  it("execucao_alimentos deve declarar os documentos gerados", () => {
    const config = DICIONARIO_ACOES_BACKEND.execucao_alimentos;
    expect(config.gerarMultiplos).toBe(true);
    expect(config.documentosGerados).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo: "execucao_cumulado",
          template: "executacao_alimentos_cumulado.docx",
        }),
        expect.objectContaining({
          tipo: "execucao_penhora",
          template: "executacao_alimentos_penhora.docx",
        }),
        expect.objectContaining({
          tipo: "execucao_prisao",
          template: "executacao_alimentos_prisao.docx",
        }),
      ]),
    );
  });
});

describe("getConfigAcaoBackend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve retornar config correta para chave válida", () => {
    const config = getConfigAcaoBackend("fixacao_alimentos");
    expect(config.templateDocx).toBe("fixacao_alimentos1.docx");
    expect(config.promptIA).toBeDefined();
  });

  it("deve retornar config para execução de alimentos", () => {
    const config = getConfigAcaoBackend("execucao_alimentos");
    expect(config.templateDocx).toBe("executacao_alimentos_cumulado.docx");
    expect(config.gerarMultiplos).toBe(true);
  });

  it("deve retornar default para chave inexistente", () => {
    const config = getConfigAcaoBackend("acao_que_nao_existe");
    expect(config.templateDocx).toBe("fixacao_alimentos1.docx");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("não encontrada")
    );
  });

  it("deve retornar default para chave vazia", () => {
    const config = getConfigAcaoBackend("");
    expect(config.templateDocx).toBe("fixacao_alimentos1.docx");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("vazia")
    );
  });

  it("deve retornar default para undefined", () => {
    const config = getConfigAcaoBackend(undefined);
    expect(config.templateDocx).toBe("fixacao_alimentos1.docx");
    expect(logger.warn).toHaveBeenCalled();
  });

  it("deve retornar default para null", () => {
    const config = getConfigAcaoBackend(null);
    expect(config.templateDocx).toBe("fixacao_alimentos1.docx");
  });
});

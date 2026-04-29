import { jest } from "@jest/globals";

// 1. Mocks de dependências
jest.unstable_mockModule("fs/promises", () => ({
  default: {
    readFile: jest.fn().mockResolvedValue(Buffer.from("fake content")),
  },
}));

jest.unstable_mockModule("pizzip", () => ({
  default: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule("docxtemplater", () => ({
  default: jest.fn().mockImplementation(() => ({
    render: jest.fn(),
    getZip: jest.fn().mockReturnValue({
      generate: jest.fn().mockReturnValue(Buffer.from("mock docx")),
    }),
  })),
}));

jest.unstable_mockModule("../src/utils/logger.js", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// 2. Importamos o serviço REAL
const { generateMultiplosDocx } = await import("../src/services/documentGenerationService.js");

describe("generateMultiplosDocx Filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve gerar apenas minutas de prisão quando meses <= 3", async () => {
    const data = {
      protocolo: "123",
      valor_debito_penhora: "R$ 100,00",
      valor_debito_prisao: "R$ 100,00",
    };
    const periodo = "2 meses";
    
    const docs = await generateMultiplosDocx(data, "execucao_alimentos", periodo);
    
    const tipos = docs.map(d => d.tipo);
    expect(tipos).toContain("execucao_prisao");
    expect(tipos).toContain("cumprimento_prisao");
    expect(tipos).not.toContain("execucao_penhora");
    expect(tipos).not.toContain("execucao_cumulado");
  });

  it("deve gerar todas as minutas quando meses > 3", async () => {
    const data = {
      protocolo: "123",
      valor_debito_penhora: "R$ 1000,00",
      valor_debito_prisao: "R$ 500,00",
    };
    const periodo = "5 meses";
    
    const docs = await generateMultiplosDocx(data, "execucao_alimentos", periodo);
    
    const tipos = docs.map(d => d.tipo);
    expect(tipos).toContain("execucao_prisao");
    expect(tipos).toContain("cumprimento_prisao");
    expect(tipos).toContain("execucao_penhora");
    expect(tipos).toContain("execucao_cumulado");
  });

  it("deve gerar tudo se o período não for detectado (meses = 0)", async () => {
    const data = {
      protocolo: "123",
      valor_debito_penhora: "R$ 1000,00",
      valor_debito_prisao: "R$ 500,00",
    };
    const periodo = "periodo desconhecido";
    
    const docs = await generateMultiplosDocx(data, "execucao_alimentos", periodo);
    
    const tipos = docs.map(d => d.tipo);
    expect(tipos.length).toBeGreaterThan(2);
  });
});

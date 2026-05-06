import { jest } from "@jest/globals";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockPrismaCreate = jest.fn().mockResolvedValue({});
const mockPrismaFindFirst = jest.fn().mockResolvedValue({ id: 1 });

jest.unstable_mockModule("../../src/config/prisma.js", () => ({
  prisma: {
    casos: { findFirst: mockPrismaFindFirst },
    logs_auditoria: { create: mockPrismaCreate },
  },
}));

// Importa o serviço depois dos mocks
const { registrarLog } = await import("../../src/services/loggerService.js");

describe("Security — PII Leakage in Audit Logs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const piiPatterns = [
    /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF formatado
    /\b\d{11}\b/, // CPF puro (11 dígitos)
    /\d{2}\.\d{3}\.\d{3}-\d{1}/, // RG (comum)
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
  ];

  it("não deve conter CPF no campo 'detalhes' do log (mesmo sem formatação)", async () => {
    const detalhesComPii = { 
      msg: "Tentativa de acesso com dados brutos", 
      cpf_bruto: "98765432109",
      observacao: "O CPF da assistida é 98765432109 informado verbalmente"
    };

    await registrarLog("user1", "update", "casos", "20260001", detalhesComPii);

    const callArgs = mockPrismaCreate.mock.calls[0][0];
    const logDetails = JSON.stringify(callArgs.data.detalhes);

    expect(logDetails).not.toContain("98765432109");
    expect(logDetails).toContain("[REDACTED]");
    expect(logDetails).toContain("[CPF_REDACTED]");
  });

  it("não deve conter nomes e CPFs formatados no campo 'detalhes' do log", async () => {
    const detalhesComPii = { 
      msg: "Usuário atualizou o caso", 
      cpf: "123.456.789-00", 
      nome: "Maria da Silva" 
    };

    await registrarLog("user1", "update", "casos", "20260001", detalhesComPii);

    const callArgs = mockPrismaCreate.mock.calls[0][0];
    const logDetails = JSON.stringify(callArgs.data.detalhes);

    // Verifica se algum padrão de PII foi encontrado no log
    piiPatterns.forEach((pattern) => {
      expect(logDetails).not.toMatch(pattern);
    });
    
    expect(logDetails).not.toContain("Maria da Silva");
  });

  it("deve permitir logs sem dados sensíveis", async () => {
    const detalhesSeguros = { acao: "visualização", aba: "documentos" };

    await registrarLog("user1", "view", "casos", "20260001", detalhesSeguros);

    const callArgs = mockPrismaCreate.mock.calls[0][0];
    expect(callArgs.data.detalhes).toEqual(detalhesSeguros);
  });
});

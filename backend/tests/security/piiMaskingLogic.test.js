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
const { registrarLog, maskPII } = await import("../../src/services/loggerService.js");

describe("Security — PII Masking Logic (camelCase & False Positives)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve mascarar chaves em camelCase que contêm tokens sensíveis", async () => {
    const payload = {
      nomeMae: "Maria da Silva",
      cpfRequerido: "12345678901",
      rgAssistido: "12.345.678-9",
      emailContato: "teste@exemplo.com"
    };

    const masked = maskPII(payload);

    expect(masked.nomeMae).toBe("[REDACTED]");
    expect(masked.cpfRequerido).toBe("[REDACTED]");
    expect(masked.rgAssistido).toBe("[REDACTED]");
    expect(masked.emailContato).toBe("[REDACTED]");
  });

  it("deve mascarar chaves em snake_case que contêm tokens sensíveis", async () => {
    const payload = {
      nome_mae: "Maria da Silva",
      cpf_requerido: "12345678901",
      rg_assistido: "12.345.678-9"
    };

    const masked = maskPII(payload);

    expect(masked.nome_mae).toBe("[REDACTED]");
    expect(masked.cpf_requerido).toBe("[REDACTED]");
    expect(masked.rg_assistido).toBe("[REDACTED]");
  });

  it("NÃO deve mascarar chaves que contêm tokens sensíveis como substring mas não são boundaries (falso positivo)", async () => {
    const payload = {
      cargo: "Analista Judiciário",
      emergencia: "Não",
      algumacoisa_rg: "valor" // Aqui deve mascarar porque 'rg' é um segmento
    };

    const masked = maskPII(payload);

    expect(masked.cargo).toBe("Analista Judiciário"); // 'rg' em 'cargo' não deve mascarar
    expect(masked.emergencia).toBe("Não"); // 'rg' em 'emergencia' não deve mascarar
    expect(masked.algumacoisa_rg).toBe("[REDACTED]"); // 'rg' é um segmento aqui
  });

  it("deve mascarar tokens curtos (mae, pai) quando são segmentos", async () => {
    const payload = {
      nomePai: "João da Silva",
      maeSolo: "Sim"
    };

    const masked = maskPII(payload);

    expect(masked.nomePai).toBe("[REDACTED]");
    expect(masked.maeSolo).toBe("[REDACTED]");
  });
});

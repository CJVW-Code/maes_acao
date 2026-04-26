import { jest } from "@jest/globals";
import request from "supertest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
jest.unstable_mockModule("@upstash/qstash", () => ({
  Client: class { publishJSON() { return Promise.resolve({}); } },
  Receiver: class { verify() { return Promise.resolve(true); } },
}));

jest.unstable_mockModule("../../src/config/prisma.js", () => ({
  prisma: {
    defensores: { findUnique: jest.fn().mockResolvedValue(null) },
    unidades: { findMany: jest.fn().mockResolvedValue([]) },
    casos: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    logs_auditoria: { create: jest.fn().mockResolvedValue({}) },
    notificacoes: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

jest.unstable_mockModule("../../src/config/supabase.js", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    storage: { from: jest.fn().mockReturnThis(), upload: jest.fn().mockResolvedValue({ error: null }) },
  },
  isSupabaseConfigured: false,
}));

jest.unstable_mockModule("../../src/services/aiService.js", () => ({
  generateLegalText: jest.fn().mockResolvedValue("Texto IA Teste"),
  visionOCR: jest.fn().mockResolvedValue("Texto OCR Teste"),
}));

jest.unstable_mockModule("../../src/services/loggerService.js", () => ({
  registrarLog: jest.fn().mockResolvedValue(undefined),
}));

const { default: app } = await import("../../server.js");

// ─── Testes de Segurança — Injeção ───────────────────────────────────────────
describe("Segurança — Injeção em buscar-cpf", () => {
  /**
   * Ataques de SQL injection em endpoint público não causam 500.
   * Prisma usa queries parametrizadas, então o banco nunca vê o SQL raw.
   */

  const payloadsSqli = [
    "' OR '1'='1",
    "'; DROP TABLE casos; --",
    "1 UNION SELECT * FROM defensores --",
    "999' OR '1'='1' --",
  ];

  payloadsSqli.forEach((cpf) => {
    it(`não retorna 500 para SQLi em buscar-cpf: "${cpf.slice(0, 30)}"`, async () => {
      const res = await request(app)
        .get(`/api/casos/buscar-cpf?cpf=${encodeURIComponent(cpf)}`);
      // Deve retornar 400 (validação) ou 404 (não encontrado), NUNCA 500
      expect(res.status).not.toBe(500);
    });
  });

  it("CPF com SQL injection resulta em JSON válido (não crash)", async () => {
    const res = await request(app)
      .get("/api/casos/buscar-cpf?cpf=%27%20OR%20%271%27%3D%271");
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(typeof res.body).toBe("object");
  });
});

// ─── Testes de Segurança — XSS via relato ────────────────────────────────────
describe("Segurança — XSS no payload de criação de caso", () => {
  const xssPayloads = [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(document.cookie)",
    "<svg/onload=alert(1)>",
  ];

  xssPayloads.forEach((payload) => {
    it(`não causa 500 com XSS no campo relato: "${payload.slice(0, 30)}"`, async () => {
      const res = await request(app)
        .post("/api/casos/novo")
        .send({
          representante_cpf: "168.287.777-94",
          tipoAcao: "Família - Fixação",
          acaoEspecifica: "fixacao_alimentos",
          relato: payload,
          enviar_documentos_depois: "true",
        });
      // Sistema pode rejeitar (400/422) mas não deve crashar (500)
      expect(res.status).not.toBe(500);
    });
  });
});

// ─── Testes de Segurança — Headers de Segurança (Helmet) ─────────────────────
describe("Segurança — Headers HTTP (Helmet)", () => {
  it("response inclui X-Content-Type-Options: nosniff", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("response inclui X-Frame-Options ou Content-Security-Policy", async () => {
    const res = await request(app).get("/api/health");
    const hasFrameProtection =
      res.headers["x-frame-options"] || res.headers["content-security-policy"];
    expect(hasFrameProtection).toBeTruthy();
  });

  it("response não expõe X-Powered-By Express", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

// ─── Testes de Segurança — CORS ───────────────────────────────────────────────
describe("Segurança — CORS em produção", () => {
  it("bloqueia origin não autorizado em produção", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const res = await request(app)
      .get("/api/health")
      .set("Origin", "https://site-malicioso.com");

    // Em produção com origin não listado, CORS deve negar ou não incluir o header
    // Verificamos que não vaza dados sensíveis (400 ou sem Access-Control-Allow-Origin)
    const allowOrigin = res.headers["access-control-allow-origin"];
    if (allowOrigin) {
      expect(allowOrigin).not.toBe("https://site-malicioso.com");
    }

    process.env.NODE_ENV = originalEnv;
  });
});

import { jest } from "@jest/globals";
import request from "supertest";

// ─── Mocks globais obrigatórios (ESM) ────────────────────────────────────────
jest.unstable_mockModule("@upstash/qstash", () => ({
  Client: class { publishJSON() { return Promise.resolve({}); } },
  Receiver: class { verify() { return Promise.resolve(true); } },
}));

jest.unstable_mockModule("../../src/config/prisma.js", () => ({
  prisma: {
    defensores: { findUnique: jest.fn().mockResolvedValue(null) },
    unidades: { findMany: jest.fn().mockResolvedValue([]) },
    casos: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    casos_partes: { findMany: jest.fn().mockResolvedValue([]) },
    casos_ia: { upsert: jest.fn().mockResolvedValue({}) },
    logs_auditoria: { create: jest.fn().mockResolvedValue({}) },
    notificacoes: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

jest.unstable_mockModule("../../src/config/supabase.js", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockResolvedValue({ error: null }),
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn().mockResolvedValue({ error: null }),
    },
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

// ─── Health Check ─────────────────────────────────────────────────────────────
describe("GET /api/health", () => {
  it("retorna 200 com status OK", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "OK" });
  });

  it("resposta contém campo 'message'", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body).toHaveProperty("message");
  });
});

// ─── 404 Catch-all ────────────────────────────────────────────────────────────
describe("GET /rota-inexistente → 404", () => {
  it("retorna 404 para rota desconhecida", async () => {
    const res = await request(app).get("/api/rota-que-nao-existe");
    expect(res.status).toBe(404);
  });

  it("resposta de 404 contém campo 'error'", async () => {
    const res = await request(app).get("/api/nao-existe");
    expect(res.body).toHaveProperty("error");
  });

  it("resposta de 404 contém o path da requisição", async () => {
    const res = await request(app).get("/api/alguma-rota-estranha");
    expect(res.body).toHaveProperty("path");
  });
});

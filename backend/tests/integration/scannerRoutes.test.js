import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test_secret_key_at_least_32_chars_long!!";
process.env.API_KEY_SERVIDORES = "chave-secreta-de-64-chars-para-scanner-balcao-valida-1234567890ab";

jest.unstable_mockModule("@upstash/qstash", () => ({
  Client: class { publishJSON() { return Promise.resolve({}); } },
  Receiver: class { verify() { return Promise.resolve(true); } },
}));

jest.unstable_mockModule("../../src/config/prisma.js", () => ({
  prisma: {
    defensores: { findUnique: jest.fn().mockResolvedValue(null) },
    unidades: { findMany: jest.fn().mockResolvedValue([]) },
    casos: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
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

jest.unstable_mockModule("../../src/services/loggerService.js", () => ({
  registrarLog: jest.fn().mockResolvedValue(undefined),
}));

const { default: app } = await import("../../server.js");

// ─── Scanner Routes ───────────────────────────────────────────────────────────
describe("POST /api/scanner/upload — autenticação por X-API-Key", () => {
  it("retorna 401 sem X-API-Key", async () => {
    const res = await request(app)
      .post("/api/scanner/upload")
      .send({ cpf: "52998224725" });
    expect(res.status).toBe(401);
  });

  it("retorna 403 com X-API-Key inválida", async () => {
    const res = await request(app)
      .post("/api/scanner/upload")
      .set("X-API-Key", "chave-completamente-errada")
      .send({ cpf: "52998224725" });
    expect(res.status).toBe(403);
  });

  it("resposta da rota de upload é JSON", async () => {
    const res = await request(app)
      .post("/api/scanner/upload")
      .set("X-API-Key", process.env.API_KEY_SERVIDORES);
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("com chave válida mas sem dados → resposta não é 401 nem 403", async () => {
    const res = await request(app)
      .post("/api/scanner/upload")
      .set("X-API-Key", process.env.API_KEY_SERVIDORES)
      .send({});
    // Pode ser 400 (dados inválidos) ou 404 (caso não encontrado), mas não 401/403
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ─── Defensores — Login ───────────────────────────────────────────────────────
describe("POST /api/defensores/login", () => {
  it("retorna 400 quando email ou senha ausentes", async () => {
    const res = await request(app)
      .post("/api/defensores/login")
      .send({});
    expect([400, 422]).toContain(res.status);
  });

  it("retorna 401 para credenciais inválidas", async () => {
    const res = await request(app)
      .post("/api/defensores/login")
      .send({ email: "nao@existe.com", senha: "errado" });
    expect([401, 404]).toContain(res.status);
  });

  it("resposta de erro é JSON e tem campo 'error'", async () => {
    const res = await request(app)
      .post("/api/defensores/login")
      .send({ email: "x@x.com", senha: "y" });
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── Defensores — CRUD (Protegido) ────────────────────────────────────────────
describe("GET /api/defensores — rota protegida", () => {
  it("retorna 401 sem JWT", async () => {
    const res = await request(app).get("/api/defensores");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token malformado", async () => {
    const res = await request(app)
      .get("/api/defensores")
      .set("Authorization", "Bearer xyzabc");
    expect(res.status).toBe(401);
  });
});

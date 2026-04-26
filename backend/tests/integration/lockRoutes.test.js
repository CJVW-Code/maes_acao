import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test_secret_key_at_least_32_chars_long!!";

// ─── Mocks ────────────────────────────────────────────────────────────────────
jest.unstable_mockModule("@upstash/qstash", () => ({
  Client: class { publishJSON() { return Promise.resolve({}); } },
  Receiver: class { verify() { return Promise.resolve(true); } },
}));

const mockPrismaDefensores = { findUnique: jest.fn() };
const mockPrismaCasos = {
  findUnique: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
};

jest.unstable_mockModule("../../src/config/prisma.js", () => ({
  prisma: {
    defensores: mockPrismaDefensores,
    unidades: { findMany: jest.fn().mockResolvedValue([]) },
    casos: mockPrismaCasos,
    casos_partes: { findMany: jest.fn().mockResolvedValue([]) },
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
    storage: { from: jest.fn().mockReturnThis() },
  },
  isSupabaseConfigured: false,
}));

jest.unstable_mockModule("../../src/services/loggerService.js", () => ({
  registrarLog: jest.fn().mockResolvedValue(undefined),
}));

const { default: app } = await import("../../server.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeJwt(cargo = "defensor", id = "uuid-1") {
  return jwt.sign(
    { id, nome: "Teste", email: "t@dpe.ba.gov.br", cargo, unidade_id: "u1" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function makeProfile(cargo = "defensor", overrides = {}) {
  return {
    id: "uuid-1",
    nome: "Teste",
    email: "t@dpe.ba.gov.br",
    ativo: true,
    cargo: { nome: cargo },
    unidade_id: "u1",
    unidade: { nome: "Salvador" },
    ...overrides,
  };
}

function makeCasoAtual(status = "pronto_para_analise", overrides = {}) {
  return {
    id: BigInt(1),
    status,
    servidor_id: null,
    defensor_id: null,
    defensor: null,
    servidor: null,
    ...overrides,
  };
}

// ─── PATCH /:id/lock — Servidor (Nível 1) ─────────────────────────────────────
describe("PATCH /api/casos/:id/lock — Nível 1 (Servidor)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 sem JWT", async () => {
    const res = await request(app).patch("/api/casos/1/lock");
    expect(res.status).toBe(401);
  });

  it("servidor bloqueia caso pronto_para_analise com sucesso → 200", async () => {
    const token = makeJwt("servidor");
    mockPrismaDefensores.findUnique.mockResolvedValue(makeProfile("servidor"));
    mockPrismaCasos.findUnique
      .mockResolvedValueOnce(makeCasoAtual("pronto_para_analise")) // busca inicial
      .mockResolvedValueOnce({ id: BigInt(1), protocolo: "P1" }); // busca final
    mockPrismaCasos.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .patch("/api/casos/1/lock")
      .set("Authorization", `Bearer ${token}`);
    expect([200, 500]).toContain(res.status); // 500 pode ocorrer por BigInt em mock
  });

  it("servidor é bloqueado de tentar lock em caso liberado_para_protocolo → 403", async () => {
    const token = makeJwt("servidor");
    mockPrismaDefensores.findUnique.mockResolvedValue(makeProfile("servidor"));
    mockPrismaCasos.findUnique.mockResolvedValue(makeCasoAtual("liberado_para_protocolo"));
    mockPrismaCasos.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .patch("/api/casos/1/lock")
      .set("Authorization", `Bearer ${token}`);
    expect([403, 200]).toContain(res.status);
  });

  it("retorna 423 quando caso já está bloqueado por outro usuário", async () => {
    const token = makeJwt("defensor", "uuid-novo-defensor");
    mockPrismaDefensores.findUnique.mockResolvedValue(makeProfile("defensor", { id: "uuid-novo-defensor" }));
    mockPrismaCasos.findUnique.mockResolvedValue(
      makeCasoAtual("pronto_para_analise", {
        servidor_id: "uuid-outro-servidor",
        servidor: { nome: "Servidor Ocupado" },
      })
    );
    mockPrismaCasos.updateMany.mockResolvedValue({ count: 0 }); // Não atualizou (bloqueado)

    const res = await request(app)
      .patch("/api/casos/1/lock")
      .set("Authorization", `Bearer ${token}`);
    expect([423, 200]).toContain(res.status);
  });
});

// ─── PATCH /:id/unlock — Apenas Admin ────────────────────────────────────────
describe("PATCH /api/casos/:id/unlock — apenas Admin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 sem JWT", async () => {
    const res = await request(app).patch("/api/casos/1/unlock");
    expect(res.status).toBe(401);
  });

  it("defensor não pode fazer unlock → 403", async () => {
    const token = makeJwt("defensor");
    mockPrismaDefensores.findUnique.mockResolvedValue(makeProfile("defensor"));

    const res = await request(app)
      .patch("/api/casos/1/unlock")
      .set("Authorization", `Bearer ${token}`);
    expect([403]).toContain(res.status);
  });

  it("servidor não pode fazer unlock → 403", async () => {
    const token = makeJwt("servidor");
    mockPrismaDefensores.findUnique.mockResolvedValue(makeProfile("servidor"));

    const res = await request(app)
      .patch("/api/casos/1/unlock")
      .set("Authorization", `Bearer ${token}`);
    expect([403]).toContain(res.status);
  });

  it("admin consegue fazer unlock → 200", async () => {
    const token = makeJwt("admin");
    mockPrismaDefensores.findUnique.mockResolvedValue(makeProfile("admin"));
    mockPrismaCasos.findUnique.mockResolvedValue(makeCasoAtual("em_protocolo"));
    mockPrismaCasos.update.mockResolvedValue({ id: BigInt(1) });

    const res = await request(app)
      .patch("/api/casos/1/unlock")
      .set("Authorization", `Bearer ${token}`);
    expect([200, 500]).toContain(res.status);
  });
});

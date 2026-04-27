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
  updateMany: jest.fn(),
};

jest.unstable_mockModule("../../src/config/prisma.js", () => ({
  prisma: {
    defensores: mockPrismaDefensores,
    unidades: { 
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ regional: "1ª Regional - Feira de Santana" })
    },
    casos: mockPrismaCasos,
    casos_partes: { findMany: jest.fn().mockResolvedValue([]) },
    logs_auditoria: { create: jest.fn().mockResolvedValue({}) },
  },
}));

jest.unstable_mockModule("../../src/config/supabase.js", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ 
      data: { id: 1, unidade_id: "u1", status: "pronto_para_analise" }, 
      error: null 
    }),
  },
  isSupabaseConfigured: false,
}));

jest.unstable_mockModule("../../src/services/loggerService.js", () => ({
  registrarLog: jest.fn().mockResolvedValue(undefined),
}));

const { default: app } = await import("../../server.js");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeJwt(cargo = "admin", id = "uuid-1") {
  return jwt.sign(
    { id, nome: "Teste", email: "t@dpe.ba.gov.br", cargo, unidade_id: "u1" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function makeProfile(cargo = "defensor", overrides = {}) {
  return {
    id: "uuid-target",
    nome: "Alvo",
    ativo: true,
    cargo: { nome: cargo },
    unidade_id: "u1",
    ...overrides,
  };
}

// ─── Testes POST /api/casos/:id/distribuir ────────────────────────────────────
describe("POST /api/casos/:id/distribuir", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 sem JWT", async () => {
    const res = await request(app).post("/api/casos/1/distribuir").send({ usuario_id: "u2" });
    expect(res.status).toBe(401);
  });

  it("bloqueia distribuição por servidor (RBAC) → 403", async () => {
    const token = makeJwt("servidor");
    mockPrismaDefensores.findUnique.mockResolvedValue(makeProfile("servidor"));

    const res = await request(app)
      .post("/api/casos/1/distribuir")
      .set("Authorization", `Bearer ${token}`)
      .send({ usuario_id: "u2" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/permissão/i);
  });

  it("permite distribuição por admin → 200", async () => {
    const token = makeJwt("admin");
    // 1ª chamada: authMiddleware (admin)
    // 2ª chamada: distribuirCaso (alvo defensor)
    mockPrismaDefensores.findUnique
      .mockResolvedValueOnce(makeProfile("admin", { id: "uuid-1" }))
      .mockResolvedValueOnce(makeProfile("defensor", { id: "u2" }));

    mockPrismaCasos.findUnique
      .mockResolvedValueOnce({ id: 1, status: "pronto_para_analise", unidade_id: "u1" }) // busca inicial
      .mockResolvedValueOnce({ id: 1, status: "em_atendimento" }); // busca final
    mockPrismaCasos.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post("/api/casos/1/distribuir")
      .set("Authorization", `Bearer ${token}`)
      .send({ usuario_id: "u2" });

    expect(res.status).toBe(200);
  });

  it("retorna 409 em caso de conflito de concorrência (Prisma count=0)", async () => {
    const token = makeJwt("gestor");
    mockPrismaDefensores.findUnique
      .mockResolvedValueOnce(makeProfile("gestor", { id: "uuid-1" }))
      .mockResolvedValueOnce(makeProfile("defensor", { id: "u2" }));

    mockPrismaCasos.findUnique.mockResolvedValue({ id: 1, status: "pronto_para_analise", unidade_id: "u1" });
    mockPrismaCasos.updateMany.mockResolvedValue({ count: 0 }); // Conflito!

    const res = await request(app)
      .post("/api/casos/1/distribuir")
      .set("Authorization", `Bearer ${token}`)
      .send({ usuario_id: "u2" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Conflito");
  });

  it("retorna 409 quando Prisma lança P2025", async () => {
    const token = makeJwt("coordenador");
    mockPrismaDefensores.findUnique
      .mockResolvedValueOnce(makeProfile("coordenador", { id: "uuid-1" }))
      .mockResolvedValueOnce(makeProfile("defensor", { id: "u2" }));

    mockPrismaCasos.findUnique.mockResolvedValue({ id: 1, status: "pronto_para_analise", unidade_id: "u1" });
    
    // Simula erro P2025
    const error = new Error("Record not found");
    error.code = 'P2025';
    mockPrismaCasos.updateMany.mockRejectedValue(error);

    const res = await request(app)
      .post("/api/casos/1/distribuir")
      .set("Authorization", `Bearer ${token}`)
      .send({ usuario_id: "u2" });

    expect(res.status).toBe(409);
  });
});

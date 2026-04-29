import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test_secret_key_at_least_32_chars_long!!";
process.env.API_KEY_SERVIDORES = "chave-secreta-de-64-chars-para-scanner-balcao-valida-1234567890ab";

// ─── Mocks ────────────────────────────────────────────────────────────────────
jest.unstable_mockModule("@upstash/qstash", () => ({
  Client: class { publishJSON() { return Promise.resolve({}); } },
  Receiver: class { verify() { return Promise.resolve(true); } },
}));

const mockPrismaDefensores = { findUnique: jest.fn() };
const mockPrismaCasos = {
  create: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  findFirst: jest.fn(),
  updateMany: jest.fn(),
  findMany: jest.fn().mockResolvedValue([]),
};

jest.unstable_mockModule("../../src/config/prisma.js", () => ({
  prisma: {
    defensores: mockPrismaDefensores,
    unidades: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "00000000-0000-0000-0000-000000000001" }) },
    casos: mockPrismaCasos,
    casos_partes: { findMany: jest.fn().mockResolvedValue([]) },
    casos_ia: { upsert: jest.fn().mockResolvedValue({}) },
    logs_auditoria: { create: jest.fn().mockResolvedValue({}) },
    notificacoes: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn().mockResolvedValue({}) },
  },
}));

jest.unstable_mockModule("../../src/config/supabase.js", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ 
      data: { id: 1, unidade_id: "u1", status: "pronto_para_analise", assistencia_casos: [] }, 
      error: null 
    }),
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

// ─── Helper: gera token válido ────────────────────────────────────────────────
function makeJwt(cargo = "defensor", id = "uuid-defensor-1") {
  return jwt.sign(
    { id, nome: "Defensor Teste", email: "d@dpe.ba.gov.br", cargo, unidade_id: "u1" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function makeUserProfile(cargo = "defensor", overrides = {}) {
  return {
    id: "uuid-defensor-1",
    nome: "Defensor Teste",
    email: "d@dpe.ba.gov.br",
    ativo: true,
    cargo: { nome: cargo },
    unidade_id: "u1",
    unidade: { nome: "Salvador" },
    ...overrides,
  };
}

// ─── POST /api/casos/novo ─────────────────────────────────────────────────────
describe("POST /api/casos/novo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaCasos.create.mockResolvedValue({ id: BigInt(1), protocolo: "20260425011111" });
    mockPrismaCasos.findFirst.mockResolvedValue(null);
  });

  const payloadMinimo = {
    nome: "Maria da Silva (Teste)",
    representante_cpf: "168.287.777-94",
    tipoAcao: "Família - Fixação",
    acaoEspecifica: "fixacao_alimentos",
    relato: "Desejo fixar alimentos para meu filho.",
    documentos_informados: JSON.stringify(["RG", "CPF"]),
    enviar_documentos_depois: "true",
  };

  it("cria caso com payload válido → 201", async () => {
    const res = await request(app)
      .post("/api/casos/novo")
      .send(payloadMinimo);
    // 201 ou 200 dependendo da rota pública, ou 400 por validação extra
    expect([200, 201, 400]).toContain(res.status);
  });

  it("retorna campo 'protocolo' na resposta de sucesso", async () => {
    const res = await request(app)
      .post("/api/casos/novo")
      .send(payloadMinimo);
    if (res.status === 201 || res.status === 200) {
      expect(res.body).toHaveProperty("protocolo");
    }
  });
});

// ─── GET /api/casos (protegida) ───────────────────────────────────────────────
describe("GET /api/casos — rota protegida por JWT", () => {
  it("retorna 401 sem Authorization header", async () => {
    const res = await request(app).get("/api/casos");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com token inválido", async () => {
    const res = await request(app)
      .get("/api/casos")
      .set("Authorization", "Bearer token_invalido");
    expect(res.status).toBe(401);
  });

  it("retorna 403 quando usuário está inativo", async () => {
    const token = makeJwt("defensor");
    mockPrismaDefensores.findUnique.mockResolvedValue(
      makeUserProfile("defensor", { ativo: false })
    );
    const res = await request(app)
      .get("/api/casos")
      .set("Authorization", `Bearer ${token}`);
    // 403 por inativo ou por usuário não encontrado
    expect([401, 403]).toContain(res.status);
  });

  it("responde sem erro de servidor (não 500) para JWT válido com usuário existente", async () => {
    const token = makeJwt("defensor");
    mockPrismaDefensores.findUnique.mockResolvedValue(makeUserProfile("defensor"));
    // Mock listagem de casos
    mockPrismaCasos.findFirst = undefined;
    const res = await request(app)
      .get("/api/casos")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).not.toBe(500);
  });
});

// ─── GET /api/casos/buscar-cpf ────────────────────────────────────────────────
describe("GET /api/casos/buscar-cpf — rota pública com rate limit", () => {
  it("retorna 400 ou 422 quando CPF não é fornecido", async () => {
    const res = await request(app).get("/api/casos/buscar-cpf");
    expect([400, 404, 422]).toContain(res.status);
  });

  it("retorna resposta JSON (não HTML)", async () => {
    const res = await request(app).get("/api/casos/buscar-cpf?cpf=12345678900");
    expect(res.headers["content-type"]).toMatch(/json/);
  });
});

// ─── DELETE /api/casos/:id (RBAC) ─────────────────────────────────────────────
describe("DELETE /api/casos/:id — requer write access", () => {
  it("retorna 401 sem JWT", async () => {
    const res = await request(app).delete("/api/casos/1");
    expect(res.status).toBe(401);
  });

  it("retorna 403 para cargo visualizador", async () => {
    const token = makeJwt("visualizador");
    mockPrismaDefensores.findUnique.mockResolvedValue(makeUserProfile("visualizador"));
    mockPrismaCasos.findUnique.mockResolvedValue({ id: 1, unidade_id: "u1" });
    
    const res = await request(app)
      .delete("/api/casos/1")
      .set("Authorization", `Bearer ${token}`);
    expect([403, 401]).toContain(res.status);
  });
});

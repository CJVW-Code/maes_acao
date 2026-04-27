import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

// ─── Configuração de variáveis de ambiente ───────────────────────────────────
process.env.JWT_SECRET = "test_secret_key_at_least_32_chars_long!!";

// ─── Mock do Prisma ───────────────────────────────────────────────────────────
const mockFindUnique = jest.fn();

jest.unstable_mockModule("../../src/config/prisma.js", () => ({
  prisma: {
    defensores: { findUnique: mockFindUnique },
  },
}));

jest.unstable_mockModule("../../src/utils/logger.js", () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const { authMiddleware, validateDownloadTicket } = await import(
  "../../src/middleware/auth.js"
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeUser(overrides = {}) {
  return {
    id: "uuid-1234",
    nome: "Defensor Teste",
    email: "defensor@dpe.ba.gov.br",
    ativo: true,
    cargo: { nome: "defensor" },
    unidade_id: "unidade-1",
    unidade: { nome: "Salvador" },
    ...overrides,
  };
}

function makeToken(payload = {}, secret = process.env.JWT_SECRET, options = {}) {
  return jwt.sign(
    {
      id: "uuid-1234",
      nome: "Defensor Teste",
      email: "defensor@dpe.ba.gov.br",
      cargo: "defensor",
      ...payload,
    },
    secret,
    { expiresIn: "1h", algorithm: "HS256", ...options }
  );
}

function mockReqRes(headers = {}) {
  const req = { headers };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
}

// ─── authMiddleware ───────────────────────────────────────────────────────────
describe("authMiddleware", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 quando não há Authorization header", async () => {
    const { req, res, next } = mockReqRes();
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 401 quando header não começa com 'Bearer '", async () => {
    const { req, res, next } = mockReqRes({ authorization: "Token abc123" });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 401 para token completamente inválido", async () => {
    const { req, res, next } = mockReqRes({ authorization: "Bearer nao_e_um_jwt" });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("bloqueia token RS256 (bypass de algoritmo)", async () => {
    // Simula um token RS256 assinado com chave privada (bypassa verificação HS256)
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const rs256Token = jwt.sign({ id: "uuid-1234", cargo: "defensor" }, privateKey, {
      algorithm: "RS256",
      expiresIn: "1h",
    });
    const { req, res, next } = mockReqRes({
      authorization: `Bearer ${rs256Token}`,
    });
    await authMiddleware(req, res, next);
    // Deve rejeitar com 401 especificamente (algorithms: ["HS256"] falha a verificação do jwt.verify)
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 401 para token expirado com code INVALID_TOKEN", async () => {
    const expiredToken = makeToken({}, process.env.JWT_SECRET, {
      expiresIn: "-1s",
    });
    const { req, res, next } = mockReqRes({
      authorization: `Bearer ${expiredToken}`,
    });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall).toHaveProperty("code", "INVALID_TOKEN");
  });

  it("retorna 403 quando usuário não existe no banco", async () => {
    const token = makeToken();
    mockFindUnique.mockResolvedValue(null);
    const { req, res, next } = mockReqRes({
      authorization: `Bearer ${token}`,
    });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 403 quando usuário está inativo (ativo: false)", async () => {
    const token = makeToken();
    mockFindUnique.mockResolvedValue(makeUser({ ativo: false }));
    const { req, res, next } = mockReqRes({
      authorization: `Bearer ${token}`,
    });
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next() e injeta req.user para token e usuário válidos", async () => {
    const token = makeToken();
    const user = makeUser();
    mockFindUnique.mockResolvedValue(user);
    const { req, res, next } = mockReqRes({
      authorization: `Bearer ${token}`,
    });
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({
      id: user.id,
      nome: user.nome,
      email: user.email,
      cargo: "defensor",
      unidade_id: user.unidade_id,
    });
  });

  it("usa 'visualizador' como cargo padrão quando cargo está ausente", async () => {
    const token = makeToken();
    const user = makeUser({ cargo: null });
    mockFindUnique.mockResolvedValue(user);
    const { req, res, next } = mockReqRes({
      authorization: `Bearer ${token}`,
    });
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.cargo).toBe("visualizador");
  });
});

// ─── validateDownloadTicket ───────────────────────────────────────────────────
describe("validateDownloadTicket", () => {
  beforeEach(() => jest.clearAllMocks());

  function makeTicket(payload = {}) {
    return jwt.sign(
      {
        purpose: "download",
        user: { id: "uuid-1", nome: "Teste", email: "t@t.com", cargo: "defensor", unidade_id: "u1" },
        path: "casos/1/doc.pdf",
        bucket: "documentos",
        casoId: "42",
        casoUnidadeId: "u1",
        ...payload,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h", algorithm: "HS256" }
    );
  }

  function mockTicketReqRes(ticket) {
    const req = { query: ticket ? { ticket } : {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();
    return { req, res, next };
  }

  it("retorna 401 quando ticket não fornecido", async () => {
    const { req, res, next } = mockTicketReqRes(null);
    await validateDownloadTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 403 quando ticket não tem purpose 'download'", async () => {
    const badTicket = makeTicket({ purpose: "admin" });
    const { req, res, next } = mockTicketReqRes(badTicket);
    await validateDownloadTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 403 (fail-closed) quando ticket não tem casoId", async () => {
    const ticket = makeTicket({ casoId: undefined });
    const { req, res, next } = mockTicketReqRes(ticket);
    await validateDownloadTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 401 para ticket expirado", async () => {
    const _expired = makeTicket({ expiresIn: "-1s" });
    // Precisa recriar manualmente com options
    const expiredTicket = jwt.sign(
      { purpose: "download", user: {}, path: "x", bucket: "y", casoId: "1" },
      process.env.JWT_SECRET,
      { expiresIn: "-1s" }
    );
    const { req, res, next } = mockTicketReqRes(expiredTicket);
    await validateDownloadTicket(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("chama next() e popula req.ticket para ticket válido", async () => {
    const ticket = makeTicket();
    const { req, res, next } = mockTicketReqRes(ticket);
    await validateDownloadTicket(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.ticket).toMatchObject({
      path: "casos/1/doc.pdf",
      bucket: "documentos",
      casoId: "42",
    });
    expect(req.user).toMatchObject({ id: "uuid-1", cargo: "defensor" });
  });
});

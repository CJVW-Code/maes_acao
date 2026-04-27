import { jest } from "@jest/globals";

process.env.API_KEY_SERVIDORES = "chave-secreta-de-64-chars-para-scanner-balcao-valida-1234567890ab";

jest.unstable_mockModule("../../src/utils/logger.js", () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const { apiKeyMiddleware } = await import("../../src/middleware/apiKeyMiddleware.js");

// ─── Helper ───────────────────────────────────────────────────────────────────
function run(apiKey) {
  const req = { headers: {} };
  if (apiKey !== undefined) req.headers["x-api-key"] = apiKey;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  apiKeyMiddleware(req, res, next);
  return { req, res, next };
}

// ─── Testes ───────────────────────────────────────────────────────────────────
describe("apiKeyMiddleware", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 quando X-API-Key não é fornecida", () => {
    const { res, next } = run(undefined);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 403 quando X-API-Key é inválida", () => {
    const { res, next } = run("chave-errada-qualquer");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 403 para string vazia como X-API-Key", () => {
    const { res, next } = run("");
    // Header vazio é tratado como ausente (falsy)
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next() com chave válida", () => {
    const { res, next } = run(process.env.API_KEY_SERVIDORES);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("injeta req.user com cargo 'sistema' para chave válida", () => {
    const { req, next } = run(process.env.API_KEY_SERVIDORES);
    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({
      cargo: "sistema",
      nome: "Scanner Automático",
    });
  });

  it("mensagem de 401 menciona 'Scanner/Balcão'", () => {
    const { res } = run(undefined);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/scanner/i);
  });

  it("mensagem de 403 indica chave inválida", () => {
    const { res } = run("qualquer-outra-coisa");
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/inválida|invalida/i);
  });
});

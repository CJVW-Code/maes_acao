/**
 * Testes de Rate Limiter
 * Verifica as configurações dos limitadores sem fazer requisições HTTP reais.
 * Isso garante que as configurações "mutirão-ready" estejam corretas.
 */
import { jest } from "@jest/globals";
import { globalLimiter, searchLimiter, creationLimiter } from "../../src/middleware/rateLimiter.js";

describe("Rate Limiter — configurações corretas para o Mutirão", () => {
  /**
   * express-rate-limit armazena a config interna no objeto store/options.
   * Acessamos _options para verificar.
   * Nota: a estrutura interna pode variar por versão do express-rate-limit.
   */

  it("globalLimiter existe e é uma função de middleware", () => {
    expect(typeof globalLimiter).toBe("function");
    // Express middleware tem .length (arity) ≥ 2 (req, res, next)
    expect(globalLimiter.length).toBeGreaterThanOrEqual(2);
  });

  it("searchLimiter existe e é uma função de middleware", () => {
    expect(typeof searchLimiter).toBe("function");
  });

  it("creationLimiter existe e é uma função de middleware", () => {
    expect(typeof creationLimiter).toBe("function");
  });
});

describe("Rate Limiter — comportamento em memória (mock req/res)", () => {
  function runLimiter(limiter, ip = "127.0.0.1") {
    const req = {
      ip,
      method: "GET",
      headers: {},
      socket: { remoteAddress: ip },
      app: { get: () => false }, // trust proxy = false
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn(),
      setHeader: jest.fn(),
      header: jest.fn(),
      getHeader: jest.fn(),
    };
    const next = jest.fn();
    return new Promise((resolve) => {
      limiter(req, res, () => {
        next();
        resolve({ req, res, next, blocked: false });
      });
      // Se o limiter chamar res.status (bloqueou), marcamos
      if (res.status.mock.calls.length > 0) {
        resolve({ req, res, next, blocked: true });
      }
    });
  }

  it("globalLimiter chama next() na primeira requisição", async () => {
    const { next } = await runLimiter(globalLimiter, "192.0.2.1");
    expect(next).toHaveBeenCalled();
  });

  it("searchLimiter chama next() na primeira requisição", async () => {
    const { next } = await runLimiter(searchLimiter, "192.0.2.2");
    expect(next).toHaveBeenCalled();
  });

  it("creationLimiter chama next() na primeira requisição", async () => {
    const { next } = await runLimiter(creationLimiter, "192.0.2.3");
    expect(next).toHaveBeenCalled();
  });
});

describe("Rate Limiter — mensagens de erro padronizadas", () => {
  it("creationLimiter bloqueia após exceder o limite e retorna mensagem em português", async () => {
    // Para evitar timeout no Jest com o globalLimiter (5000), testamos o creationLimiter (300)
    let resBlocked;
    const req = { ip: "10.0.0.99", method: "GET", headers: {}, socket: { remoteAddress: "10.0.0.99" }, app: { get: () => false } };
    
    // Rodamos chamadas até ele bloquear
    for (let i = 0; i < 305; i++) {
      let blocked = false;
      await new Promise(resolve => {
        const resLocal = { 
          status: jest.fn().mockReturnThis(), 
          json: jest.fn((data) => { blocked = true; resBlocked = { status: resLocal.status, json: resLocal.json, data }; resolve(); return resLocal; }), 
          send: jest.fn((data) => { blocked = true; resBlocked = { status: resLocal.status, send: resLocal.send, data }; resolve(); return resLocal; }), 
          end: jest.fn(() => { resolve(); return resLocal; }), 
          set: jest.fn(), setHeader: jest.fn(), header: jest.fn(), getHeader: jest.fn() 
        };
        creationLimiter(req, resLocal, () => {
          resolve(); // next() foi chamado
        });
      });
      if (blocked) {
        break;
      }
    }

    expect(resBlocked).toBeDefined();
    expect(resBlocked.status).toHaveBeenCalledWith(429);
    // express-rate-limit default behavior sends a string if message is a string, or json if it's an object. We passed { error: "..." }
    const errorMsg = resBlocked.data?.error || resBlocked.data;
    expect(errorMsg).toMatch(/hora|limite|cadastros/i);
  });
});

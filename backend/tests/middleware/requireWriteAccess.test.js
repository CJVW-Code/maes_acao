import { jest } from "@jest/globals";
import { requireWriteAccess } from "../../src/middleware/requireWriteAccess.js";

// ─── Helper ───────────────────────────────────────────────────────────────────
function run(cargo, hasUser = true) {
  const req = hasUser ? { user: { cargo } } : {};
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  requireWriteAccess(req, res, next);
  return { res, next };
}

// ─── Cargos Bloqueados ────────────────────────────────────────────────────────
describe("requireWriteAccess — cargos bloqueados", () => {
  it("retorna 401 quando req.user está ausente", () => {
    const { res, next } = run(null, false);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("bloqueia 'visualizador' com 403", () => {
    const { res, next } = run("visualizador");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("bloqueia 'Visualizador' (maiúsculo) com 403 — case-insensitive", () => {
    const { res, next } = run("Visualizador");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("bloqueia 'VISUALIZADOR' (uppercase) com 403", () => {
    const { res, next } = run("VISUALIZADOR");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("bloqueia cargo desconhecido ('hacker') com 403", () => {
    const { res, next } = run("hacker");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("resposta de 403 contém mensagem explicativa", () => {
    const { res } = run("visualizador");
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty("error");
    expect(body.error.toLowerCase()).toMatch(/leitura|acesso negado/i);
  });
});

// ─── Cargos Permitidos ────────────────────────────────────────────────────────
describe("requireWriteAccess — cargos permitidos", () => {
  const allowedRoles = ["admin", "coordenador", "defensor", "servidor", "estagiario"];

  allowedRoles.forEach((cargo) => {
    it(`chama next() para cargo '${cargo}'`, () => {
      const { res, next } = run(cargo);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  it("chama next() para cargo em maiúsculas 'ADMIN' (case-insensitive)", () => {
    const { res, next } = run("ADMIN");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("chama next() para cargo misto 'Defensor'", () => {
    const { res, next } = run("Defensor");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

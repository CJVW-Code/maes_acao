import { jest } from "@jest/globals";

const mockPrisma = {
  casos: {
    findUnique: jest.fn(),
  },
};

// Mock deve vir antes do import do módulo que o consome
jest.unstable_mockModule("../../src/config/prisma.js", () => ({
  prisma: mockPrisma,
}));

// Agora sim importamos o middleware
const { requireSameUnit } = await import("../../src/middleware/requireSameUnit.js");

describe("Middleware: requireSameUnit", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { id: "1" },
      user: { id: "u1", cargo: "defensor", unidade_id: "unidade-a" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it("permite acesso se a unidade do caso coincide com a do usuário", async () => {
    mockPrisma.casos.findUnique.mockResolvedValue({ unidade_id: "unidade-a" });

    await requireSameUnit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.caso).toBeDefined();
    expect(req.caso.unidade_id).toBe("unidade-a");
  });

  it("bloqueia acesso (403) se a unidade do caso é diferente", async () => {
    mockPrisma.casos.findUnique.mockResolvedValue({ unidade_id: "unidade-b" });

    await requireSameUnit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining("unidade"),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it("permite acesso para administradores mesmo de unidades diferentes", async () => {
    req.user.cargo = "admin";
    req.user.unidade_id = "unidade-admin";
    mockPrisma.casos.findUnique.mockResolvedValue({ unidade_id: "unidade-b" });

    await requireSameUnit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("retorna 404 se o caso não existe", async () => {
    mockPrisma.casos.findUnique.mockResolvedValue(null);

    await requireSameUnit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("trata erro de banco retornando 500", async () => {
    mockPrisma.casos.findUnique.mockRejectedValue(new Error("Database error"));

    await requireSameUnit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

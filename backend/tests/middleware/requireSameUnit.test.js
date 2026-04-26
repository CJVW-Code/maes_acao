import { jest } from "@jest/globals";

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

// Mock deve vir antes do import do módulo que o consome
jest.unstable_mockModule("../../src/config/supabase.js", () => ({
  supabase: mockSupabase,
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
    mockSupabase.single.mockResolvedValue({ data: { id: "1", unidade_id: "unidade-a" }, error: null });

    await requireSameUnit(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.casoBasic).toBeDefined();
    expect(req.casoBasic.unidade_id).toBe("unidade-a");
  });

  it("bloqueia acesso (403) se a unidade do caso é diferente", async () => {
    mockSupabase.single.mockResolvedValue({ data: { id: "1", unidade_id: "unidade-b" }, error: null });

    await requireSameUnit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining("negado"),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it("permite acesso para administradores mesmo de unidades diferentes", async () => {
    req.user.cargo = "admin";
    req.user.unidade_id = "unidade-admin";
    // Nem chama o banco para admin/gestor (bypass)
    await requireSameUnit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("permite acesso para gestores mesmo de unidades diferentes", async () => {
    req.user.cargo = "gestor";
    req.user.unidade_id = "unidade-gestor";
    await requireSameUnit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("permite acesso para colaboradores com assistência aceita", async () => {
    mockSupabase.single.mockResolvedValue({ 
      data: { 
        id: "1", 
        unidade_id: "unidade-outra",
        assistencia_casos: [{ destinatario_id: "u1", status: "aceito" }]
      }, 
      error: null 
    });

    await requireSameUnit(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("retorna 404 se o caso não existe", async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    await requireSameUnit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("trata erro de banco retornando 500", async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: "Database error" } });

    await requireSameUnit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

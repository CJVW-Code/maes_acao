import { jest } from "@jest/globals";

// Mock do loggerService
jest.unstable_mockModule("../src/services/loggerService.js", () => ({
  registrarLog: jest.fn(),
}));

// Dynamic import is required AFTER the unstable_mockModule call for ES Modules
const { auditMiddleware } = await import("../src/middleware/auditMiddleware.js");
const { registrarLog } = await import("../src/services/loggerService.js");

describe("Audit Middleware", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    req = {
      method: "PATCH",
      originalUrl: "/api/casos/123/status",
      baseUrl: "/api/casos",
      body: { status: "em_analise" },
      params: { id: "123" },
      user: { id: "user_1" }
    };

    res = {
      statusCode: 200,
      on: jest.fn((event, callback) => {
        if (event === "finish") {
          // Immediately invoke the 'finish' callback when .on is called
          // This simulates the response finishing
          callback();
        }
      })
    };

    next = jest.fn();
  });

  it("should skip logging for GET requests", () => {
    req.method = "GET";
    auditMiddleware(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(res.on).not.toHaveBeenCalled();
    expect(registrarLog).not.toHaveBeenCalled();
  });

  it("should log successful requests and extract entity from baseUrl", () => {
    // Execute middleware
    auditMiddleware(req, res, next);

    // Verify next was called
    expect(next).toHaveBeenCalled();

    // Verify log was recorded because we mocked 'res.on' to execute immediately
    expect(registrarLog).toHaveBeenCalledWith(
      "user_1",             // usuarioId
      "PATCH /api/casos/123/status", // acao
      "casos",              // entidade (from baseUrl: "/api/casos")
      "123",                // registroId
      { status: "em_analise" } // detalhes
    );
  });
  
  it("should hide passwords in details", () => {
    req.body.senha = "segredo";
    req.body.password = "123456";
    
    auditMiddleware(req, res, next);
    
    expect(registrarLog).toHaveBeenCalled();
    const mockCallDetails = registrarLog.mock.calls[0][4]; // The details object
    
    expect(mockCallDetails.senha).toBe("***");
    expect(mockCallDetails.password).toBe("***");
    expect(mockCallDetails.status).toBe("em_analise");
  });
});

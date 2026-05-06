import { jest } from "@jest/globals";
import request from "supertest";
import express from "express";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockVerify = jest.fn();
jest.unstable_mockModule("@upstash/qstash", () => ({
  Receiver: class {
    constructor() {}
    verify() {
      return mockVerify();
    }
  },
}));

// Mock do Supabase com suporte a encadeamento e "thenable"
const mockSupabaseSingle = jest.fn();
const mockSupabaseEq = jest.fn();

const mockChain = {
  select: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: mockSupabaseEq,
  single: mockSupabaseSingle,
};

// Faz o mockChain se comportar como uma promessa se for aguardado diretamente
mockSupabaseEq.mockImplementation(function() {
  const promise = Promise.resolve({ data: {}, error: null });
  return Object.assign(promise, mockChain);
});

jest.unstable_mockModule("../../src/config/supabase.js", () => ({
  supabase: {
    from: jest.fn().mockReturnValue(mockChain),
  },
  isSupabaseConfigured: true,
}));

const mockProcessarCaso = jest.fn();
jest.unstable_mockModule("../../src/controllers/casosController.js", () => ({
  processarCasoEmBackground: mockProcessarCaso,
}));

// Importamos a rota e o middleware diretamente
const { default: jobsRoutes } = await import("../../src/routes/jobs.js");

// Criamos um app minimalista para o teste
const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use("/api/jobs", jobsRoutes);

describe("POST /api/jobs/process", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset defaults
    mockSupabaseEq.mockImplementation(function() {
      const promise = Promise.resolve({ data: {}, error: null });
      return Object.assign(promise, mockChain);
    });
    mockSupabaseSingle.mockResolvedValue({ data: {}, error: null });
  });

  it("retorna 401 se a assinatura for inválida", async () => {
    mockVerify.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/jobs/process")
      .set("upstash-signature", "invalid-sig")
      .send({ protocolo: "123" });

    expect(res.status).toBe(401);
    expect(res.text).toBe("Invalid signature");
  });

  it("processa o job com sucesso quando assinatura e payload são válidos", async () => {
    mockVerify.mockResolvedValue(true);
    
    // Configura o mock para a busca inicial (select().eq().single())
    mockSupabaseEq.mockReturnValue(mockChain); // Para que .single() funcione
    mockSupabaseSingle.mockResolvedValue({
      data: { id: 1, protocolo: "20260001", status: "aguardando_documentos" },
      error: null,
    });

    // Configura o mock para o update final (update().eq())
    // O segundo chamado de eq deve retornar a promessa de sucesso
    mockSupabaseEq.mockReturnValueOnce(mockChain) // Para o select
                  .mockResolvedValueOnce({ error: null }); // Para o update

    const res = await request(app)
      .post("/api/jobs/process")
      .set("upstash-signature", "valid-sig")
      .send({ protocolo: "20260001" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockProcessarCaso).toHaveBeenCalledWith("20260001", undefined, expect.any(Array), undefined, undefined);
  });

  it("retorna 404 se o protocolo não existir no banco", async () => {
    mockVerify.mockResolvedValue(true);
    
    mockSupabaseEq.mockReturnValue(mockChain);
    mockSupabaseSingle.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const res = await request(app)
      .post("/api/jobs/process")
      .set("upstash-signature", "valid-sig")
      .send({ protocolo: "999999" });

    expect(res.status).toBe(404);
  });
});

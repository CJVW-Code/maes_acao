import { jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "test_secret_key_at_least_32_chars_long!!";

// ─── Mocks ────────────────────────────────────────────────────────────────────
const mockArchiver = {
  pipe: jest.fn().mockImplementation((dest) => {
    // Simula o fechamento do stream para que o supertest não fique pendente
    setImmediate(() => {
      dest.write("dummy-zip-data");
      dest.end();
    });
    return dest;
  }),
  append: jest.fn(),
  finalize: jest.fn().mockResolvedValue(true),
  on: jest.fn().mockReturnThis(),
};

jest.unstable_mockModule("archiver", () => ({
  default: () => mockArchiver,
}));

const mockSupabaseDownload = jest.fn().mockResolvedValue({
  data: Buffer.from("arquivo teste"),
  error: null,
});

jest.unstable_mockModule("../../src/config/supabase.js", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { 
        id: 1, 
        protocolo: "20260001", 
        unidade_id: "u1",
        documentos: [{ storage_path: "doc1.pdf", nome_original: "rg.pdf" }],
        ia: { url_peticao: "peticao.docx" }
      },
      error: null,
    }),
    storage: {
      from: jest.fn().mockReturnThis(),
      download: mockSupabaseDownload,
    }
  },
  isSupabaseConfigured: true,
}));

// Importa o app depois dos mocks
const { default: app } = await import("../../server.js");

describe("GET /api/casos/:id/download-zip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeTicket = (casoId = 1) => {
    return jwt.sign(
      { 
        purpose: "download", 
        user: { id: "u1", cargo: "defensor", unidade_id: "u1" },
        casoId: String(casoId),
        casoUnidadeId: "u1"
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m" }
    );
  };

  it("retorna 401 se o ticket não for fornecido", async () => {
    const res = await request(app).get("/api/casos/1/download-zip");
    expect(res.status).toBe(401);
  });

  it("gera ZIP com sucesso quando ticket é válido", async () => {
    const ticket = makeTicket(1);
    
    const res = await request(app)
      .get("/api/casos/1/download-zip")
      .query({ ticket });

    expect(res.status).toBe(200);
    expect(res.header["content-type"]).toBe("application/zip");
    expect(res.header["content-disposition"]).toContain("attachment");
    expect(res.header["content-disposition"]).toContain("20260001");
    
    // Verifica se o archiver foi chamado
    expect(mockArchiver.append).toHaveBeenCalled();
    expect(mockArchiver.finalize).toHaveBeenCalled();
  });

  it("retorna 403 se o ticket for para um caso diferente do ID na rota", async () => {
    const ticket = makeTicket(2); // Ticket para o caso 2
    
    const res = await request(app)
      .get("/api/casos/1/download-zip") // Tentando baixar o caso 1
      .query({ ticket });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("Ticket não autorizado para este caso.");
  });
});

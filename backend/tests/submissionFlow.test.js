import { jest } from "@jest/globals";
import request from "supertest";

// Mock minimal para evitar SyntaxError de exports nomeados
jest.unstable_mockModule("@upstash/qstash", () => {
  return {
    Client: class MockClient { publishJSON() { return Promise.resolve({}); } },
    Receiver: class MockReceiver { verify() { return Promise.resolve(true); } },
    __esModule: true
  };
});

jest.unstable_mockModule("../src/config/supabase.js", () => ({
  isSupabaseConfigured: false,
  supabase: {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { protocolo: "T1" }, error: null }),
    select: jest.fn().mockReturnThis(),
    storage: { from: jest.fn().mockReturnThis(), upload: jest.fn().mockResolvedValue({ error: null }) }
  }
}));

jest.unstable_mockModule("../src/config/prisma.js", () => ({
  prisma: {
    unidades: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1, comarca: "Teixeira de Freitas" }),
    },
    casos: {
      create: jest.fn().mockResolvedValue({ id: 1, protocolo: "T1" }),
      update: jest.fn().mockResolvedValue({ id: 1, protocolo: "T1" }),
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        protocolo: "T1",
        relato_texto: "Relato de teste",
        dados_formulario: {},
      }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    casos_partes: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    casos_ia: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}));

const { default: app } = await import("../server.js");
const { processarCasoEmBackground } = await import("../src/controllers/casosController.js");

describe("Minimal Submission Test", () => {
  it("should run", async () => {
    console.log("🚀 START");
    const payload = {
      nome: "Fulano de Tal (Teste)",
      cpf: "100.000.000-19",
      telefone: "(73) 98888-8888",
      acaoEspecifica: "fixacao_alimentos",
      tipoAcao: "Fixação - Fixação de Pensão Alimentícia",
      relato: "Desejo fixar alimentos para meu filho.",
      documentos_informados: JSON.stringify(["RG", "CPF"])
    };

    const res = await request(app).post("/api/casos/novo").send(payload);
    
    if (res.status !== 201) {
      console.error("❌ ERRO NA SUBMISSÃO:", res.body);
    }
    
    expect(res.status).toBe(201);
    
    console.log("✨ Mágica em cascata iniciada...");
    await processarCasoEmBackground("T1", payload, [], null, null);
    
    console.log("✅ END");
  });
});

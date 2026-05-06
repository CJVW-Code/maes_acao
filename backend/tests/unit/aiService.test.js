import { jest } from "@jest/globals";

// ──────────────────────────────────────────────────────────
// Mocks de clientes externos — devem vir ANTES do import do módulo
// ──────────────────────────────────────────────────────────

// Resposta padrão de sucesso para ambos
const mockGroqCreate = jest.fn();
const mockGeminiGenerate = jest.fn();
const mockOpenAICreate = jest.fn();

jest.unstable_mockModule("groq-sdk", () => ({
  default: class MockGroq {
    constructor() {
      this.chat = { completions: { create: mockGroqCreate } };
    }
  },
}));

jest.unstable_mockModule("@google/generative-ai", () => ({
  GoogleGenerativeAI: class MockGoogleAI {
    getGenerativeModel() {
      return { generateContent: mockGeminiGenerate };
    }
  },
}));

jest.unstable_mockModule("openai", () => ({
  default: class MockOpenAI {
    constructor() {
      this.chat = { completions: { create: mockOpenAICreate } };
    }
  },
}));

process.env.GROQ_API_KEY = "dummy_groq_key_for_testing";
process.env.GEMINI_API_KEY = "dummy_gemini_key_for_testing";
process.env.OPENAI_API_KEY = "dummy_openai_key_for_testing";

// Carrega o módulo DEPOIS dos mocks (padrão ESM)
const { generateLegalText } = await import(
  "../../src/services/aiService.js"
);

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
function makeGroqSuccess(text) {
  return Promise.resolve({
    choices: [{ message: { content: text } }],
  });
}

function makeOpenAISuccess(text) {
  return Promise.resolve({
    choices: [{ message: { content: text } }],
  });
}

// ──────────────────────────────────────────────────────────
// generateLegalText — PII Sanitization
// ──────────────────────────────────────────────────────────
describe("aiService — generateLegalText: PII Sanitization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Groq retorna texto com placeholder
    mockGroqCreate.mockImplementationOnce(({ messages }) => {
      // Captura o que foi enviado e devolve como texto gerado
      const userPrompt = messages.find((m) => m.role === "user")?.content || "";
      return makeGroqSuccess(`RESULTADO: ${userPrompt}`);
    });
  });

  it("substitui nome real por placeholder antes de enviar para IA", async () => {
    const piiMap = { "Maria da Silva": "[NOME_AUTOR]" };

    await generateLegalText(
      "System prompt",
      "A autora Maria da Silva requer alimentos.",
      0.3,
      piiMap
    );

    const callArgs = mockGroqCreate.mock.calls[0][0];
    const userPromptEnviado = callArgs.messages.find(
      (m) => m.role === "user"
    )?.content;

    expect(userPromptEnviado).not.toContain("Maria da Silva");
    expect(userPromptEnviado).toContain("[NOME_AUTOR]");
  });

  it("restaura o placeholder pelo nome real no texto retornado", async () => {
    mockGroqCreate.mockReset();
    // Groq retorna texto com o placeholder
    mockGroqCreate.mockResolvedValue(
      makeGroqSuccess("A [NOME_AUTOR] solicita alimentos.")
    );

    const piiMap = { "Maria da Silva": "[NOME_AUTOR]" };
    const result = await generateLegalText(
      "System",
      "contexto",
      0.3,
      piiMap
    );

    expect(result).toContain("Maria da Silva");
    expect(result).not.toContain("[NOME_AUTOR]");
  });

  it("ignora chaves PII com menos de 3 caracteres", async () => {
    mockGroqCreate.mockReset();
    mockGroqCreate.mockImplementationOnce(({ messages }) => {
      const user = messages.find((m) => m.role === "user")?.content || "";
      return makeGroqSuccess(`ECO: ${user}`);
    });

    // "Jo" tem 2 chars — deve ser ignorado
    const piiMap = { Jo: "[PLACEHOLDER_CURTO]" };
    await generateLegalText("sys", "Texto com Jo aqui.", 0.3, piiMap);

    const callArgs = mockGroqCreate.mock.calls[0][0];
    const userPromptEnviado = callArgs.messages.find(
      (m) => m.role === "user"
    )?.content;

    // "Jo" não deve ter sido substituído
    expect(userPromptEnviado).toContain("Jo");
  });

  it("substitui múltiplas ocorrências da mesma PII", async () => {
    mockGroqCreate.mockReset();
    mockGroqCreate.mockImplementationOnce(({ messages }) => {
      const user = messages.find((m) => m.role === "user")?.content || "";
      return makeGroqSuccess(user);
    });

    const piiMap = { "Carlos Souza": "[NOME_REQUERIDO]" };
    const texto = "Carlos Souza mora com Carlos Souza em Carlos Souza Street.";

    await generateLegalText("sys", texto, 0.3, piiMap);

    const callArgs = mockGroqCreate.mock.calls[0][0];
    const enviado = callArgs.messages.find((m) => m.role === "user")?.content;
    expect(enviado).not.toContain("Carlos Souza");
    expect(enviado.split("[NOME_REQUERIDO]").length - 1).toBe(3);
  });
});

// ──────────────────────────────────────────────────────────
// generateLegalText — Fallback para OpenAI
// ──────────────────────────────────────────────────────────
describe("aiService — generateLegalText: Fallback Groq → OpenAI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("usa OpenAI quando Groq lança erro", async () => {
    mockGroqCreate.mockRejectedValueOnce(new Error("Groq rate limit"));
    mockOpenAICreate.mockResolvedValueOnce(makeOpenAISuccess("Texto do OpenAI fallback"));

    const result = await generateLegalText("sys", "prompt", 0.3, {});
    expect(result).toBe("Texto do OpenAI fallback");
    expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
  });

  it("lança erro quando ambos falham", async () => {
    mockGroqCreate.mockRejectedValueOnce(new Error("Groq down"));
    mockOpenAICreate.mockRejectedValueOnce(new Error("OpenAI down"));

    await expect(generateLegalText("sys", "prompt", 0.3, {})).rejects.toThrow(
      /Inteligência Artificial indisponível|ambos.*falharam/i
    );
  });
});

// ──────────────────────────────────────────────────────────
// generateLegalText — Timeout
// ──────────────────────────────────────────────────────────
describe("aiService — generateLegalText: Timeout", () => {
  it("lança erro quando Groq excede o tempo limite", async () => {
    jest.clearAllMocks();
    // Simula Groq nunca resolvendo (timeout real excedido)
    mockGroqCreate.mockImplementationOnce(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout: Chamada Groq excedeu o limite de tempo")), 10))
    );
    mockOpenAICreate.mockRejectedValueOnce(new Error("OpenAI also failed"));

    await expect(generateLegalText("sys", "prompt", 0.3, {})).rejects.toThrow();
  }, 10000);
});

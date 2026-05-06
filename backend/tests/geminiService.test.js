import { jest } from "@jest/globals";

// Mock logger
jest.unstable_mockModule("../src/utils/logger.js", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock aiService
jest.unstable_mockModule("../src/services/aiService.js", () => ({
  generateLegalText: jest.fn().mockResolvedValue(
    "Fragmento de texto jurídico gerado pela IA."
  ),
  __esModule: true,
}));

const { generateDosFatos, normalizePromptData } = await import(
  "../src/services/geminiService.js"
);
const { generateLegalText } = await import("../src/services/aiService.js");
const logger = (await import("../src/utils/logger.js")).default;

describe("normalizePromptData", () => {
  it("deve normalizar dados básicos do caso", () => {
    const raw = {
      nome_assistido: "MARIA DA SILVA",
      cpf_assistido: "123.456.789-00",
      nome_requerido: "JOÃO DA SILVA",
      relato_texto: "Pai não paga pensão",
      tipo_acao: "fixacao_alimentos",
    };

    const result = normalizePromptData(raw);

    expect(result.requerente.nome).toBeDefined();
    expect(result.requerido.nome).toBeDefined();
    expect(result.relato).toBe("Pai não paga pensão");
    expect(result.triagemNumero).toBeDefined();
  });
});

describe("generateDosFatos (Pipeline Atômico Apex 2.0)", () => {
  const dadosCasoBase = {
    nome_assistido: "PEDRO HENRIQUE SILVA",
    relato_texto: "O pai não contribui para as despesas do filho.",
    tipo_acao: "fixacao_alimentos",
    valor_pensao: "500",
    opcao_guarda: "regularizar",
    situacao_financeira_genitora: "Desempregada",
    ocupacao_requerido: "Mecânico",
    representante_nome: "ANA MARIA SILVA",
    nome_requerido: "CARLOS SOUZA"
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve disparar múltiplas chamadas (Atoms) para fixacao_alimentos", async () => {
    await generateDosFatos(dadosCasoBase, "fixacao_alimentos");

    // VINCULO, OMISSAO, HIPOSSUFICIENCIA, NECESSIDADES, CAPACIDADE, GUARDA = 6 chamadas
    expect(generateLegalText).toHaveBeenCalledTimes(6);
    
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("Iniciando Pipeline Atômico")
    );
  });

  it("deve EXCLUIR o Atom de GUARDA se opcao_guarda for 'nao'", async () => {
    const dadosSemGuarda = { ...dadosCasoBase, opcao_guarda: "nao" };
    
    // Configura o mock para retornar texto que contenha a palavra "guarda" para testar o filtro
    generateLegalText.mockResolvedValue("Texto sobre o tema.");

    const resultado = await generateDosFatos(dadosSemGuarda, "fixacao_alimentos");

    // 6 - 1 (GUARDA) = 5 chamadas
    expect(generateLegalText).toHaveBeenCalledTimes(5);
    expect(resultado.toLowerCase()).not.toContain("guarda");
  });

  it("deve pular o Atom de CAPACIDADE se não houver ocupacao_requerido", async () => {
    const dadosSemOcupacao = { ...dadosCasoBase, ocupacao_requerido: "" };
    await generateDosFatos(dadosSemOcupacao, "fixacao_alimentos");

    // 6 - 1 (CAPACIDADE) = 5 chamadas
    expect(generateLegalText).toHaveBeenCalledTimes(5);
  });

  it("deve aplicar conectores determinísticos nos parágrafos", async () => {
    generateLegalText.mockImplementation((sys, user) => {
      if (user.includes("vincule ao valor pretendido")) return "IA gerou necessidades.";
      return "IA gerou texto.";
    });

    const resultado = await generateDosFatos(dadosCasoBase, "fixacao_alimentos");
    
    // Verifica se o conector de NECESSIDADES foi aplicado
    expect(resultado).toContain("Nesse contexto, iA gerou necessidades.");
  });

  it("deve sanitizar fragmentos individuais (Nuker - destruir sentença com 1ª pessoa)", async () => {
    generateLegalText.mockResolvedValue("Eu acho que ele deve pagar. No entanto, o requerido é solvente.");
    
    const resultado = await generateDosFatos(dadosCasoBase, "fixacao_alimentos");
    expect(resultado).not.toContain("Eu acho");
    expect(resultado).toContain("No entanto, o requerido é solvente");
  });

  it("deve usar PII Map para mascarar nomes nos Atoms", async () => {
    await generateDosFatos(dadosCasoBase, "fixacao_alimentos");

    const piiMap = generateLegalText.mock.calls[0][3];
    // Nomes são formatados (Proper Case) pelo normalizePromptData
    expect(piiMap["Pedro Henrique Silva"]).toBe("[NOME_AUTOR_PRINCIPAL]");
    expect(piiMap["Ana Maria Silva"]).toBe("[NOME_REPRESENTANTE]");
  });
});



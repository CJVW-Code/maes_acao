import { jest } from "@jest/globals";

// Mock logger
jest.unstable_mockModule("../src/utils/logger.js", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock aiService (não queremos chamar IA real nos testes)
jest.unstable_mockModule("../src/services/aiService.js", () => ({
  generateLegalText: jest.fn().mockResolvedValue(
    "O alimentando é fruto da relação entre as partes. " +
    "Ocorre que o genitor não contribui voluntariamente para o sustento. " +
    "A genitora vem arcando sozinha com todas as despesas. " +
    "As necessidades mensais giram em torno de R$ 500,00."
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
    expect(result.tipo_acao).toBe("fixacao_alimentos");
    expect(result.comarca).toBeDefined();
  });

  it("deve usar defaults quando dados estão vazios", () => {
    const result = normalizePromptData({});
    expect(result.comarca).toContain("Teixeira de Freitas");
    expect(result.relato).toBe("");
  });
});

describe("generateDosFatos", () => {
  const dadosCasoBase = {
    nome_assistido: "PEDRO HENRIQUE SILVA",
    cpf_assistido: "123.456.789-00",
    requerente_data_nascimento: "2020-05-15",
    nome_requerido: "CARLOS SOUZA",
    cpf_requerido: "987.654.321-00",
    relato_texto: "O pai não contribui para as despesas do filho.",
    tipo_acao: "fixacao_alimentos",
    valor_mensal_pensao: "500",
    descricao_guarda: "A guarda é exercida pela mãe",
    situacao_financeira_genitora: "Desempregada",
    assistido_eh_incapaz: "sim",
    representante_nome: "ANA MARIA SILVA",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deve chamar generateLegalText com acaoKey fixacao_alimentos (DICIONÁRIO)", async () => {
    await generateDosFatos(dadosCasoBase, "fixacao_alimentos");

    expect(generateLegalText).toHaveBeenCalledTimes(1);

    const [systemPrompt] = generateLegalText.mock.calls[0];
    expect(systemPrompt).toContain("Defensor Público");
    expect(systemPrompt).toContain('"menor" — use "filho"');

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("DICIONÁRIO")
    );
  });

  it("deve usar FALLBACK_LEGADO para ação sem prompt (divorcio)", async () => {
    await generateDosFatos(dadosCasoBase, "divorcio");

    expect(generateLegalText).toHaveBeenCalledTimes(1);

    const [systemPrompt] = generateLegalText.mock.calls[0];
    // Fallback usa o mesmo prompt (Defensor Público)
    expect(systemPrompt).toContain("Defensor Público");

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("FALLBACK_LEGADO")
    );
  });

  it("deve usar FALLBACK_LEGADO para acaoKey undefined", async () => {
    await generateDosFatos(dadosCasoBase, undefined);

    expect(generateLegalText).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("FALLBACK_LEGADO")
    );
  });

  it("deve sanitizar o texto retornado (remover títulos MD)", async () => {
    generateLegalText.mockResolvedValueOnce(
      "## Dos Fatos\n\nO alimentando é fruto da relação entre as partes."
    );

    const resultado = await generateDosFatos(dadosCasoBase, "fixacao_alimentos");
    expect(resultado).not.toContain("## Dos Fatos");
    expect(resultado).toContain("O alimentando é fruto da relação");
  });

  it("deve propagar erro quando IA falha", async () => {
    generateLegalText.mockRejectedValueOnce(new Error("Timeout na IA"));

    await expect(
      generateDosFatos(dadosCasoBase, "fixacao_alimentos")
    ).rejects.toThrow("Timeout na IA");
  });

  it("deve enviar piiMap para sanitização", async () => {
    await generateDosFatos(dadosCasoBase, "fixacao_alimentos");

    // O 4º argumento do generateLegalText é o piiMap
    const piiMap = generateLegalText.mock.calls[0][3];
    expect(piiMap).toBeDefined();
    expect(typeof piiMap).toBe("object");
  });
});

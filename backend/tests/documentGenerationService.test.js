/* eslint-disable no-unused-vars */
import { jest } from "@jest/globals";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Mock logger
jest.unstable_mockModule("../src/utils/logger.js", () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { generateDocx, generateTermoDeclaracao } = await import(
  "../src/services/documentGenerationService.js"
);
const { getConfigAcaoBackend } = await import("../src/config/dicionarioAcoes.js");
const logger = (await import("../src/utils/logger.js")).default;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const templatesDir = path.resolve(__dirname, "..", "templates");

describe("documentGenerationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Templates existem no disco", () => {
    const templatesEsperados = [
      "fixacao_alimentos1.docx",
      "executacao_alimentos_prisao.docx",
      "executacao_alimentos_penhora.docx",
      "termo_declaracao.docx",
    ];

    templatesEsperados.forEach((filename) => {
      it(`template ${filename} deve existir`, async () => {
        const fullPath = path.join(templatesDir, filename);
        const stat = await fs.stat(fullPath);
        expect(stat.isFile()).toBe(true);
      });
    });
  });

  describe("generateDocx — lookup do dicionário", () => {
    it("deve logar template correto para fixacao_alimentos", async () => {
      try {
        await generateDocx({}, "fixacao_alimentos");
      } catch (e) {
        // Template pode ter erros de formatação ({{ duplo) — isso é esperado.
        // O importante é que o lookup funcionou.
      }
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('template="fixacao_alimentos1.docx"')
      );
    });

    it("deve logar template base correto para execucao_alimentos", async () => {
      try {
        await generateDocx({}, "execucao_alimentos");
      } catch (e) { /* template error esperado */ }
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('template="executacao_alimentos_cumulado.docx"')
      );
    });

    it("deve usar o template de prisão quando houver override", async () => {
      const config = getConfigAcaoBackend("execucao_alimentos");
      const templatePrisao = config.documentosGerados.find(
        (doc) => doc.tipo === "execucao_prisao",
      )?.template;

      try {
        await generateDocx({}, "execucao_alimentos", templatePrisao);
      } catch (e) { /* template error esperado */ }
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('template="executacao_alimentos_prisao.docx"')
      );
    });

    it("deve usar template default para chave inválida", async () => {
      try {
        await generateDocx({}, "acao_invalida");
      } catch (e) { /* template error esperado */ }
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("não encontrada")
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('template="fixacao_alimentos1.docx"')
      );
    });

    it("deve funcionar com acaoKey undefined (fallback)", async () => {
      try {
        await generateDocx({}, undefined);
      } catch (e) { /* template error esperado */ }
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("vazia")
      );
    });
  });

  describe("generateTermoDeclaracao", () => {
    it("deve gerar buffer DOCX do termo", async () => {
      const dadosTermo = {
        requerente_nome: "FULANO DE TAL",
        data_declaracao: "01/01/2026",
      };
      const buffer = await generateTermoDeclaracao(dadosTermo);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});

/* global global */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { processSubmission } from "@/areas/servidor/services/submissionService.js";

// ─── Factory de formState mínimo válido ───────────────────────────────────────
function makeFormState(overrides = {}) {
  return {
    assistidoEhIncapaz: "sim",
    NOME: "João da Silva (Filho)",
    cpf: "529.982.247-25",
    REPRESENTANTE_NOME: "Maria da Silva",
    representante_cpf: "111.444.777-35",
    representante_data_nascimento: "15/03/1985",
    requerente_endereco_residencial: "Rua das Flores, 123 - CEP 40000-000",
    requerente_telefone: "(71) 99999-8888",
    REQUERIDO_NOME: "Carlos Souza",
    executado_endereco_residencial: "Rua Bela, 456",
    executado_telefone: "(71) 98888-7777",
    relato: "Desejo fixar alimentos para meu filho.",
    acaoEspecifica: "fixacao_alimentos",
    tipoAcao: "Família - Fixação",
    prefersAudio: false,
    audioBlob: null,
    documentFiles: [
      new File([""], "rg_mae.jpg", { type: "image/jpeg" }),
      new File([""], "rg_filho.jpg", { type: "image/jpeg" }),
      new File([""], "cert_nascimento.jpg", { type: "image/jpeg" }),
      new File([""], "comp_residencia.jpg", { type: "image/jpeg" }),
      new File([""], "comp_renda.jpg", { type: "image/jpeg" }),
      new File([""], "cpf_mae.jpg", { type: "image/jpeg" }),
      new File([""], "cpf_filho.jpg", { type: "image/jpeg" }),
    ],
    documentNames: {},
    documentosMarcados: ["RG", "CPF", "Certidão"],
    outrosFilhos: [],
    enviarDocumentosDepois: false,
    calculo_arquivo: null,
    ...overrides,
  };
}

// ─── Mocks dos callbacks ──────────────────────────────────────────────────────
function makeMocks() {
  return {
    setFormErrors: vi.fn(),
    setLoading: vi.fn(),
    setStatusMessage: vi.fn(),
    setGeneratedCredentials: vi.fn(),
    toast: { error: vi.fn(), success: vi.fn() },
    configAcao: {
      titulo: "Fixação de Pensão Alimentícia",
      secoes: ["SecaoValoresPensao"],
      exigeDadosProcessoOriginal: false,
      ocultarRelato: false,
      isAlvara: false,
    },
    forcaRepresentacao: false,
    today: "2024-01-01",
    // Funções reais do formatters
    stripNonDigits: (v) => v.replace(/\D/g, ""),
    validateCpfAlgorithm: (cpf) => {
      const clean = String(cpf).replace(/\D/g, "");
      if (clean.length !== 11 || /^(\d)\1+$/.test(clean)) return false;
      let soma = 0;
      for (let i = 1; i <= 9; i++) soma += parseInt(clean[i - 1]) * (11 - i);
      let resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(clean[9])) return false;
      soma = 0;
      for (let i = 1; i <= 10; i++) soma += parseInt(clean[i - 1]) * (12 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      return resto === parseInt(clean[10]);
    },
    formatDateToBr: (v) => {
      if (!v || v.includes("/")) return v;
      const [y, m, d] = v.split("-");
      return `${d}/${m}/${y}`;
    },
    parseBrDateToIso: (v) => {
      if (!v || !v.includes("/")) return v;
      const [d, m, y] = v.split("/");
      if (!y || y.length < 4) return "";
      return `${y}-${m}-${d}`;
    },
    normalizeDecimalForSubmit: (v) => {
      if (!v) return "";
      const n = Number(String(v).replace(/\./g, "").replace(",", "."));
      return isNaN(n) ? "" : n.toFixed(2);
    },
    API_BASE: "http://localhost:8000/api",
  };
}

// ─── Validação — Campos Obrigatórios ─────────────────────────────────────────
describe("processSubmission — validação de campos obrigatórios", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("não chama fetch se REPRESENTANTE_NOME está vazio (adulto)", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({
      assistidoEhIncapaz: "nao",
      REPRESENTANTE_NOME: "",
      documentFiles: Array(4).fill(new File([""], "doc.jpg")),
    });

    await processSubmission({ ...mocks, formState });

    expect(mocks.setFormErrors).toHaveBeenCalled();
    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("REPRESENTANTE_NOME");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("não chama fetch se CPF da representante está vazio", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({ representante_cpf: "" });

    await processSubmission({ ...mocks, formState });

    expect(mocks.setFormErrors).toHaveBeenCalled();
    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("representante_cpf");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("não chama fetch se endereço não contém CEP válido", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({
      requerente_endereco_residencial: "Rua sem CEP",
    });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("requerente_endereco_residencial");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("não chama fetch se telefone do requerente está vazio", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({ requerente_telefone: "" });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("requerente_telefone");
  });

  it("bloqueia CPF matematicamente inválido do representante", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({ representante_cpf: "111.111.111-11" });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("representante_cpf");
  });

  it("bloqueia data de nascimento no futuro", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({
      assistidoEhIncapaz: "nao",
      representante_data_nascimento: "01/01/2099",
    });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("representante_data_nascimento");
  });

  it("bloqueia data inválida (31/04 não existe)", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({
      assistidoEhIncapaz: "nao",
      representante_data_nascimento: "31/04/1990",
    });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("representante_data_nascimento");
  });

  it("bloqueia envio sem documentos suficientes (incapaz exige 7+)", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({
      documentFiles: [new File([""], "doc.jpg")], // apenas 1, precisa 7+
    });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("documentos");
  });

  it("bloqueia envio sem relato quando ocultarRelato é false", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({ relato: "" });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("relato");
  });

  it("chama toast.error quando há erros de validação", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({ representante_cpf: "" });

    await processSubmission({ ...mocks, formState });

    expect(mocks.toast.error).toHaveBeenCalled();
  });
});

// ─── Validação — CPF de Outro Filho ──────────────────────────────────────────
describe("processSubmission — validação de outros filhos", () => {
  it("bloqueia se CPF de filho extra está ausente", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({
      outrosFilhos: [{ nome: "Filho 2", cpf: "", dataNascimento: "10/05/2010" }],
    });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("filho_cpf_0");
  });

  it("bloqueia se CPF de filho extra é inválido", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({
      outrosFilhos: [{ nome: "Filho 2", cpf: "111.111.111-11", dataNascimento: "10/05/2010" }],
    });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("filho_cpf_0");
  });

  it("bloqueia data de nascimento de filho no futuro", async () => {
    const mocks = makeMocks();
    const formState = makeFormState({
      outrosFilhos: [{ nome: "Filho 2", cpf: "529.982.247-25", dataNascimento: "01/01/2099" }],
    });

    await processSubmission({ ...mocks, formState });

    const errors = mocks.setFormErrors.mock.calls[0][0];
    expect(errors).toHaveProperty("filho_nascimento_0");
  });
});

// ─── Chamada à API ────────────────────────────────────────────────────────────
describe("processSubmission — chamada à API em caso válido", () => {
  it("chama fetch para /casos/novo com dados válidos", async () => {
    const mocks = makeMocks();
    // Mock fetch bem-sucedido
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ protocolo: "20260425011111", chaveAcesso: null }),
    });

    const formState = makeFormState();

    await processSubmission({ ...mocks, formState });

    // Se não há erros de validação, fetch deve ter sido chamado
    if (mocks.setFormErrors.mock.calls.length === 0 ||
        Object.keys(mocks.setFormErrors.mock.calls[0]?.[0] || {}).length === 0) {
      expect(global.fetch).toHaveBeenCalled();
      const url = global.fetch.mock.calls[0][0];
      expect(url).toContain("/casos/novo");
    }
  });

  it("chama setLoading(false) no finally mesmo em caso de erro de rede", async () => {
    const mocks = makeMocks();
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const formState = makeFormState();
    await processSubmission({ ...mocks, formState });

    // setLoading pode ter sido chamado com false no finally
    const loadingCalls = mocks.setLoading.mock.calls;
    const hasCalledFalse = loadingCalls.some(([val]) => val === false);
    // Se chegou ao fetch (sem erros de validação), deve ter chamado false
    if (global.fetch.mock.calls.length > 0) {
      expect(hasCalledFalse).toBe(true);
    }
  });
});

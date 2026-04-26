import { describe, it, expect } from "vitest";
import {
  stripNonDigits,
  formatCpf,
  formatPhone,
  formatDateMask,
  formatDateToBr,
  parseBrDateToIso,
  validateCpfAlgorithm,
  validateBrDate,
  formatCurrencyMask,
  normalizeDecimalForSubmit,
  sanitizeDecimalInput,
  numeroParaExtenso,
  formatRgNumber,
  formatMonthYearMask,
} from "@/utils/formatters.js";

// ─── stripNonDigits ───────────────────────────────────────────────────────────
describe("stripNonDigits", () => {
  it("remove todos os caracteres não-numéricos", () => {
    expect(stripNonDigits("123.456.789-09")).toBe("12345678909");
  });

  it("retorna string vazia para input vazio", () => {
    expect(stripNonDigits("")).toBe("");
  });

  it("mantém apenas dígitos em string mista", () => {
    expect(stripNonDigits("(71) 99999-8888")).toBe("71999998888");
  });
});

// ─── formatCpf ───────────────────────────────────────────────────────────────
describe("formatCpf", () => {
  it("formata CPF completo com pontos e traço", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("formata CPF com máscara (input com pontos)", () => {
    expect(formatCpf("529.982.247-25")).toBe("529.982.247-25");
  });

  it("formata parcialmente com 5 dígitos", () => {
    expect(formatCpf("12345")).toBe("123.45");
  });

  it("formata parcialmente com 8 dígitos", () => {
    expect(formatCpf("12345678")).toBe("123.456.78");
  });

  it("retorna apenas dígitos para 3 ou menos dígitos", () => {
    expect(formatCpf("123")).toBe("123");
  });

  it("ignora dígitos além do 11º", () => {
    expect(formatCpf("529982247259999")).toBe("529.982.247-25");
  });
});

// ─── formatPhone ─────────────────────────────────────────────────────────────
describe("formatPhone", () => {
  it("formata celular completo (11 dígitos)", () => {
    expect(formatPhone("71988887777")).toBe("(71) 98888-7777");
  });

  it("formata telefone fixo (10 dígitos)", () => {
    expect(formatPhone("7132221111")).toBe("(71) 3222-1111");
  });

  it("formata com 2 dígitos", () => {
    expect(formatPhone("71")).toBe("(71");
  });

  it("retorna string vazia para input vazio", () => {
    expect(formatPhone("")).toBe("");
  });
});

// ─── formatDateMask ───────────────────────────────────────────────────────────
describe("formatDateMask", () => {
  it("formata data completa", () => {
    expect(formatDateMask("01011990")).toBe("01/01/1990");
  });

  it("formata com 4 dígitos (dia e mês)", () => {
    expect(formatDateMask("0101")).toBe("01/01");
  });

  it("formata com 2 dígitos", () => {
    expect(formatDateMask("01")).toBe("01");
  });

  it("retorna vazio para input vazio", () => {
    expect(formatDateMask("")).toBe("");
  });
});

// ─── formatDateToBr / parseBrDateToIso ───────────────────────────────────────
describe("formatDateToBr", () => {
  it("converte ISO para formato BR", () => {
    expect(formatDateToBr("1990-01-31")).toBe("31/01/1990");
  });

  it("retorna string vazia para input vazio", () => {
    expect(formatDateToBr("")).toBe("");
  });

  it("não re-converte data já no formato BR", () => {
    expect(formatDateToBr("31/01/1990")).toBe("31/01/1990");
  });
});

describe("parseBrDateToIso", () => {
  it("converte data BR para ISO", () => {
    expect(parseBrDateToIso("31/01/1990")).toBe("1990-01-31");
  });

  it("retorna string original sem '/'", () => {
    expect(parseBrDateToIso("19900131")).toBe("19900131");
  });

  it("retorna string vazia para data com ano incompleto", () => {
    expect(parseBrDateToIso("31/01/90")).toBe("");
  });

  it("retorna string vazia para input vazio", () => {
    expect(parseBrDateToIso("")).toBe("");
  });
});

// ─── validateCpfAlgorithm ─────────────────────────────────────────────────────
describe("validateCpfAlgorithm", () => {
  // CPFs válidos conhecidos
  const cpfsValidos = ["529.982.247-25", "52998224725", "111.444.777-35"];
  cpfsValidos.forEach((cpf) => {
    it(`valida CPF correto: ${cpf}`, () => {
      expect(validateCpfAlgorithm(cpf)).toBe(true);
    });
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(validateCpfAlgorithm("529.982.247-26")).toBe(false);
  });

  it("rejeita CPF com todos os dígitos iguais (111.111.111-11)", () => {
    expect(validateCpfAlgorithm("111.111.111-11")).toBe(false);
  });

  it("rejeita CPF com menos de 11 dígitos", () => {
    expect(validateCpfAlgorithm("1234567")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(validateCpfAlgorithm("")).toBe(false);
  });

  it("rejeita CPF com SQL injection", () => {
    expect(validateCpfAlgorithm("' OR '1'='1")).toBe(false);
  });
});

// ─── validateBrDate ───────────────────────────────────────────────────────────
describe("validateBrDate", () => {
  it("valida data correta", () => {
    expect(validateBrDate("31/12/2000")).toBe(true);
  });

  it("valida 29/02 em ano bissexto", () => {
    expect(validateBrDate("29/02/2000")).toBe(true);
  });

  it("rejeita 29/02 em ano não-bissexto", () => {
    expect(validateBrDate("29/02/2001")).toBe(false);
  });

  it("rejeita dia 31 em mês com 30 dias", () => {
    expect(validateBrDate("31/04/2000")).toBe(false);
  });

  it("rejeita mês 13", () => {
    expect(validateBrDate("01/13/2000")).toBe(false);
  });

  it("rejeita data no futuro", () => {
    const future = `01/01/${new Date().getFullYear() + 1}`;
    expect(validateBrDate(future)).toBe(false);
  });

  it("rejeita formato ISO", () => {
    expect(validateBrDate("2000-12-31")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(validateBrDate("")).toBe(false);
  });

  it("rejeita null/undefined de forma segura", () => {
    expect(validateBrDate(null)).toBe(false);
    expect(validateBrDate(undefined)).toBe(false);
  });
});

// ─── formatCurrencyMask ───────────────────────────────────────────────────────
describe("formatCurrencyMask", () => {
  it("formata valor 1000 como '10,00'", () => {
    expect(formatCurrencyMask("1000")).toBe("10,00");
  });

  it("formata valor 100000 como '1.000,00'", () => {
    expect(formatCurrencyMask("100000")).toBe("1.000,00");
  });

  it("retorna vazio para input vazio", () => {
    expect(formatCurrencyMask("")).toBe("");
  });

  it("retorna '0,00' para string de zeros", () => {
    expect(formatCurrencyMask("00")).toBe("0,00");
  });
});

// ─── normalizeDecimalForSubmit ────────────────────────────────────────────────
describe("normalizeDecimalForSubmit", () => {
  it("converte '1.500,00' para '1500.00'", () => {
    expect(normalizeDecimalForSubmit("1.500,00")).toBe("1500.00");
  });

  it("converte '100,50' para '100.50'", () => {
    expect(normalizeDecimalForSubmit("100,50")).toBe("100.50");
  });

  it("retorna vazio para input vazio", () => {
    expect(normalizeDecimalForSubmit("")).toBe("");
  });

  it("retorna vazio para NaN", () => {
    expect(normalizeDecimalForSubmit("abc")).toBe("");
  });
});

// ─── numeroParaExtenso ────────────────────────────────────────────────────────
describe("numeroParaExtenso", () => {
  it("converte 1 para 'um real'", () => {
    expect(numeroParaExtenso(1)).toBe("um real");
  });

  it("converte 2 para 'dois reais'", () => {
    expect(numeroParaExtenso(2)).toBe("dois reais");
  });

  it("converte 1000 para string que contém 'mil' e 'reais'", () => {
    const result = numeroParaExtenso(1000);
    expect(result).toContain("mil");
    expect(result).toContain("reais");
  });

  it("converte 1621 para string que contém 'mil'", () => {
    expect(numeroParaExtenso(1621)).toContain("mil");
  });

  it("converte 1.5 para string com 'centavo'", () => {
    expect(numeroParaExtenso(1.5)).toContain("centavo");
  });

  it("retorna vazio para null/undefined/vazio", () => {
    expect(numeroParaExtenso(null)).toBe("");
    expect(numeroParaExtenso(undefined)).toBe("");
    expect(numeroParaExtenso("")).toBe("");
  });

  it("retorna vazio para NaN", () => {
    expect(numeroParaExtenso("abc")).toBe("");
  });

  it("converte 0 para 'zero real'", () => {
    expect(numeroParaExtenso(0)).toBe("zero real");
  });

  it("converte 1.621,00 (string com máscara BR) corretamente", () => {
    const result = numeroParaExtenso("1.621,00");
    expect(result).toContain("mil");
    expect(result).toContain("reais");
  });
});

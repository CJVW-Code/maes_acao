import http from "k6/http";
import { check } from "k6";

export const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
export const AUTH_TOKEN = __ENV.AUTH_TOKEN || "";
export const SCANNER_API_KEY = __ENV.SCANNER_API_KEY || "";
export const TEST_CASE_ID = __ENV.TEST_CASE_ID || "";
export const TEST_PROTOCOLO = __ENV.TEST_PROTOCOLO || "";
export const TEST_CPF_EXISTENTE = (
  __ENV.TEST_CPF_EXISTENTE || "12345678901"
).replace(/\D/g, "");
export const TEST_CPF_INEXISTENTE = (
  __ENV.TEST_CPF_INEXISTENTE || "99999999999"
).replace(/\D/g, "");

const fixtureText = open("../fixtures/documento_teste.txt", "b");

function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(length = 6) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return output;
}

export function defaultHeaders(extra = {}) {
  return {
    Accept: "application/json",
    ...extra,
  };
}

export function authHeaders(extra = {}) {
  const headers = defaultHeaders(extra);
  if (AUTH_TOKEN) {
    headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  }
  return headers;
}

export function scannerHeaders(extra = {}) {
  const headers = defaultHeaders(extra);
  if (SCANNER_API_KEY) {
    headers["X-API-Key"] = SCANNER_API_KEY;
  }
  return headers;
}

export function randomCpf(seedPrefix = "77") {
  const core =
    `${seedPrefix}${String(randomIntBetween(100000000, 999999999))}`.slice(
      0,
      11,
    );
  return core.padEnd(11, "0");
}

export function buildCasePayload() {
  const unique = `${Date.now()}${randomIntBetween(100, 999)}`;
  const cpf = randomCpf("70");
  return {
    nome: `Carga ${randomString(6)}`,
    cpf,
    telefone: `7399${randomIntBetween(1000000, 9999999)}`,
    tipoAcao: "fixacao_alimentos",
    acaoEspecifica: "fixacao_alimentos",
    relato: `Teste de carga automatizado ${unique}`,
    documentos_informados: JSON.stringify([
      "RG",
      "CPF",
      "Comprovante de residencia",
    ]),
  };
}

export function buildCaseMultipart() {
  return {
    ...buildCasePayload(),
    documentos: http.file(fixtureText, "documento_teste.txt", "text/plain"),
  };
}

export function buildScannerMultipart(protocolo = TEST_PROTOCOLO) {
  return {
    protocolo,
    tipos: "comprovante",
    documentos: http.file(
      fixtureText,
      "scanner_documento_teste.txt",
      "text/plain",
    ),
  };
}

export function assertCoreChecks(response, expectedStatuses, tag) {
  const allowed = Array.isArray(expectedStatuses)
    ? expectedStatuses
    : [expectedStatuses];
  check(response, {
    [`${tag} status esperado`]: (r) => allowed.includes(r.status),
    [`${tag} sem 5xx`]: (r) => r.status < 500,
    [`${tag} latency < 3000ms`]: (r) => r.timings.duration < 3000,
  });
}

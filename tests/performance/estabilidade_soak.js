import http from "k6/http";
import { sleep } from "k6";
import {
  BASE_URL,
  SCANNER_API_KEY,
  TEST_CASE_ID,
  TEST_CPF_EXISTENTE,
  TEST_CPF_INEXISTENTE,
  TEST_PROTOCOLO,
  assertCoreChecks,
  authHeaders,
  buildScannerMultipart,
  defaultHeaders,
  scannerHeaders,
} from "./lib/config.js";

export const options = {
  scenarios: {
    consultas_constantes: {
      executor: "constant-vus",
      exec: "consultasConstantes",
      vus: 12,
      duration: "2h",
    },
    detalhes_constantes: {
      executor: "constant-vus",
      exec: "detalhesConstantes",
      vus: 4,
      duration: "2h",
    },
    scanner_periodico: {
      executor: "constant-arrival-rate",
      exec: "scannerPeriodico",
      rate: 6,
      timeUnit: "1m",
      duration: "2h",
      preAllocatedVUs: 2,
      maxVUs: 6,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<2000", "p(99)<3500"],
  },
};

export function consultasConstantes() {
  const cpf = __ITER % 3 === 0 ? TEST_CPF_INEXISTENTE : TEST_CPF_EXISTENTE;
  const expected = cpf === TEST_CPF_INEXISTENTE ? [404, 429] : [200, 404, 429];
  const response = http.get(`${BASE_URL}/api/status/cpf/${cpf}`, {
    headers: defaultHeaders(),
  });
  assertCoreChecks(response, expected, "soak consulta");
  sleep(5);
}

export function detalhesConstantes() {
  if (!TEST_CASE_ID) {
    sleep(10);
    return;
  }

  const response = http.get(`${BASE_URL}/api/casos/${TEST_CASE_ID}`, {
    headers: authHeaders(),
  });
  assertCoreChecks(response, [200, 401, 403, 423], "soak detalhe");
  sleep(10);
}

export function scannerPeriodico() {
  if (!SCANNER_API_KEY || !TEST_PROTOCOLO) {
    sleep(10);
    return;
  }

  const response = http.post(
    `${BASE_URL}/api/scanner/upload`,
    buildScannerMultipart(TEST_PROTOCOLO),
    { headers: scannerHeaders() },
  );
  assertCoreChecks(response, [200, 400, 404, 429], "soak scanner");
}

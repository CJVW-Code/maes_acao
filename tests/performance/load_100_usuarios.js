import http from "k6/http";
import { sleep } from "k6";
import { Counter } from "k6/metrics";
import {
  BASE_URL,
  SCANNER_API_KEY,
  AUTH_TOKEN,
  TEST_CASE_ID,
  TEST_CPF_EXISTENTE,
  TEST_CPF_INEXISTENTE,
  TEST_PROTOCOLO,
  assertCoreChecks,
  authHeaders,
  buildCaseMultipart,
  buildScannerMultipart,
  defaultHeaders,
  scannerHeaders,
} from "./lib/config.js";

const skippedProtected = new Counter("skipped_protected_requests");

export const options = {
  scenarios: {
    consulta_publica_hit: {
      executor: "ramping-vus",
      exec: "consultaPublicaHit",
      stages: [
        { duration: "1m", target: 20 },
        { duration: "3m", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    consulta_publica_miss: {
      executor: "ramping-vus",
      exec: "consultaPublicaMiss",
      startTime: "10s",
      stages: [
        { duration: "1m", target: 20 },
        { duration: "3m", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    criacao_casos: {
      executor: "ramping-vus",
      exec: "criarCaso",
      startTime: "20s",
      stages: [
        { duration: "90s", target: 20 },
        { duration: "3m", target: 20 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    scanner_upload: {
      executor: "ramping-vus",
      exec: "uploadScanner",
      startTime: "30s",
      stages: [
        { duration: "90s", target: 10 },
        { duration: "3m", target: 10 },
        { duration: "20s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    lock_contention: {
      executor: "constant-vus",
      exec: "disputarLock",
      startTime: "45s",
      vus: 10,
      duration: "3m",
    },
    detalhe_autenticado: {
      executor: "constant-vus",
      exec: "detalheCaso",
      startTime: "45s",
      vus: 20,
      duration: "3m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2500", "p(99)<4000"],
    skipped_protected_requests: ["count<1000000"],
  },
};

export function consultaPublicaHit() {
  const response = http.get(
    `${BASE_URL}/api/status/cpf/${TEST_CPF_EXISTENTE}`,
    { headers: defaultHeaders() },
  );
  assertCoreChecks(response, [200, 404, 429], "consulta hit");
  sleep(1);
}

export function consultaPublicaMiss() {
  const response = http.get(
    `${BASE_URL}/api/status/cpf/${TEST_CPF_INEXISTENTE}`,
    { headers: defaultHeaders() },
  );
  assertCoreChecks(response, [404, 429], "consulta miss");
  sleep(1);
}

export function criarCaso() {
  const response = http.post(
    `${BASE_URL}/api/casos/novo`,
    buildCaseMultipart(),
    { headers: defaultHeaders() },
  );
  assertCoreChecks(response, [201, 400, 429], "criacao");
  sleep(2);
}

export function uploadScanner() {
  if (!SCANNER_API_KEY || !TEST_PROTOCOLO) {
    skippedProtected.add(1);
    sleep(1);
    return;
  }

  const response = http.post(
    `${BASE_URL}/api/scanner/upload`,
    buildScannerMultipart(TEST_PROTOCOLO),
    { headers: scannerHeaders() },
  );
  assertCoreChecks(response, [200, 400, 404, 429], "scanner");
  sleep(2);
}

export function disputarLock() {
  if (!AUTH_TOKEN || !TEST_CASE_ID) {
    skippedProtected.add(1);
    sleep(1);
    return;
  }

  const lockResponse = http.patch(
    `${BASE_URL}/api/casos/${TEST_CASE_ID}/lock`,
    null,
    { headers: authHeaders() },
  );
  assertCoreChecks(lockResponse, [200, 423], "lock");

  if (lockResponse.status === 200) {
    const unlockResponse = http.patch(
      `${BASE_URL}/api/casos/${TEST_CASE_ID}/unlock`,
      null,
      { headers: authHeaders() },
    );
    assertCoreChecks(unlockResponse, [200, 403], "unlock");
  }

  sleep(1);
}

export function detalheCaso() {
  if (!AUTH_TOKEN || !TEST_CASE_ID) {
    skippedProtected.add(1);
    sleep(1);
    return;
  }

  const response = http.get(
    `${BASE_URL}/api/casos/${TEST_CASE_ID}`,
    { headers: authHeaders() },
  );
  assertCoreChecks(response, [200, 401, 403, 423], "detalhe");
  sleep(1);
}

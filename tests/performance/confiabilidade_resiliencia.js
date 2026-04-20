import http from "k6/http";
import { sleep } from "k6";
import { check } from "k6";
import {
  BASE_URL,
  TEST_CPF_INEXISTENTE,
  TEST_PROTOCOLO,
  assertCoreChecks,
  buildScannerMultipart,
  defaultHeaders,
  scannerHeaders,
} from "./lib/config.js";

export const options = {
  scenarios: {
    burst_consulta: {
      executor: "per-vu-iterations",
      exec: "burstConsulta",
      vus: 40,
      iterations: 10,
      maxDuration: "2m",
    },
    scanner_sem_credencial: {
      executor: "per-vu-iterations",
      exec: "scannerSemCredencial",
      vus: 5,
      iterations: 4,
      maxDuration: "1m",
    },
    scanner_protocolo_invalido: {
      executor: "per-vu-iterations",
      exec: "scannerProtocoloInvalido",
      vus: 5,
      iterations: 4,
      maxDuration: "1m",
    },
    preflight_health: {
      executor: "constant-vus",
      exec: "healthAndPreflight",
      vus: 2,
      duration: "1m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000", "p(99)<3000"],
  },
};

export function burstConsulta() {
  const response = http.get(`${BASE_URL}/api/status/cpf/${TEST_CPF_INEXISTENTE}`, {
    headers: defaultHeaders(),
  });
  assertCoreChecks(response, [404, 429], "burst consulta");
  sleep(0.3);
}

export function scannerSemCredencial() {
  const response = http.post(
    `${BASE_URL}/api/scanner/upload`,
    buildScannerMultipart(TEST_PROTOCOLO || "PROTOCOLO-TESTE"),
    { headers: defaultHeaders() },
  );
  assertCoreChecks(response, [401, 403], "scanner sem credencial");
}

export function scannerProtocoloInvalido() {
  const response = http.post(
    `${BASE_URL}/api/scanner/upload`,
    buildScannerMultipart("PROTOCOLO-INEXISTENTE"),
    { headers: scannerHeaders() },
  );
  assertCoreChecks(response, [401, 403, 404], "scanner protocolo invalido");
}

export function healthAndPreflight() {
  const health = http.get(`${BASE_URL}/api/health`, {
    headers: defaultHeaders(),
  });
  assertCoreChecks(health, 200, "health");

  const preflight = http.options(`${BASE_URL}/api/casos/novo`, null, {
    headers: {
      Origin: "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });

  check(preflight, {
    "preflight status 204": (r) => r.status === 204,
    "preflight sem 5xx": (r) => r.status < 500,
  });
  sleep(1);
}

# 🚀 Guia de Testes de Performance — Mães em Ação

Este guia contém as instruções para executar os testes de carga e resiliência utilizando o **k6**.

> [!IMPORTANT]
> Os testes devem ser executados no **PowerShell** (Windows). Garanta que o backend esteja rodando localmente.

---

## 🔑 Configuração de Credenciais

Para que os testes autenticados funcionem, você precisa definir estas variáveis no seu terminal antes de rodar os comandos:

1. **`SCANNER_API_KEY`**: O valor exato da `API_KEY_SERVIDORES` no seu `.env` do backend.
2. **`AUTH_TOKEN`**: Um JWT válido (pegue no console do navegador após fazer login como Defensor/Admin).
3. **`TEST_CPF_EXISTENTE`**: Um CPF que já esteja cadastrado no seu banco para testar a busca.
4. **`TEST_PROTOCOLO`**: Um protocolo de caso existente para testar a visualização e o lock.

---

## 1️⃣ Teste de Carga (`perf:load`)

**Objetivo:** Simular 100 usuários simultâneos em um cenário real de mutirão.

```powershell
$env:BASE_URL="http://localhost:8000"
$env:SCANNER_API_KEY="_uwgfYCHM8I4tuKExmpIgv3nR2UDrmX1KyRnxg7jfbhUTPChBcQWVnCK6vSnvh85g"
$env:AUTH_TOKEN="COLE_SEU_JWT_AQUI"
$env:TEST_CPF_EXISTENTE="965.452.140-71"
$env:TEST_PROTOCOLO="202604184226106 "
npm run perf:load
```

### ✅ Indicadores de Sucesso:

- **Falhas (`http_req_failed`)**: < 5%.
- **Latência (`p95`)**: < 2.5s (2500ms).
- **Checks**: > 95% de sucesso.

---

## 2️⃣ Teste de Estabilidade (`perf:soak`)

**Objetivo:** Validar se o sistema aguenta carga contínua por 2 horas sem vazamento de memória ou lentidão.

```powershell
$env:BASE_URL="http://localhost:8000"
$env:SCANNER_API_KEY="_uwgfYCHM8I4tuKExmpIgv3nR2UDrmX1KyRnxg7jfbhUTPChBcQWVnCK6vSnvh85g"
$env:AUTH_TOKEN="COLE_SEU_JWT_AQUI"
$env:TEST_CASE_ID="6"
npm run perf:soak
```

---

## 3️⃣ Teste de Confiabilidade (`perf:reliability`)

**Objetivo:** Testar Rate Limit, segurança e se o servidor gera erros 500 sob estresse.

```powershell
$env:BASE_URL="http://localhost:8000"
$env:SCANNER_API_KEY="_uwgfYCHM8I4tuKExmpIgv3nR2UDrmX1KyRnxg7jfbhUTPChBcQWVnCK6vSnvh85g"
npm run perf:reliability
```

---

## 📊 Tabela de Referência (O que é um resultado bom?)

| Métrica              | Ótimo  | Atenção   | Crítico |
| :------------------- | :----- | :-------- | :------ |
| **Erros (Failed)**   | < 1%   | 5% - 10%  | > 10%   |
| **Latência (p95)**   | < 1.5s | 2.5s - 4s | > 5s    |
| **Erros 500**        | Zero   | 1 ou 2    | > 5     |
| **Sucesso (Checks)** | 100%   | > 90%     | < 80%   |

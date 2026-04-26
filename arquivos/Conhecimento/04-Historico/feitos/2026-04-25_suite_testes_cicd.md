# Histórico de Alterações — 2026-04-25 · Suíte de Testes e CI/CD

## Resumo

Implementação completa de suíte de testes automatizados para o backend (Jest/Supertest) e frontend (Vitest), cobrindo testes unitários, de middleware, de integração e de segurança. Adicionado pipeline de CI/CD via GitHub Actions para automatizar lint, testes, auditoria de segurança e build a cada push ou Pull Request nas branches protegidas.

---

## 1. Infraestrutura de Testes — Backend (Jest)

### Arquivos criados

| Arquivo | Categoria |
|---|---|
| `backend/tests/setup.js` | Configuração global |
| `backend/tests/unit/securityService.test.js` | Unitário |
| `backend/tests/unit/aiService.test.js` | Unitário |
| `backend/tests/middleware/auth.test.js` | Middleware |
| `backend/tests/middleware/requireWriteAccess.test.js` | Middleware |
| `backend/tests/middleware/apiKey.test.js` | Middleware |
| `backend/tests/integration/health.test.js` | Integração |
| `backend/tests/integration/casosRoutes.test.js` | Integração |
| `backend/tests/integration/lockRoutes.test.js` | Integração |
| `backend/tests/integration/scannerRoutes.test.js` | Integração |
| `backend/tests/security/injection.test.js` | Segurança |
| `backend/tests/security/rateLimiter.test.js` | Segurança |

### Arquivo modificado

- `backend/jest.config.js` — expandido para cobrir todos os subdiretórios, adicionadas thresholds de cobertura (30% global) e exportação de relatório HTML/lcov em `logs/coverage/`.

### Estratégia de isolamento

Todos os testes usam `jest.unstable_mockModule()` para mockar Prisma, Supabase, QStash, aiService e loggerService antes da importação do `server.js`. Nenhum teste toca o banco de dados real.

---

## 2. Infraestrutura de Testes — Frontend (Vitest)

### Dependências adicionadas ao `frontend/package.json`

```json
"vitest": "^3.1.0",
"@vitest/coverage-v8": "^3.1.0",
"jsdom": "^26.0.0"
```

### Novos scripts em `frontend/package.json`

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

### Arquivos criados

| Arquivo | O que testa |
|---|---|
| `frontend/vitest.config.js` | Configuração: jsdom, alias `@/`, cobertura v8 (50% threshold) |
| `frontend/src/__tests__/formatters.test.js` | 58 testes das funções de `utils/formatters.js` |
| `frontend/src/__tests__/caseUtils.test.js` | 15 testes de `formatTipoAcaoLabel` |
| `frontend/src/__tests__/apiBase.test.js` | 6 testes de `authFetch` (401, token, headers) |
| `frontend/src/__tests__/submissionValidation.test.js` | 15 testes de validação do `processSubmission` |

**Total: 94 testes — 94 passando (100%).**

---

## 3. Pipeline de CI/CD — GitHub Actions

### Arquivo criado

`.github/workflows/ci.yml`

### Trigger

```yaml
on:
  push:    { branches: [versao_1, main] }
  pull_request: { branches: [versao_1, main] }
```

### Jobs (em ordem de execução)

```
lint-backend  ──→ test-backend  ──→ build-backend  ──┐
lint-frontend ──→ test-frontend ──→ build-frontend ──┤──→ ✅ ci-success
security-audit ──────────────────────────────────────┘
```

| Job | Ferramenta | Falha o pipeline se... |
|---|---|---|
| `lint-backend` | ESLint | há erros de lint no backend |
| `lint-frontend` | ESLint | há erros de lint no frontend |
| `test-backend` | Jest | qualquer teste falha |
| `test-frontend` | Vitest | qualquer teste falha |
| `security-audit` | `npm audit` | há vulnerabilidade **crítica** |
| `build-backend` | Prisma generate | schema não compila |
| `build-frontend` | Vite build | build de produção falha |
| `ci-success` | Gate final | qualquer job anterior falhou |

### Artefatos gerados por run

- `backend-coverage` — relatório HTML de cobertura do backend (7 dias)
- `frontend-coverage` — relatório HTML de cobertura do frontend (7 dias)
- `frontend-dist` — bundle de produção buildado (3 dias)

---

## 4. Configuração de Branch Protection (Manual)

Para integrar o CI com o GitHub, configurar em **Settings → Branches → Add classic branch protection rule**:

- Branch: `versao_1` (e repetir para `main`)
- ✅ Require a pull request before merging
- ✅ Require status checks to pass: **`✅ CI Completo`**
- ✅ Block force pushes
- ✅ Restrict deletions

---

## Arquivos Criados/Modificados

```
.github/
  workflows/
    ci.yml                                        [NEW]

backend/
  jest.config.js                                  [MODIFIED]
  tests/
    setup.js                                      [NEW]
    unit/
      securityService.test.js                     [NEW]
      aiService.test.js                           [NEW]
    middleware/
      auth.test.js                                [NEW]
      requireWriteAccess.test.js                  [NEW]
      apiKey.test.js                              [NEW]
    integration/
      health.test.js                              [NEW]
      casosRoutes.test.js                         [NEW]
      lockRoutes.test.js                          [NEW]
      scannerRoutes.test.js                       [NEW]
    security/
      injection.test.js                           [NEW]
      rateLimiter.test.js                         [NEW]

frontend/
  package.json                                    [MODIFIED — +vitest, +jsdom, +scripts]
  vitest.config.js                                [NEW]
  src/
    __tests__/
      formatters.test.js                          [NEW]
      caseUtils.test.js                           [NEW]
      apiBase.test.js                             [NEW]
      submissionValidation.test.js                [NEW]
```

# Guia de Uso — Suíte de Testes · Mães em Ação

> **Versão:** 1.0 · **Criado em:** 2026-04-25
> **Stack de testes:** Jest (Backend) + Vitest (Frontend)

---

## Pré-requisitos

```bash
# Garanta que as dependências estão instaladas
cd backend  && npm install
cd ../frontend && npm install
```

---

## BACKEND — Comandos

> Todos os comandos devem ser executados dentro da pasta `backend/`.

```bash
cd backend
```

### Rodar todos os testes

```bash
npm test
```

### Rodar apenas um arquivo específico

```bash
npm test -- tests/unit/securityService.test.js
npm test -- tests/middleware/auth.test.js
npm test -- tests/integration/casosRoutes.test.js
npm test -- tests/security/injection.test.js
```

### Rodar todos os testes de uma categoria

```bash
npm test -- tests/unit/
npm test -- tests/middleware/
npm test -- tests/integration/
npm test -- tests/security/
```

### Rodar em modo watch (re-executa ao salvar)

```bash
npm test -- --watch
```

### Ver relatório de cobertura (HTML)

```bash
npm test
# Abra no navegador:
# backend/logs/coverage/index.html
```

---

## FRONTEND — Comandos

> Todos os comandos devem ser executados dentro da pasta `frontend/`.

```bash
cd frontend
```

### Rodar todos os testes

```bash
npm test
```

### Rodar com cobertura

```bash
npm run test:coverage
# Relatório em: frontend/coverage/index.html
```

### Rodar em modo watch (re-executa ao salvar)

```bash
npm run test:watch
```

### Rodar apenas um arquivo

```bash
npx vitest run src/__tests__/formatters.test.js
npx vitest run src/__tests__/caseUtils.test.js
npx vitest run src/__tests__/apiBase.test.js
npx vitest run src/__tests__/submissionValidation.test.js
```

---

## O que cada arquivo de teste cobre

---

### 🔵 BACKEND

#### `tests/setup.js` — Configuração global

Executa antes de todos os testes. Define variáveis de ambiente seguras para o ambiente de CI/CD sem tocar nas credenciais reais:

- `JWT_SECRET`, `API_KEY_SERVIDORES`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `DATABASE_URL` etc.

---

#### `tests/unit/securityService.test.js` — Serviço de Segurança

**O que testa:** Funções puras de `src/services/securityService.js`.

| Teste                         | Descrição                                               |
| ----------------------------- | ------------------------------------------------------- |
| Formato do protocolo          | Gera string numérica de 14 dígitos (`AAAAMMDDXXXXXXXX`) |
| Unicidade do protocolo        | Dois protocolos gerados consecutivamente são diferentes |
| Hash de senha (bcrypt)        | `hashPassword()` retorna string diferente do original   |
| Verificação de senha          | `verifyPassword()` retorna `true` para senha correta    |
| Verificação de senha errada   | `verifyPassword()` retorna `false` para senha incorreta |
| Proteção contra timing attack | Verificação de senha é constante (bcrypt)               |

---

#### `tests/unit/aiService.test.js` — Serviço de IA

**O que testa:** Sanitização de PII antes de enviar dados para Gemini/Groq, fallbacks e timeouts.

| Teste                  | Descrição                                                  |
| ---------------------- | ---------------------------------------------------------- |
| Sanitização CPF        | CPF é substituído por placeholder antes de chamar a IA     |
| Sanitização nome       | Nome real é substituído por placeholder genérico           |
| Desanitização          | Placeholder é revertido ao valor original na resposta      |
| Fallback Groq → Gemini | Se Groq falha, Gemini Flash é chamado como fallback        |
| Timeout                | Se a IA não responde em tempo hábil, lança erro controlado |
| Texto sem PII          | Não altera texto sem dados pessoais identificáveis         |

---

#### `tests/middleware/auth.test.js` — Middleware de Autenticação JWT

**O que testa:** Validação de JWT em todas as rotas protegidas.

| Teste                           | Descrição                                    |
| ------------------------------- | -------------------------------------------- |
| Sem `Authorization` header      | Retorna `401 Unauthorized`                   |
| Token malformado                | Retorna `401`                                |
| Token expirado                  | Retorna `401` com mensagem "sessão expirada" |
| Token com algoritmo `none`      | Retorna `401` (bypass prevention)            |
| Token com algoritmo `RS256`     | Retorna `401` (aceita apenas `HS256`)        |
| Token válido, usuário inativo   | Retorna `403 Forbidden`                      |
| Token válido, usuário existente | Chama `next()` e popula `req.user`           |
| Download ticket inválido        | Retorna `401`                                |
| Download ticket expirado        | Retorna `401`                                |
| Download ticket válido          | Chama `next()` e popula `req.downloadInfo`   |

---

#### `tests/middleware/requireWriteAccess.test.js` — Middleware de RBAC

**O que testa:** Controle de acesso por cargo para operações de escrita (POST/PATCH/DELETE).

| Teste                            | Descrição                                       |
| -------------------------------- | ----------------------------------------------- |
| Sem `req.user`                   | Retorna `401`                                   |
| Cargo `visualizador`             | Retorna `403 Forbidden`                         |
| Cargo `Visualizador` (maiúsculo) | Retorna `403` — verificação é case-insensitive  |
| Cargo desconhecido (`hacker`)    | Retorna `403` — lista de permissões é exclusiva |
| Cargo `admin`                    | Chama `next()`                                  |
| Cargo `defensor`                 | Chama `next()`                                  |
| Cargo `servidor`                 | Chama `next()`                                  |
| Cargo `estagiario`               | Chama `next()`                                  |

---

#### `tests/middleware/apiKey.test.js` — Middleware de API Key (Scanner)

**O que testa:** Autenticação por `X-API-Key` para o endpoint do Scanner do Balcão.

| Teste                   | Descrição                                                               |
| ----------------------- | ----------------------------------------------------------------------- |
| Sem header `X-API-Key`  | Retorna `401` com mensagem mencionando "Scanner"                        |
| Chave inválida          | Retorna `403` com mensagem "inválida"                                   |
| String vazia            | Retorna `401` (falsy, tratado como ausente)                             |
| Chave válida            | Chama `next()`                                                          |
| Chave válida — req.user | Injeta `{ cargo: "sistema", nome: "Scanner Automático" }` em `req.user` |

---

#### `tests/integration/health.test.js` — Endpoints Básicos (Supertest)

**O que testa:** Saúde da aplicação e tratamento de rotas desconhecidas.

| Teste                                    | Descrição                               |
| ---------------------------------------- | --------------------------------------- |
| `GET /api/health` → 200                  | Aplicação está no ar                    |
| `/api/health` retorna `{ status: "OK" }` | Formato correto da resposta             |
| `/api/health` retorna campo `message`    | Campo obrigatório presente              |
| `GET /api/rota-inexistente` → 404        | Catch-all funciona                      |
| 404 retorna campo `error`                | Resposta padronizada                    |
| 404 retorna campo `path`                 | Path da requisição incluído na resposta |

---

#### `tests/integration/casosRoutes.test.js` — Rotas de Casos (Supertest)

**O que testa:** Criação e listagem de casos com autenticação JWT.

| Teste                                       | Descrição                  |
| ------------------------------------------- | -------------------------- |
| `POST /api/casos/novo` com payload válido   | Retorna 200 ou 201         |
| Resposta de criação contém `protocolo`      | Campo obrigatório presente |
| `GET /api/casos` sem JWT                    | Retorna 401                |
| `GET /api/casos` com token inválido         | Retorna 401                |
| `GET /api/casos` com usuário inativo        | Retorna 401 ou 403         |
| `GET /api/casos` com JWT válido             | Não retorna 500            |
| `GET /api/casos/buscar-cpf` sem CPF         | Retorna 400/404/422        |
| `buscar-cpf` retorna JSON (não HTML)        | Content-Type correto       |
| `DELETE /api/casos/:id` sem JWT             | Retorna 401                |
| `DELETE /api/casos/:id` como `visualizador` | Retorna 403                |

---

#### `tests/integration/lockRoutes.test.js` — Sistema de Locking (Supertest)

**O que testa:** Bloqueio e desbloqueio de casos (concorrência entre atendentes).

| Teste                                            | Descrição                               |
| ------------------------------------------------ | --------------------------------------- |
| `PATCH /lock` sem JWT                            | Retorna 401                             |
| Servidor bloqueia caso `pronto_para_analise`     | Retorna 200 (ou 500 por BigInt em mock) |
| Servidor tenta lock em `liberado_para_protocolo` | Retorna 403                             |
| Lock quando caso já está bloqueado por outro     | Retorna 423 (Locked)                    |
| `PATCH /unlock` sem JWT                          | Retorna 401                             |
| Defensor tenta unlock                            | Retorna 403                             |
| Servidor tenta unlock                            | Retorna 403                             |
| Admin faz unlock                                 | Retorna 200                             |

---

#### `tests/integration/scannerRoutes.test.js` — Rotas do Scanner e Login (Supertest)

**O que testa:** Autenticação do scanner e endpoint de login dos defensores.

| Teste                                       | Descrição                     |
| ------------------------------------------- | ----------------------------- |
| `POST /api/scanner/upload` sem `X-API-Key`  | Retorna 401                   |
| Upload com chave inválida                   | Retorna 403                   |
| Upload retorna JSON                         | Content-Type correto          |
| Upload com chave válida, sem dados          | Retorna 400/404 (não 401/403) |
| `POST /api/defensores/login` sem corpo      | Retorna 400/422               |
| Login com credenciais inválidas             | Retorna 401/404               |
| Resposta de erro de login tem campo `error` | Formato padronizado           |
| `GET /api/defensores` sem JWT               | Retorna 401                   |
| `GET /api/defensores` com token malformado  | Retorna 401                   |

---

#### `tests/security/injection.test.js` — Proteção contra Injeção

**O que testa:** Que o sistema não vaza dados, crasha ou retorna 500 sob payloads maliciosos.

| Teste                                 | Descrição                                           |
| ------------------------------------- | --------------------------------------------------- |
| SQL injection no campo CPF            | Não retorna 500 — Prisma usa queries parametrizadas |
| `' OR '1'='1` no buscar-cpf           | Retorna 400/404, nunca 500                          |
| `'; DROP TABLE casos; --`             | Sistema não crashar                                 |
| XSS `<script>alert()` no campo relato | Não retorna 500                                     |
| XSS `<img onerror=...>` no relato     | Sistema não crasha                                  |
| `X-Content-Type-Options: nosniff`     | Header Helmet presente                              |
| `X-Frame-Options` ou `CSP`            | Proteção anti-clickjacking presente                 |
| `X-Powered-By` ausente                | Express não se expõe                                |
| CORS bloqueia origin não autorizado   | Não vaza `Access-Control-Allow-Origin: *`           |
| Isolamento de Unidade (IDOR)         | Middleware `requireSameUnit` bloqueia acesso a casos de outras sedes |

---

#### `tests/middleware/requireSameUnit.test.js` — Isolamento de Unidade

**O que testa:** Proteção contra acesso a dados de outras sedes (unidades).

| Teste                           | Descrição                                    |
| ------------------------------- | -------------------------------------------- |
| Unidade Coincidente             | Permite acesso se `unidade_id` bate          |
| Unidade Divergente              | Retorna `403 Forbidden`                      |
| Admin Bypass                    | Permite acesso independente da unidade       |
| Caso Inexistente                | Retorna `404 Not Found`                      |
| Erro de Banco                   | Retorna `500 Internal Server Error`          |

---

#### `tests/unit/utils.test.js` — Helpers e State Machine

**O que testa:** Lógica pura de transição de status e manipulação de JSONB.

| Teste                           | Descrição                                    |
| ------------------------------- | -------------------------------------------- |
| Transição Válida                | Valida fluxo normal (ex: análise -> atendimento) |
| Transição Inválida              | Bloqueia saltos ilegais na máquina de estados |
| Admin Bypass (Status)           | Permite qualquer transição para admins       |
| `safeJsonParse`                 | Parse seguro sem quebrar o servidor          |
| `safeFormData`                  | Higieniza dados_formulario (string/obj/null) |

---

---

#### `tests/security/rateLimiter.test.js` — Rate Limiting

**O que testa:** Que os três limitadores existem e estão configurados corretamente.

| Teste                                 | Descrição                     |
| ------------------------------------- | ----------------------------- |
| `globalLimiter` existe como função    | Middleware registrado         |
| `searchLimiter` existe como função    | Middleware registrado         |
| `creationLimiter` existe como função  | Middleware registrado         |
| `globalLimiter` passa 1ª requisição   | Chama `next()` sem bloquear   |
| `searchLimiter` passa 1ª requisição   | Chama `next()` sem bloquear   |
| `creationLimiter` passa 1ª requisição | Chama `next()` sem bloquear   |
| Mensagem de erro em português         | Config correta para o mutirão |

---

### 🟢 FRONTEND

#### `src/__tests__/formatters.test.js` — Utilitários de Formatação (58 testes)

**O que testa:** Todas as funções de `src/utils/formatters.js`.

| Função                      | Testes | O que verifica                                                  |
| --------------------------- | ------ | --------------------------------------------------------------- |
| `stripNonDigits`            | 3      | Remove não-dígitos, string vazia, misto                         |
| `formatCpf`                 | 6      | Formatação completa, parcial, ignora excedente                  |
| `formatPhone`               | 4      | Celular (11 dig), fixo (10 dig), parcial, vazio                 |
| `formatDateMask`            | 4      | Data completa, 4 dígitos, 2 dígitos, vazio                      |
| `formatDateToBr`            | 3      | ISO→BR, vazio, não re-converte                                  |
| `parseBrDateToIso`          | 4      | BR→ISO, sem barra, ano curto, vazio                             |
| `validateCpfAlgorithm`      | 8      | CPFs válidos, dígito errado, todos iguais, curto, SQL injection |
| `validateBrDate`            | 9      | Data válida, 29/02 bissexto, inválidos, futuro, null/undefined  |
| `formatCurrencyMask`        | 4      | 1000, 100000, vazio, zeros                                      |
| `normalizeDecimalForSubmit` | 4      | BR→ponto, conversão, vazio, NaN                                 |
| `numeroParaExtenso`         | 9      | 1, 2, 1000, 1621, decimal, null, NaN, 0, máscara BR             |

---

#### `src/__tests__/caseUtils.test.js` — Utilitários de Caso (15 testes)

**O que testa:** `formatTipoAcaoLabel` de `src/utils/caseUtils.js`.

| Teste                             | Descrição                                        |
| --------------------------------- | ------------------------------------------------ |
| `exec_cumulado`                   | Resolve para "Execução de Alimentos"             |
| `exec_penhora`                    | Resolve para "Execução de Alimentos (Penhora)"   |
| `exec_prisao`                     | Resolve para "Execução de Alimentos (Prisão)"    |
| `def_cumulado`                    | Resolve para "Cumprimento de Sentença Cumulada"  |
| `def_penhora`                     | Resolve para "Cumprimento de Sentença (Penhora)" |
| `def_prisao`                      | Resolve para "Cumprimento de Sentença (Prisão)"  |
| `termo_declaracao`                | Resolve para "Termo de Declaração"               |
| Formato `"Área - Ação"`           | Extrai apenas a parte após `-`                   |
| Chave com underscore desconhecida | Converte underscores em espaços                  |
| String vazia                      | Retorna "Não informado"                          |
| `undefined`                       | Retorna "Não informado"                          |
| `null`                            | Não lança erro, retorna string                   |
| Com acentos no input              | Normaliza e resolve corretamente                 |
| `EXEC_CUMULADO` (maiúsculo)       | Lookup é case-insensitive                        |

---

#### `src/__tests__/apiBase.test.js` — Cliente HTTP (6 testes)

**O que testa:** `authFetch` e `API_BASE` de `src/utils/apiBase.js`.

| Teste                                                   | Descrição                                |
| ------------------------------------------------------- | ---------------------------------------- |
| `API_BASE` é string                                     | Variável está definida                   |
| Status 401 → lança "Sessão expirada"                    | Erro padronizado para redirecionamento   |
| Status 401 → remove token do localStorage               | Sessão limpa automaticamente             |
| Status 401 → remove user do localStorage                | Dados de sessão completamente apagados   |
| Token no localStorage → header `Authorization` injetado | `Bearer {token}` enviado automaticamente |
| Sem token → sem header `Authorization`                  | Não injeta header undefined              |
| URL absoluta passada diretamente                        | Não concatena com `API_BASE`             |

---

#### `src/__tests__/submissionValidation.test.js` — Validação do Formulário (15 testes)

**O que testa:** Regras de validação do `processSubmission` em `submissionService.js`.

| Teste                                        | Descrição                                                |
| -------------------------------------------- | -------------------------------------------------------- |
| `REPRESENTANTE_NOME` vazio                   | `setFormErrors` é chamado com chave `REPRESENTANTE_NOME` |
| CPF da representante vazio                   | Erro na chave `representante_cpf`                        |
| Endereço sem CEP                             | Erro na chave `requerente_endereco_residencial`          |
| Telefone vazio                               | Erro na chave `requerente_telefone`                      |
| CPF matematicamente inválido                 | `111.111.111-11` é bloqueado                             |
| Data de nascimento no futuro                 | Erro em `representante_data_nascimento`                  |
| Data inválida (31/04)                        | Dia que não existe é bloqueado                           |
| Menos de 7 documentos                        | Erro na chave `documentos`                               |
| Relato vazio                                 | Erro na chave `relato`                                   |
| Qualquer erro →`toast.error` chamado         | Notificação visual disparada                             |
| CPF de filho extra ausente                   | Erro em `filho_cpf_0`                                    |
| CPF de filho extra inválido                  | CPF matematicamente errado bloqueado                     |
| Data de nascimento de filho no futuro        | Erro em `filho_nascimento_0`                             |
| Payload válido →`fetch` é chamado            | API só é chamada após validação passar                   |
| Erro de rede →`setLoading(false)` no finally | Loading sempre resolvido                                 |

---

## Saída esperada ao rodar `npm test`

### Backend

```
PASS  tests/unit/securityService.test.js
PASS  tests/unit/aiService.test.js
PASS  tests/middleware/auth.test.js
PASS  tests/middleware/requireWriteAccess.test.js
PASS  tests/middleware/apiKey.test.js
PASS  tests/integration/health.test.js
PASS  tests/integration/casosRoutes.test.js
PASS  tests/integration/lockRoutes.test.js
PASS  tests/integration/scannerRoutes.test.js
PASS  tests/security/injection.test.js
PASS  tests/security/rateLimiter.test.js

Test Suites: 11 passed, 11 total
```

### Frontend

```
✓ src/__tests__/apiBase.test.js           (6 tests)
✓ src/__tests__/caseUtils.test.js         (15 tests)
✓ src/__tests__/formatters.test.js        (58 tests)
✓ src/__tests__/submissionValidation.test.js (15 tests)

Test Files: 4 passed (4)
Tests:      94 passed (94)
```

---

## Thresholds de Cobertura

| Package  | Statements | Branches | Functions | Lines |
| -------- | ---------- | -------- | --------- | ----- |
| Backend  | 30%        | 20%      | 30%       | 30%   |
| Frontend | 50%        | 40%      | 50%       | 50%   |

> Se a cobertura cair abaixo do threshold, `npm test` retorna exit code 1 e **quebra o CI**.

---

## Dicas de Troubleshooting

### Jest: `SyntaxError: Cannot use import statement`

Certifique-se de que `jest.config.js` tem `transform: {}` e o `package.json` do backend tem `"type": "module"`.

### Vitest: `Failed to resolve import "@/utils/..."`

O alias `@` → `src/` está definido em `vitest.config.js`. Se não funcionar, execute `npm install` dentro de `frontend/` para garantir que o Vite está instalado.

### CI falha com `npm audit`

O audit só falha para vulnerabilidades **críticas**. Se aparecer, rode:

```bash
npm audit fix
# Se não resolver automaticamente:
npm audit --json | node -e "..."  # para ver qual pacote
```

### Teste de lock retorna 500 em vez do status esperado

Em versões anteriores do código, os testes de lock aceitavam `[200, 500]` devido à serialização imperfeita de campos `BigInt` usados pelos mocks do Prisma. Essa prática é desencorajada pois mascara falhas legítimas de servidor (500). O problema foi corrigido forçando que os ids sejam tipados via mocks fixos, permitindo que as asserções exijam precisamente os status corretos (`200`, `403` ou `423`).

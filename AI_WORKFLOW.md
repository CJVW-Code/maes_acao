# 🤖 Guia de Desenvolvimento com IA — Mães em Ação

> **Versão:** 1.0 · **Atualizado em:** 2026-04-22
> **Propósito:** Padronizar o uso de assistentes de IA (Claude, Gemini, etc.) para garantir desenvolvimento seguro, consistente e alinhado à arquitetura do projeto.

---

## ⚡ TL;DR — Fluxo Resumido

```
1. PLANEJAR  → Prompt de Arquiteto (Pre-Mortem + Implementation Plan)
2. AUDITAR   → Prompt de Auditoria (gaps, padrões, segurança)
3. DECOMPOR  → Prompt de Task List (tasks atômicas para execução)
4. EXECUTAR  → Prompt de Execução (uma task por vez, sem desvios)
```

---

## 📋 Contexto Obrigatório — Como Usar o `claude.md`

O arquivo `claude.md` na raiz do projeto é o **MEGA CONTEXTO** do sistema. Ele deve ser **sempre injetado** antes de qualquer sessão de desenvolvimento com IA.

### O que ele contém

| Seção                 | Conteúdo                                                                                                             |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md`     | Stack, diagrama de módulos, fluxo operacional, máquina de estados, banco de dados, pipeline de IA, segurança, deploy |
| `BUSINESS_RULES.md`   | Tipos de ação, validações, fluxo de documentos, regras de RBAC, LGPD                                                 |
| `CODING_STANDARDS.md` | Padrões de código, ES Modules, nomenclatura, tratamento de erro                                                      |
| `API_REFERENCE.md`    | Endpoints, payloads, respostas, status codes                                                                         |

### Como injetar o contexto

**Opção A — Cursor / Windsurf / VS Code com extensão de IA:**

1. Abra o arquivo `claude.md`
2. Use `@claude.md` na sua conversa com o assistente
3. O assistente recebe todo o contexto automaticamente

**Opção B — Claude.ai / ChatGPT (interface web):**

1. Copie o conteúdo completo do `claude.md`
2. Cole no início da conversa como primeira mensagem
3. Em seguida, faça seu pedido

**Opção C — API direta:**

```
system_prompt = conteúdo do claude.md
user_message  = seu prompt de desenvolvimento
```

> [!IMPORTANT]
> **NUNCA** inicie uma sessão de desenvolvimento pedindo mudanças de código sem primeiro injetar o `claude.md`. A IA irá gerar código incompatível com a arquitetura.

---

## 🏗️ Fase 1 — PLANEJAR (Prompt de Arquiteto)

Use este prompt para **qualquer feature nova, refatoração ou correção não trivial**.

```
Atue como Arquiteto de Software Sênior com profundo conhecimento do projeto
Mães em Ação (contexto já injetado via claude.md).

Analise o repositório e o escopo:
[DESCREVA A TASK AQUI]

Antes de propor a solução, realize um Pre-Mortem: liste 5 motivos técnicos
pelos quais essa implementação poderia falhar ou gerar bugs em produção,
considerando:
- Concorrência e locking de casos
- Valores nulos em dados_formulario (JSONB)
- Performance com alto volume (mutirão com 35-52 sedes)
- Segurança (LGPD, RBAC, signed URLs)
- Integridade da máquina de estados

Após a análise, gere um Implementation Plan estruturado em:

1. Impact Analysis
   - Arquivos afetados e possíveis efeitos colaterais em módulos existentes.

2. Technical Approach
   - Lógica central, novos hooks/componentes.
   - Como se integra com o pipeline de IA, QStash ou Prisma (se aplicável).

3. Edge Case Mitigation
   - Como o plano lidará com: estados vazios, erros de API, latência,
     fallback de IA, casos arquivados, usuários sem permissão.

4. Step-by-Step Strategy
   - Sequência lógica de modificação (dependências primeiro).

Não gere código funcional ainda. Foque na estratégia.
```

### ✅ Critérios de um bom plano

- [ ] Pre-Mortem com ≥ 5 riscos reais (não genéricos)
- [ ] Máquina de estados respeitada (nenhum status criado ad-hoc)
- [ ] RBAC considerado (cargo `visualizador` bloqueado em writes)
- [ ] LGPD respeitada (nenhum CPF/nome em logs)
- [ ] Nenhuma URL de Storage pública (apenas signed URLs)

---

## 🔍 Fase 2 — AUDITAR (Prompt de Auditoria)

Use este prompt para **revisar o plano antes de executar**. Especialmente útil quando o plano envolve múltiplos arquivos ou mudanças na máquina de estados.

```
Audite o plano de implementação abaixo para o projeto Mães em Ação.

Procure por:

1. Gaps de Lógica
   - Alguma transição de estado (`aguardando_documentos` → ... → `protocolado`)
     não foi coberta ou foi violada?
   - O locking de casos (Nível 1: servidor / Nível 2: defensor) foi considerado?

2. Inconsistência de Padrão
   - O plano respeita a arquitetura atual?
     * ES Modules no backend (`import/export`, não `require`)
     * **Tailwind CSS v4** no frontend — classes utilitárias do Tailwind são permitidas
       e esperadas. Novos estilos reutilizáveis devem ser adicionados como componentes
       no bloco `@layer components` do `index.css`, usando `@apply` quando apropriado.
       Estilo inline ad-hoc deve ser evitado.
     * Supabase JS Client para casos/IA, Prisma apenas para equipe/RBAC
     * `dados_formulario` é JSONB — não criar campos novos na tabela `casos`
       sem justificativa clara

3. Falta de Especificidade
   - Onde o plano está vago e pode levar o executor a tomar decisões erradas?

4. Segurança
   - Há exposição de CPF/dados pessoais em logs?
   - Signed URLs com expiração definida?
   - Endpoints que modificam dados verificam cargo via middleware?

[COLE O PLANO AQUI]

Se encontrar falhas, reescreva a seção específica com a correção rigorosa.
```

---

## 📝 Fase 3 — DECOMPOR (Prompt de Task List)

Use após a auditoria aprovada. Este prompt gera as tasks que serão executadas **uma por vez** na Fase 4.

```
Com base no plano validado abaixo, gere uma Task List para execução.

Cada task DEVE seguir este formato:

---
ID: [Número sequencial]
File Path: [caminho/relativo/do/Arquivo.jsx]
Context: O que este arquivo faz atualmente (máx. 2 linhas).
Action: Instrução técnica direta.
  Exemplos: "Adicionar handler para status X", "Refatorar query Y para usar Prisma"
Logic Details: Regras de negócio específicas e tratamentos de erro obrigatórios.
  - Referenciar campos reais do schema (ex: `casos_juridico.debito_penhora_valor`)
  - Referenciar constantes do projeto (ex: `STATUS_CASES.EM_ATENDIMENTO`)
Acceptance Criteria: O que deve ser verdade após esta task estar concluída.
---

Regras para a Task List:
- Tasks ATÔMICAS: uma alteração por arquivo por task
- Se uma alteração em um arquivo for muito grande, quebre em duas tasks
- Ordenar por dependência (infraestrutura → backend → frontend)
- Incluir task de teste/validação ao final

[COLE O PLANO VALIDADO AQUI]
```

---

## ⚙️ Fase 4 — EXECUTAR (Prompt de Execução)

Use para executar **cada task individualmente**. Nunca envie todas as tasks de uma vez.

```
Execute a Task abaixo seguindo estritamente o plano de implementação e o
contexto do projeto Mães em Ação (claude.md).

Restrições INEGOCIÁVEIS:
1. Não altere nada fora do escopo da Task (nenhum arquivo não listado)
2. Use ES Modules no backend (`import`/`export`, NUNCA `require`)
3. Frontend usa **Tailwind CSS v4** com design system de tokens em `index.css`:
   - Classes utilitárias do Tailwind (`flex`, `gap-2`, `rounded-xl`, etc.) são esperadas
   - Novos estilos reutilizáveis vão em `@layer components` no `index.css` usando `@apply`
   - Tokens de cor via CSS vars (`var(--color-primary)`, etc.) para consistência de tema
   - NUNCA usar estilo inline (`style={{...}}`) para layout/cores — use classes
4. Supabase JS Client para casos/IA; Prisma apenas para equipe/RBAC
5. LGPD: nunca logar CPF, nome ou dados pessoais — apenas `caso_id`, ação e timestamp
6. Signed URLs: nunca retornar URLs de Storage sem expiração (ticket JWT de curta duração via `POST /:id/gerar-ticket-download`)
7. Se encontrar ambiguidade, PARE e liste as opções em vez de assumir

[COLE A TASK AQUI]
```

---

## 🚨 Regras de Segurança — Sempre Verificar

Antes de aprovar qualquer código gerado por IA, cheque a lista abaixo:

### Backend

- [ ] Nenhum `require()` — projeto usa ES Modules (`"type": "module"`)
- [ ] Endpoints de escrita têm `authMiddleware` + `requireWriteAccess` no middleware
- [ ] Downloads de arquivos usam ticket JWT de curta duração (`POST /:id/gerar-ticket-download`) — nunca expor URL do Storage diretamente
- [ ] Signed URLs geradas com expiração de 1 hora via Supabase Storage
- [ ] Logs de auditoria usam apenas `caso_id`, sem CPF/nome
- [ ] Status de casos seguem a máquina de estados definida
- [ ] Transições de status validadas antes de update

### Frontend

- [ ] Estilos via classes Tailwind v4 e/ou componentes do `@layer components` em `index.css`
- [ ] Novos componentes reutilizáveis definidos em `@layer components` com `@apply`, não inline
- [ ] Tokens de cor via `var(--color-*)` para suporte a dark mode
- [ ] `AuthContext` verificado antes de operações de escrita
- [ ] Cargo `visualizador` não exibe botões de ação
- [ ] Dados sensíveis não logados no `console.log`

### Banco de Dados / IA

- [ ] Campos novos em `dados_formulario` são JSONB (não colunas novas)
- [ ] Novas colunas têm migration Prisma + SQL correspondente
- [ ] Pipeline de IA tem fallback definido para cada etapa
- [ ] QStash jobs têm retry configurado (máx. 3, backoff 30s)

---

## 📁 Referência Rápida — Arquivos Críticos

| Arquivo                                                | Responsabilidade                                          |
| :----------------------------------------------------- | :-------------------------------------------------------- |
| `backend/src/controllers/casosController.js`           | CRUD de casos, locking, geração DOCX, pipeline IA        |
| `backend/src/config/dicionarioAcoes.js`                | Mapeamento acaoKey → template + config de geração        |
| `backend/src/config/dicionarioTags.js`                 | Mapeamento de tags DOCX para docxtemplater               |
| `backend/src/controllers/scannerController.js`         | Upload em lote via balcão (ScannerBalcao.jsx)            |
| `backend/src/controllers/lockController.js`            | Lock/unlock de sessão (Níveis 1 e 2)                     |
| `backend/src/middleware/auth.js`                       | JWT (`authMiddleware`), ticket download, RBAC            |
| `backend/src/middleware/requireWriteAcess.js`          | Bloqueia `visualizador` de operações de escrita           |
| `backend/src/routes/casos.js`                          | Roteamento + middleware por endpoint                     |
| `frontend/src/index.css`                               | Design system: tokens, Tailwind v4, `@layer components`  |
| `frontend/src/areas/servidor/pages/TriagemCaso.jsx`    | Formulário multi-step (triagem)                           |
| `frontend/src/areas/servidor/pages/ScannerBalcao.jsx`  | Tela dedicada de scanner de documentos                   |
| `frontend/src/areas/defensor/pages/DetalhesCaso.jsx`   | Detalhes + minutas + download seguro + ações             |
| `frontend/src/areas/defensor/contexts/AuthContext.jsx` | JWT, cargo, unidade                                      |
| `frontend/src/config/formularios/acoes/familia.js`     | Config declarativa de ações                               |
| `prisma/schema.prisma`                                 | Schema do banco de dados                                  |

---

## 🔄 Status da Máquina de Estados (Referência)

```
aguardando_documentos
    → documentacao_completa   (scanner finaliza upload via /api/scanner/upload)
    → documentos_entregues    (assistido faz upload complementar)

documentos_entregues
    → documentacao_completa   (scanner processa os novos documentos)

documentacao_completa
    → processando_ia          (QStash job inicia)

processando_ia
    → pronto_para_analise     (pipeline IA concluído)
    → erro_processamento      (após 3 retries QStash)

erro_processamento
    → processando_ia          (reprocessamento manual via POST /:id/reprocessar)

pronto_para_analise
    → em_atendimento          (servidor trava caso via PATCH /:id/lock)

em_atendimento
    → liberado_para_protocolo (servidor libera via PATCH /:id/status)

liberado_para_protocolo
    → em_protocolo            (defensor atribui via PATCH /:id/lock)

em_protocolo
    → protocolado             (defensor finaliza via POST /:id/finalizar)
```

> [!CAUTION]
> **NUNCA** pule etapas da máquina de estados. A IA não pode propor um `status` que não esteja neste diagrama sem discussão explícita e atualização da documentação.

---

## 🔒 Downloads Seguros — Fluxo Obrigatório

O sistema **não expõe URLs de Storage diretamente**. Todo download de documento ou minuta segue este fluxo:

```
1. Frontend chama  POST /:id/gerar-ticket-download  (JWT autenticado)
2. Backend retorna { ticket: "<jwt_curta_duração>" }
3. Frontend monta a URL:  GET /:id/download-zip?ticket=<jwt>
   ou:                    GET /:id/documento/download?ticket=<jwt>&path=<path>
4. Backend valida o ticket (purpose: "download", casoId binding) e serve o arquivo
```

**Regras para a IA:**
- NUNCA gerar código que acesse `supabase.storage.createSignedUrl` diretamente no frontend
- NUNCA retornar `url_peticao` ou `url_documento_gerado` como URL pública
- Downloads de minuta usam `POST /:id/upload-minuta` para substituição (autenticado + `requireWriteAccess`)

---

## 💡 Dicas de Uso por Assistente

### Claude (claude.ai / API)

- Injete o `claude.md` completo como system prompt ou primeira mensagem
- Use o formato `<task>...</task>` em XML para delimitar tarefas longas
- Peça para Claude "pensar antes de responder" em tarefas complexas
- Use Projects do Claude para manter o contexto entre sessões

### Gemini (Google AI Studio / Cursor)

- Injete o `claude.md` no system prompt do projeto
- Use `@claude.md` no Cursor para referência automática
- Para geração de código longa, divida em arquivos menores (Gemini trunca menos)

### Cursor / Windsurf (IDE)

- Adicione o `claude.md` como arquivo de regras do projeto (`.cursorrules` ou similar)
- Use `@claude.md` + `@arquivo.jsx` para contexto combinado
- Ative o modo "Composer" para mudanças multi-arquivo

---

## 📊 Checklist Final — Antes de Commitar

```
[ ] Rodei o servidor local e testei o fluxo manualmente
[ ] Nenhum console.log com dados sensíveis
[ ] Nenhuma URL de Storage sem signed URL
[ ] Máquina de estados respeitada
[ ] RBAC verificado (cargo visualizador não tem acesso indevido)
[ ] ES Modules no backend (nenhum require())
[ ] CSS via classes do index.css (nenhum estilo inline ou Tailwind)
[ ] Prisma schema atualizado se houver novos campos
[ ] Migration SQL gerada para campos novos
```

---

_Este guia deve ser atualizado sempre que a arquitetura do projeto mudar significativamente._

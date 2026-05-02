# Walkthrough de Implementações — Mães em Ação

> **Última atualização:** 2026-04-13 · Compilado automaticamente do histórico git

---

## 📋 Histórico de Commits (9 commits — Lineagem Completa)

| Hash | Data | Mensagem |
|:-----|:-----|:---------|
| `3c9bb9e` | 2026-04-13 | Correcoes baiscas |
| `601877e` | 2026-04-10 | FIX: Visualizacao dos casos e bloquio pro admin |
| `2dadee3` | 2026-04-10 | FEAT: antes do plano de refatoracao das logica de configuracoes |
| `a8fa31c` | 2026-04-09 | teste |
| `a502be6` | 2026-04-08 | Progresso |
| `24add10` | 2026-04-07 | correcoes |
| `f28e70c` | 2026-04-06 | Progresso |
| `9f0a9bf` | 2026-04-06 | progresso |
| `09a7bea` | 2026-04-04 | backup (commit inicial — projeto completo) |

---

## 🏗️ Fase 0 — Commit Inicial (`09a7bea` · 2026-04-04)

### O que foi criado

Este commit representa a exportação inicial de um sistema já funcional derivado da versão anterior. Foram incluídos **207 arquivos** (~40.000 linhas de código).

#### Infraestrutura
- `docker-compose.yml` — Orquestra 3 serviços: `db` (PostgreSQL 17), `backend`, `frontend`
- `docker/init.sql` — Schema SQL completo v1.0 (~530 linhas)
- `backend/Dockerfile` + `frontend/Dockerfile`

#### Backend
- Express API com ES Modules (`"type": "module"`)
- Prisma ORM configurado com `backend/prisma/schema.prisma`
- Controllers: `casosController.js`, `defensoresController.js`, `jobController.js`, `scannerController.js`, `statusController.js`, `lockController.js`
- Serviços: `documentGenerationService.js`, `geminiService.js`
- Middleware: `auth.js`, `auditMiddleware.js`
- Suite de testes Jest: `geminiService.test.js`, `dicionarioAcoes.test.js`, `documentGenerationService.test.js`, `auditMiddleware.test.js`, `submissionFlow.test.js`

#### Frontend
- React 18 + Vite — SPA modular
- **Área do Servidor:** `BuscaCentral.jsx`, `TriagemCaso.jsx`, `EnvioDoc.jsx`, `ScannerBalcao.jsx`
- **Área do Defensor:** `Dashboard.jsx`, `Casos.jsx`, `DetalhesCaso.jsx`, `GerenciarEquipe.jsx`, `Cadastro.jsx`
- **Formulário modular:** `StepDadosPessoais.jsx`, `StepRequerido.jsx`, `StepTipoAcao.jsx`, etc.
- **Hooks:** `useFormHandlers.js`, `useFormValidation.js`, `useFormEffects.js`
- **Serviço:** `submissionService.js`
- **Config:** `familia.js` (configuração declarativa das ações de família)

---

## 🔄 Fase 1 — Progresso Inicial (`9f0a9bf` + `f28e70c` · 2026-04-06)

### O que mudou
Ajustes e evolução do sistema. Maior volume de mudanças concentrado na reorganização do frontend e backend pós-exportação inicial.

---

## 🔧 Fase 2 — Correções (`24add10` · 2026-04-07)

### O que mudou
Correções pontuais pós-evolução inicial.

---

## 🚀 Fase 3 — Progresso Significativo (`a502be6` · 2026-04-08)

### O que foi entregue (maior commit em estrutura)
- **Templates DOCX** adicionados ao `backend/templates/word/` (exec_penhora, exec_prisao, def_cumulado, fixacao_alimentos, etc.)
- **Suite de Testes Jest** completa adicionada em `backend/tests/`
- **Infraestrutura Docker** consolidada

---

## ✨ Fase 4 — Reorganização do Conhecimento e Novas Features (`2dadee3` · 2026-04-10)

### O que foi entregue

Este é o commit mais significativo após o inicial (**56 arquivos, +3.920 linhas**).

#### Base de Conhecimento Reorganizada
- Pasta `arquivos/Conhecimento/` reestruturada em 4 subpastas: `01-Referencia`, `02-Estrategia`, `03-Guias`, `04-Historico`
- Novos documentos criados: `DATABASE_MODEL.md`, `CADASTRO_NOVA_ACAO.md`, `TROUBLESHOOTING.md`, `README.md`

#### Backend — Novos Módulos
- `lockController.js` criado — **Session Locking** (Nível 1 e Nível 2)
- `scannerController.js` criado — Endpoint dedicado `/api/scanner/upload`
- `casosController.js` expandido massivamente (~1.559 linhas de diff)
- `middleware/auth.js` expandido com RBAC detalhado
- Rotas: `scanner.js` criada, `defensores.js` expandida
- `RESTAURACAO_COMPLETA_SUL.sql` gerado para restauração do banco

#### Frontend — Evoluções
- `StepDadosPessoais.jsx` refatorado (suporte a multi-casos)
- `DetalhesCaso.jsx` expandido para suportar workflow colaborativo
- `NotificacoesBell.jsx` com lógica de notificações em tempo real
- `AuthContext.jsx` refatorado com controle de cargo/unidade
- Adição de `PLAYBOOK_CAMPOS_E_TAGS.md` nos guias

#### Prisma Schema — Evolução Significativa
- `supabase_uid` adicionado em `defensores`
- `assistencia_casos[]` (colaboração) adicionada em `defensores` e `casos`
- Campo `compartilhado` (boolean) adicionado em `casos`
- Novos campos em `casos`: `agendamento_data`, `agendamento_link`, `agendamento_status`, `chave_acesso_hash`, `feedback`, `finished_at`, `url_capa_processual`, `compartilhado`
- `notificacoes` (nova tabela) relacionada a `defensores`
- `directUrl` adicionada ao datasource (Supabase pooler)

---

## 🛠️ Fase 5 — FIX: Visualização e Bloqueio Admin (`601877e` · 2026-04-10)

### O que foi corrigido

Commit focado em **11 arquivos** com correções críticas.

#### Backend
- `casosController.js` — Correções na recuperação de casos com JOINs de partes/juridico
- `lockController.js` — Ajuste no bypass de admin no destravamento de sessão

#### Frontend
- `DetalhesCaso.jsx` — Reescrita significativa (~1.176 linhas de diff): melhoria na exibição segura de casos compartilhados, visibilidade baseada em papel (role-based)
- `Dashboard.jsx` — Refatorado para mostrar casos compartilhados corretamente por unidade
- `Casos.jsx` — Filtros corrigidos para visualização por unidade do defensor
- `AuthContext.jsx` — Correção no parse do token JWT
- `apiBase.js` — Normalização da URL base da API

#### Base de Conhecimento
- `DATABASE_MODEL.md` atualizado com nota sobre `compartilhado`
- `tags.md` expandido (+111 linhas) com mapeamento detalhado de tags

---

## 🔨 Fase 6 — Correções Básicas (`3c9bb9e` · 2026-04-13)

### O que foi entregue

**7 arquivos modificados** — o commit mais recente.

#### Backend
- `casosController.js` — Correções na lógica de busca/visualização de casos

#### Frontend
- `App.jsx` — Rota para `ScannerBalcao` adicionada
- `DetalhesCaso.jsx` — Correções UI e lógica de detalhes do caso
- `BuscaCentral.jsx` — Melhorias na busca por CPF com SSE (Server-Sent Events?) e vínculo de irmãos
- `ScannerBalcao.jsx` — **Novo componente criado** (~140 linhas): tela dedicada ao balcão de scanner de documentos

#### Documentação
- `implementation_planracto.md` — Plano de refatoração atualizado (+94 linhas net)
- `relatorio_consolidado_v2.md` — Relatório de análise atualizado

---

## 🛡️ Fase 7 — BI Premium & Hardening RBAC (`26/04/2026`)

### O que foi entregue
- **Módulo de BI Premium:** Relatórios v4.0 com rankings de produtividade individual (Defensores vs Servidores).
- **Cargo Gestor:** Implementação completa do perfil de Gestor com bypass global e acesso administrativo ao BI.
- **Bloqueio de Horário:** Sistema de controle de acesso ao BI baseado em janelas de tempo com overrides emergenciais.
- **Hardening Segurança:** Isloamento de unidade (IDOR protection) em rotas de busca por CPF e distribuição.
- **Distribuição L1/L2:** Regras estritas de cargo para distribuição de atendimentos e protocolos.

---

## ⚡ Fase 8 — Sistema de Controle & Treinamento (`30/04/2026`)

### O que foi entregue
- **Sistema de Avisos (Announcements):** Broadcast de comunicados globais ou por unidade via `configuracoes_sistema`.
- **Soft-Lock de Unidade (Inactive State):** Togle administrativo para desativar unidades e bloquear novos casos.
- **Treinamentos Integrados:** Nova página de Treinamentos com tutoriais em vídeo e PDF (fallback SharePoint).
- **Validação de Guarda:** Obrigatoriedade de seleção de rito de guarda em ações de família com filhos.
- **Normalização SOLAR:** Refinamento dos campos de endereço e filiação (`exequentes` JSONB) para exportação ZIP.
- **Integridade de Coordenadores:** Correção de bugs de stripping de unidade em atualizações de membros da equipe.

---

## 🧹 Fase 9 — Reconciliação e Limpeza de Regras Obsoletas (`30/04/2026`)

### O que foi entregue
- **Pruning de Regras:** Remoção de regras de negócio de "Sucessões" e status legados (`documentos_entregues`) para foco total em Família.
- **Sincronização de Docs:** `ARCHITECTURE.md`, `BUSINESS_RULES.md` e `DATABASE_MODEL.md` reconciliados com o código real.
- **Desativação de OCR:** Clarificação arquitetural de que o OCR está desativado por padrão no mutirão para priorizar latência.
- **Pruning de Planos:** Movimentação de documentos de estratégia v2.0 e planos de refatoração antigos para a pasta de Legado (`arquivos/Conhecimento/99-Legado`).
- **Otimização do Master File:** Regeneração do `claude.md` removendo ruídos e focando na fonte da verdade técnica.

---

## 🐳 Docker + Prisma — Comandos de Ambiente

### Subir o ambiente Docker
```bash
# Na raiz do projeto (defsul_maes/)
docker compose up -d          # Sobe tudo em background
docker compose logs -f        # Acompanha os logs
docker compose down           # Para tudo
docker compose down -v        # Para tudo E apaga o volume do banco (reset)
```

### Prisma no Docker
```bash
docker compose exec backend npx prisma studio    # GUI do banco na porta 5555
docker compose exec backend npx prisma db pull   # Puxa schema do banco → schema.prisma
docker compose exec backend npx prisma generate  # Gera o client
```

### Prisma local (sem Docker)
```bash
cd backend
npx prisma generate       # Gera o client
npx prisma db push        # Empurra schema para o banco
npx prisma studio         # GUI do banco
```

### Usar Prisma nos Controllers
```javascript
import { prisma } from "../config/prisma.js";

// Exemplo: buscar caso por protocolo
const caso = await prisma.casos.findUnique({
  where: { protocolo: "MAE-2025-0001" },
  include: { partes: true, juridico: true, ia: true }
});
```

---

## ✅ Status Atual do Sistema (2026-04-13)

| Componente | Status |
|:-----------|:-------|
| Docker | ✅ Todos os containers configurados |
| Banco de Dados | ✅ Schema v1.0 com evoluções aplicadas |
| Prisma | ✅ Configurado com `directUrl` para Supabase pooler |
| Backend API | ✅ Express + Session Locking + Scanner + RBAC |
| Frontend | ✅ React 18 + Vite — SPA modular |
| Pipeline IA | ✅ QStash + GPT-4o-mini + Groq Llama 3.3 |
| Colaboração | ✅ `assistencia_casos` + flag `compartilhado` |
| BI Premium | ✅ Rankings + Overrides + Gestor Role |
| Avisos & Unidades| ✅ Broadcast de Avisos + Soft-Lock Inativo |
| Treinamento | ✅ Portal de Treinamento Integrado |
| Testes | ✅ Jest suite completa + reporter coverage |

# Relatório de Progresso de Refatoração — Mães em Ação

> **Última atualização:** 2026-04-13 · Compilado do histórico git e conversas de desenvolvimento

---

## ✅ FASE 1 — Modularização do TriagemCaso.jsx (Março 2026)

**Status:** ✅ **Concluído**
**Objetivo:** Reduzir `TriagemCaso.jsx` de ~1.000 linhas para ~300 linhas.

### Extração de Componentes (Fase 1.1)

| Component | Responsabilidade |
|:----------|:----------------|
| `StepTipoAcao.jsx` | Seleção do tipo de ação |
| `StepDadosPessoais.jsx` | Dados pessoais do assistido/representante |
| `StepRequerido.jsx` | Dados da parte contrária (requerido) |
| `StepDetalhesCaso.jsx` | Detalhes específicos da ação |
| `StepRelatoDocs.jsx` | Relato e upload de documentos |
| `StepDadosProcessuais.jsx` | Dados processuais (processo original, vara) |

### Extração de Estado e Reducer (Fase 1.2)

**Arquivo:** `src/areas/servidor/state/formState.js`

Actions do reducer:
- `UPDATE_FIELD` — atualização genérica de campos
- `LOAD_RASCUNHO` — carrega dados salvos do localStorage
- `ADD_FILHO` / `REMOVE_FILHO` / `UPDATE_FILHO` — gerenciamento de lista de filhos
- `RESET_FORM` — limpa o formulário
- `PREFILL_REPRESENTATIVE_DATA` — pré-preenche dados da mãe de um caso anterior

### Extração de Constantes (Fase 1.3)

**Arquivo:** `src/areas/servidor/utils/formConstants.js`
- `fieldMapping` — Mapeamento camelCase → snake_case para a API
- `digitsOnlyFields` — Set de campos que aceitam apenas dígitos

### Extração do Serviço de Submissão (Fase 1.4)

**Arquivo:** `src/areas/servidor/services/submissionService.js`
- `processSubmission()` — validação, formatação e envio para `POST /api/casos/novo`
- Validação algorítmica de CPF
- Validação de datas futuras
- Validação de documentos obrigatórios
- Construção do `FormData` multipart

### Hooks Personalizados (Fase 1.5)

**`useFormHandlers.js`**
- `handleFieldChange` — mudança genérica de campos
- `handleNumericInput` — campos numéricos com máscara
- `handleCurrencyChange` — formatação monetária
- `handleCidadeChange` / `handleSelecionaCidade` — autocomplete de cidades
- `startRecording` / `stopRecording` / `removeAudioRecording` — controle de áudio
- `toggleRequeridoDetalhe` — toggle de campos adicionais

**`useFormEffects.js`**
- Auto-save de rascunho no `localStorage` (debounce)
- Lógica de multi-casos: pré-preenchimento do representante ao iniciar novo protocolo para a mesma mãe
- Health check silencioso da API
- Sincronização de regras automáticas (ex: Fixação = representação obrigatória)

**`useFormValidation.js`**
- Estado de `formErrors`
- Validação de CPF em tempo real
- Wrapper de submissão com confirmação visual (`useConfirm`)
- Loading state e proteção contra duplos envios

### Resultado Final

```
TriagemCaso.jsx: ~1.000 linhas → ~280 linhas (redução de ~72%)
```

| Módulo | Arquivo | Linhas |
|:-------|:--------|:-------|
| Main | `TriagemCaso.jsx` | ~280 |
| Estado | `formState.js` | ~150 |
| Handlers | `useFormHandlers.js` | ~262 |
| Efeitos | `useFormEffects.js` | ~86 |
| Validação | `useFormValidation.js` | ~84 |
| Submissão | `submissionService.js` | ~425 |
| Constantes | `formConstants.js` | ~67 |

---

## ✅ FASE 2 — Infraestrutura Docker + Prisma (Abril 2026)

**Status:** ✅ **Concluído**

### Docker

| Arquivo | Propósito |
|:--------|:----------|
| `backend/Dockerfile` | Container Node.js para o backend |
| `frontend/Dockerfile` | Container Node.js para o frontend |
| `docker-compose.yml` | Orquestra 3 serviços: `db`, `backend`, `frontend` |
| `docker/init.sql` | Schema completo v1.0 — roda automaticamente no primeiro `up` |

### Prisma

| Arquivo | Propósito |
|:--------|:----------|
| `backend/prisma/schema.prisma` | 5 enums + 13 models mapeados |
| `backend/src/config/prisma.js` | Singleton do PrismaClient |

---

## ✅ FASE 3 — Session Locking + Scanner Dedicado (2026-04-10)

**Status:** ✅ **Concluído** (commit `2dadee3`)

### Novos Módulos Backend

- **`lockController.js`** — Locking atômico com `UPDATE WHERE owner IS NULL`
  - Nível 1: Servidor (`servidor_id`)
  - Nível 2: Defensor (`defensor_id`)
  - Admin bypass para forçar destravamento
- **`scannerController.js`** — Upload otimizado para balcão de scanner
  - Endpoint: `POST /api/scanner/upload`
  - Compressão automática de imagens > 1.5MB
  - Rota dedicada: `backend/src/routes/scanner.js`

---

## ✅ FASE 4 — Colaboração e Compartilhamento de Casos (2026-04-10)

**Status:** ✅ **Concluído** (commits `2dadee3` + `601877e`)

### O que foi implementado

- **Tabela `assistencia_casos`** — Auditoria de colaborações
- **Flag `compartilhado`** em `casos` — tracking de status de colaboração
- **Notificações** — `notificacoes` table + `NotificacoesBell.jsx`
- **Visibilidade role-based** — defensores de outras unidades NÃO vêem casos compartilhados privados
- **`DetalhesCaso.jsx`** refatorado para exibir badge e histórico de colaboração

### Correções Críticas Aplicadas (commit `601877e`)

- BigInt serialization: normalizador recursivo no backend para evitar erro "Illegal constructor"
- Flag `compartilhado` persistida no banco
- Audit trail para operações de compartilhamento
- Fix no parsing de `Invalid Date` nas datas de agendamento

---

## ✅ FASE 5 — ScannerBalcao + Correções (2026-04-13)

**Status:** ✅ **Concluído** (commit `3c9bb9e`)

### Novo Componente

- **`ScannerBalcao.jsx`** (~140 linhas) — Tela dedicada para o balcão do scanner
  - Busca por CPF ou protocolo
  - Dropzone de upload única com múltiplos documentos
  - Rota adicionada em `App.jsx`

### Correções

- `casosController.js` — Correções na busca por CPF e visualização de casos
- `BuscaCentral.jsx` — Melhorias no fluxo de vínculo de irmãos
- `DetalhesCaso.jsx` — Ajustes visuais e de permissão

---

## 🔄 FASE 6 — Refatoração por Configuração (PLANEJADA)

**Status:** 🔄 **Planejada** (documentada em `relatorio_consolidado_v2.md`)

### Objetivo

Fazer o formulário (`TriagemCaso.jsx`) atuar **exclusivamente** como consumidor declarativo do arquivo de configuração (`familia.js`), eliminando qualquer lógica hardcoded.

### Flags de Controle a Implementar

- `exigeDadosProcessoOriginal`
- `ocultarDadosRequerido`
- `isCpfRepresentanteOpcional`
- `labelAutor` (Mãe, Assistida, etc.)

### Outros Gaps Identificados

1. **Lista de filhos `exequentes`** — `dados_formulario.lista_filhos` não está sendo roteado corretamente para `casos_partes.exequentes`
2. **Geração Dupla** — Pipeline deve detectar dívida ≥ 3 meses e gerar automaticamente Prisão + Penhora
3. **Limpeza de Código Fantasma** — Remover `PainelRecepcao.jsx` e status obsoletos (`reuniao_agendada`)

---

## 📊 Métricas de Progresso Geral

| Aspecto | Estado Inicial (09/04/04) | Estado Atual (2026-04-13) |
|:--------|:--------------------------|:--------------------------|
| `TriagemCaso.jsx` linhas | ~1.000 | ~280 |
| Cobertura de testes | 0 | 5 suites Jest |
| Controllers backend | 3 | 7 |
| Tabelas banco | 11 | 13+ |
| Features de colaboração | ❌ | ✅ |
| Scanner dedicado | ❌ | ✅ |
| Session Locking | ❌ | ✅ |
| Notificações | ❌ | ✅ |

# Histórico de Alterações — 2026-04-25

## Resumo
Ciclo de estabilização focado em eliminar gargalos de performance no módulo de Business Intelligence (BI), correção de falhas críticas de segurança (RBAC) e melhoria na experiência de triagem (validação de CEP).

---

## 1. Segurança e RBAC (Controle de Acesso)

### Problema
- Bug de `TypeError` no middleware de autorização: o acesso a `req.user.cargo.toLowerCase()` causava Erro 500 se o cargo estivesse ausente.
- Erro de grafia no nome do arquivo (`requireWriteAcess.js`).

### Soluções
- **Renomeação:** `backend/src/middleware/requireWriteAcess.js` → `requireWriteAccess.js`.
- **Hardenizacao:** Implementada verificação segura de tipo para `req.user.cargo`. Se ausente, assume string vazia, resultando em `403 Forbidden` em vez de `500 Internal Server Error`.
- **Integridade:** Atualizada a importação em `backend/src/routes/casos.js`.

---

## 2. Performance do BI (Gargalo de Mutirão)

### Problema
- `fetchCasosMetadata` buscava todos os metadados de uma unidade e filtrava por data em memória (Node.js), causando latência extrema em bases grandes.
- `exportarXlsxLote` realizava consultas sequenciais ao banco para cada uma das 35-52 sedes.

### Soluções
- **Filtro Nativo (PostgREST/Supabase):** Refatorado para usar `.or()` com operadores `.gte` e `.lte` diretamente na query, reduzindo o tráfego de dados.
- **Filtro Nativo (Prisma):** Adicionado bloco `OR` no `where` da consulta de fallback.
- **Batch Processing:** A exportação em lote agora faz **apenas uma consulta** inicial ao banco de dados. O agrupamento por unidade é processado em memória, eliminando dezenas de conexões redundantes.
- **Robustez Excel:** Adicionada sanitização de nomes de abas (remoção de caracteres inválidos `\/\\*?[]:`) e resolução de colisões de nomes (sufixos numéricos) para respeitar o limite de 31 caracteres do ExcelJS.

---

## 3. Validações e UX (Frontend)

### Problema
- Validação de CEP via `.includes("CEP:")` causava falsos negativos no preenchimento histórico e bloqueios desnecessários na triagem.
- Exportação de PDF "revelava" botões ocultos permanentemente após o processo de captura.

### Soluções
- **Regex CEP:** Substituída a string literal por expressão regular `/\b\d{5}-?\d{3}\b/`. A validação agora foca no padrão numérico do dado, não na etiqueta visual.
- **Estado Visual PDF:** Em `useBiData.js`, implementado controle via `dataset.wasHidden`. O sistema agora memoriza quais controles já estavam ocultos antes do print e os restaura corretamente no `finally`.

---

## Arquivos Modificados
- `backend/src/middleware/requireWriteAccess.js` [NEW/RENAMED]
- `backend/src/routes/casos.js` [IMPORT FIX]
- `backend/src/controllers/biController.js` [PERF REFACTOR]
- `frontend/src/areas/servidor/services/submissionService.js` [REGEX FIX]
- `frontend/src/areas/defensor/hooks/useBiData.js` [UI FIX]

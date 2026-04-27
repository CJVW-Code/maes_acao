# Histórico de Mudanças — 2026-04-26 (Hardening RBAC & CI Stabilization)

## Contexto
Durante a auditoria final de segurança e integração contínua, foram identificados gaps na consistência do papel de `gestor` e falhas na geração de relatórios de cobertura para o pipeline de CI.

## Mudanças Realizadas

### Backend (Core & RBAC)
1.  **Promoção do Cargo Gestor**:
    *   A função `carregarCasoDetalhado` em `casosController.js` foi atualizada para tratar o cargo `gestor` como um **Power User** (assim como o `admin`).
    *   Isso resolve inconsistências onde o gestor conseguia abrir o caso, mas recebia erro `423 Locked` ao tentar baixar documentos ou gerar tickets de download.
2.  **Correção de Referência Indefinida**:
    *   Declarado o `cargoNormalizado` na função `resumoCasos` para evitar o erro `ReferenceError: cargoNormalizado is not defined`.
3.  **Filtro de Colaboração**:
    *   Corrigida a consulta de assistência compartilhada em `listarCasos` para usar a coluna `status: "aceito"` (conforme definido no schema do banco) em vez da chave inexistente `acao`.

### Módulo BI
1.  **Widgets Premium**:
    *   Atualizado o objeto `DEFAULT_WIDGETS` em `biController.js` para incluir as abas de **Produtividade** e **Ações de Gestão** por padrão nas exportações XLSX.
2.  **Qualidade de Código (Lint)**:
    *   Eliminados diversos avisos de `unused variables` em blocos catch e correções de atribuições desnecessárias (`let overrides`).

### CI/CD e Infraestrutura
1.  **Sumário de Cobertura**:
    *   Adicionado o reporter `json-summary` ao `jest.config.js` (Backend) e `vitest.config.js` (Frontend).
    *   Isso garante a geração do arquivo `coverage-summary.json`, essencial para o funcionamento do job de inspeção de qualidade no GitHub Actions.

## Verificação Técnica
- `npm run lint` no backend: **Passou** (0 erros).
- `npm run test` no backend: **Passou** (157 testes, 100% de sucesso).
- Verificada a criação de `logs/coverage/coverage-summary.json`.

---
**Responsável:** Antigravity (AI Assistant)
**Status:** Concluído e Commitado (Commit: `Fix erros`)

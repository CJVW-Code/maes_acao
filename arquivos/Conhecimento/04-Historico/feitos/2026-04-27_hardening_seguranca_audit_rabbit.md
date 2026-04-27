# Histórico de Mudanças — Hardening & Auditoria de Segurança
**Data:** 2026-04-27
**Status:** Concluído
**Autor:** Antigravity (AI Architect)

## Resumo
Consolidação de segurança e estabilização do backend/frontend após auditoria técnica. Foco em RBAC, LGPD, Performance de BI e validação de fluxo de trabalho (Workflows L1/L2).

---

## Mudanças Técnicas

### 1. Backend: Estabilização de BI e Configurações
- **`biController.js`**:
    - Adicionado utilitário `safeParseArray` para tratamento de JSON malformado no banco.
    - Substituição de `Date.now()` por `randomUUID` da biblioteca `node:crypto` para garantir unicidade de identificadores.
    - Refatoração de `deleteOverride` para operação atômica via `prisma.$transaction`.
    - **Performance:** Otimização da agregação de logs para Coordenadores, movendo a filtragem de `unidade_id` para a query do banco de dados (Prisma `groupBy`).
    - **Sanitização:** Erros 500 agora retornam mensagens genéricas para o cliente, ocultando stack traces internos.

### 2. Segurança: RBAC & LGPD
- **`defensoresController.js`**: Normalização de todas as checagens de cargo para `.toLowerCase() === "admin"`.
- **`casosController.js`**:
    - **Distribuição Hierárquica:** Implementação de validação de cargo alvo. Atendimentos (L1) aceitam qualquer cargo. Protocolos (L2) exigem cargo de Defensor ou Gestor.
    - **LGPD:** Sanitização dos metadados de auditoria em `distribuicao_caso`. Nomes e CPFs foram removidos das colunas de detalhes.
    - **Infra:** Adicionado fallback explícito para Prisma na mutação de distribuição.
    - **Correção:** Alterado filtro de colaboração de `acao: "aceito"` para `status: "aceito"`.

### 3. Frontend: UX e Blindagem de Rotas
- **`App.jsx`**: Implementado *Optional Chaining* (`?.`) em todas as guardas de rota para prevenir crashes durante a reidratação da sessão (quando `permissions` ainda é nulo).
- **`AuthContext.jsx`**: Expansão da permissão `canManageTeam` para incluir `gestor` e `coordenador`.
- **`ModalDistribuicao.jsx`**:
    - Ajuste de `z-index` para `z-[100]` (Tailwind v4) para evitar sobreposição por outros modais.
    - Normalização do mapeamento de usuários para suportar respostas da API com objetos de cargo/unidade aninhados ou achatados.

---

## Validação e Qualidade
- **Testes de Injeção**: Refatorado `injection.test.js` para evitar bugs de cache do Jest em ambiente ESM (removido `isolateModulesAsync` instável).
- **Cobertura**: Todos os 14 testes de segurança passaram com sucesso.
- **Auditoria LGPD**: Verificado que nenhum dado pessoal está sendo persistido em tabelas de logs.

## Impacto no Fluxo de Trabalho
- Coordenadores agora podem gerenciar suas equipes diretamente pelo painel.
- Gestores ganharam visão completa de BI sem necessidade de bypass manual de unidade.
- O sistema bloqueia tentativas de distribuir casos para profissionais com cargos insuficientes para a etapa atual do processo.

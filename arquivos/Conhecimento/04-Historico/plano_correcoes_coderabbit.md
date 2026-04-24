# Plano de Correção de Falhas (CodeRabbit Audit) — v3.0

Este plano detalha a resolução das falhas identificadas no relatório `erroscoderabbit.txt`, abrangendo segurança, regras de negócio (CPF obrigatório), estabilidade funcional e conformidade com LGPD, com foco em Tailwind CSS v4.

## 1. Regras de Negócio e UX (Frontend)

### 1.1 CPF do Representante Obrigatório
- **Objetivo:** Remover a lógica de CPF opcional para o representante da assistida (mãe).
- **Ação:** 
    - Remover a flag `isCpfRepresentanteOpcional` de `frontend/src/config/formularios/acoes/familia.js`.
    - Em `StepDadosPessoais.jsx`, apagar a lógica condicional e tornar o CPF **obrigatório** no schema de validação e no `aria-required`.
    - Atualizar `submissionService.js` para garantir que o CPF seja validado em todos os envios de triagem.

### 1.2 Correção de "Validation Drift"
- **Análise sobre Minutas:** **Sim, o drift afeta as minutas.** Se a UI não exibe o erro, o usuário pode enviar o formulário incompleto, gerando petições com lacunas.
- **Ação:** Padronizar as chaves de erro para o padrão `REQUERIDO_NOME`.
- **Fallback de Minuta:** Em `DetalhesCaso.jsx`, usar a chave `url_peticao` para arquivos `url_documento_gerado`.

### 1.3 Extinção do Polling e Novo Dashboard v3.0 (Tailwind v4)
- **Ação:** 
    - **Remover Polling:** Apagar o `setInterval` e o sistema de busca periódica no `AuthContext.jsx`.
    - **Sidebar de Alertas:** Redesenhar o `Dashboard.jsx` usando grid (`grid-cols-[1fr_350px]`). A lista de casos ocupará a esquerda e uma sidebar de cards para alertas/compartilhamentos ocupará a direita.
    - **Estilização:** Definir `NotificationCard` e `AssistenciaCard` no `index.css` usando `@layer components` e `@apply` (Tailwind v4), proibindo estilos inline ad-hoc.

---

## 2. Segurança e Infraestrutura (Backend)

### 2.1 Hardening de Downloads (Prevenção de Tampering)
- **Ação:** No controller `baixarDocumentoIndividual`, validar se o `path` e o `bucket` do Ticket são IDÊNTICOS aos da requisição.
- **Fail-Closed:** Retornar 403 se `req.ticket.casoId` for inexistente no payload assinado.

### 2.2 Unificação da API_BASE_URL
- **Ação:** Padronizar em todos os arquivos o uso da porta `8001` sem o sufixo `/api`.

### 2.3 Refatorações Técnicas (Auditoria)
- **Storage:** Corrigir prefixo duplicado `"documentos/documentos/"` no fallback local.
- **iaUpdateData:** Usar `DIRECT_COLUMN_KEYS` em vez de múltiplos `ifs` em cascata.
- **Otimização:** Remover consultas redundantes ao Prisma no carregamento de casos (reuso de relações).

---

## 3. Conformidade LGPD e BI

### 3.1 Blindagem de PII no BI
- **Ação:** 
    - Substituir análise qualitativa de arquivamento por categorias controladas em `BUSINESS_RULES.md`.
    - Refatorar queries para não acessarem `casos_partes` via Prisma.

---

## 4. Manutenção de Documentação

- **Ação:** 
    - Corrigir typo "Purpósito" para "Propósito" em `2026-04-23_mudancas.md`.
    - Padronizar "Performance" para "Desempenho" em `ARCHITECTURE.md` e `claude.md`.
    - Sincronizar **v3.0** em `ARCHITECTURE.md`, `BUSINESS_RULES.md` e `DATABASE_MODEL.md`.
    - Remover estado `documentos_entregues` de `AI_WORKFLOW.md`.
    - **Tailwind v4:** Atualizar guias para incentivar componentes via `@layer components`.

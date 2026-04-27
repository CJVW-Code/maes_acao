# Histórico de Mudanças — Estabilização de RBAC, Distribuição e BI

**Data:** 2026-04-26  
**Versão:** 4.3  
**Autor:** Antigravity (AI Assistant)

---

## 🚀 Resumo das Alterações
Esta atualização foca na robustez do sistema de controle de acesso (RBAC), endurecimento das regras de distribuição de casos e otimização de transações no backend.

### 🛡️ Segurança e RBAC
- **Case-Insensitive RBAC**: Corrigida comparação de cargos em todos os controllers para usar `.toLowerCase()`. Isso evita falhas de permissão quando o banco retorna "Admin" em vez de "admin".
- **Isolamento de Unidade (Busca)**: A busca por CPF (`buscarPorCpf`) agora aplica filtragem estrita por `unidade_id`. Profissionais só veem casos de sua unidade ou casos compartilhados via assistência. Admins e Gestores mantêm visão global.
- **Isolamento de Unidade (Vínculos)**: A vinculação automática de casos irmãos em `obterDetalhesCaso` agora é restrita à mesma unidade do usuário, prevenindo vazamento de dados entre sedes.

### 📋 Distribuição de Casos
- **Validação de Unidade**: Implementada trava em `distribuirCaso` que impede a distribuição de um caso para um profissional de uma unidade diferente da unidade do caso.
- **Bypass de Poder**: Apenas usuários com cargo **Admin** ou **Gestor** podem realizar distribuições inter-unidades.

### ⚙️ Backend e Performance
- **Transações Prisma**: Refatorada a atualização de configurações em lote no `configController` para usar `$transaction`, garantindo atomicidade e prevenindo estados inconsistentes.
- **Estabilização de Testes**: Atualizado o setup de testes do Jest para incluir mocks do Supabase (`in`, `is`) e garantir o fechamento das conexões do Prisma (`$disconnect`) após os testes.

---

## 🛠️ Detalhes Técnicos

### Backend
- **Controller `casosController.js`**:
    - Adicionado filtro de unidade e assistência em `buscarPorCpf`.
    - Adicionada validação de `unidade_id` em `distribuirCaso`.
    - Padronização de verificações de cargo com `.toLowerCase()`.
- **Controller `configController.js`**: Migração para `$transaction` no `updateConfig`.
- **Setup de Testes**: Ajustes em `backend/tests/setup.js`.

---

## 🧪 Verificação Realizada
- [x] Testes de unidade e integração validados.
- [x] Verificação manual de restrição de busca entre unidades distintas.
- [x] Teste de distribuição bloqueada para unidades diferentes (Coordenador).
- [x] Confirmação de bypass para Admin/Gestor.

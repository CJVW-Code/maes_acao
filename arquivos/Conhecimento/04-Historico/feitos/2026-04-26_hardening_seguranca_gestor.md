# Histórico de Mudanças — Hardening de Segurança e Visibilidade

**Data:** 2026-04-26  
**Versão:** 4.2  
**Autor:** Antigravity (AI Assistant)

---

## 🚀 Resumo das Alterações
Esta atualização foca no endurecimento da segurança do backend, correção de bugs de roteamento e alinhamento de visibilidade para o cargo de **Gestor**.

### 🛡️ Segurança e LGPD
- **PII em Logs**: Removidos nomes de usuários (`holder`) dos logs de aviso de contenção de trava (`logger.warn`). Agora o sistema registra apenas IDs internos.
- **Isolamento de Unidade**: O middleware `requireSameUnit` foi refatorado para suportar **Assistência Compartilhada**. Agora, colaboradores aceitos de outras sedes podem visualizar o caso.
- **Roteamento**: Aplicada regex `(\\d+)` no parâmetro `:id` das rotas de casos para evitar que o middleware intercepte rotas nomeadas como `/assistencia` ou `/notificacoes`.

### 📊 Visibilidade e BI
- **Cargo Gestor**: Equalizada a visibilidade do Dashboard. Gestores agora possuem visão global (bypass de unidade) em todas as estatísticas, assim como Administradores.
- **Robustez de Dados**: Implementada limpeza profunda em `safeFormData` para garantir que o campo JSONB `dados_formulario` seja sempre um objeto válido, prevenindo crashes por dados malformados.

---

## 🛠️ Detalhes Técnicos

### Backend
- **Middleware `requireSameUnit.js`**: Migrado de Prisma para **Supabase JS Client** para seguir o padrão arquitetural de "Core de Casos".
- **Controller `resumoCasos`**: Atualizada a constante `partesWhere` para incluir `gestor`.
- **Helpers**: Adicionada validação de tipo estrita em `safeFormData`.

### Frontend
- **Nenhuma alteração necessária** (Apenas estabilização de contratos de API).

---

## 🧪 Verificação Realizada
- [x] Testes de Cobertura (`npm run test:coverage`) passando.
- [x] Validação lógica de bypass para Gestor.
- [x] Verificação de intercepção de rota `/assistencia`.

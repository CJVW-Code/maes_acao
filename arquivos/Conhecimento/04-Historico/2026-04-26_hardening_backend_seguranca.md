# Histórico de Mudanças — 26/04/2026

## Título: Hardening de Backend, Segurança de Unidade e Máquina de Estados

### Resumo
Dia focado na estabilização crítica do backend para o mutirão. Implementamos isolamento de dados por unidade (prevenção de IDOR), centralização da máquina de estados, normalização de cargos e melhorias no CI/CD. Foram concluídas 13 tasks de hardening.

### Detalhamento Técnico

#### 1. Arquitetura e Máquina de Estados
- **Task 01:** Criação do módulo `backend/src/utils/stateMachine.js` para centralizar as transições de status permitidas.
- **Task 07:** Integração do `stateMachine.js` no `casosController.js`, garantindo que mudanças de status sigam o fluxo operacional e permitindo bypass auditado para administradores.

#### 2. Robustez e Helpers
- **Task 02:** Implementação de `backend/src/utils/helpers.js` com a função `safeFormData`, protegendo o sistema contra erros de `null` em campos JSONB (`dados_formulario`).
- **Task 06:** Aplicação de `safeFormData` na regeneração de petições (IA) para evitar falhas em casos com dados incompletos.

#### 3. Segurança e RBAC (Hardening Inicial)
- **Task 03:** Normalização do campo `cargo` para lowercase no middleware de autenticação, eliminando inconsistências de case-sensitive.
- **Task 04:** Criação do middleware `requireSameUnit` para garantir que usuários só acessem casos da sua própria unidade (Isolamento de Unidade).
- **Task 09 & 12:** Aplicação global do `requireSameUnit` em todas as rotas de casos que utilizam `/:id`, protegendo contra acesso direto via URL.
- **Task 05:** Refatoração da listagem de equipe para permitir que Gestores e Coordenadores vejam membros da sua unidade, mantendo o bloqueio para os demais.

#### 4. Monitoramento e Infraestrutura
- **Task 08:** Adição de logs estruturados de contenção no `lockController.js` para monitorar disputas de bloqueio de casos durante o mutirão.
- **Task 10:** Correção da verificação de sintaxe do `server.js` no workflow do GitHub Actions (CI/CD).
- **Task 13:** Adição do domínio oficial `maesemacao.defsulbahia.com.br` na whitelist do CORS.

#### 5. Validação
- **Task 11:** Verificação final com a execução da suíte de testes.
- **Resultado:** 153 testes passando com 100% de sucesso.

---

## Título: RBAC Hierárquico, Cargo Gestor e Expansão de Permissões

### Resumo
Implementação do cargo **Gestor** (Defensor Geral) e expansão dos poderes de **Coordenador**. O sistema agora suporta visibilidade global para cargos estratégicos e poder de destravamento de casos (Unlock) para superiores.

### Detalhamento Técnico

#### 1. Novo Cargo: Gestor (Defensor Geral)
- **Visibilidade Global:** Implementado bypass no middleware `requireSameUnit` e nos controladores de listagem (`casosController`, `defensoresController`). O Gestor agora tem visão de todas as unidades do estado.
- **Permissões de Escrita:** Adicionado ao whitelist de `requireWriteAccess`.

#### 2. Expansão do Poder de Destravamento (Unlock)
- **Locking Nível 1 & 2:** Refatorado `lockController.js` para permitir que `admin`, `gestor` e `coordenador` possam liberar casos travados por qualquer usuário.
- **Operacional:** Garante que coordenadores de unidade possam intervir em atendimentos travados sem depender do administrador central.

#### 3. Ajustes de UI e UX (Frontend)
- **Saudação Honorífica:** Atualizado `Dashboard.jsx` para incluir o prefixo "Dr(a). " para os cargos `defensor`, `coordenador` e `gestor`.
- **Sidebar e Navegação:** Atualizado `Sidebar.jsx` para refletir as permissões de relatório e gestão de equipe para os novos cargos.
- **Gestão de Equipe:** Atualizado `Cadastro.jsx` e `GerenciarEquipe.jsx` para incluir o cargo `gestor` e remover o cargo obsoleto `visualizador`.

#### 4. Sincronização de Documentação
- Atualização do `ARCHITECTURE.md` (v4.1) e `BUSINESS_RULES.md` (v3.1) para refletir a nova hierarquia RBAC.
- Atualização do `claude.md` (v4.1) com a tabela de permissões atualizada.

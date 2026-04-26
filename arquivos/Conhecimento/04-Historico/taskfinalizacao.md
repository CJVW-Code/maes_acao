# Task List — Gestor, Coordenador, BI e Distribuição

> **Auditoria:** 2026-04-26 15:28 (BRT) — Status verificado diretamente nos arquivos do codebase.
> **Aderência ao `implementation_planfinal.md`:**
> - Fase 1 (Schema/Banco): ❌ Não iniciada
> - Fase 2 (Backend): ⚠️ Parcial — segurança/locking feito, distribuição e BI pendentes
> - Fase 3 (Frontend): ⚠️ Parcial — RBAC visual feito, modais e permissions helper pendentes
> - Fase 4 (Validação E2E): ❌ Não iniciada

- `[ ]` uncompleted tasks
- `[/]` in progress tasks
- `[x]` completed tasks

---
ID: 1
File Path: `backend/prisma/schema.prisma`
Context: Define a estrutura do banco de dados relacional (gerido via Prisma).
Action: Adicionar o model `configuracoes_sistema`.
Logic Details: 
  - Chave primária: `chave` (VarChar 100).
  - Campos: `valor` (String), `descricao` (String opcional), `updated_at` (DateTime com @updatedAt).
Acceptance Criteria: Model `configuracoes_sistema` deve existir e validar sem erros de sintaxe Prisma.
Status: `[ ]` — Model não encontrado no `schema.prisma`. **Não iniciado.**
---
ID: 2
File Path: `backend/package.json` (Execução de Terminal)
Context: Gerenciamento do ciclo de vida Prisma.
Action: Executar migration para criar a nova tabela no banco.
Logic Details: 
  - Rodar `npx prisma migrate dev --name add_configuracoes_sistema` e em seguida `npx prisma generate`.
Acceptance Criteria: Tabela física deve existir no Supabase sa-east-1 e Cliente Prisma atualizado.
Status: `[ ]` — Depende da Task 1. **Bloqueado/Não iniciado.**
---
ID: 3
File Path: `backend/seed_permissions.cjs`
Context: Popula o banco com cargos, permissões e dados base.
Action: Inserir cargo `gestor` e valores de default para o BI via `upsert`.
Logic Details: 
  - O JSON de horários default deve ser: `[{"inicio":"07:00","fim":"09:00"},{"inicio":"17:00","fim":"23:59"}]`.
  - Inserir `gestor` no array de cargos do Seed.
Acceptance Criteria: Ao rodar o seed, o banco deve ter o cargo `gestor` e as chaves `bi_horarios` / `bi_timezone`.
Status: `[ ]` — Cargo `gestor` não encontrado no `seed_permissions.cjs`. Horários de BI também ausentes. **Não iniciado.**
---
ID: 4
File Path: `backend/src/utils/configCache.js` (Novo)
Context: Arquivo novo para cache em memória.
Action: Criar módulo de cache em memória para a tabela `configuracoes_sistema`.
Logic Details: 
  - Função `getConfiguracoes()` que lê do Prisma e salva na memória se expirado.
  - TTL (Time To Live) estrito de 5 minutos (300.000 ms).
  - Função `invalidarCache()` exposta para forçar o reset.
Acceptance Criteria: Leituras repetidas em <5min não devem gerar queries no banco de dados.
Status: `[ ]` — Arquivo não existe em `backend/src/utils/`. **Não iniciado.**
---
ID: 5
File Path: `backend/src/middleware/requireSameUnit.js` (Novo)
Context: Arquivo novo para proteger rotas por Unidade.
Action: Criar middleware que valida escopo horizontal.
Logic Details: 
  - Buscar `unidade_id` do caso via `supabase.from('casos').select('unidade_id').eq('id', req.params.id)`.
  - Comparar com `req.user.unidade_id`.
  - Permitir bypass silencioso se `req.user.cargo` for `admin` ou `gestor`.
  - Retornar 403 Forbidden se houver mismatch.
Acceptance Criteria: Um coordenador não deve conseguir alterar casos de outra unidade.
Status: `[x]` — **Concluído.** Arquivo `backend/src/middleware/requireSameUnit.js` existe e foi commitado (commit `7a49e82`).
---
ID: 6
File Path: `backend/src/middleware/requireWriteAccess.js`
Context: Protege rotas de escrita na API globalmente.
Action: Adicionar o cargo `gestor` na whitelist de permissões de escrita.
Logic Details: 
  - Incluir `'gestor'` no array `allowedCargos`.
Acceptance Criteria: Requisições POST/PUT de um usuário com cargo "gestor" não devem retornar 403.
Status: `[x]` — **Concluído.** `gestor` presente no array `allowedRoles` de `requireWriteAccess.js`.
---
ID: 7
File Path: `backend/src/controllers/configController.js` (Novo)
Context: Arquivo novo. Expõe endpoints CRUD para configurações.
Action: Criar funções GET e PUT para gerenciar `configuracoes_sistema`.
Logic Details: 
  - PUT deve chamar `invalidarCache()` do `configCache.js` imediatamente após salvar no Prisma.
  - Retornar configuração de forma unificada/serializada.
Acceptance Criteria: O endpoint PUT altera os dados e reseta o cache em memória no mesmo request.
Status: `[ ]` — Arquivo não existe em `backend/src/controllers/`. **Não iniciado.**
---
ID: 8
File Path: `backend/src/controllers/lockController.js`
Context: Gerencia o destrancamento de casos no sistema.
Action: Refatorar `unlockCaso` adicionando whitelist e permitindo cargo `coordenador` e `gestor`.
Logic Details: 
  - `isAdmin` substituído por validação contra cargos autorizados (`admin`, `gestor`, `coordenador`).
  - Coordenador só pode fazer unlock se o status for `pronto_para_analise`, `em_atendimento`, `liberado_para_protocolo`, `em_protocolo` ou `erro_processamento`.
  - Status `protocolado` e `processando_ia` retornam 409 se acionados por coordenador.
Acceptance Criteria: Destrancamento rejeita status bloqueados para Coordenador, mas permite todos para Gestor.
Status: `[/]` — **Parcialmente concluído.** O `unlockCaso` já verifica `['admin', 'gestor', 'coordenador']`. **Porém**, a whitelist de status (rejeitar `protocolado` e `processando_ia` para coordenador) ainda NÃO foi implementada. O unlock está genérico para qualquer status.
---
ID: 9
File Path: `backend/src/controllers/casosController.js`
Context: Controller central de casos.
Action: Criar a função `distribuirCaso`.
Logic Details: 
  - Consultar `status` atual usando Supabase.
  - Se status é fluxo inicial (`pronto_para_analise`, `em_atendimento`): alvo vai para `servidor_id`, mudar status para `em_atendimento`.
  - Se status é fluxo final (`liberado_para_protocolo`, `em_protocolo`): alvo vai para `defensor_id`, mudar status para `em_protocolo`.
  - Fazer `.update()` via Supabase com `.in('status', statusPermitidos)`. Retornar 409 se `.single()` falhar.
  - Chamar Prisma para criar linha em `logs_auditoria`.
Acceptance Criteria: O "Distribuir" garante thread-safety e alinha corretamente os Locks N1 e N2 sem sobrescrever o campo errado.
Status: `[ ]` — Função `distribuirCaso` não encontrada no `casosController.js`. **Não iniciado.**
---
ID: 10
File Path: `backend/src/controllers/biController.js`
Context: Controlador que gera os dados do Dashboard e exportações.
Action: Implementar bloqueio por horário no BI usando `configCache`.
Logic Details: 
  - Ler `bi_horarios` e `bi_timezone` do `getConfiguracoes()`.
  - Obter a hora atual (moment-timezone) e comparar com o array de JSON (`[{"inicio":"07:00","fim":"09:00"}]`).
  - Se `req.user.cargo` não for `admin` E hora atual for inválida: retornar `{ bloqueadoPorHorario: true, mensagem: "..." }` com HTTP 200.
Acceptance Criteria: A API deve responder um Payload amigável contendo `bloqueadoPorHorario` quando fora da janela estipulada.
Status: `[ ]` — Lógica de `bi_horarios` não encontrada no `biController.js`. **Não iniciado.**
---
ID: 11
File Path: `backend/src/controllers/biController.js`
Context: Controlador que gera os dados do Dashboard e exportações.
Action: Adicionar Produtividade por Defensor e Escopo de Coordenador.
Logic Details: 
  - Se cargo for `coordenador`, forçar `.eq('unidade_id', req.user.unidade_id)` na query do Supabase.
  - Adicionar nova aba no JSON retornado (`produtividade_defensores`), agrupando os casos por `defensor_id` (Nível 2) ou `servidor_id` (Nível 1).
Acceptance Criteria: O JSON do BI retornará estatísticas agrupadas por usuários além de unidades.
Status: `[ ]` — Campo `produtividade_defensores` não encontrado. Escopo de coordenador não implementado. **Não iniciado.**
---
ID: 12
File Path: `backend/src/routes/bi.js`
Context: Rotas da área de inteligência do mutirão.
Action: Atualizar middleware de permissão das rotas de BI.
Logic Details: 
  - Substituir check de cargo `admin` por função que permite `admin`, `gestor` ou `coordenador`.
Acceptance Criteria: Endpoints `/api/bi/estatisticas`, `/api/bi/exportar/pdf` e `xlsx` passam a aceitar esses 3 cargos.
Status: `[ ]` — Cargo `gestor`/`coordenador` não encontrado nas rotas de `bi.js`. Acesso ainda restrito ao `admin`. **Não iniciado.**
---
ID: 13
File Path: `backend/src/routes/casos.js`
Context: Rotas operacionais (REST) de Casos.
Action: Adicionar rota `POST /:id/distribuir`.
Logic Details: 
  - Injetar middlewares em ordem: `authMiddleware` -> `requireWriteAccess` -> `requireSameUnit` -> `distribuirCaso`.
Acceptance Criteria: A requisição chega limpa ao Controller com o Cargo e Escopo pré-validados.
Status: `[ ]` — Rota `/distribuir` não encontrada em `backend/src/routes/casos.js`. **Não iniciado.** Depende da Task 9.
---
ID: 14
File Path: `backend/src/routes/config.js` (Novo)
Context: Arquivo novo.
Action: Criar e exportar o Router Express para o `configController`.
Logic Details: 
  - Mapear `GET /api/config` e `PUT /api/config`.
  - Proteger ambas as rotas restringindo uso SOMENTE a `admin` e `gestor`.
  - Registrar esse Router no `backend/src/app.js` ou `routes/index.js`.
Acceptance Criteria: As rotas de configuração respondem corretamente e são inacessíveis para o Coordenador.
Status: `[ ]` — Arquivo `backend/src/routes/config.js` não existe. **Não iniciado.** Depende das Tasks 7 e 4.
---
ID: 15
File Path: `frontend/src/areas/defensor/contexts/AuthContext.jsx`
Context: Gerencia tokens e dados do usuário globalmente.
Action: Criar e expor `permissions` (Helper centralizado).
Logic Details: 
  - Definir `canManageTeam` (`admin`), `canViewBi` (`admin/gestor/coord`), `canDistribuir` (`admin/gestor/coord`).
  - Passar esse objeto no `value` do `AuthContext.Provider`.
Acceptance Criteria: Todo o frontend tem acesso a verificações semânticas em vez de ler `user.cargo` cru.
Status: `[ ]` — O `AuthContext.jsx` não expõe objeto `permissions`. Componentes ainda dependem de `user.cargo` diretamente. **Não iniciado.**
---
ID: 16
File Path: `frontend/src/areas/defensor/pages/ConfiguracoesSistema.jsx` (Novo)
Context: Arquivo novo.
Action: Interface para editar os horários do BI.
Logic Details: 
  - Input dinâmico de Array para `horario_inicio` e `horario_fim`.
  - Sem uso de `style={{}}`.
Acceptance Criteria: O Admin e Gestor podem adicionar/remover blocos de tempo visualmente e salvar.
Status: `[ ]` — Arquivo não existe. **Não iniciado.** Depende das Tasks 14, 7, 4.
---
ID: 17
File Path: `frontend/src/areas/defensor/pages/Dashboard.jsx`
Context: Exibe os widgets do BI via requisição React.
Action: Tratar o estado `bloqueadoPorHorario` e exibir gráficos de Produtividade.
Logic Details: 
  - Se a API retornar `{ bloqueadoPorHorario: true }`, esconder os gráficos e mostrar um Card de alerta.
  - Consumir o novo array `produtividade_defensores` e renderizar listagem/gráfico.
Acceptance Criteria: Usuário é avisado corretamente e novos gráficos são visíveis (quando permitido).
Status: `[ ]` — `bloqueadoPorHorario` e `produtividade_defensores` não encontrados no `Dashboard.jsx`. **Não iniciado.**
---
ID: 18
File Path: `frontend/src/areas/defensor/components/ModalDistribuicao.jsx` (Novo)
Context: Arquivo novo. Componente puro.
Action: Criar Dialog para seleção de usuários da mesma Unidade.
Logic Details: 
  - Realizar fetch em `/api/defensores/unidade/:unidade_id` para listar defensores.
Acceptance Criteria: O modal exibe apenas nomes de usuários ativos na unidade corrente.
Status: `[ ]` — Arquivo não existe. **Não iniciado.** Depende da Task 9.
---
ID: 19
File Path: `frontend/src/areas/defensor/pages/DetalhesCaso.jsx`
Context: Página com as ações que alteram o status de um caso.
Action: Injetar os botões "Distribuir Caso" e "Devolver Caso".
Logic Details: 
  - Renderizar botões baseados em `permissions.canDistribuir`.
  - Ocultar botões se o status atual for `protocolado` ou `processando_ia`.
Acceptance Criteria: A página reflete corretamente a capacidade de gerenciamento da fila para coordenadores e gestores.
Status: `[ ]` — Botões `Distribuir`/`Devolver` não encontrados em `DetalhesCaso.jsx`. **Não iniciado.** Depende das Tasks 9, 15 e 18.
---
ID: 20
File Path: `frontend/src/areas/defensor/pages/GerenciarEquipe.jsx`
Context: Listagem de defensores do mutirão.
Action: Remover dependência do admin hardcoded e tratar UI do Gestor.
Logic Details: 
  - Substituir verificações `user.cargo === 'admin'` por `permissions.canManageTeam`.
  - Adicionar classe de badge para o cargo de `GESTOR` nas listagens.
Acceptance Criteria: O Gestor acessa a página para ver a equipe, mas botões de Editar/Excluir somem graciosamente.
Status: `[/]` — **Parcialmente concluído.** O cargo `gestor` já aparece no arquivo e tem tratamento visual (badge). Porém a substituição por `permissions.canManageTeam` não foi feita — ainda usa `user.cargo` hardcoded. Depende da Task 15 para completar.
---
ID: 21
File Path: `frontend/src/areas/defensor/pages/Cadastro.jsx`
Context: Tela de inserção de membros na equipe.
Action: Incluir `gestor` como opção.
Logic Details: 
  - O cargo Gestor deve figurar nas opções do `<select>` e ser enviado via POST para `/api/defensores/cadastro`.
Acceptance Criteria: É possível cadastrar um usuário da plataforma diretamente como gestor.
Status: `[x]` — **Concluído.** Cargo `gestor` encontrado como opção em `Cadastro.jsx`.
---
ID: 22
File Path: `End-to-End Validation`
Context: Garantia de Qualidade da Nova Regra.
Action: Validação integral de regras horizontais e verticais.
Logic Details: 
  - Testar lock pessimista Nível 1 vs Nível 2 distribuindo um caso "Pronto para análise" e "Liberado para Protocolo".
  - Logar como Coordenador, gerar Relatório no pico (deve dar Alert de bloqueado), e fora do pico (deve filtrar unidade e mostrar produtividade do usuário).
  - Fazer requisição manual via HTTP do coordenador para Distribuir caso de outra unidade (deve rejeitar 403).
Acceptance Criteria: O sistema não quebra na API ou no front, os erros são tratados com mensagens amigáveis e não há vazamento de dados inter-regionais.
Status: `[ ]` — **Não iniciado.** Depende das Tasks 9–19.

---
ID: 1
File Path: backend/seed_permissions.cjs
Context: Semeia permissões básicas, cargos padrío e vínculos em `cargo_permissoes`.
Action: Atualizar catálogo de cargos e permissões para incluir `coordenador`, remover `recepcao` do desenho alvo e bloquear protocolo para `servidor`/`estagiario`.
Logic Details:
- Manter cargos alvo: `admin`, `coordenador`, `defensor`, `servidor`, `estagiario`, `visualizador`.
- Garantir que `coordenador` receba as mesmas permissões operacionais de `defensor`.
- Garantir que `servidor` e `estagiario` nío recebam permissío equivalente a protocolar/finalizar.
- Preservar `gerenciar_equipe` apenas para `admin`.
- Nío introduzir `require` novo em arquivos ES Module; esta task é isolada no seed CJS existente.
Acceptance Criteria:
- O seed passa a refletir exatamente a matriz de cargos validada.
- `coordenador` existe no catálogo sem poderes globais de `admin`.
- `servidor` e `estagiario` nío recebem capacidade de protocolo/finalizaçío.
---
---

ID: 2
File Path: backend/src/middleware/requireWriteAcess.js
Context: Middleware simples que hoje bloqueia apenas o cargo `visualizador` de operações de escrita.
Action: Refatorar para usar matriz explícita de escrita por cargo.
Logic Details:

- Permitir escrita apenas para `admin`, `coordenador`, `defensor`, `servidor`, `estagiario`.
- Negar escrita para `visualizador`.
- Preparar o middleware para ser compatível com os cargos sem inferência implícita por nome parcial.
- Retornar `403` com mensagem clara para cargos sem escrita.
  Acceptance Criteria:
- `visualizador` continua bloqueado em todas as rotas protegidas por este middleware.
- Novos cargos validados (`coordenador`) passam corretamente.
- Nenhum cargo fora da matriz recebe escrita por acidente.

---

---

ID: 3
File Path: backend/src/middleware/auth.js
Context: Valida JWT local, carrega `defensores` via Prisma e injeta `req.user`.
Action: Alinhar a montagem de `req.user` para sustentar a nova matriz de cargos e futuras checagens por unidade.
Logic Details:

- Garantir que `req.user` sempre contenha `id`, `cargo`, `unidade_id`, `nome`, `email`.
- Nío adicionar logs com CPF, protocolo ou conteúdo de `dados_formulario`.
- Manter validaçío HS256 e o formato atual do token.
- Nío mudar a estratégia de autenticaçío pública do upload complementar.
  Acceptance Criteria:
- Todos os controllers passam a receber `cargo` e `unidade_id` de forma consistente.
- Nenhuma informaçío sensível extra é incluída em logs de autenticaçío.

---

---

ID: 4
File Path: backend/src/controllers/lockController.js
Context: Implementa `PATCH /:id/lock` e `PATCH /:id/unlock` usando `prisma.casos.updateMany`.
Action: Reescrever a lógica de locking para separar Nível 1 e Nível 2 por cargo e por status, com aquisiçío atômica.
Logic Details:

- `defensor` e `coordenador` podem adquirir lock:
  - Nível 1 em `pronto_para_analise` e `em_atendimento`
  - Nível 2 em `liberado_para_protocolo` e `em_protocolo`
- `servidor` e `estagiario` só podem adquirir lock Nível 1.
- `servidor`/`estagiario` nío podem bloquear casos em `em_protocolo`.
- Usar atualizaçío condicional atômica sobre `casos.servidor_id`, `casos.servidor_at`, `casos.defensor_id`, `casos.defensor_at`.
- Em conflito, retornar `423` com `holder` sem expor dados pessoais além do `nome`.
- `unlock` continua administrativo por ora, a menos que já exista regra mais restritiva no código integrado.
  Acceptance Criteria:
- Dois usuários concorrentes nío conseguem adquirir o mesmo lock.
- `servidor` nunca consegue adquirir Nível 2.
- `coordenador` se comporta como `defensor` para locking.

---

---

ID: 5
File Path: backend/src/controllers/casosController.js
Context: Controlador central de casos; contém leitura de detalhe, auto-vínculo, máquina de estados, upload complementar e notificações.
Action: Refatorar o fluxo de `obterDetalhesCaso` para nío adquirir lock implicitamente e usá-lo apenas como validaçío de posse/acesso.
Logic Details:

- O `GET /:id` nío deve mais ser a operaçío primária de lock.
- Se `casos.defensor_id`/`casos.servidor_id` já estiverem ocupados por outro usuário sem compartilhamento aceito em `assistencia_casos.status = "aceito"`, retornar `423`.
- `defensor`/`coordenador` podem ler casos de protocolo conforme posse/unidade.
- `servidor`/`estagiario` nío devem acessar caso em `em_protocolo`, mesmo por URL direta.
- Nío priorizar refino de casos antigos além de impedir quebra do fluxo novo.
  Acceptance Criteria:
- Abrir o detalhe nío atribui mais o caso sozinho.
- Usuário sem posse válida em caso travado recebe `423`.
- `servidor` nío acessa `em_protocolo`.

---

---

ID: 6
File Path: backend/src/controllers/casosController.js
Context: O mesmo controlador contém `atualizarStatusCaso`, com transições genéricas entre estados.
Action: Endurecer a máquina de estados e remover `protocolado` da atualizaçío genérica de status.
Logic Details:

- Preservar apenas transições operacionais coerentes:
  - `aguardando_documentos -> documentacao_completa`
  - `documentacao_completa -> processando_ia | pronto_para_analise | aguardando_documentos`
  - `processando_ia -> pronto_para_analise | erro_processamento`
  - `pronto_para_analise -> em_atendimento | aguardando_documentos | processando_ia`
  - `em_atendimento -> liberado_para_protocolo | aguardando_documentos | pronto_para_analise`
  - `liberado_para_protocolo -> em_protocolo | em_atendimento`
- Remover `em_protocolo -> protocolado` da rota genérica.
- Ao setar `liberado_para_protocolo`, limpar `casos.servidor_id` e `casos.servidor_at`.
- Bloquear `servidor` e `estagiario` de qualquer transiçío para `em_protocolo`.
- Validar cargo via `req.user.cargo`, além do middleware.
  Acceptance Criteria:
- `protocolado` nío pode mais ser atingido por `PATCH /:id/status`.
- `servidor`/`estagiario` nío conseguem mover o caso para protocolo.
- A transiçío para `liberado_para_protocolo` continua liberando o lock Nível 1.

---

---

ID: 7
File Path: backend/src/controllers/casosController.js
Context: O controlador também implementa `finalizarCasoSolar`, que hoje já materializa a conclusío do caso.
Action: Tornar `finalizarCasoSolar` a única origem válida do status `protocolado`.
Logic Details:

- A conclusío deve setar `casos.status = "protocolado"` exclusivamente aqui.
- Validar que apenas `admin`, `defensor` e `coordenador` podem concluir.
- Garantir preenchimento consistente de campos já usados no fluxo final, como `casos.numero_processo`, `casos.protocolado_at`, `casos.url_capa_processual` e `casos.finished_at` quando aplicável.
- Manter a lógica de upload da capa e signed URLs conforme o fluxo atual.
- Em erro, nío deixar `casos.status` em `protocolado` sem os demais dados críticos persistidos.
  Acceptance Criteria:
- O botío “Concluir e Enviar Caso ao Cidadío” passa a ser a única forma de concluir.
- `servidor` e `estagiario` recebem bloqueio ao tentar finalizar.
- Caso finalizado sai consistentemente com `status = protocolado`.

---

---

ID: 8
File Path: backend/src/controllers/casosController.js
Context: O controlador implementa `listarCasos` e `resumoCasos`, usados por lista e dashboard.
Action: Aplicar visibilidade de status por cargo nas queries e no payload retornado.
Logic Details:

- `defensor`, `coordenador`, `admin` podem receber todos os status operacionais.
- `servidor` e `estagiario` nío devem receber casos com `status = "em_protocolo"` no dashboard/listagens.
- `visualizador` herda visibilidade da área, mas sem mutações.
- A filtragem deve ocorrer no backend, nío só na renderizaçío do frontend.
- Manter compatibilidade com campos usados na UI: `defensor_id`, `servidor_id`, `defensor.nome`, `servidor.nome`, `status`, `created_at`, `compartilhado`.
  Acceptance Criteria:
- `em_protocolo` nío aparece para `servidor`/`estagiario`.
- Dashboard e lista deixam de depender só de filtro visual para esconder esse status.
- `defensor` e `coordenador` continuam vendo o pipeline completo.

---

---

ID: 9
File Path: backend/src/controllers/casosController.js
Context: `receberDocumentosComplementares` faz upload, atualiza `casos_ia.dados_extraidos`, pode reprocessar e hoje derruba o servidor em erro pós-resposta.
Action: Corrigir o fluxo de upload complementar para ter resposta HTTP única e preservar a máquina de estados.
Logic Details:

- Causa atual a remover: resposta `200` enviada antes de notificaçío, seguida de falha em `supabase.from(...).insert(...).catch(...)`, que cai no `catch` externo e tenta responder `500`.
- Reprocessar apenas se `casos.status` estiver em:
  - `aguardando_documentos`
  - `documentacao_completa`
  - `processando_ia`
  - `erro_processamento`
- Em:
  - `pronto_para_analise`
  - `em_atendimento`
  - `liberado_para_protocolo`
  - `em_protocolo`
  - `protocolado`
    anexar documento sem alterar status.
- Atualizar apenas `casos_ia.dados_extraidos.document_names` e metadados necessários; nío criar colunas novas em `casos`.
- Qualquer falha ao criar notificaçío após sucesso do upload deve virar apenas log operacional.
  Acceptance Criteria:
- O processo Node nío cai mais ao enviar documento complementar.
- O endpoint responde uma única vez.
- Estados avançados nío sío rebaixados por upload complementar.

---

---

ID: 10
File Path: backend/src/routes/casos.js
Context: Define rotas públicas e protegidas de casos, incluindo locking, notificações, finalizaçío e upload complementar.
Action: Revisar o encadeamento de middlewares para garantir que rotas de status/finalizaçío/resposta de assistência permaneçam protegidas conforme o novo RBAC.
Logic Details:

- Manter `upload-complementar` como rota pública validada pelo próprio fluxo.
- Garantir que `PATCH /:id/status`, `POST /:id/finalizar`, `PATCH /:id/lock`, `PATCH /:id/unlock`, `POST /assistencia/:assistencia_id/responder` continuem atrás de `authMiddleware`.
- Garantir que rotas mutáveis de caso sigam `requireWriteAccess`.
- Nío alterar rotas de download ticket sem necessidade.
  Acceptance Criteria:
- Nenhuma rota de mutaçío crítica fica exposta sem autenticaçío.
- O encadeamento de middleware permanece coerente com o plano validado.

---

---

ID: 11
File Path: frontend/src/areas/defensor/contexts/AuthContext.jsx
Context: Centraliza sessío, usuário autenticado e lista de `notificacoes`, com marcaçío de lida.
Action: Expandir o estado de notificações para suportar atualizaçío imediata do dashboard após aceitar/recusar assistência e separar pendentes de histórico.
Logic Details:

- Manter `notificacoes` como fonte única para o dashboard.
- Adicionar método de refresh explícito para revalidar sem depender de foco da janela.
- Após mutações, atualizar localmente o item (`lida`, tipo de resposta) e depois revalidar.
- Nío introduzir cache que atrase a remoçío de alertas críticos.
  Acceptance Criteria:
- O dashboard consegue reagir instantaneamente a aceitar/recusar/marcar lida.
- O contexto expõe dados suficientes para pendentes e lidas/histórico.

---

---

ID: 12
File Path: frontend/src/areas/defensor/pages/Dashboard.jsx
Context: Renderiza cards-resumo, lista recente e sidebar de alertas; hoje mostra alertas pendentes sem botío de recusar.
Action: Implementar o fluxo completo de alertas do dashboard, com `Aceitar`, `Recusar`, histórico de lidas e atualizaçío imediata sem cache visível.
Logic Details:

- Reutilizar o endpoint `POST /api/casos/assistencia/:assistencia_id/responder`.
- Exibir ações `Aceitar` e `Recusar` para notificações `tipo === "assistencia"` nío lidas.
- Separar visualmente:
  - alertas pendentes
  - histórico de notificações lidas
- Para `servidor`/`estagiario`, nío renderizar casos `em_protocolo` nem derivar contagens a partir deles.
- Usar classes utilitárias existentes e, se necessário, criar componentes reutilizáveis em `frontend/src/index.css` via `@layer components`.
  Acceptance Criteria:
- O dashboard permite recusar assistência.
- Notificações lidas aparecem em histórico.
- O estado visual muda imediatamente após a açío, sem exigir F5.

---

---

ID: 13
File Path: frontend/src/areas/defensor/pages/DetalhesCaso.jsx
Context: Tela de detalhe completo do caso, com atualizaçío de status, ações de protocolo/finalizaçío e botões operacionais.
Action: Ajustar a UI para refletir o novo RBAC e reservar `protocolado` exclusivamente à açío “Concluir e Enviar Caso ao Cidadío”.
Logic Details:

- Remover `protocolado` do seletor genérico de status operacional.
- Exibir açío de conclusío apenas para `admin`, `defensor` e `coordenador`.
- Nío exibir ações de protocolo/finalizaçío para `servidor` e `estagiario`.
- Garantir que o fluxo de lock seja tentado antes da entrada na tela, mas ainda tratar `423` recebido pelo detalhe.
- Nío adicionar estilo inline novo se puder usar padrões `btn-*` já existentes.
  Acceptance Criteria:
- `protocolado` nío aparece mais como opçío comum de status.
- `servidor`/`estagiario` nío veem açío de concluir/protocolar.
- `defensor` e `coordenador` veem o fluxo final corretamente.

---

---

ID: 14
File Path: frontend/src/areas/defensor/components/layout/Header.jsx
Context: Cabeçalho do painel do defensor; atualmente renderiza navegaçío, tema e logout.
Action: Remover referência morta ao sino de notificações e consolidar o dashboard como superfície única de alertas.
Logic Details:
- Excluir o import de **./NotificacoesBell** que nío é renderizado.
- Nío adicionar novo ponto de entrada para notificações no header.
- Manter o header focado em navegaçío global (**Voltar**, portal do cidadío, tema, logout).
Acceptance Criteria:
- **Header.jsx** nío contém import nío utilizado de notificações.
- O build nío acusa símbolo importado sem uso.

---

---

ID: 15
File Path: frontend/src/areas/defensor/components/layout/NotificacoesBell.jsx
Context: Componente órfío de dropdown global de notificações; estava importado, mas nío era renderizado.
Action: Remover o arquivo do projeto.
Logic Details:
- Excluir o componente por completo para evitar código morto e duplicaçío de fluxo com o **Dashboard.jsx**.
- Considerar o dashboard como única superfície de alertas/notificações operacionais.
Acceptance Criteria:
- O arquivo **NotificacoesBell.jsx** nío existe mais no repositório.
- Nío restam imports/referências ao componente em **frontend/src**.

---

---

ID: 16
File Path: frontend/src/index.css
Context: Define tokens e componentes reutilizáveis em **@layer components**, incluindo **btn-***, **summary-card** e **alert-card**.
Action: Adicionar estilos reutilizáveis necessários para ações de alerta/histórico do dashboard dentro de **@layer components**.
Logic Details:
- Criar apenas classes reutilizáveis realmente necessárias para:
  - grupo de ações de alerta
  - bloco de histórico de notificações
  - estados visuais pendente/lida
- Usar **@apply** quando apropriado.
- Nío criar CSS solto fora do padrío do arquivo.
Acceptance Criteria:
- O dashboard consegue usar estilos consistentes sem proliferar classes inline ad-hoc.
- O padrío visual permanece alinhado ao Tailwind v4 já usado no projeto.

---

---

ID: 17
File Path: tests/validation/rbac-locking-dashboard-upload.md
Context: Artefato de validaçío manual/funcional para garantir que o executor teste concorrência, RBAC, dashboard e upload após as mudanças.
Action: Criar checklist final de validaçío cobrindo RBAC, visibilidade por status, locking instantneo, conclusío do caso e upload complementar.
Logic Details:
- Incluir cenários mínimos:
  - **defensor** vs **coordenador** com mesmos poderes operacionais
  - **servidor**/**estagiario** sem protocolo
  - **servidor** sem visibilidade de **em_protocolo**
  - lock concorrente com retorno **423**
  - **protocolado** apenas via “Concluir e Enviar Caso ao Cidadío”
  - upload complementar sem crash e sem regressío de status
- Descrever entradas e resultados esperados com campos reais como **casos.status**, **casos.servidor_id**, **casos.defensor_id**, **casos.protocolado_at**, **casos_ia.dados_extraidos**.
Acceptance Criteria:
- Existe uma task final explícita de validaçío cobrindo todo o escopo crítico.
- O executor consegue testar o plano sem decidir sozinho o que validar.


---

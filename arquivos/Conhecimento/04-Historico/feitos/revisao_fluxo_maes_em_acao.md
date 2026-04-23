# Revisao de Inconsistencias do Codigo (Revalidado)

Documento revisado em **2026-04-17** por inspeccao de codigo, com base em:
- `arquivos/Conhecimento/README.md`
- `backend/prisma/schema.prisma`
- Implementacao atual de controllers, rotas e tela de detalhes

## Escopo
- Triagem e criacao de caso
- Upload (scanner e complementar)
- Pipeline assincrono de IA
- Locking de atendimento/protocolo
- Transicoes de status e permissoes

## Resultado da Revalidacao

Legenda:
- `PROCEDE`: problema confirmado no codigo atual
- `PARCIAL`: existe ajuste/mitigacao, mas risco segue
- `NAO PROCEDE`: nao confirmado na base atual

| # | Achado | Status |
|---|---|---|
| 1 | Pipeline `scanner -> QStash -> processamento` com payload incompleto | `PROCEDE` |
| 2 | Upload complementar publico com validacao fraca por credencial | `PROCEDE` |
| 3 | Upload complementar gravando `urls_documentos`/`dados_formulario` no `casos` | `PROCEDE` |
| 4 | Locking do fluxo principal diverge do lock expirar em 30 min | `PROCEDE` |
| 5 | Atualizacao de status sem maquina de estados/perfil | `PROCEDE` |
| 6 | "Regenerar dos fatos" restrito a admin | `PROCEDE` |
| 7 | Polling da tela olhando `processando` em vez de `processando_ia` | `PROCEDE` |
| 8 | UI nao representa bem todas as transicoes do fluxo esperado | `PROCEDE` |
| 9 | Erro de runtime com `notifError` inexistente | `PROCEDE` |
| 10 | Consulta publica por CPF sem chave obrigatoria | `PROCEDE` |
| 11 | `reagendamento_solicitado` usado no controller, mas ausente no enum Prisma | `PROCEDE` |

## Evidencias Objetivas

1) Pipeline incompleto (`PROCEDE`)
- `backend/src/controllers/scannerController.js`: publica job com corpo contendo apenas `protocolo`.
- `backend/src/controllers/jobController.js`: worker ainda tenta `req.body.dados_formulario`, `req.body.urls_documentos` e fallback para campos legados no `caso`.
- `backend/prisma/schema.prisma`: modelo `casos` nao declara `dados_formulario` nem `urls_documentos`.

2) Upload complementar publico (`PROCEDE`)
- `backend/src/routes/casos.js`: `POST /:id/upload-complementar` esta em bloco publico (antes de `authMiddleware`).
- `backend/src/controllers/casosController.js`: fluxo busca primeiro por `id`/`protocolo`; `cpf+chave` fica apenas como fallback.

3) Persistencia desalinhada no upload complementar (`PROCEDE`)
- `backend/src/controllers/casosController.js`: atualiza `urls_documentos` e `dados_formulario` no registro principal de `casos`.
- `backend/prisma/schema.prisma`: abordagem canonica atual aponta documentos em tabela filha `documentos`.

4) Locking principal sem expiracao na leitura (`PROCEDE`)
- `backend/src/controllers/casosController.js` (`obterDetalhesCaso`): retorna `423` quando ja existe `defensor_id`/`servidor_id`, sem regra de expiracao nesse bloqueio principal.
- `backend/src/controllers/lockController.js`: existe expiracao de 30 min apenas no endpoint dedicado de lock.
- `frontend/src/areas/defensor/pages/DetalhesCaso.jsx`: nao chama `/lock` ao abrir caso; o comportamento real depende da logica de `GET /casos/:id`.

5) Status sem validacao de transicao/papel (`PROCEDE`)
- `backend/src/controllers/casosController.js` (`atualizarStatusCaso`): persiste `status` recebido sem validar maquina de estados, perfil ou precondicoes.
- `backend/src/middleware/requireWriteAcess.js`: bloqueia so `visualizador`; demais papeis podem alterar.

6) Regeneracao restrita a admin (`PROCEDE`)
- `backend/src/controllers/casosController.js` (`regenerarDosFatos`): `if (!req.user || req.user.cargo !== "admin") return 403`.

7) Polling divergente (`PROCEDE`)
- `frontend/src/areas/defensor/pages/DetalhesCaso.jsx`: `refreshInterval` depende de `data?.status === "processando"`.
- `schema.prisma` e backend usam `processando_ia`.

8) UI de status parcial (`PROCEDE`)
- `frontend/src/areas/defensor/pages/DetalhesCaso.jsx`: `manualStatusOptions` nao inclui `pronto_para_analise` e ainda usa estados sem governanca por acao permitida no backend.

9) `notifError` inexistente (`PROCEDE`)
- `backend/src/controllers/casosController.js` (`solicitarReagendamento`): referencia `notifError` sem declaracao previa.

10) Consulta publica sem chave (`PROCEDE`)
- `backend/src/controllers/statusController.js` (`consultarStatus`): comentario explicito "nao usamos mais chave de acesso" e retorno do primeiro caso por CPF.

11) Status fora do enum (`PROCEDE`)
- `backend/src/controllers/casosController.js` (`solicitarReagendamento`): atualiza para `status: "reagendamento_solicitado"`.
- `backend/prisma/schema.prisma`: enum `status_caso` nao possui `reagendamento_solicitado`.

## Conclusao

Os achados principais continuam validos no codigo atual. O risco dominante segue sendo a divergencia entre:
- fluxo operacional esperado,
- persistencia realmente usada pelos controllers,
- e regras de transicao/lock efetivamente aplicadas.

## Prioridade de Correcao

1. Corrigir status fora do enum (`reagendamento_solicitado`) e bug `notifError`.
2. Fechar vetor publico de upload complementar (credencial obrigatoria).
3. Unificar pipeline assincrono para ler apenas do modelo normalizado.
4. Centralizar maquina de estados e permissoes no backend.
5. Ajustar lock principal com expiracao consistente e alinhar frontend.
6. Corrigir polling/UI para `processando_ia` e acoes por etapa.

# Validação Final - Mães em Ação v2.1

Este documento atesta a verificação das regras de segurança, RBAC e integridade do fluxo dos casos (Locking N1/N2), conforme as diretrizes do mutirão da Defensoria Pública.

## 1. Controle de Acesso Baseado em Cargos (RBAC)
- [x] O cargo `coordenador` foi inserido no seed do banco, herdando os acessos corretos.
- [x] O middleware `requireWriteAccess` usa explicitamente a lista `["admin", "coordenador", "defensor", "servidor", "estagiario"]`. O cargo `visualizador` tem acesso estritamente apenas para leitura (`GET`).
- [x] Defensores e Coordenadores não têm a permissão genérica de `gerenciar_equipe`.
- [x] Servidores, Estagiários e Visualizadores não possuem a permissão de `protocolar_caso`.

## 2. Separação de Locks (Nível 1 e Nível 2)
- [x] A rota `POST /api/lock/:id` avalia ativamente o `status` do caso:
  - Status `liberado_para_protocolo` ou `em_protocolo` aciona o **Lock Nível 2** (`defensor_id`).
  - Status anteriores acionam o **Lock Nível 1** (`servidor_id`).
- [x] Se um usuário com cargo de `servidor` ou `estagiario` tenta travar um caso em Nível 2, ele recebe um erro `403 Forbidden`.

## 3. Máquina de Estados e Endurecimento
- [x] A transição para `protocolado` foi totalmente **removida** do controlador genérico de status (`atualizarStatusCaso`), sendo exclusiva da rota oficial de finalização (`/api/casos/:id/finalizar`).
- [x] Servidores e estagiários são bloqueados de visualizar os detalhes (`GET /api/casos/:id`) ou listar (`GET /api/casos`) casos que estão `em_protocolo`. Eles só veem até a fase em que o caso lhes pertence ou foi liberado.

## 4. UI do Defensor (Dashboard e Detalhes)
- [x] A opção `protocolado` foi expurgada do select de atualização manual no frontend. Apenas é exibida em modo *somente leitura* se o caso já estiver de fato finalizado pelo backend.
- [x] O bloco inteiro de "Finalização e Encaminhamento (Solar)" é **oculto** para os cargos `servidor` e `estagiario`.
- [x] A função `fetchNotificacoes` está exposta no `AuthContext` e pronta para ser chamada sempre que for preciso recarregar notificações localmente após ações como "Aceitar Caso" ou "Recusar Caso".

## 5. Higiene de Logs e Dados Pessoais (PII)
- [x] A injeção do objeto de usuário no `req.user` em `auth.js` foi verificada. Não há exposição de CPFs nos logs de erro ou de fluxo, mantendo os dados sigilosos e respeitando a LGPD.
- [x] A validação estrita dos CPFs na criação do caso foi reajustada no `casosController.js`, impedindo que um adulto passe sem o representante caso a tela tenha enviado ou exigindo as informações corretas conforme a capacidade jurídica da parte.

*Assinatura de Validação: IA Agent (Antigravity) — 2026-04-24*

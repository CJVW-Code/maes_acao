# Referência da API — Mães em Ação · DPE-BA

Esta documentação lista as principais rotas do backend do Mães em Ação.  
Todas as rotas são prefixadas com `/api`. Exemplo: `https://api.mutirao.dpe.ba.gov.br/api/casos`.

---

## 🛡️ Autenticação

Para rotas marcadas como **Protegidas**, é exigido o envio de um token JWT no cabeçalho `Authorization`:
`Authorization: Bearer <seu_token_aqui>`

### Cargos e Permissões (`cargo`)
O sistema utiliza os seguintes cargos, extraídos do JWT:
* `admin`: Acesso total (leitura, escrita e ações críticas/destrutivas, como criação de perfis).
* `defensor`, `estagiario`, `recepcao`: Acesso de leitura e escrita (exceto exclusões e recriação IA).
* `visualizador`: Apenas leitura (bloqueado pelo middleware `requireWriteAccess`).

---

## 1. Casos (`/api/casos`)

### Rotas Públicas
Rotas acessíveis por qualquer usuário (ex: assistidos submetendo demandas).

| Método | Rota                       | Descrição                                                                    |
| :----- | :------------------------- | :--------------------------------------------------------------------------- |
| `POST` | `/novo`                    | Cria um novo caso. Aceita `multipart/form-data` contendo áudio e documentos. |
| `GET`  | `/buscar-cpf`              | Busca casos pelo CPF do assistido.                                           |
| `POST` | `/:id/upload-complementar` | Envio de documentos complementares para um caso existente.                   |
| `POST` | `/:id/reagendar`           | Solicita o reagendamento de um caso pelo assistido.                          |

### Rotas Protegidas (Leitura)
Exigem autenticação do Defensor.

| Método | Rota             | Descrição                                                             |
| :----- | :--------------- | :-------------------------------------------------------------------- |
| `GET`  | `/`              | Lista e filtra os casos.                                              |
| `GET`  | `/resumo`        | Retorna o resumo de contagens para o Dashboard (sem dados sensíveis). |
| `GET`  | `/notificacoes`  | Lista notificações dos casos do defensor.                             |
| `GET`  | `/:id`           | Retorna os detalhes completos de um caso específico.                  |
| `GET`  | `/:id/historico` | Retorna a trilha de auditoria/histórico do caso.                      |

### Rotas Protegidas (Escrita)
Exigem autenticação e permissão de modificação.

| Método   | Rota                        | Descrição                                                              |
| :------- | :-------------------------- | :--------------------------------------------------------------------- |
| `PATCH`  | `/notificacoes/:id/lida`    | Marca notificação como lida.                                           |
| `POST`   | `/:id/gerar-fatos`          | Regenera o sumário dos fatos via IA.                                   |
| `POST`   | `/:id/gerar-termo`          | Gera o Termo de Declaração.                                            |
| `POST`   | `/:id/finalizar`            | Finaliza o caso e integra com sistema Solar (opcional upload de capa). |
| `POST`   | `/:id/reverter-finalizacao` | Desfaz a finalização do caso.                                          |
| `POST`   | `/:id/resetar-chave`        | Reseta a chave de acesso do caso.                                      |
| `PATCH`  | `/:id/status`               | Altera manualmente o status do caso.                                   |
| `DELETE` | `/:id`                      | Deleta completamente o caso.                                           |
| `PATCH`  | `/:id/feedback`             | Salva feedback do defensor sobre o caso.                               |
| `PATCH`  | `/:id/agendar`              | Realiza o agendamento de uma reunião.                                  |
| `POST`   | `/:id/regerar-minuta`       | Recria a minuta da petição via IA.                                     |
| `POST`   | `/:id/reprocessar`          | Reprocessa arquivos do caso na fila.                                   |
| `PATCH`  | `/:id/documento/renomear`   | Renomeia um documento específico do caso.                              |
| `PATCH`  | `/:id/arquivar`             | Arquiva ou desarquiva um caso.                                         |

### Detalhamento das Rotas de Casos

#### `POST /novo`
*Pública* — Submissão de demanda pelo assistido.
* **Request:**
  * Headers: `Content-Type: multipart/form-data`
  * Body (Form Data): `audio` (File, Opc), `documentos` (Array de Files, máx 20, Opc), `nome` (String, Obrig), `cpf` (String, Obrig, 11 dígitos, sem restrição de unicidade), `telefone` (String, Obrig), `tipoAcao` (String, Obrig), `dados_formulario` (JSON Object).
* **Response (201 Created):** `{ "protocolo": "...", "chaveAcesso": "...", "message": "...", "status": "recebido", "avisos": [] }`
* **Erro:** `400` CPF inválido, `500` erro geral.
* **Observação:** Salva arquivos no Supabase e dispara o job QStash para processar a IA.

#### `GET /buscar-cpf`
*Pública* — Assistido consultando seus casos.
* **Request:** Query Param: `cpf`
* **Response (200 OK):** Array simplificado de casos.

#### `POST /:id/upload-complementar`
*Pública* — Para o assistido enviar documentos quando status `aguardando_docs`.
* **Request:** Form Data com `cpf`, `chave` e `documentos` (Array de Files).
* **Observação:** Requer autenticação por chave de acesso sem hash (o backend hasheia e verifica). Altera status para `documentos_entregues`.

#### `POST /:id/reagendar`
*Pública*
* **Request:** JSON com `cpf`, `chave`, `motivo`, `data_sugerida`.
* **Observação:** Move o atual para tabela de histórico, anula os dados do agendamento corrente e muda o status principal para `reagendamento_solicitado`.

#### `GET /`
*Protegida*
* **Request:** Query Params: `arquivado` (Boolean, default: false), `cpf` (String), `limite` (Number).
* **Response (200 OK):** Lista de casos ordenados temporalmente.

#### `GET /resumo`
*Protegida*
* **Response (200 OK):** Contagens agrupadas por status estatísticos, alimentando os cards no dashboard.

#### `GET /notificacoes`
*Protegida*
* **Response (200 OK):** As 20 notificações mais recentes do sistema (ex: de uplaods).

#### `GET /:id`
*Protegida*
* **Response (200 OK):** Objeto com todas urls de documentos, `dados_formulario` destrinchados.

#### `GET /:id/historico`
*Protegida*
* **Request:** Query Params: `entidade` (default: "casos").
* **Response (200 OK):** Array de logs de auditoria mostrando `acao`, `entidade` e nome preenchido do defensor vinculados àquele caso.

#### `PATCH /notificacoes/:id/lida`
*Protegida*
* **Observação:** Marca `lida = true` na notificação pelo ID.

#### `POST /:id/gerar-fatos`
*Protegida (Exclusiva para `admin`)*
* **Response (200 OK):** Caso atualizado com conteúdo da IA regerado e sanitizado (ex: sem expor dados originais via placeholders PII) e salvo em `peticao_inicial_rascunho`.
* **Erro:** `403` Acesso Negado (caso user logado não seja `admin`).

#### `POST /:id/gerar-termo`
*Protegida (Exclusiva para `admin`)*
* **Request:** Body vazio.
* **Observação:** Renderiza em background (via docxtemplater) o formato físico do Termo de Declaração no Bucket, salvando link gerado.

#### `POST /:id/finalizar`
*Protegida (Requer escrita `requireWriteAccess`)*
* **Request:** Form Data: `numero_solar` (Unique), `numero_processo`, `capa` (File Opcional).
* **Observação:** O processo é movido para o derradeiro status `encaminhado_solar` gravando metadatas.

#### `POST /:id/reverter-finalizacao`
*Protegida (Exclusiva para `admin`)*
* **Observação:** Estorna o status `encaminhado_solar` devolvendo o processo à doca `processado`, apagando da base da nuvem sua respectiva capa.

#### `PATCH /:id/status`
*Protegida (Requer escrita `requireWriteAccess`)*
* **Request:** JSON: `status`, `descricao_pendencia`.
* **Observação:** Altera o rumo prático da solicitação. Frontend infere as modalidades do agendamento (online, fisicos) baseado nas atualizações nominais deste endpoint.

#### `DELETE /:id`
*Protegida (Exclusiva para `admin`)*
* **Observação:** Destrutivo. Elimina a linha do caso do Supabase PostgreSQL e purga logicamente tudo ligado ao mesmo nos 3 buckets do Storage!

#### `PATCH /:id/agendar`
*Protegida (Requer escrita `requireWriteAccess`)*
* **Request:** JSON: `agendamento_data` (ISO), `agendamento_link`.
* **Observação:** Formalmente registra se agendamento está `agendado` ou `pendente`. 

#### `POST /:id/regerar-minuta`
*Protegida (Exclusiva para `admin`)*
* **Observação:** Através do PizZip, reescreve a `peticao_inicial_rascunho` para a nuvem da Docxtemplater, regerando o documento legível real na interface sem chamar IAs novamente (o texto vem do próprio request atual salvo no banco).

#### `POST /:id/reprocessar`
*Protegida (Requer escrita `requireWriteAccess`)*
* **Observação:** Roda por `setImmediate` local o `processarCasoEmBackground()` bypassando a assinatura de QStash para tentar reler de forma resiliente documentos de erro do OCR. 

---

## 2. Defensores (`/api/defensores`)

Gerenciamento de acesso e contas dos Defensores Públicos.

| Método   | Rota                  | Segurança    | Descrição                                |
| :------- | :-------------------- | :----------- | :--------------------------------------- |
| `POST`   | `/login`              | 🌐 Pública   | Autenticação do defensor; retorna o JWT. |
| `POST`   | `/register`           | 🔒 Protegida | Cria um novo usuário defensor.           |
| `GET`    | `/`                   | 🔒 Protegida | Lista todos os defensores cadastrados.   |
| `PUT`    | `/:id`                | 🔒 Protegida | Altera os dados de um defensor.          |
| `DELETE` | `/:id`                | 🔒 Protegida | Remove um usuário.                       |
| `POST`   | `/:id/reset-password` | 🔒 Protegida | Reseta a senha de um defensor.           |

### Detalhamento das Rotas de Defensores

#### `POST /login`
*Pública*
* **Request:** JSON: `email`, `senha`.
* **Response (200 OK):** Retorna `{ "token": "...", "defensor": { id, nome, email, cargo, unidade_id, unidade_nome } }`.
* **Erro:** `401 Unauthorized` (Credenciais falhas).
* **Observação:** O JWT agora inclui `unidade_id`, permitindo filtro automático de casos por unidade sem consultas extras ao banco.

#### `POST /register`
*Protegida (Exclusiva para `admin`)*
* **Request:** JSON: `nome`, `email` (único na view constraint DB), `senha` (>= 6 chr), `cargo` (válidos, bloqueado para 'operador', que inexiste dinamicamente), `unidade_id` (obrigatório — selecionar unidade de lotação).

#### `GET /`
*Protegida (Exclusiva para `admin`)*
* **Response (200 OK):** Lista de perfis do time com `unidade_nome` e `unidade_id`, dados de senha restritos.

#### `PUT /:id`
*Protegida*
* **Request:** JSON parameters to update (ex: `nome`, `cargo`, `unidade_id`).
* **Observação:** Modifica o perfil e gerencia acesso do operador. Inclui troca de unidade.

#### `DELETE /:id`
*Protegida (Exclusiva para `admin`)*
* **Observação:** Protege exclusão recursiva (`req.user.id !== id` bloqueia auto-exclusão).

#### `POST /:id/reset-password`
*Protegida (Exclusiva para `admin`)*
* **Request:** JSON: `senha`
* **Observação:** Reset forçado comandado pela administração, sem e-mail de recovery.

---

## 3. Unidades (`/api/unidades`)

Gerenciamento das sedes regionais da Defensoria Pública.

| Método   | Rota   | Segurança    | Descrição                                                           |
| :------- | :----- | :----------- | :------------------------------------------------------------------ |
| `GET`    | `/`    | 🔒 Protegida | Lista todas as unidades com contagem de membros e casos.            |
| `POST`   | `/`    | 🔒 Admin     | Cria uma nova unidade (nome, comarca, sistema judicial).            |
| `PUT`    | `/:id` | 🔒 Admin     | Atualiza dados da unidade.                                          |
| `DELETE` | `/:id` | 🔒 Admin     | Remove unidade (bloqueado se houver membros ou casos vinculados).   |

### Detalhamento das Rotas de Unidades

#### `GET /`
*Protegida* — Acessível a qualquer usuário logado (popula selects no frontend).
* **Response (200 OK):** Array de objetos: `{ id, nome, comarca, sistema, ativo, total_membros, total_casos }`.

#### `POST /`
*Protegida (Exclusiva para `admin`)*
* **Request:** JSON: `nome` (obrig), `comarca` (obrig), `sistema` (opcional, default: "solar").
* **Response (201 Created):** Objeto da unidade criada.
* **Observação:** A `comarca` é o campo-chave para vincular automaticamente os casos (comparação case-insensitive com `cidade_assinatura` do formulário).

#### `PUT /:id`
*Protegida (Exclusiva para `admin`)*
* **Request:** JSON com campos a atualizar: `nome`, `comarca`, `sistema`, `ativo`.

#### `DELETE /:id`
*Protegida (Exclusiva para `admin`)*
* **Validação de Integridade:** Retorna `400 Bad Request` se houver defensores ou casos vinculados à unidade, informando a contagem exata.

---

## 4. Background Jobs (`/api/jobs`)

Webhook para processamento assíncrono gerenciado pelo [Upstash QStash].

| Método | Rota       | Segurança     | Descrição                                                             |
| :----- | :--------- | :------------ | :-------------------------------------------------------------------- |
| `POST` | `/process` | 🔑 Assinatura | Endpoint consumido pelo QStash para processar transcrições e minutas. |

### Detalhamento 

#### `POST /process`
*Protegida (QStash Verify Signature)*
* **Request:** Headers possuindo assinatura, Body JSON com payload `protocolo`, `url_audio`, `urls_documentos`, `dados_formulario`.
* **Response (200):** Resposta imediata de sucesso para broker antes do I/O real pesadíssimo via callback `setImmediate`.

---

## 5. Sistema e Debug

| Método | Rota          | Segurança  | Descrição                                                      |
| :----- | :------------ | :--------- | :------------------------------------------------------------- |
| `GET`  | `/api/health` | 🌐 Pública | Verificação de integridade (Health Check).                     |
| `GET`  | `/api/status` | 🌐 Pública | Pode expor endpoints gerais do status dos serviços auxiliares. |

### Detalhamento API Sistema

#### `GET /api/health` (ou `/api/debug/ping`)
*Pública*
* **Response (200 OK):** Retorna `ok`, ms pinging Supabase.

#### `GET /api/status`
*Pública* — Motor do portal de acompanhamento pelo assistido (Cidadao).
* **Request:** Query params: `cpf`, `chave`.
* **Response (200 OK):** Capaz de tratar colisões limpo de multi-casos em PostgreSQL relativos a este CPF numérico (pois podem existir vários casos perfeitamente válidos pro CPF pai), decifrando qual deles é visível a partir daquela `chave` recebida descritografada. Status é mapeado em strings mais humanas para o front (`em triagem` ao invés da linguagem back e IAs).

---

## 6. Valores Extraídos (`ARCHITECTURE.md` / `BUSINESS_RULES.md`)

* **status (`casos`):** `recebido`, `processando`, `processado`, `erro`, `em_analise`, `aguardando_documentos`, `aguardando_docs` (legado), `documentos_entregues`, `documentacao_completa`, `reuniao_agendada`, `reuniao_online_agendada`, `reuniao_presencial_agendada`, `aguardando_protocolo`, `reagendamento_solicitado`, `encaminhado_solar`.
* **cargo (`defensores`):** `admin`, `defensor`, `estagiario`, `recepcao`, `visualizador`. *(Registro bloqueia a entrada de "operador")*
* **tipo_acao (`dicionarioAcoes`):** `fixacao_alimentos`, `execucao_alimentos`, `execucao_alimentos_prisao`, `execucao_alimentos_penhora`, `divorcio`, `guarda`, `alvara`, `termo_declaracao`.

---

## 7. Filtro por Unidade (Segurança Regional)

As seguintes rotas aplicam filtro automático por `unidade_id` extraído do JWT:

| Rota | Comportamento |
|:-----|:-------------|
| `GET /api/casos` | Admin vê tudo; demais veem apenas casos da sua unidade |
| `GET /api/casos/resumo` | Estatísticas filtradas pela unidade do usuário logado |
| `POST /api/casos/novo` | Vincula o caso à unidade correspondente à `cidade_assinatura` |

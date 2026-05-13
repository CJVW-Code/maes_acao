# Regras de Negocio - Maes em Acao / DPE-BA

> **Versao:** 6.0
> **Atualizado em:** 2026-05-12
> **Fonte:** controllers, middlewares, schema Prisma e configuracoes atuais

Este arquivo descreve regras implementadas no codigo atual. Conteudos historicos removidos: status legados como `encaminhado_solar`, rotas `agendar/reagendar`, autenticacao publica por chave de acesso e auto-release automatico de lock.

---

## 1. Entidades Centrais

### Caso

Tabela/modelo `casos`.

Campos operacionais mais relevantes:

- `protocolo` unico
- `unidade_id`
- `tipo_acao`
- `status`
- `servidor_id`, `servidor_at`
- `defensor_id`, `defensor_at`
- `numero_solar`
- `numero_processo`
- `url_capa_processual`
- `protocolado_at`
- `finished_at`
- `arquivado`
- `motivo_arquivamento`
- `observacao_arquivamento`
- `feedback`
- `compartilhado`
- `status_job`, `retry_count`, `erro_processamento`, `processing_started_at`, `processed_at`

### Relacoes 1:1 do Caso

- `casos_partes`: qualificacao das partes e exequentes.
- `casos_juridico`: campos juridicos normalizados.
- `casos_ia`: dados extraidos, textos e URLs de minutas.

### Relacoes 1:N / N:N

- `documentos`: anexos originais.
- `logs_auditoria`: acoes humanas.
- `logs_pipeline`: etapas tecnicas.
- `assistencia_casos`: colaboracao entre defensores.
- `notificacoes`: avisos para usuarios internos.

---

## 2. Status do Caso

Valores atuais do enum `status_caso`:

| Status | Significado operacional |
|:--|:--|
| `aguardando_documentos` | Caso criado, ainda depende de anexos/documentos |
| `documentacao_completa` | Documentos/dados recebidos; apto a processamento |
| `processando_ia` | Worker em execucao |
| `pronto_para_analise` | Caso processado e disponivel para analise |
| `em_atendimento` | Caso assumido/distribuido para atendimento juridico |
| `liberado_para_protocolo` | Atendimento finalizado e pronto para protocolo |
| `em_protocolo` | Caso atribuido para protocolo |
| `protocolado` | Caso finalizado/protocolado |
| `erro_processamento` | Falha no pipeline |

### Transicoes Permitidas

Fonte: `backend/src/utils/stateMachine.js`.

| De | Para |
|:--|:--|
| `aguardando_documentos` | `documentacao_completa`, `erro_processamento` |
| `documentacao_completa` | `processando_ia`, `pronto_para_analise`, `aguardando_documentos` |
| `processando_ia` | `pronto_para_analise`, `erro_processamento` |
| `pronto_para_analise` | `em_atendimento`, `aguardando_documentos`, `processando_ia` |
| `em_atendimento` | `liberado_para_protocolo`, `aguardando_documentos`, `pronto_para_analise` |
| `liberado_para_protocolo` | `em_protocolo`, `em_atendimento` |
| `em_protocolo` | `liberado_para_protocolo` |
| `protocolado` | `aguardando_documentos` |
| `erro_processamento` | `processando_ia`, `aguardando_documentos` |

Regras:

- `admin` tem bypass de transicao.
- Mudanca manual para `protocolado` e bloqueada. O status `protocolado` so deve ser definido por `POST /api/casos/:id/finalizar`.
- Ao mudar para `liberado_para_protocolo` ou `pronto_para_analise`, os locks `servidor_id`, `servidor_at`, `defensor_id`, `defensor_at` sao limpos.
- O alias legado `aguardando_docs` e normalizado para `aguardando_documentos` em `atualizarStatusCaso`.

---

## 3. Tipos de Acao e Templates

### Enum do Banco

`tipo_acao` no Prisma:

- `exec_penhora`
- `exec_prisao`
- `exec_cumulado`
- `def_penhora`
- `def_prisao`
- `def_cumulado`
- `fixacao_alimentos`
- `alimentos_gravidicos`

### Chaves Ativas no Formulario

Fonte: `frontend/src/config/formularios/acoes/familia.js`.

| Chave | Status no frontend | Observacao |
|:--|:--|:--|
| `fixacao_alimentos` | ativo | Exibe valores de pensao e emprego do requerido |
| `execucao_alimentos` | ativo | Exige dados do processo originario e filhos/exequentes |
| `guarda` | scaffold | Existe no config, nao aparece como ativo |
| `revisao_alimentos_majoracao` | scaffold | Scaffold |
| `revisao_alimentos_reducao` | scaffold | Scaffold |
| `uniao_estavel_reconhecimento` | scaffold | Scaffold |
| `reconhecimento_paternidade` | scaffold | Scaffold |
| `tutela` | scaffold | Scaffold |

### Dicionario Backend

Fonte: `backend/src/config/dicionarioAcoes.js`.

| Chave backend | Comportamento |
|:--|:--|
| `fixacao_alimentos` | Usa `fixacao_alimentos1.docx` e pipeline atomico de "Dos Fatos" |
| `execucao_alimentos` | Ignora OCR/Dos Fatos, gera multiplos DOCX |
| `termo_declaracao` | Usa `termo_declaracao.docx` |
| `default` | Fallback para `fixacao_alimentos1.docx` |

### Templates de Execucao

Para `execucao_alimentos`, o backend pode gerar:

- `executacao_alimentos_cumulado.docx`
- `executacao_alimentos_penhora.docx`
- `executacao_alimentos_prisao.docx`
- `cumprimento_cumulado.docx`
- `cumprimento_penhora.docx`
- `cumprimento_prisao.docx`
- `nos_autos_cumulado.docx`
- `nos_autos_penhora.docx`
- `nos_autos_prisao.docx`

---

## 4. Criacao de Caso

Endpoint: `POST /api/casos/novo`.

Regras:

- Aceita `multipart/form-data`.
- Campos de arquivos:
  - `audio`: maximo 1.
  - `documentos`: maximo 20.
- Limite por arquivo no backend: 50 MB.
- Se `enviar_documentos_depois` for true, status inicial e `aguardando_documentos`.
- Caso contrario, status inicial e `documentacao_completa`.
- O backend cria registros normalizados para caso, partes, juridico e IA.
- O protocolo e unico.
- O mesmo CPF pode ter varios casos.
- Quando possivel, o sistema reaproveita/identifica vinculos por CPF de representante para multi-casos.
- Se QStash estiver configurado (`QSTASH_TOKEN` + `API_BASE_URL` valida), publica job.
- Se QStash falhar ou nao estiver configurado, processa localmente por `setImmediate()`.

---

## 5. Uploads e Documentos

### Upload Inicial

- Pode ocorrer junto da criacao do caso.
- Arquivos sao salvos no Supabase Storage quando configurado.
- Sem Supabase, arquivos ficam em `uploads/`.

### Scanner/Balcao

Endpoint: `POST /api/scanner/upload`.

Regras:

- Exige `x-api-key`.
- Exige `protocolo`.
- Aceita ate 20 documentos.
- Cria registros na tabela `documentos`.
- Se o caso estava `aguardando_documentos`, atualiza para `documentacao_completa`.
- Nao dispara job de IA/minuta. O scanner apenas anexa documentos.

### Upload Complementar Publico

Endpoint: `POST /api/casos/:id/upload-complementar`.

Regras atuais:

- Nao usa mais chave de acesso como autenticacao.
- Localiza caso por ID, protocolo ou CPF quando necessario.
- Salva novos documentos e atualiza `dados_extraidos.document_names` quando nomes sao enviados.
- Se o status for elegivel (`aguardando_documentos`, `documentos_entregues`, `erro_processamento`, `processando_ia`), muda para `documentacao_completa` e dispara processamento local.
- Se o caso ja esta em etapa avancada, preserva o status.

### Renomear e Excluir Documento

- `PATCH /api/casos/:id/documento/renomear` altera `documentos.nome_original` e metadados em `casos_ia.dados_extraidos`.
- `DELETE /api/casos/:id/documento/:documentoId` remove o documento do banco e do Storage quando Supabase esta configurado.

---

## 6. Processamento, IA e DOCX

### Pipeline Principal

1. Caso entra em `documentacao_completa`.
2. Job QStash ou fallback local chama `processarCasoEmBackground`.
3. Status muda para `processando_ia`.
4. Dados do formulario e tabelas normalizadas sao consolidados.
5. Texto juridico e/ou payload DOCX sao gerados.
6. Arquivos DOCX sao salvos em `peticoes`.
7. `casos_ia` recebe textos, JSON de dados e URLs.
8. Status final esperado: `pronto_para_analise`.
9. Em erro: `erro_processamento`.

### OCR

- O codigo possui Gemini Vision e Tesseract.
- No fluxo principal atual, OCR esta desativado por performance/privacidade (`deveIgnorarIA = true`).
- Documentos informados/rotulados e campos do formulario sao a fonte principal.

### Geracao de Texto

- Groq e o provedor primario para texto juridico.
- OpenAI GPT-4o-mini e fallback.
- Se ambos falharem, `buildFallbackDosFatos()` gera texto templateado.
- Dados sensiveis podem ser mascarados com placeholders antes do envio para IA.

### Regeracao Manual

| Acao | Endpoint | Regra |
|:--|:--|:--|
| Regenerar "Dos Fatos" | `POST /api/casos/:id/gerar-fatos` | Admin ou responsavel pelo caso |
| Gerar termo de declaracao | `POST /api/casos/:id/gerar-termo` | Respeita lock, dono, gestor e assistencia |
| Regerar minuta DOCX | `POST /api/casos/:id/regerar-minuta` | Admin, dono, assistente aceito ou gestor sem conflito de lock |
| Substituir minuta | `POST /api/casos/:id/upload-minuta` | Cargo com escrita; valida chaves permitidas |
| Reprocessar caso | `POST /api/casos/:id/reprocessar` | Cargo com escrita; dispara `setImmediate()` |

### Edicao de Dados Preenchidos

Endpoint: `PATCH /api/casos/:id/juridico`.

Regras atuais:

- A tela interna de detalhes do caso permite revisar e editar dados preenchidos a partir do componente `InfoAssistido`.
- Antes de salvar, o frontend exibe aviso de que a minuta deve ser regerada e que edicoes manuais na minuta atual podem ser perdidas na regeneracao.
- O payload aceito pode conter `partes`, `juridico` e `dados_extraidos`.
- `partes` atualiza campos permitidos de qualificacao em `casos_partes`.
- `juridico` atualiza campos permitidos em `casos_juridico`; `vencimento_dia` e convertido para inteiro ou `null`.
- `dados_extraidos` e mesclado ao JSON atual de `casos_ia.dados_extraidos`.
- A rota bloqueia persistencia de arquivos brutos e URLs geradas em `dados_extraidos`, incluindo `audioBlob`, `documentFiles`, arquivos de calculo e chaves iniciadas por `url_`.
- Se nenhum campo editavel for enviado, retorna HTTP 400.
- Quando Supabase esta configurado, a rota tambem executa upserts diretos no Supabase antes da transacao Prisma local.

---

## 7. Permissoes e RBAC

### Cargos

| Cargo | Acesso geral |
|:--|:--|
| `admin` | Global, configuracao, BI, equipe, exclusao, bypass de status |
| `gestor` | Global para casos, configuracao, BI; sem bypass admin em todas as operacoes destrutivas |
| `coordenador` | Regional/unidade, BI, equipe conforme regional, pode destravar com restricoes |
| `defensor` | Operacional, atendimento/protocolo conforme atribuicao |
| `servidor` | Operacional de atendimento; pode encaminhar caso que atende |
| `estagiario` | Operacional de atendimento; pode encaminhar caso que atende |

### Escrita

`requireWriteAccess` permite escrita para:

```text
admin, gestor, coordenador, defensor, servidor, estagiario
```

### Isolamento de Caso

`requireSameUnit` permite acesso quando:

- usuario e `admin` ou `gestor`;
- caso pertence a mesma unidade;
- usuario e `coordenador` e caso esta na mesma regional;
- usuario e colaborador aceito em `assistencia_casos`.

---

## 8. Distribuicao e Encaminhamento

Endpoint: `POST /api/casos/:id/distribuir`.

Regras:

- O body exige `usuario_id`.
- O usuario alvo deve existir e estar ativo.
- Alvos de atendimento: `servidor`, `estagiario`, `defensor`, `coordenador`, `admin`, `gestor`.
- Alvos de protocolo: `defensor`, `coordenador`, `admin`, `gestor`.
- `admin` e `gestor` podem distribuir para qualquer unidade.
- Demais distribuidores so podem distribuir para profissional da mesma unidade do caso.
- `servidor` e `estagiario` so podem encaminhar caso que estejam atendendo (`servidor_id` igual ao usuario logado) e somente se o status for `em_atendimento`.
- Distribuicao usa update atomico por status permitido; conflito retorna `409`.
- Encaminhamento de atendente para protocolo cria notificacao para o destinatario.

Fluxos implementados:

- `pronto_para_analise` ou `em_atendimento` -> `em_atendimento` quando distribuido para atendimento.
- `em_atendimento` -> `em_protocolo` quando encaminhado para cargo apto a protocolo.
- `liberado_para_protocolo` ou `em_protocolo` -> `em_protocolo` quando distribuido para protocolo.

---

## 9. Locking

Endpoints:

- `PATCH /api/casos/:id/lock`
- `PATCH /api/casos/:id/unlock`

Regras:

- L1 usa `servidor_id` e `servidor_at`.
- L2 usa `defensor_id` e `defensor_at`.
- Status `liberado_para_protocolo` e `em_protocolo` usam L2.
- Outros status operacionais usam L1.
- `servidor` e `estagiario` nao podem assumir L2 por lock.
- Ao travar:
  - caso `pronto_para_analise` pode virar `em_atendimento`;
  - caso `liberado_para_protocolo` pode virar `em_protocolo`.
- Se outro usuario ja detem o lock, retorna `423 Locked`.
- Lock e permanente/manual no controller atual.
- Nao existe liberacao automatica depois de 30 minutos.
- A dashboard pode contar casos ociosos por timestamps antigos, mas isso nao destrava.
- `unlock` permitido para `admin`, `gestor` e `coordenador`.
- Coordenador nao destrava casos `protocolado` ou `processando_ia`.

---

## 10. Finalizacao, Reversao, Arquivamento e Exclusao

### Finalizacao/Protocolo

Endpoint: `POST /api/casos/:id/finalizar`.

Efeitos:

- `status = "protocolado"`
- grava `numero_solar`
- grava `numero_processo`
- grava `url_capa_processual` quando arquivo `capa` e enviado
- grava `protocolado_at`
- grava `finished_at`
- se usuario nao e `admin`/`gestor`, fixa produtividade no respectivo `defensor_id` ou `servidor_id`

### Reverter Finalizacao

Endpoint: `POST /api/casos/:id/reverter-finalizacao`.

Regras:

- Apenas `admin`.
- Remove capa processual do Storage/local quando houver.
- Atualiza:
  - `status = "pronto_para_analise"`
  - `numero_solar = null`
  - `numero_processo = null`
  - `url_capa_processual = null`
  - `finished_at = null`

### Arquivamento

Endpoint: `PATCH /api/casos/:id/arquivar`.

Regras:

- Campo `arquivado` e ortogonal ao `status`.
- Listagens comuns filtram nao arquivados por padrao.
- Ao arquivar, motivo/observacao devem ser informados conforme validacao do controller.
- Ao desarquivar, campos de arquivamento sao limpos.

### Exclusao Permanente

Endpoint: `DELETE /api/casos/:id`.

Regras:

- Apenas `admin`.
- Remove arquivos relacionados dos buckets quando Supabase esta configurado.
- Limpa referencias em auditoria antes da exclusao.
- Exclui caso; relacoes com cascade removem registros dependentes.

---

## 11. Downloads Seguros

Fluxo:

1. Usuario autenticado chama `POST /api/casos/:id/gerar-ticket-download`.
2. Backend valida acesso ao caso.
3. Gera JWT de 30 segundos com `purpose = "download"`, `casoId`, `bucket` e `path`.
4. Cliente usa o ticket em:
   - `GET /api/casos/:id/download-zip`
   - `GET /api/casos/:id/documento/download`

Regras:

- Ticket sem `casoId` e rejeitado.
- Ticket de outro caso e rejeitado.
- Divergencia de path ou bucket e rejeitada.
- Downloads usam Supabase Storage quando configurado ou fallback local.

---

## 12. Assistencia/Colaboracao

### Solicitar Assistencia

Endpoint: `POST /api/casos/:id/solicitar-assistencia`.

Regras:

- Cria linha em `assistencia_casos`.
- Cria notificacao para destinatario com tipo `assistencia`.
- O caso fica marcado como compartilhado somente quando assistencia e aceita.

### Responder Assistencia

Endpoint: `POST /api/casos/assistencia/:assistencia_id/responder`.

Regras:

- Atualiza `status` da assistencia para `aceito` ou `recusado`.
- Se aceito, marca `casos.compartilhado = true`.
- Cria notificacao de resposta para remetente.
- Colaborador aceito ganha acesso via `requireSameUnit`.

---

## 13. Notificacoes

Tipos atualmente gerados no codigo:

- `upload`
- `assistencia`
- `assistencia_resposta`
- `protocolo`

Regras:

- `GET /api/casos/notificacoes` retorna notificacoes recentes do usuario logado.
- `PATCH /api/casos/notificacoes/:id/lida` marca como lida.
- Upload complementar pode notificar `servidor_id` ou `defensor_id`.
- Encaminhamento de atendente para protocolo notifica destinatario.

---

## 14. Usuarios, Equipe e Hierarquia

### Login

Endpoint: `POST /api/defensores/login`.

Regras:

- Exige `email` e `senha`.
- Usuario deve estar ativo.
- Senha e comparada por bcrypt.
- JWT inclui `id`, `nome`, `email`, `cargo`, `unidade_id` e dados auxiliares.

### Cadastro e Edicao

Regras implementadas no controller:

- Managers permitidos: `admin`, `gestor`, `coordenador`.
- Apenas admin pode criar/editar admin.
- Gestor/coordenador nao podem criar ou editar usuario de cargo igual/superior.
- Coordenador deve ter regional vinculada e so opera dentro da sua regional.
- Email e unico.
- Senha minima: 6 caracteres.

### Listagens

- `admin` e `gestor` tem visao ampla.
- `coordenador` ve sua regional.
- outros cargos tem acesso restrito conforme endpoints especificos.

---

## 15. Unidades

Regras:

- `GET /api/unidades` e publico para popular selects.
- Criar, editar e deletar unidade exige `admin`.
- Unidade tem `nome`, `comarca`, `sistema`, `ativo`, `regional`.
- Exclusao e bloqueada se houver casos ou defensores vinculados.
- Unidade inativa pode ser usada como soft-lock operacional em regras de criacao/acesso quando o controller correspondente aplica a checagem.

---

## 16. BI e Configuracoes

### BI

Rotas em `/api/bi`.

Permissoes:

- Acesso BI: `admin`, `gestor`, `coordenador`.
- Exportacao em lote: `admin`, `gestor`.
- Gerenciar overrides: `admin`.

Regras:

- Relatorios sao agregados.
- Exportacao XLSX usa `exceljs`.
- O controller aplica validacoes de periodo, unidade e bloqueios de horario/overrides.

### Configuracoes

Rotas em `/api/config`.

Permissoes:

- Apenas `admin` e `gestor`.

Regras:

- `GET /` lista configuracoes.
- `PUT /` aceita atualizacao individual ou lote via objeto `configs`.
- Dados sao persistidos em `configuracoes_sistema`.

---

## 17. Consulta Publica de Status

Rotas:

- `GET /api/status?cpf=...`
- `GET /api/status/cpf/:cpf`

Regras atuais:

- Exigem CPF na query/param.
- Normalizam CPF removendo nao digitos.
- Buscam por `cpf_assistido`; a rota `/cpf/:cpf` tambem tenta protocolo.
- Retornam `id`, `protocolo`, `status`, `nome_assistido` e `nome_representante`.
- Retornam status interno, sem mapa publico de status.
- Nao exigem chave de acesso.

---

## 18. Chave de Acesso

O campo `chave_acesso_hash` ainda existe em `casos`, mas a funcionalidade esta desativada no controller atual.

Regras:

- `POST /api/casos/:id/resetar-chave` retorna HTTP 410.
- Upload complementar e consulta de status nao validam chave de acesso no codigo atual.
- Documentos antigos que mencionam autenticacao publica por chave devem ser considerados obsoletos.

---

## 19. Validacoes Tecnicas

| Item | Regra |
|:--|:--|
| Upload backend | 50 MB por arquivo |
| Upload criacao | `audio` max 1; `documentos` max 20 |
| Upload scanner | `documentos` max 20 |
| Rate limit global | 5000 / 15 min |
| Rate limit busca | 500 / 15 min |
| Rate limit criacao | 300 / 1 hora |
| JWT principal | `expiresIn: "1d"` |
| Ticket download | `expiresIn: "30s"` |
| Signed URLs | padrao 3600s |
| Senha | minimo 6 caracteres; bcrypt |
| Cargos | comparados em lowercase |

---

## 20. Principios LGPD Operacionais

- Evitar CPF, nome de partes e dados sensiveis em logs.
- Usar IDs tecnicos, protocolo, status e timestamps em auditoria.
- Downloads exigem validacao por caso e ticket curto.
- `requireSameUnit` bloqueia acesso cruzado por unidade/regional, salvo permissoes explicitas.
- URLs de Supabase Storage sao assinadas e temporarias.

# Referencia da API - Maes em Acao / DPE-BA

> **Versao:** 6.0
> **Atualizado em:** 2026-05-12
> **Fonte:** `backend/server.js` e `backend/src/routes/*.js`

Todas as rotas abaixo sao prefixadas por `/api`, exceto quando indicado.

---

## 1. Convencoes de Seguranca

### Autenticacao JWT

Rotas protegidas recebem:

```http
Authorization: Bearer <jwt>
```

O token e validado por `authMiddleware` com `JWT_SECRET` e algoritmo `HS256`.

### API Key do Scanner

Rotas de scanner recebem:

```http
x-api-key: <API_KEY_SERVIDORES>
```

### Ticket de Download

Downloads diretos usam ticket curto em query string:

```http
GET /api/casos/:id/download-zip?ticket=<ticket>
GET /api/casos/:id/documento/download?ticket=<ticket>&path=<storage_path>
```

O ticket e gerado por `POST /api/casos/:id/gerar-ticket-download`.

### Middlewares Importantes

- `globalLimiter`: 5000 requests / 15 min.
- `searchLimiter`: 500 buscas / 15 min.
- `creationLimiter`: 300 criacoes/uploads / 1 hora.
- `requireSameUnit`: protege rotas numericas de caso contra IDOR.
- `requireWriteAccess`: exige cargo na whitelist de escrita.
- `auditMiddleware`: registra operacoes protegidas.

---

## 2. Rotas Globais

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `GET` | `/api/health` | Publica | Healthcheck basico da API |
| `GET` | `/api/files/*` | Publica/local | Servidor estatico para fallback local em `uploads/` |

---

## 3. Casos - `/api/casos`

### 3.1 Rotas Publicas

| Metodo | Rota | Middlewares | Descricao |
|:--|:--|:--|:--|
| `POST` | `/novo` | `creationLimiter`, `upload.fields(audio, documentos)` | Cria novo caso |
| `GET` | `/buscar-cpf` | `searchLimiter` | Busca casos por CPF em fluxo publico/triagem |
| `POST` | `/:id/upload-complementar` | `creationLimiter`, `upload.fields(documentos)` | Anexa documentos complementares |

### 3.2 Downloads com Ticket

Estas rotas ficam antes do `authMiddleware`; o acesso depende de `validateDownloadTicket`.

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `GET` | `/:id/download-zip` | Ticket JWT `purpose=download` | Baixa documentos do caso em ZIP |
| `GET` | `/:id/documento/download` | Ticket JWT `purpose=download` | Baixa arquivo individual |

### 3.3 Rotas Protegidas de Leitura e Notificacao

A partir daqui o router aplica `authMiddleware` e `auditMiddleware`.

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `GET` | `/` | JWT | Lista casos com filtros |
| `GET` | `/resumo` | JWT | Contagens para dashboard |
| `GET` | `/notificacoes` | JWT | Lista notificacoes do usuario |
| `PATCH` | `/notificacoes/:id/lida` | JWT | Marca notificacao como lida |

### 3.4 Rotas Numericas com Isolamento de Caso

Antes destas rotas, o router aplica `requireSameUnit` para `/:id(\\d+)`.

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `GET` | `/:id/exportar-solar` | JWT + unidade/regional/assistencia | Retorna payload normalizado para SOLAR |
| `GET` | `/:id` | JWT + unidade/regional/assistencia | Detalhes completos do caso com URLs assinadas |
| `POST` | `/:id/gerar-ticket-download` | JWT + unidade/regional/assistencia | Gera ticket JWT de download por 30s |

### 3.5 Rotas Protegidas de Escrita

Antes destas rotas, o router aplica `requireWriteAccess`.

| Metodo | Rota | Descricao |
|:--|:--|:--|
| `POST` | `/:id/gerar-fatos` | Regenera "Dos Fatos"; exige admin ou responsavel pelo caso |
| `POST` | `/:id/gerar-termo` | Gera termo de declaracao DOCX; respeita lock/dono/assistencia |
| `POST` | `/:id/finalizar` | Finaliza/protocola o caso, opcionalmente com upload de capa |
| `POST` | `/:id/reverter-finalizacao` | Reverte `protocolado` para `pronto_para_analise`; apenas admin |
| `POST` | `/:id/resetar-chave` | Retorna 410; chave de acesso esta desativada |
| `DELETE` | `/:id` | Exclui caso e arquivos relacionados; apenas admin |
| `PATCH` | `/:id/status` | Atualiza status pela maquina de estados |
| `PATCH` | `/:id/feedback` | Salva feedback textual |
| `POST` | `/:id/regerar-minuta` | Regera DOCX a partir dos dados atuais |
| `POST` | `/:id/upload-minuta` | Substitui minuta por arquivo enviado manualmente |
| `POST` | `/:id/reprocessar` | Reprocessa caso localmente por `setImmediate()` |
| `PATCH` | `/:id/documento/renomear` | Renomeia documento anexado |
| `DELETE` | `/:id/documento/:documentoId` | Exclui documento anexado |
| `PATCH` | `/:id/arquivar` | Arquiva/desarquiva caso |
| `PATCH` | `/:id/juridico` | Salva edicao parcial de dados preenchidos: partes, juridico e dados extraidos |
| `POST` | `/:id/solicitar-assistencia` | Solicita colaboracao de outro defensor |
| `POST` | `/assistencia/:assistencia_id/responder` | Aceita ou recusa assistencia |
| `GET` | `/:id/historico` | Lista historico/auditoria do caso |
| `POST` | `/:id/distribuir` | Distribui/encaminha caso para usuario alvo |
| `PATCH` | `/:id/lock` | Trava caso para atendimento/protocolo |
| `PATCH` | `/:id/unlock` | Libera locks; admin, gestor ou coordenador |

### 3.6 Observacoes de Casos

- `/:id` numerico passa por `requireSameUnit`.
- `assistencia/:assistencia_id/responder` nao dispara `requireSameUnit`, pois `assistencia_id` e UUID.
- Upload complementar publico nao exige chave de acesso no codigo atual; usa ID/protocolo/CPF para localizar caso.
- `resetar-chave` esta desativado e retorna HTTP 410.
- `finalizar` define `status = "protocolado"`.
- `PATCH /:id/juridico` aceita payload parcial com chaves `partes`, `juridico` e `dados_extraidos`.
- O salvamento de dados preenchidos usa whitelist de campos para `casos_partes` e `casos_juridico`; campos fora da lista sao ignorados.
- CPFs enviados por essa rota sao persistidos sem pontuacao em `partes` e em entradas conhecidas de `dados_extraidos`.
- `dados_extraidos` deve ser objeto simples; valores invalidos nao viram merge de JSON flexivel.
- Em `dados_extraidos`, arquivos brutos e URLs geradas (`audioBlob`, `documentFiles`, `calculo_prisao_arquivo`, `calculo_penhora_arquivo`, `url_*`) nao sao persistidos por essa rota.
- A rota executa a transacao Prisma antes dos upserts espelho no Supabase, quando Supabase esta configurado.
- O controle admin de cidade de assinatura em `DetalhesCaso` usa esta rota enviando `juridico.cidade_assinatura`.

---

## 4. Defensores - `/api/defensores`

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `POST` | `/login` | Publica | Autentica usuario interno e retorna JWT |
| `POST` | `/register` | JWT | Cadastra membro, com regra hierarquica no controller |
| `GET` | `/` | JWT | Lista equipe conforme cargo/regional/unidade |
| `PUT` | `/:id` | JWT | Atualiza membro, com regra hierarquica no controller |
| `DELETE` | `/:id` | JWT | Remove/desativa membro conforme regra do controller |
| `GET` | `/colegas` | JWT | Lista colegas disponiveis para colaboracao |
| `GET` | `/encaminhamento` | JWT + `requireWriteAccess` | Lista defensores para encaminhamento |
| `POST` | `/:id/reset-password` | JWT | Reseta senha conforme regra do controller |

Notas:

- Senhas sao validadas com bcrypt.
- O controller normaliza cargos em lowercase para comparacoes.
- Coordenadores possuem restricoes por regional.
- Admin pode operar globalmente.

---

## 5. Unidades - `/api/unidades`

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `GET` | `/` | Publica | Lista unidades para selects e painel |
| `POST` | `/` | JWT + audit; controller exige admin | Cria unidade |
| `PUT` | `/:id` | JWT + audit; controller exige admin | Atualiza unidade |
| `DELETE` | `/:id` | JWT + audit; controller exige admin | Remove unidade se nao houver vinculos |

---

## 6. Scanner - `/api/scanner`

O router inteiro usa `apiKeyMiddleware`.

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `POST` | `/upload` | `x-api-key`, `upload.array(documentos, 20)` | Recebe lote de documentos por protocolo |

Comportamento:

- Exige `protocolo` no body.
- Salva no bucket/pasta `documentos`.
- Cria registros em `documentos`.
- Se o caso esta `aguardando_documentos`, muda para `documentacao_completa`.
- Nao dispara IA/minuta nesse endpoint.

---

## 7. Jobs - `/api/jobs`

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `POST` | `/process` | Assinatura Upstash QStash | Recebe job de processamento |

Detalhes:

- Usa `Receiver` da Upstash.
- Valida `upstash-signature` contra `req.rawBody`.
- Responde rapido e processa com `setImmediate()`.
- Payload esperado inclui `protocolo`, `dados_formulario`, `urls_documentos`, `url_audio`, `url_peticao`.

---

## 8. Status Publico - `/api/status`

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `GET` | `/` | Publica | Consulta casos por query `cpf` |
| `GET` | `/cpf/:cpf` | Publica | Consulta por CPF ou protocolo limpo |

Observacao:

- O controller atual retorna status interno diretamente.
- Nao ha autenticacao por chave de acesso nesse controller.

---

## 9. BI - `/api/bi`

O router aplica `authMiddleware` e depois `requireBiAccess`.

Acesso BI:

- `admin`
- `gestor`
- `coordenador`

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `POST` | `/gerar` | BI access | Gera dados agregados de relatorio |
| `POST` | `/export-xlsx` | BI access | Exporta relatorio XLSX |
| `POST` | `/export-xlsx-lote` | `admin` ou `gestor` | Exporta XLSX em lote |
| `GET` | `/overrides` | BI access | Lista overrides/registros de horario |
| `POST` | `/overrides` | `admin` | Cria override |
| `DELETE` | `/overrides/:id` | `admin` | Remove override |

---

## 10. Configuracoes - `/api/config`

O router aplica `authMiddleware` e restringe a `admin` ou `gestor`.

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `GET` | `/` | `admin` ou `gestor` | Lista configuracoes do sistema |
| `PUT` | `/` | `admin` ou `gestor` | Atualiza configuracao individual ou em lote |

---

## 11. Debug - `/api/debug`

| Metodo | Rota | Seguranca | Descricao |
|:--|:--|:--|:--|
| `GET` | `/supabase` | Publica | Testa conectividade/configuracao Supabase |

---

## 12. Codigos de Resposta Relevantes

| Codigo | Uso |
|:--|:--|
| `200` | Sucesso |
| `201` | Criacao de recurso |
| `400` | Entrada invalida |
| `401` | JWT/ticket/API key ausente ou invalido |
| `403` | Cargo sem permissao ou IDOR |
| `404` | Recurso nao encontrado |
| `409` | Conflito de status/concorrencia |
| `410` | Funcionalidade desativada (`resetar-chave`) |
| `423` | Caso bloqueado por outro usuario |
| `429` | Rate limit |
| `500` | Erro interno |

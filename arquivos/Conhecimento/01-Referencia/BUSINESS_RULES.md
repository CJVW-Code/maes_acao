# Regras de Negócio — Mães em Ação · DPE-BA

> **Versão:** 2.2 · **Atualizado em:** 2026-04-23 (Módulo BI + LGPD Enforcement + Refinamentos UX)  
> **Fonte:** Análise da codebase (controllers, services, middleware, config)  
> **Propósito:** Referência canônica para treinamento de IAs e orientação de defensores

---

## 1. Tipos de Ação (`tipo_acao`)

O campo `tipo_acao` da tabela `casos` determina qual template DOCX e qual prompt de IA serão utilizados. As chaves internas (`acaoKey`) são mapeadas no **dicionário de ações** (`dicionarioAcoes.js`).

### 1.1 Mapeamento completo

| # | `acaoKey` (chave interna) | Template DOCX | Prompt IA | Vara Competente |
|---|:--------------------------|:--------------|:----------|:----------------|
| 1 | `fixacao_alimentos` | `fixacao_alimentos1.docx` | ✅ System prompt específico (dicionário) | Vara de Família |
| 2 | `exec_penhora` | `executacao_alimentos_penhora.docx` | ❌ Usa fallback legado | Vara de Família |
| 3 | `exec_prisao` | `executacao_alimentos_prisao.docx` | ❌ Usa fallback legado | Vara de Família |
| 4 | `exec_cumulado` | `executacao_alimentos_cumulado.docx` | ❌ Usa fallback legado | Vara de Família |
| 5 | `def_penhora` | `cumprimento_penhora.docx` | ❌ Usa fallback legado | Vara de Família |
| 6 | `def_prisao` | `cumprimento_prisao.docx` | ❌ Usa fallback legado | Vara de Família |
| 7 | `def_cumulado` | `cumprimento_cumulado.docx` | ❌ Usa fallback legado | Vara de Família |
| 8 | `alimentos_gravidicos` | `alimentos_gravidicos.docx` | ❌ Usa fallback legado | Vara de Família |
| 9 | `termo_declaracao` | `termo_declaracao.docx` | ❌ (N/A — gerado separadamente) | — |
| — | `default` (fallback) | `fixacao_alimentos1.docx` | ❌ Usa fallback legado | `[VARA NÃO ESPECIFICADA]` |

> **Regra de fallback:** Se `acaoKey` está vazio ou não existe no dicionário, a config `default` é usada com log de aviso.

### 1.2 Descrição jurídica de cada tipo

| Tipo | Descrição | Quando é aplicável |
|:-----|:----------|:-------------------|
| **Fixação de Alimentos** | Ação para obrigar o genitor a pagar pensão alimentícia aos filhos. | Quando a criança/adolescente não recebe contribuição financeira regular do genitor ausente. |
| **Execução de Alimentos — Prisão** | Cumprimento de sentença que já fixou alimentos, sob pena de prisão civil. | Quando já existe uma decisão judicial fixando alimentos que não está sendo cumprida (inadimplente nos últimos 3 meses). |
| **Execução de Alimentos — Penhora** | Cumprimento de sentença com penhora de bens ou desconto em folha. | Quando já existe decisão judicial fixando alimentos e o devedor possui bens ou emprego formal para penhora. |
| **Execução Cumulada** | Execução com ambos os ritos (prisão e penhora). | Quando se busca tanto a prisão quanto a penhora de bens. |
| **Cumprimento de Sentença — Penhora** | Cumprimento de sentença definitiva com penhora. | Quando há sentença transitada em julgado. |
| **Cumprimento de Sentença — Prisão** | Cumprimento de sentença definitiva com prisão. | Quando há sentença transitada em julgado e inadimplência. |
| **Cumprimento Cumulado** | Cumprimento com ambos os ritos. | Quando se busca tanto a prisão quanto a penhora em sentença definitiva. |
| **Alimentos Gravídicos** | Alimentos durante a gestação. | Quando a genitora necessita de alimentos durante a gravidez. |
| **Termo de Declaração** | Documento que formaliza o relato do assistido perante a Defensoria. | Gerado sob demanda pelo defensor para formalizar o depoimento do assistido. Não é uma ação judicial. |

### 1.3 Determinação da `acaoKey`

A chave da ação é extraída no backend pela seguinte lógica de prioridade:

```
acaoKey = dados_formulario.acaoEspecifica
       || dados_formulario.tipoAcao.split(" - ")[1]?.trim()
       || dados_formulario.tipoAcao.trim()
       || ""
```

O campo `tipoAcao` pode vir do frontend no formato `"Família - fixacao_alimentos"`, onde a parte após o `" - "` é a chave do dicionário.

### 1.4 Mapeamento de Varas (`varasMapping.js`)

O `tipo_acao` (versão descritiva, ex: "Fixação de Pensão Alimentícia") é mapeado para a vara competente:

| Rótulo descritivo | Vara |
|:-------------------|:-----|
| Fixação de Pensão Alimentícia | Vara de Família |
| Divórcio Litigioso / Consensual | Vara de Família |
| Reconhecimento e Dissolução de União Estável | Vara de Família |
| Dissolução Litigiosa de União Estável | Vara de Família |
| Guarda de Filhos | Vara de Família |
| Execução de Alimentos Rito Penhora/Prisão | Vara de Família |
| Revisão de Alimentos (Majoração/Redução) | Vara de Família |
| Alimentos Gravídicos | Vara de Família |
| Reconhecimento de União Estável Post Mortem | Vara de Sucessões |
| Alvará | Vara de Sucessões |

> Se o tipo não for encontrado no mapeamento, retorna `"[VARA NÃO ESPECIFICADA]"`.

---

## 2. Estrutura do `dados_formulario` (JSONB)

O campo `dados_formulario` na tabela `casos` armazena todos os dados coletados no formulário multi-step do cidadão. É um objeto JSONB com chaves variáveis conforme o tipo de ação.

### 2.1 Campos universais (presentes em todos os tipos)

| Chave | Tipo | Obrigatório | Descrição |
|:------|:-----|:------------|:----------|
| `nome` | `string` | ✅ | Nome completo do assistido |
| `cpf` | `string` | ✅ | CPF do assistido (validado algoritmicamente) |
| `telefone` | `string` | ✅ | Telefone de contato |
| `whatsapp_contato` | `string` | ❌ | WhatsApp do assistido |
| `tipoAcao` | `string` | ✅ | Tipo de ação selecionado (ex: `"Família - fixacao_alimentos"`) |
| `acaoEspecifica` | `string` | ❌ | Chave limpa do dicionário (ex: `"fixacao_alimentos"`) |
| `relato` | `string` | ❌ | Relato textual do assistido |
| `documentos_informados` | `string (JSON)` | ❌ | Array serializado de nomes de documentos |
| `document_names` | `object` | ❌ | Mapa `{ nomeArquivo: rotuloAmigavel }` (gerado/atualizado pelo backend) |

### 2.2 Campos do assistido (requerente/autor)

| Chave | Tipo | Obrigatório | Descrição |
|:------|:-----|:------------|:----------|
| `assistido_eh_incapaz` | `"sim" \| "nao"` | ❌ | Se o assistido é incapaz (criança/adolescente representado) |
| `assistido_data_nascimento` | `string (YYYY-MM-DD)` | ❌ | Data de nascimento do assistido |
| `assistido_nacionalidade` | `string` | ❌ | Nacionalidade |
| `assistido_estado_civil` | `string` | ❌ | Estado civil |
| `assistido_ocupacao` | `string` | ❌ | Profissão/ocupação |
| `assistido_rg_numero` | `string` | ❌ | Número do RG |
| `assistido_rg_orgao` | `string` | ❌ | Órgão emissor do RG |
| `endereco_assistido` | `string` | ❌ | Endereço completo |
| `email_assistido` | `string` | ❌ | E-mail de contato |
| `dados_adicionais_requerente` | `string` | ❌ | Informações complementares sobre o requerente |
| `situacao_financeira_genitora` | `string` | ❌ | Descrição da situação financeira da genitora |

### 2.3 Campos do representante legal

Preenchidos quando `assistido_eh_incapaz === "sim"` (a mãe/pai representando o(s) filho(s)).

| Chave | Tipo | Obrigatório (quando incapaz) | Descrição |
|:------|:-----|:-----------------------------|:----------|
| `representante_nome` | `string` | ✅ | Nome do representante legal |
| `representante_nacionalidade` | `string` | ❌ | Nacionalidade |
| `representante_estado_civil` | `string` | ❌ | Estado civil |
| `representante_ocupacao` | `string` | ❌ | Profissão |
| `representante_cpf` | `string` | ❌ | CPF do representante |
| `representante_rg_numero` | `string` | ❌ | RG número |
| `representante_rg_orgao` | `string` | ❌ | RG órgão emissor |
| `representante_endereco_residencial` | `string` | ❌ | Endereço residencial |
| `representante_endereco_profissional` | `string` | ❌ | Endereço profissional |
| `representante_email` | `string` | ❌ | E-mail |
| `representante_telefone` | `string` | ❌ | Telefone |

### 2.4 Campos da parte contrária (requerido/executado)

| Chave | Tipo | Obrigatório | Descrição |
|:------|:-----|:------------|:----------|
| `nome_requerido` | `string` | ❌ | Nome do requerido |
| `cpf_requerido` | `string` | ❌ | CPF do requerido (validado, mas gera apenas **aviso** — não bloqueia) |
| `endereco_requerido` | `string` | ❌ | Endereço residencial |
| `dados_adicionais_requerido` | `string` | ❌ | Informações adicionais |
| `requerido_nacionalidade` | `string` | ❌ | Nacionalidade |
| `requerido_estado_civil` | `string` | ❌ | Estado civil |
| `requerido_ocupacao` | `string` | ❌ | Profissão |
| `requerido_endereco_profissional` | `string` | ❌ | Endereço profissional |
| `requerido_email` | `string` | ❌ | E-mail |
| `requerido_telefone` | `string` | ❌ | Telefone |
| `requerido_tem_emprego_formal` | `string` | ❌ | Se possui emprego formal |
| `empregador_requerido_nome` | `string` | ❌ | Nome do empregador |
| `empregador_requerido_endereco` | `string` | ❌ | Endereço do empregador |
| `empregador_email` | `string` | ❌ | E-mail do empregador |

### 2.5 Campos específicos por tipo de ação

#### Fixação/Revisão de Alimentos

| Chave | Tipo | Descrição |
|:------|:-----|:----------|
| `valor_mensal_pensao` | `string \| number` | Valor mensal pretendido |
| `dia_pagamento_requerido` | `string` | Dia do mês para pagamento |
| `dados_bancarios_deposito` | `string` | Dados bancários para depósito |
| `filhos_info` | `string` | Informações sobre filhos |
| `descricao_guarda` | `string` | Descrição da situação de guarda |
| `outros_filhos_detalhes` | `string (JSON)` | Array serializado com `{ nome, cpf, dataNascimento, rgNumero, rgOrgao, nacionalidade }` |

#### Execução de Alimentos

| Chave | Tipo | Descrição |
|:------|:-----|:----------|
| `numero_processo_originario` | `string` | Número do processo que fixou os alimentos |
| `vara_originaria` | `string` | Vara do processo original |
| `percentual_ou_valor_fixado` | `string` | Percentual ou valor fixado na decisão |
| `dia_pagamento_fixado` | `string` | Dia de pagamento conforme decisão |
| `periodo_debito_execucao` | `string` | Período de inadimplência |
| `valor_total_debito_execucao` | `string \| number` | Valor total do débito |
| `valor_total_extenso` | `string` | Valor por extenso |
| `valor_debito_extenso` | `string` | Valor do débito por extenso |
| `processo_titulo_numero` | `string` | Número do título executivo |
| `percentual_definitivo_salario_min` | `string` | Percentual do salário mínimo |
| `percentual_definitivo_extras` | `string` | Percentual para despesas extras |

#### Divórcio

| Chave | Tipo | Descrição |
|:------|:-----|:----------|
| `data_inicio_relacao` | `string (YYYY-MM-DD)` | Data de início do relacionamento |
| `data_separacao` | `string (YYYY-MM-DD)` | Data da separação de fato |
| `bens_partilha` | `string` | Descrição dos bens a partilhar |
| `regime_bens` | `string` | Regime de bens do casamento |
| `retorno_nome_solteira` | `string` | Se deseja retornar ao nome de solteira |
| `alimentos_para_ex_conjuge` | `string` | Se solicita alimentos para ex-cônjuge |

#### Guarda

| Chave | Tipo | Descrição |
|:------|:-----|:----------|
| `descricao_guarda` | `string` | Situação atual da guarda |
| `filhos_info` | `string` | Informações sobre os filhos |

#### Campos calculados pelo backend (inseridos no processamento)

| Chave | Origem | Descrição |
|:------|:-------|:----------|
| `percentual_salario_minimo` | `calcularPercentualSalarioMinimo()` | `(valor_mensal_pensao / SALARIO_MINIMO_ATUAL) * 100` |
| `salario_minimo_formatado` | env `SALARIO_MINIMO_ATUAL` (padrão: R$ 1.621,00) | Valor do salário mínimo vigente formatado |
| `valor_causa` | `calcularValorCausa()` | `valor_mensal_pensao × 12` (anualizado) |

### 2.6 Estrutura de `outros_filhos_detalhes`

Quando há mais de um filho na ação, este campo contém um array JSON serializado:

```json
[
  {
    "nome": "Maria Silva Santos",
    "cpf": "12345678901",
    "dataNascimento": "2015-03-20",
    "rgNumero": "1234567",
    "rgOrgao": "SSP/BA",
    "nacionalidade": "brasileiro(a)"
  }
]
```

O primeiro filho é sempre extraído dos campos raiz (`nome`, `cpf`, `assistido_data_nascimento`). Os demais vêm deste array.

---

## 3. Regras de Validação

### 3.1 Normalização e Busca de CPF

Para garantir que a busca seja resiliente a diferentes formatos de entrada, o sistema aplica as seguintes regras:

| Regra | Descrição |
|:------|:----------|
| **Normalização** | CPFs informados na busca são limpos (removendo `.` e `-`) antes da consulta. |
| **Busca Resiliente** | O backend consulta simultaneamente o CPF "sujo" (como digitado) e o CPF "limpo" na tabela `casos_partes`. |
| **Escopo de Busca** | A busca verifica os campos `cpf_assistido` e `representante_cpf` para garantir que o caso seja encontrado independente de quem iniciou o processo. |
| **Validação** | CPF do assistido é **obrigatório e validado** algoritmicamente (Bloqueante). |

### 3.2 Unicidade de CPF e Arquitetura Multi-Casos

| Regra | Comportamento |
|:------|:-------------|
| **Não há unicidade de CPF na tabela `casos`** | Um mesmo CPF pode ter múltiplos casos vinculados. |
| **Múltiplos Assistidos por Representante** | Uma representante (mãe) pode criar múltiplos casos distintos para filhos diferentes com requeridos diferentes, reusando seus próprios dados, mas gerando protocolos independentes. |
| O campo `protocolo` é UNIQUE | Cada caso/filho possui um protocolo único e tracking separado. |
| O campo `email` na tabela `defensores` é UNIQUE | Não é possível cadastrar dois defensores com o mesmo e-mail. |
| O campo `numero_solar` possui constraint UNIQUE | Retorna `409` se tentar vincular um número Solar já usado. |



### 3.3 Validação de arquivos

| Regra | Valor |
|:------|:------|
| Tamanho máximo por arquivo | 50 MB |
| Formatos processados por OCR | `.jpg`, `.jpeg`, `.png`, `.pdf` |
| Quantidade máxima de documentos por upload | 20 |
| Quantidade máxima de áudios | 1 |

### 3.4 Validação de senha (defensores)

| Regra | Valor |
|:------|:------|
| Tamanho mínimo da senha | 6 caracteres |
| Algoritmo de hash | bcrypt (10 salt rounds) |

### 3.5 Validação de arquivamento

| Regra | Comportamento |
|:------|:-------------|
| Motivo é obrigatório ao arquivar | Mínimo 5 caracteres; retorna `400` se ausente |
| Ao restaurar (desarquivar) | Motivo é limpo (`null`) |

### 3.6 Validação do Formulário de Triagem

| Campo | Regra | Comportamento |
|:------|:------|:--------------|
| `relato` | Obrigatório (não vazio) | Bloqueia envio se vazio — **não** há mínimo de caracteres |
| `valor_debito` | Obrigatório quando `exigeDadosProcessoOriginal = true` | Bloqueia envio para execuções sem o valor do débito |
| `calculo_arquivo` | Obrigatório quando `exigeDadosProcessoOriginal = true` e "Enviar depois" = false | Bloqueia envio de execuções sem o demonstrativo de cálculo anexado |

### 3.6 Campos que o assistido preenche vs. apenas o defensor

| Quem preenche | Campos |
|:--------------|:-------|
| **Assistido** (via formulário público) | `nome`, `cpf`, `telefone`, `whatsapp_contato`, `tipoAcao`, `relato`, `documentos_informados`, todos os campos de `dados_formulario`, documentos e áudio |
| **Assistido** (pós-submissão) | Upload de documentos complementares, solicitação de reagendamento |
| **Defensor** (via painel protegido) | `status`, `descricao_pendencia`, `numero_solar`, `numero_processo`, `agendamento_data`, `agendamento_link`, `feedback`, `arquivado`, `motivo_arquivamento` |
| **Sistema** (automático) | `protocolo`, `chave_acesso_hash`, `resumo_ia`, `peticao_inicial_rascunho`, `peticao_completa_texto`, `url_documento_gerado`, `status` (durante processamento), `processed_at`, `processing_started_at` |

---

## 4. Fluxo de Geração de Documentos

### 4.1 Pipeline de processamento em background

```
criarNovoCaso() → QStash.publishJSON() → jobController.processJob()
                                              ↓
                                    processarCasoEmBackground()
                                              ↓
                               ┌──────────────┼──────────────┐
                               ↓              ↓              ↓
                            [OCR]         [Resumo IA]    [Dos Fatos IA]
                               ↓              ↓              ↓
                          textoCompleto    resumo_ia     dosFatosTexto
                                              ↓
                                    buildDocxTemplatePayload()
                                              ↓
                                    ┌─────────┼──────────┐
                                    ↓                    ↓
                              generateDocx()    gerarTextoCompletoPeticao()
                                    ↓                    ↓
                            url_documento_gerado   peticao_completa_texto
```

### 4.2 Quando uma petição pode ser gerada

| Condição | Geração automática | Geração manual |
|:---------|:-------------------|:---------------|
| **Criação do caso** | ✅ Gerada automaticamente via processamento background | — |
| **Regerar minuta** | — | ✅ Admin pode regerar via `POST /:id/regerar-minuta` |
| **Substituir minuta** | — | ✅ Servidor pode fazer upload manual via `POST /:id/upload-minuta` |
| **Regenerar Dos Fatos** | — | ✅ Admin pode regerar via `POST /:id/gerar-fatos` |
| **Reprocessar caso** | ✅ Re-executa todo o pipeline | — |

*Nota Especial - Execução de Alimentos (v2.0):* 
O sistema agora suporta a geração e visualização simultânea de múltiplos documentos para o mesmo protocolo:
1. **Ritos Combinados:** Se a ação registrar débito superior a 3 meses, o pipeline gera automaticamente uma peça de **Prisão** e outra de **Penhora**.
2. **Termo de Declaração:** Pode ser gerado e armazenado de forma independente das peças processuais.
3. **Download Dinâmico:** O frontend exibe abas para cada documento disponível no Storage.

### 4.3 O que a IA recebe como input

#### Para o Resumo Executivo (`analyzeCase`)

- **Input:** `textoCompleto` = relato do assistido + textos extraídos via OCR de todos os documentos
- **Temperatura:** 0.3
- **Output:** Resumo com: Problema Central, Partes Envolvidas, Pedido Principal, Urgência, Área do Direito
- **Destino:** Campo `resumo_ia` do caso

#### Para a seção "Dos Fatos" (`generateDosFatos`)

- **Input:** Dados normalizados do caso (nomes, CPFs, relato, situação financeira, filhos, documentos)
- **Sanitização PII:** Antes do envio, dados sensíveis são substituídos por placeholders (`[NOME_AUTOR_1]`, `[CPF_REU]`)
- **Temperatura:** 0.3
- **Output:** Texto jurídico no estilo da Defensoria Pública da Bahia
- **Destino:** Campo `peticao_inicial_rascunho` (prefixado com `"DOS FATOS\n\n"`)

#### Prompts de IA — Regras estilísticas obrigatórias

| Regra | Detalhes |
|:------|:---------|
| **Nunca usar "menor"** | Deve usar "criança", "adolescente" ou "filho(a)" |
| **Não citar documentos no texto** | CPF, RG e datas de nascimento não devem aparecer no texto narrativo |
| **Conectivos obrigatórios** | "Insta salientar", "Ocorre que, no caso em tela", "Como é sabido", "aduzir" |
| **Formato** | Parágrafos coesos, sem tópicos/listas |
| **Estilo** | Extremamente formal, culto e padronizado (juridiquês clássico) |

### 4.4 Diferença entre os campos de petição

| Campo | Conteúdo | Quando é preenchido |
|:------|:---------|:--------------------|
| `peticao_inicial_rascunho` | Texto da seção "Dos Fatos" gerado pela IA (prefixado com `"DOS FATOS\n\n"`) | Processamento background |
| `peticao_completa_texto` | Texto completo da petição (cabeçalho + qualificação + dos fatos + pedidos + assinatura) em texto puro | Processamento background |
| `url_documento_gerado` | Caminho no Storage do `.docx` da petição inicial renderizada via Docxtemplater | Processamento background |
| `url_termo_declaracao` | Caminho no Storage do `.docx` do Termo de Declaração | Gerado sob demanda (admin) |

### 4.5 Geração do Termo de Declaração

- **Quem pode gerar:** Apenas `admin`
- **Endpoint:** `POST /:id/gerar-termo`
- **Dados utilizados:** `dados_formulario` do caso + dados do caso (`nome_assistido`, `cpf_assistido`, `relato_texto`, `protocolo`, `tipo_acao`)
- **Template:** `termo_declaracao.docx`
- **Comportamento:** Remove o arquivo anterior do Storage antes de gerar um novo (geração limpa)
- **Destino:** `url_termo_declaracao` no caso

### 4.6 Fallbacks de geração

| Componente | Fallback |
|:-----------|:---------|
| OCR (Gemini Vision) | Tesseract.js (apenas para imagens, não PDFs) |
| Geração de texto (Groq) | Gemini 2.5 Flash |
| Dos Fatos (IA) | `buildFallbackDosFatos()` — texto templateado sem IA |
| QStash (fila) | `setImmediate()` — processamento local |

---

## 5. Regras de Permissão

### 5.1 Cargos do sistema

O campo `cargo` na tabela `defensores` define o nível de acesso. O cargo é incluído no token JWT no login.

| Cargo | Acesso de Leitura | Acesso de Escrita | Operações Admin |
|:------|:-------------------|:-------------------|:----------------|
| `admin` | ✅ | ✅ | ✅ |
| `defensor` | ✅ | ✅ | ❌ |
| `estagiario` | ✅ | ✅ | ❌ |
| `recepcao` | ✅ | ✅ | ❌ |
| `visualizador` | ✅ | ❌ | ❌ |

> O cargo padrão ao cadastrar um novo membro é `"estagiario"`. Apenas o admin pode criar cadastros e deve selecionar entre as opções disponíveis no formulário.



### 5.2 Middleware de controle

| Middleware | Função | Aplicação |
|:-----------|:-------|:----------|
| `authMiddleware` | Verifica JWT e injeta `req.user` | Todas as rotas protegidas (após rotas públicas) |
| `requireWriteAccess` | Bloqueia cargo `visualizador` de operações de escrita (403) | Todas as rotas de escrita (POST, PATCH, DELETE protegidas) |
| `auditMiddleware` | Registra operações de escrita na tabela `logs_auditoria` | Todas as rotas protegidas |

### 5.3 Operações exclusivas de Admin

As seguintes operações verificam **explicitamente** `req.user.cargo === "admin"` no controller:

| Operação | Endpoint | Justificativa |
|:---------|:---------|:-------------|
| Regenerar Dos Fatos | `POST /:id/gerar-fatos` | Consome créditos de IA |
| Gerar Termo de Declaração | `POST /:id/gerar-termo` | Documento formal |
| Regerar Minuta DOCX | `POST /:id/regerar-minuta` | Consome créditos de IA |
| Reverter Finalização | `POST /:id/reverter-finalizacao` | Ação destrutiva (remove dados Solar) |
| Deletar Caso | `DELETE /:id` | Ação irreversível (exclui do banco e Storage) |
| Registrar novo membro | `POST /api/defensores/cadastro` | Gestão de equipe |
| Listar equipe | `GET /api/defensores` | Dados sensíveis da equipe |
| Atualizar membro | `PATCH /api/defensores/:id` | Gestão de equipe |
| Deletar membro | `DELETE /api/defensores/:id` | Gestão de equipe (não pode deletar a si mesmo) |
| Resetar senha de membro | `POST /api/defensores/:id/resetar-senha` | Segurança |

### 5.4 Acesso público (sem autenticação)

O assistido (cidadão) pode realizar as seguintes ações **sem login**:

| Ação | Endpoint | Autenticação |
|:-----|:---------|:-------------|
| Submeter novo caso | `POST /api/casos/novo` | Nenhuma |
| Buscar casos por CPF | `GET /api/casos/buscar-cpf` | Nenhuma |
| Upload de documentos complementares | `POST /api/casos/:id/upload-complementar` | CPF + chave de acesso (no body) |
| Solicitar reagendamento | `POST /api/casos/:id/reagendar` | CPF + chave de acesso (no body) |
| Consultar status | `GET /api/status` | CPF + chave de acesso (na query) |

> **Segurança do assistido:** A chave de acesso é hasheada com SHA-256 + salt aleatório antes de ser armazenada no banco. A verificação é feita recomputando o hash.

### 5.5 Mapeamento de status públicos

O assistido não vê os status internos do sistema. O `statusController` converte:

| Status Interno | Status Público (para o cidadão) |
|:---------------|:-------------------------------|
| `recebido` | `enviado` |
| `processando` | `em triagem` |
| `processado` | `em triagem` |
| `em_analise` | `em triagem` |
| `aguardando_docs` | `documentos pendente` |
| `documentos_entregues` | `documentos entregues` |
| `reuniao_agendada` | `reuniao agendada` |
| `reuniao_online_agendada` | `reuniao online` |
| `reuniao_presencial_agendada` | `reuniao presencial` |
| `aguardando_protocolo` | `Aguardando protocolo` |
| `reagendamento_solicitado` | `em analise` |
| `encaminhado_solar` | `encaminhamento solar` |
| `erro` | `enviado` |

---

## 6. Regras de Agendamento

### 6.1 Quem pode agendar

| Ação | Quem realiza |
|:-----|:-------------|
| **Agendar reunião** | Defensor (qualquer cargo com escrita) via `PATCH /:id/agendar` |
| **Solicitar reagendamento** | Assistido (cidadão) via `POST /:id/reagendar` |

### 6.2 Tipos de agendamento

Os tipos são inferidos pelo status do caso ao qual o agendamento está vinculado:

| Status | Tipo implícito |
|:-------|:---------------|
| `reuniao_agendada` | Genérico |
| `reuniao_online_agendada` | Online (link de videoconferência) |
| `reuniao_presencial_agendada` | Presencial (endereço físico) |

> O tipo é definido pelo defensor ao mudar o status via `PATCH /:id/status`.

### 6.3 Status do agendamento (`agendamento_status`)

| Valor | Quando é definido |
|:------|:------------------|
| `agendado` | Quando `agendamento_data` **E** `agendamento_link` estão preenchidos |
| `pendente` | Quando os campos estão vazios |

### 6.4 Fluxo de reagendamento

```
1. Assistido chama POST /:id/reagendar com { motivo, data_sugerida, cpf, chave }
2. Backend valida CPF (match exato) e chave de acesso (hash)
3. Se houver agendamento anterior:
   → Salva no historico_agendamentos com status "reagendado"
   → Tipo inferido: "presencial" se status contém "presencial", senão "online"
4. Atualiza o caso:
   → status = "reagendamento_solicitado"
   → motivo_reagendamento = motivo
   → data_sugerida_reagendamento = data_sugerida
   → agendamento_data = null (libera a agenda)
   → agendamento_link = null
5. Cria notificação para o defensor (tipo: "reagendamento")
```

### 6.5 O que fica registrado em `historico_agendamentos`

| Campo | Origem |
|:------|:-------|
| `caso_id` | ID do caso |
| `data_agendamento` | Data/hora do agendamento anterior |
| `link_ou_local` | Link da chamada ou endereço do agendamento anterior |
| `tipo` | `"online"` ou `"presencial"` (inferido do status) |
| `status` | Sempre `"reagendado"` |
| `created_at` | Timestamp automático |

---

## 7. Regras de Arquivamento e Finalização

### 7.1 Finalização (Encaminhamento ao Solar)

| Aspecto | Detalhe |
|:--------|:-------|
| **Endpoint** | `POST /:id/finalizar` |
| **Quem pode** | Qualquer cargo com acesso de escrita (protected + requireWriteAccess) |
| **Dados recebidos** | `numero_solar`, `numero_processo`, arquivo `capa` (capa processual) |
| **Efeitos no banco** | `status = "encaminhado_solar"`, `numero_solar`, `numero_processo`, `url_capa_processual`, `finished_at = now()` |
| **Upload da capa** | Salva em `documentos/capas/{id}_{timestamp}_{nomeOriginal}` |

### 7.2 Reversão da Finalização

| Aspecto | Detalhe |
|:--------|:-------|
| **Endpoint** | `POST /:id/reverter-finalizacao` |
| **Quem pode** | Apenas `admin` |
| **Efeitos no banco** | `status = "processado"`, `numero_solar = null`, `numero_processo = null`, `url_capa_processual = null`, `finished_at = null` |
| **Efeitos no Storage** | Exclui o arquivo da capa processual do bucket `documentos` |

### 7.3 Arquivamento (Soft Delete)

| Aspecto | Detalhe |
|:--------|:-------|
| **Endpoint** | `PATCH /:id/arquivar` |
| **Quem pode** | Qualquer cargo com acesso de escrita |
| **Campo no banco** | `arquivado` (boolean) — ortogonal ao `status` |
| **Motivo obrigatório** | Mínimo 5 caracteres ao arquivar; limpo ao restaurar |
| **Efeito na listagem** | `listarCasos` filtra por `arquivado = false` por padrão |
| **Reversível** | ✅ Basta chamar com `{ arquivado: false }` |

### 7.4 Exclusão permanente

| Aspecto | Detalhe |
|:--------|:-------|
| **Endpoint** | `DELETE /:id` |
| **Quem pode** | Apenas `admin` |
| **Efeitos** | Exclui o registro da tabela `casos` **e** todos os arquivos vinculados nos 3 buckets (áudio, documentos, petições) |
| **Irreversível** | ✅ Não há recuperação após exclusão |

### 7.5 Reprocessamento

| Aspecto | Detalhe |
|:--------|:-------|
| **Endpoint** | `POST /:id/reprocessar` |
| **Quem pode** | Qualquer cargo com acesso de escrita |
| **Quando usar** | Quando o caso está em `status = "erro"` |
| **Comportamento** | Re-executa `processarCasoEmBackground()` com os dados originais do banco, via `setImmediate` (sem passar pelo QStash) |

---

## 8. Notificações

### 8.1 Tipos de notificação

| Tipo | Quando é gerada | Mensagem |
|:-----|:-----------------|:---------|
| `upload` | Assistido envia documentos complementares | `"Novos documentos entregues por {nome}."` |
| `reagendamento` | Assistido solicita reagendamento | `"Solicitação de reagendamento para o caso {nome}."` |

### 8.2 Regras

- Notificações são armazenadas na tabela `notificacoes` com `lida = false`
- A listagem retorna as 20 mais recentes, ordenadas por `created_at DESC`
- Qualquer usuário autenticado com acesso de escrita pode marcar como lida

---

## 9. Geração do Protocolo e Chave de Acesso

### 9.1 Formato do Protocolo

```
{AAAA}{MM}{DD}{ID_CATEGORIA}{SEQUENCIAL_6_DIGITOS}
```

| Componente | Exemplo | Origem |
|:-----------|:--------|:-------|
| Data | `20260326` | `new Date()` |
| ID Categoria | `0` | Mapa: `familia=0, consumidor=1, saude=2, criminal=3, outro=4` |
| Sequencial | `345678` | Últimos 6 dígitos de `Date.now()` |

> **Observação:** O ID da categoria é determinado pelo parâmetro `casoTipo` recebido pela função, que recebe o `tipoAcao`. A maioria das ações mapeará para `"outro"` (4), já que o mapa usa chaves genéricas (`familia`, `consumidor`, etc.) e não as chaves específicas do dicionário. `[INFERIDO]`

<!-- VALIDAR COM DEFENSOR: O campo casoTipo que alimenta o mapa de categorias (familia=0, consumidor=1...) recebe o tipoAcao do formulário. Porém, o tipoAcao tem valor como "Família - fixacao_alimentos", e não as chaves do mapa (familia, consumidor...). Isso faz com que a maioria dos protocolos caia na categoria 4 (outro). É intencional? -->

### 9.2 Formato da Chave de Acesso

```
DPB-{5_DIGITOS}-0{5_DIGITOS}
Exemplo: DPB-01234-012345
```

- Gerada com `crypto.randomBytes(3)`
- Hasheada com SHA-256 + salt aleatório de 16 bytes antes do armazenamento
- O hash é armazenado no formato `{salt}:{hash}` no campo `chave_acesso_hash`

---

## 11. Session Locking e Concorrência

Para evitar que dois usuários editem o mesmo caso simultaneamente, o sistema utiliza um mecanismo de **Session Locking** no banco de dados.

### 11.1 Níveis de Bloqueio
- **Nível 1 (Servidor):** Ativado quando um servidor acessa o caso para análise jurídica. Bloqueia outros servidores.
- **Nível 2 (Defensor):** Ativado quando um defensor inicia a etapa de protocolo no Solar/Sigad. Bloqueia outros defensores.

### 11.2 Comportamento da API
- **Bloqueio Automático:** Ao abrir o detalhe do caso, o backend tenta realizar o lock (`UPDATE WHERE owner_id IS NULL`).
- **Bloqueio Manual:** Endpoints `PATCH /lock` e `PATCH /unlock` permitem controle explícito.
- **Conflito (HTTP 423):** Se o caso já estiver bloqueado por outro usuário (id diferente), a API retorna `423 Locked` com o nome do atual responsável.

### 11.3 Liberação
- O lock é liberado automaticamente após 30 minutos de inatividade ou manualmente pelo botão **Liberar Caso**.
- **Administradores** possuem bypass e podem forçar o destravamento de qualquer sessão.

---

## 12. Inteligência de Dados (Módulo BI)

O módulo de BI é restrito exclusivamente a administradores e foca em métricas de produtividade e throughput sem comprometer dados sensíveis.

### 12.1 Princípios de LGPD no BI
- **Zero PII (Personally Identifiable Information):** As queries de BI nunca acessam as tabelas `casos_partes` ou campos de qualificação.
- **Agregação Obrigatória:** Dados são exibidos apenas em formatos agregados (contagens, médias, percentuais).
- **Exportação Segura:** O arquivo XLSX gerado para download segue as mesmas restrições de vedação de dados pessoais.

### 12.2 Métricas Monitoradas
- **Throughput de Triagem:** Casos criados por dia/sede.
- **Conversão de Protocolo:** Percentual de casos que chegam ao status `protocolado`.
- **Eficiência da IA:** Tempo médio entre `processing_started_at` e `processed_at`.
- **Motivos de Arquivamento:** Categorias controladas e contagens agregadas sobre por que os casos estão sendo encerrados sem protocolo.
- **Distribuição por Unidade:** Ranking de sedes com maior volume de atendimento.

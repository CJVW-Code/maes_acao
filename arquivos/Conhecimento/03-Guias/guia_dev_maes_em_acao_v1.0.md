# GUIA COMPLETO DE DESENVOLVIMENTO — MÃES EM AÇÃO
## DPE-BA · Documento para Desenvolvimento Assistido por IA
### Versão 1.1 · Atualizado com evoluções recentes

---

> **Como usar este documento:** Cole-o integralmente como contexto em qualquer sessão com uma IA de código (Cursor, Claude, ChatGPT). Ele contém o estado atual do projeto, as decisões já tomadas, o código que precisa ser criado ou alterado, e as regras de negócio. Não há necessidade de documentação adicional para concluir o projeto.

---

## PARTE 1 — ESTADO ATUAL DO PROJETO

### 1.1 O que já existe e funciona (Evoluções Recentes)

O projeto é um fork do sistema anterior (**Mães em Ação**), adaptado para o mutirão estadual. A estrutura base está sólida e recebeu grandes refinamentos nas sessões recentes:

- **Backend & Infra:** O backend já resolve o erro do `entrypoint.sh` do Docker. Temos o gerador local de `.docx` operando com graceful degradation (fallback para Prisma se o Supabase Storage falhar), prevenindo os antigos erros 500. O sistema central de templates mapeia tags corretamente e acomoda a multiplicidade de execuções (penhora, prisão).
- **Formulários Otimizados:** O fluxo da "Execução de Alimentos" tornou-se cirúrgico (foram removidos "Dados Processuais", WhatsApp, "Despesas Extras" e a rigidez documental). Agora, o fluxo tem um "Enviar documentos depois" com o `DocumentUpload` nativo nas consultas. O "Tipo de Decisão" usa dropdowns e há busca assistida de emissores RG.
- **Regionalização & Templates:** Implantamos a vinculação à unidade ("Cidade de Origem" injetada automaticamente nos templates sem hardcodes de Comarca). Tudo refletido no mapeamento de acessos.
- **Status Padronizados:** Consolidou-se o Prisma Schema de Status (`aguardando_documentos`, `aguardando_protocolo`, etc.), harmonizando as exibições no Dashboard sem chaves órfãs.
- **Identidade Visual:** Todo o hub frontend reflete a roupagem Roxo/Lilás, alinhada à excelência da campanha.

O ORM **Prisma** (para Servidores/Defensores) e **Supabase JS** (para dados escaláveis de Casos e IA) continuam atrelados colaborativamente. 

### 1.2 O que falta (Próximos Passos / Para Implementar)

**Falta 1 — Locking Nível 1 e 2:** [CONCLUÍDO ✅] O sistema de bloqueio atômico foi implementado com `lockController.js` e integrado ao frontend (`DetalhesCaso.jsx`, `Casos.jsx`). Suporta holders claros e admin bypass.

**Falta 2 — Deploy & Pipeline de Fila IA:** [CONCLUÍDO ✅] A integridade do payload QStash foi resolvida com o hook `verify`. A esteira operacional está pronta para o mutirão.

**Falta 3 — Scanner de Balcão:** [CONCLUÍDO ✅] Endpoint dedicado `/api/scanner/upload` criado e testado. Visualização dinâmica de múltiplas minutas integrada.

### 1.3 Decisão de ORM: manter Prisma para usuários, Supabase JS para casos

A decisão é **não reescrever o que funciona**. Prisma continua sendo usado para `defensores`, `cargos`, `cargo_permissoes` e `permissoes` (RBAC). O Supabase JS Client continua para `casos` e suas tabelas filhas. Isso evita migração desnecessária com prazo apertado.

---

## PARTE 2 — ARQUITETURA E STACK DEFINITIVA

### 2.1 Stack tecnológica

```
Frontend:   React 18 + Vite → Vercel Free (SPA estática — sem serverless functions)
Backend:    Node.js 18+ Express + ES Modules → Railway Pro ($20/mês mínimo)
Banco:      Supabase Pro (PostgreSQL, sa-east-1) — projeto ISOLADO da versão anterior
ORM:        Prisma para tabelas de usuários | Supabase JS para tabelas de casos
Storage:    Supabase Storage — apenas signed URLs com expiração de 1h, NUNCA públicas
Fila:       QStash (Upstash) Pay-as-you-go — US Region — mensagens ilimitadas
OCR:        GPT-4o-mini (OpenAI) — substitui Gemini para OCR de documentos
Redação IA: Groq Llama 3.3 70B — mantido, free tier confortável para o volume
Fallback IA:Gemini 2.5 Flash — fallback se Groq falhar (já implementado no aiService.js)
Templates:  docxtemplater + pizzip — um .docx por tipo de ação
Auth:       JWT gerado no backend Express — secret em JWT_SECRET (64 chars)
```

### 2.2 Variáveis de ambiente obrigatórias no Railway

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...   # service_role (Legacy)
DATABASE_URL=postgresql://...      # porta 5432 agora, migrar para 6543 (PgBouncer) antes do mutirão

# IA
OPENAI_API_KEY=sk-...              # GPT-4o-mini para OCR
GROQ_API_KEY=gsk_...               # Llama 3.3 70B para redação
GEMINI_API_KEY=AI...               # Fallback — manter da versão anterior

# QStash
QSTASH_URL=https://qstash.upstash.io/v2/publish/
QSTASH_TOKEN=eyJ...
QSTASH_CURRENT_SIGNING_KEY=sig_...
QSTASH_NEXT_SIGNING_KEY=sig_...
WEBHOOK_URL=https://SEU_APP.up.railway.app/api/jobs

# Auth
JWT_SECRET=64_chars_aleatorios
API_KEY_SERVIDORES=64_chars_aleatorios   # header X-Api-Key para triagem e scanner

# Configuração
PORT=8000
NODE_ENV=production
SIGNED_URL_EXPIRES=3600
SALARIO_MINIMO_ATUAL=1518
```

---

## PARTE 3 — SCHEMA DO BANCO DE DADOS (VERSÃO FINAL)

Execute este SQL no Supabase SQL Editor do projeto Mães em Ação. Execute na ordem indicada.

### 3.1 Tipos ENUM

```sql
CREATE TYPE status_caso AS ENUM (
  'aguardando_documentos',
  'documentacao_completa',
  'processando_ia',
  'pronto_para_analise',
  'em_atendimento',
  'liberado_para_protocolo',
  'em_protocolo',
  'protocolado',
  'erro_processamento'
);

CREATE TYPE status_job AS ENUM ('pendente', 'processando', 'concluido', 'erro');

CREATE TYPE tipo_acao AS ENUM (
  'fixacao_alimentos',
  'exec_penhora',
  'exec_prisao',
  'exec_cumulado',
  'def_penhora',
  'def_prisao',
  'def_cumulado',
  'alimentos_gravidicos'
);

CREATE TYPE sistema_judicial AS ENUM ('solar', 'sigad');

CREATE TYPE etapa_pipeline AS ENUM (
  'upload_recebido',
  'compressao_imagem',
  'ocr_gpt',
  'extracao_dados',
  'geracao_dos_fatos',
  'merge_template',
  'upload_docx',
  'status_atualizado'
);
```

### 3.2 RBAC — Cargos e Permissões (usado pelo Prisma)

```sql
CREATE TABLE cargos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  descricao  text,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissoes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave     text NOT NULL UNIQUE,
  descricao text NOT NULL
);

CREATE TABLE cargo_permissoes (
  cargo_id     uuid NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  permissao_id uuid NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
  PRIMARY KEY (cargo_id, permissao_id)
);
```

### 3.3 Unidades (sedes DPE-BA)

```sql
CREATE TABLE unidades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  comarca    text NOT NULL,   -- usado como {CIDADE} no template
  sistema    sistema_judicial NOT NULL DEFAULT 'solar',
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.4 Defensores/Servidores (gerenciado pelo Prisma)

```sql
CREATE TABLE defensores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  email      text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  cargo_id   uuid NOT NULL REFERENCES cargos(id),
  unidade_id uuid REFERENCES unidades(id),
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 3.5 Casos — Núcleo

```sql
CREATE TABLE casos (
  id                 bigserial PRIMARY KEY,
  protocolo          text NOT NULL UNIQUE,
  unidade_id         uuid NOT NULL REFERENCES unidades(id),
  tipo_acao          tipo_acao NOT NULL,
  status             status_caso NOT NULL DEFAULT 'aguardando_documentos',
  numero_vara        text,   -- {NUMERO_VARA} no template — informado na triagem

  -- Locking nível 1: servidor jurídico (atendimento)
  servidor_id        uuid REFERENCES defensores(id),
  servidor_at        timestamptz,

  -- Locking nível 2: defensor (protocolo)
  defensor_id        uuid REFERENCES defensores(id),
  defensor_at        timestamptz,

  -- Resultado do protocolo
  numero_processo    text,
  url_capa           text,   -- storage_path — nunca URL pública
  protocolado_at     timestamptz,

  -- Pipeline de IA
  status_job         status_job DEFAULT 'pendente',
  erro_processamento text,
  retry_count        integer NOT NULL DEFAULT 0,
  last_retry_at      timestamptz,
  processed_at       timestamptz,

  -- Controle
  criado_por         uuid REFERENCES defensores(id),
  arquivado          boolean NOT NULL DEFAULT false,
  motivo_arquivamento text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
```

### 3.6 Tabelas filhas de casos (1:1)

```sql
-- Partes: assistida e requerido
CREATE TABLE casos_partes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                bigint NOT NULL UNIQUE REFERENCES casos(id) ON DELETE CASCADE,

  -- Assistida / genitora / representante legal
  nome_assistido         text NOT NULL,
  cpf_assistido          text NOT NULL,
  rg_assistido           text,
  emissor_rg_assistido   text,
  estado_civil           text,
  profissao              text,           -- {emprego_exequente} em exec_penhora
  nome_mae_representante text,           -- {nome_mae_representante} no template
  nome_pai_representante text,           -- {nome_pai_representante} no template
  nome_mae_assistido     text,           -- filiação da própria assistida
  nome_pai_assistido     text,
  endereco_assistido     text,
  telefone_assistido     text,
  email_assistido        text,

  -- Requerido / executado
  nome_requerido         text,
  cpf_requerido          text,
  rg_requerido           text,
  emissor_rg_requerido   text,
  profissao_requerido    text,           -- {emprego_executado}
  nome_mae_requerido     text,
  nome_pai_requerido     text,
  endereco_requerido     text,
  telefone_requerido     text,
  email_requerido        text,

  -- Filhos/exequentes (array — suporta múltiplos)
  -- Estrutura: [{ "nome": "NOME EM MAIÚSCULO", "nascimento": "DD/MM/AAAA" }]
  exequentes             jsonb NOT NULL DEFAULT '[]',

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Dados jurídicos específicos da ação
CREATE TABLE casos_juridico (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                  bigint NOT NULL UNIQUE REFERENCES casos(id) ON DELETE CASCADE,

  numero_processo_titulo   text,          -- {numero_processo}
  percentual_salario       numeric(5,2),  -- {porcetagem_salario} — ex: 32.00
  vencimento_dia           integer,       -- {data_pagamento} — ex: 5
  periodo_inadimplencia    text,          -- {data_inadimplencia}

  -- Débito principal (modelos simples)
  debito_valor             text,          -- {valor_causa}
  debito_extenso           text,          -- {valor_causa_extenso} — gerado pelo backend

  -- Débito separado (modelos cumulados)
  debito_penhora_valor     text,          -- {valor_debito_penhora}
  debito_penhora_extenso   text,
  debito_prisao_valor      text,          -- {valor_debito_prisao}
  debito_prisao_extenso    text,

  -- Conta bancária — campos separados para montar a string do template
  conta_banco              text,          -- ex: 'CEF'
  conta_agencia            text,          -- ex: '0618'
  conta_operacao           text,          -- ex: '023'
  conta_numero             text,          -- ex: '00015065-6 03/24'
  -- Backend monta: "CEF, Ag. 0618, 023, C.c. 00015065-6 03/24" → {dados_conta}

  -- Empregador (para ofício desconto em folha — opcional)
  empregador_nome          text,
  empregador_cnpj          text,
  empregador_endereco      text,
  -- Backend monta string → {empregador_folha}

  dados_extras             jsonb DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Dados e outputs de IA
CREATE TABLE casos_ia (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                bigint NOT NULL UNIQUE REFERENCES casos(id) ON DELETE CASCADE,
  relato_texto           text,
  dados_extraidos        jsonb,          -- output bruto do OCR GPT para conferência
  dos_fatos_gerado       text,           -- output do Groq
  peticao_completa_texto text,
  url_peticao            text,           -- storage_path — nunca URL pública
  versao_peticao         integer NOT NULL DEFAULT 1,
  regenerado_at          timestamptz,
  regenerado_por         uuid REFERENCES defensores(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Documentos enviados pelo scanner
CREATE TABLE documentos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                bigint NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  storage_path           text NOT NULL,  -- nunca URL pública
  nome_original          text,
  tipo                   text,           -- 'rg' | 'cpf' | 'decisao_judicial' | 'outro'
  tamanho_bytes          bigint,
  tamanho_original_bytes bigint,         -- antes da compressão
  created_at             timestamptz NOT NULL DEFAULT now()
);
```

### 3.7 Logs — dois níveis

```sql
-- Nível 1: Auditoria humana
CREATE TABLE logs_auditoria (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES defensores(id),
  caso_id    bigint REFERENCES casos(id),
  acao       text NOT NULL,
  detalhes   jsonb,  -- NUNCA salvar CPF, nome ou dados pessoais
  criado_em  timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);

-- Nível 2: Pipeline de IA (debug granular)
CREATE TABLE logs_pipeline (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id       bigint NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  job_tentativa integer NOT NULL DEFAULT 1,
  etapa         etapa_pipeline NOT NULL,
  status        text NOT NULL,  -- 'iniciado' | 'concluido' | 'erro'
  duracao_ms    integer,
  detalhes      jsonb,
  erro_mensagem text,
  criado_em     timestamptz NOT NULL DEFAULT timezone('America/Sao_Paulo', now())
);
```

### 3.8 Views de relatório

```sql
-- Análise em tempo real por status
CREATE VIEW vw_analise_status AS
SELECT status, COUNT(*) AS total,
  COUNT(*) FILTER (WHERE arquivado = false) AS ativos
FROM casos GROUP BY status ORDER BY total DESC;

-- Produtividade por sede
CREATE VIEW vw_analise_por_sede AS
SELECT u.nome AS sede, u.comarca, COUNT(c.id) AS total_casos,
  COUNT(c.id) FILTER (WHERE c.status = 'pronto_para_analise')     AS fila_atendimento,
  COUNT(c.id) FILTER (WHERE c.status = 'liberado_para_protocolo') AS fila_protocolo,
  COUNT(c.id) FILTER (WHERE c.status = 'protocolado')             AS protocolados,
  COUNT(c.id) FILTER (WHERE c.status = 'erro_processamento')      AS com_erro,
  ROUND(COUNT(c.id) FILTER (WHERE c.status = 'protocolado') * 100.0 / NULLIF(COUNT(c.id), 0), 1) AS pct_conclusao
FROM unidades u LEFT JOIN casos c ON c.unidade_id = u.id
WHERE u.ativo = true GROUP BY u.id, u.nome, u.comarca ORDER BY total_casos DESC;

-- Fila de erros para reprocessamento
CREATE VIEW vw_analise_erros AS
SELECT c.id, c.protocolo, u.nome AS sede, c.tipo_acao,
  c.retry_count, c.last_retry_at, c.erro_processamento,
  lp.etapa AS ultima_etapa_pipeline, lp.erro_mensagem AS ultimo_erro_pipeline
FROM casos c JOIN unidades u ON c.unidade_id = u.id
LEFT JOIN LATERAL (
  SELECT etapa, erro_mensagem FROM logs_pipeline
  WHERE caso_id = c.id ORDER BY criado_em DESC LIMIT 1
) lp ON true
WHERE c.status = 'erro_processamento' ORDER BY c.retry_count DESC;

-- Relatório de divulgação (público — impacto social)
CREATE VIEW vw_divulgacao_resumo AS
SELECT
  COUNT(DISTINCT cp.cpf_assistido) AS assistidas_unicas,
  COUNT(c.id) AS total_casos_registrados,
  COUNT(c.id) FILTER (WHERE c.status = 'protocolado') AS peticoes_protocoladas,
  COUNT(DISTINCT c.unidade_id) FILTER (WHERE c.status = 'protocolado') AS sedes_com_protocolo,
  ROUND(AVG(EXTRACT(EPOCH FROM (c.protocolado_at - c.created_at)) / 60)
    FILTER (WHERE c.status = 'protocolado'), 0) AS tempo_medio_atendimento_min
FROM casos c LEFT JOIN casos_partes cp ON cp.caso_id = c.id;
```

### 3.9 Índices e trigger updated_at

```sql
CREATE INDEX idx_casos_protocolo   ON casos (protocolo);
CREATE INDEX idx_casos_status      ON casos (status);
CREATE INDEX idx_casos_unidade     ON casos (unidade_id);
CREATE INDEX idx_casos_tipo        ON casos (tipo_acao);
CREATE INDEX idx_casos_servidor    ON casos (servidor_id, status);
CREATE INDEX idx_casos_defensor    ON casos (defensor_id, status);
CREATE INDEX idx_partes_cpf        ON casos_partes (cpf_assistido);
CREATE INDEX idx_docs_caso         ON documentos (caso_id);
CREATE INDEX idx_pipeline_caso     ON logs_pipeline (caso_id);
CREATE INDEX idx_pipeline_etapa    ON logs_pipeline (etapa, status);

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_casos_updated_at BEFORE UPDATE ON casos FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_partes_updated_at BEFORE UPDATE ON casos_partes FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_juridico_updated_at BEFORE UPDATE ON casos_juridico FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_ia_updated_at BEFORE UPDATE ON casos_ia FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
```

### 3.10 Dados iniciais — RBAC e unidades

```sql
-- Permissões
INSERT INTO permissoes (chave, descricao) VALUES
  ('casos:criar',         'Criar novo caso na triagem'),
  ('casos:buscar',        'Buscar caso por CPF ou protocolo'),
  ('casos:ver_unidade',   'Ver casos da própria unidade'),
  ('casos:ver_todos',     'Ver casos de todas as unidades'),
  ('casos:atribuir',      'Atribuir caso ao próprio nome — locking nível 1'),
  ('casos:liberar',       'Liberar caso para protocolo'),
  ('casos:protocolar',    'Protocolar caso — locking nível 2'),
  ('casos:arquivar',      'Arquivar um caso'),
  ('docs:upload',         'Enviar documentos via scanner'),
  ('docs:ver',            'Visualizar documentos de um caso'),
  ('ia:reprocessar',      'Reprocessar caso com erro de IA'),
  ('ia:regenerar',        'Regenerar DOS FATOS de um caso'),
  ('usuarios:gerenciar',  'Criar e gerenciar usuários'),
  ('relatorios:ver',      'Acessar relatórios'),
  ('relatorios:exportar', 'Exportar relatórios');

-- Cargos
INSERT INTO cargos (nome, descricao) VALUES
  ('atendente', 'Atendente primário — triagem e scanner'),
  ('servidor',  'Servidor jurídico — atendimento e revisão de peças'),
  ('defensor',  'Defensor público — protocolo e atendimento'),
  ('admin',     'Administrador do sistema');

-- Permissões por cargo
INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'atendente' AND p.chave IN ('casos:criar','casos:buscar','docs:upload','docs:ver');

INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'servidor' AND p.chave IN (
  'casos:buscar','casos:ver_unidade','casos:atribuir','casos:liberar','docs:ver','ia:regenerar');

INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'defensor' AND p.chave IN (
  'casos:buscar','casos:ver_unidade','casos:atribuir','casos:liberar',
  'casos:protocolar','docs:ver','ia:regenerar','relatorios:ver');

INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p WHERE c.nome = 'admin';
```

---

## PARTE 4 — PRISMA SCHEMA ATUALIZADO

Substituir completamente o conteúdo de `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL")
}

model Cargo {
  id          String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nome        String      @unique
  descricao   String?
  ativo       Boolean     @default(true)
  created_at  DateTime    @default(now()) @db.Timestamptz
  defensores  Defensor[]
  permissoes  CargoPermissao[]

  @@map("cargos")
}

model Permissao {
  id        String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  chave     String           @unique
  descricao String
  cargos    CargoPermissao[]

  @@map("permissoes")
}

model CargoPermissao {
  cargo_id     String    @db.Uuid
  permissao_id String    @db.Uuid
  cargo        Cargo     @relation(fields: [cargo_id], references: [id], onDelete: Cascade)
  permissao    Permissao @relation(fields: [permissao_id], references: [id], onDelete: Cascade)

  @@id([cargo_id, permissao_id])
  @@map("cargo_permissoes")
}

model Unidade {
  id         String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nome       String
  comarca    String
  sistema    String     @default("solar")
  ativo      Boolean    @default(true)
  created_at DateTime   @default(now()) @db.Timestamptz
  defensores Defensor[]

  @@map("unidades")
}

model Defensor {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nome       String
  email      String    @unique
  senha_hash String
  cargo_id   String    @db.Uuid
  unidade_id String?   @db.Uuid
  ativo      Boolean   @default(true)
  created_at DateTime  @default(now()) @db.Timestamptz
  updated_at DateTime  @default(now()) @db.Timestamptz
  cargo      Cargo     @relation(fields: [cargo_id], references: [id])
  unidade    Unidade?  @relation(fields: [unidade_id], references: [id])

  @@map("defensores")
}
```

Após atualizar, executar: `npx prisma db pull` seguido de `npx prisma generate`.

---

## PARTE 5 — ARQUIVOS A CRIAR OU REESCREVER COMPLETAMENTE

### 5.1 `backend/src/config/dicionarioAcoes.js` — REESCREVER COMPLETAMENTE

Este é o arquivo mais crítico. O sistema de IA usa `promptIA: null` para os modelos de execução porque esses templates não precisam de geração de texto — apenas merge de variáveis. A IA é usada apenas para `fixacao_alimentos` e `alimentos_gravidicos`.

```javascript
import logger from "../utils/logger.js";

/**
 * DICIONÁRIO DE AÇÕES — Mães em Ação
 *
 * promptIA: null  → Apenas merge de variáveis no template (sem chamada à IA para DOS FATOS)
 * promptIA: {...} → Gera DOS FATOS via Groq antes do merge
 *
 * usaOCR: true  → Processa documentos com GPT-4o-mini antes de gerar fatos
 * usaOCR: false → Não faz OCR (templates de execução usam dados já digitados)
 */
export const DICIONARIO_ACOES_BACKEND = {

  fixacao_alimentos: {
    templateDocx: "fixacao_alimentos.docx",
    usaOCR: true,
    promptIA: {
      systemPrompt: `Você é um Defensor Público experiente na Bahia.
Seu estilo de escrita é extremamente formal, culto e padronizado (juridiquês clássico).
Utilize os conectivos: "Insta salientar", "Ocorre que, no caso em tela", "Como é sabido", "aduzir".
REGRA CRÍTICA: NUNCA use o termo "menor" para se referir a uma criança ou adolescente.
Use sempre "criança", "adolescente" ou "filho(a)".
REGRA DE OURO: NÃO cite números de documentos (CPF, RG) ou datas de nascimento no texto narrativo.
Não use listas ou tópicos. Escreva apenas parágrafos coesos.`,
      buildUserPrompt: (dados) => `
Escreva a seção "DOS FATOS" para uma ação de fixação de alimentos com os seguintes dados:
Assistida (genitora): ${dados.nome_representacao}
Filhos: ${dados.lista_filhos?.map(f => `${f.NOME_EXEQUENTE} (nasc. ${f.data_nascimento_exequente})`).join(", ")}
Requerido: ${dados.nome_executado}, ${dados.emprego_executado}
Relato: ${dados.relato_texto || "Não informado"}
Dados extraídos dos documentos: ${JSON.stringify(dados.dados_extraidos || {})}
`,
    },
  },

  alimentos_gravidicos: {
    templateDocx: "alimentos_gravidicos.docx",
    usaOCR: true,
    promptIA: {
      systemPrompt: `Você é um Defensor Público experiente na Bahia especializado em Alimentos Gravídicos (Lei 11.804/2008).
Seu estilo de escrita é extremamente formal, culto e padronizado.
REGRA CRÍTICA: NUNCA use o termo "menor". Use "nascituro" ou "criança".
Não use listas ou tópicos. Escreva apenas parágrafos coesos.`,
      buildUserPrompt: (dados) => `
Escreva a seção "DOS FATOS" para uma ação de alimentos gravídicos com os seguintes dados:
Gestante: ${dados.nome_representacao}
Requerido (suposto pai): ${dados.nome_executado}, ${dados.emprego_executado}
Relato: ${dados.relato_texto || "Não informado"}
Dados extraídos dos documentos: ${JSON.stringify(dados.dados_extraidos || {})}
`,
    },
  },

  // Modelos de EXECUÇÃO — apenas merge de variáveis, SEM geração de DOS FATOS por IA
  // Os dados já vêm digitados pelo servidor na triagem

  exec_penhora: {
    templateDocx: "executacao_alimentos_penhora.docx",
    usaOCR: false,
    promptIA: null,
  },

  exec_prisao: {
    templateDocx: "executacao_alimentos_prisao.docx",
    usaOCR: false,
    promptIA: null,
  },

  exec_cumulado: {
    templateDocx: "prov_cumulado.docx",
    usaOCR: false,
    promptIA: null,
  },

  def_penhora: {
    templateDocx: "def_penhora.docx",
    usaOCR: false,
    promptIA: null,
  },

  def_prisao: {
    templateDocx: "def_prisao.docx",
    usaOCR: false,
    promptIA: null,
  },

  def_cumulado: {
    templateDocx: "def_cumulado.docx",
    usaOCR: false,
    promptIA: null,
  },

  termo_declaracao: {
    templateDocx: "termo_declaracao.docx",
    usaOCR: false,
    promptIA: null,
  },

  default: {
    templateDocx: "fixacao_alimentos.docx",
    usaOCR: false,
    promptIA: null,
  },
};

export const getConfigAcaoBackend = (acaoKey) => {
  if (!acaoKey) {
    logger.warn("[Dicionário] acaoKey vazia — usando config default");
    return DICIONARIO_ACOES_BACKEND["default"];
  }
  const config = DICIONARIO_ACOES_BACKEND[acaoKey];
  if (!config) {
    logger.warn(`[Dicionário] acaoKey="${acaoKey}" não encontrada — usando default`);
    return DICIONARIO_ACOES_BACKEND["default"];
  }
  return config;
};
```

### 5.2 `backend/src/services/templateMergeService.js` — CRIAR

Este é o serviço responsável por montar o objeto de dados para o docxtemplater. Centraliza toda a lógica de formatação e resolve as inconsistências de capitalização dos templates sem precisar alterá-los.

```javascript
/**
 * templateMergeService.js
 *
 * Monta o objeto de dados para o docxtemplater a partir dos dados do caso no banco.
 * Resolve as inconsistências de capitalização dos templates sem alterá-los.
 * Inclui chaves duplicadas onde necessário (ex: nome_executado E NOME_EXECUTADO).
 */

import { supabase } from "../config/supabase.js";

/**
 * Converte número para extenso em português brasileiro.
 */
export const numeroParaExtenso = (valor) => {
  // Implementação completa já existe em casosController.js — importar de lá ou copiar.
  // Reutilizar a função existente.
};

/**
 * Monta a string de dados bancários no formato do template.
 * Ex: "CEF, Ag. 0618, 023, C.c. 00015065-6 03/24"
 */
const montarDadosConta = (juridico) => {
  if (!juridico.conta_banco) return "[DADOS BANCÁRIOS NÃO INFORMADOS]";
  const partes = [juridico.conta_banco];
  if (juridico.conta_agencia) partes.push(`Ag. ${juridico.conta_agencia}`);
  if (juridico.conta_operacao) partes.push(juridico.conta_operacao);
  if (juridico.conta_numero) partes.push(`C.c. ${juridico.conta_numero}`);
  return partes.join(", ");
};

/**
 * Monta a string do empregador para o ofício de desconto em folha.
 */
const montarEmpregador = (juridico) => {
  if (!juridico.empregador_nome) return "Empregador a identificar";
  const partes = [juridico.empregador_nome];
  if (juridico.empregador_cnpj) partes.push(`CNPJ nº ${juridico.empregador_cnpj}`);
  if (juridico.empregador_endereco) partes.push(juridico.empregador_endereco);
  return partes.join(", ");
};

/**
 * Monta a string de data atual no formato jurídico.
 * Ex: "Salvador, 15 de maio de 2025"
 */
const montarDataAtual = (comarca) => {
  const meses = ["janeiro","fevereiro","março","abril","maio","junho",
                 "julho","agosto","setembro","outubro","novembro","dezembro"];
  const hoje = new Date();
  const cidade = comarca || "Salvador";
  return `${cidade}, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
};

/**
 * Busca todos os dados de um caso e monta o objeto de merge completo.
 * Este objeto é passado diretamente ao docxtemplater.render().
 *
 * @param {number} casoId - ID do caso na tabela casos
 * @param {string} comarca - Comarca da unidade (para {CIDADE} e data_atual)
 * @param {string} dosFatosGerado - Texto gerado pela IA (se aplicável)
 * @returns {object} Objeto pronto para docxtemplater
 */
export const montarDadosMerge = async (casoId, comarca, dosFatosGerado = "") => {
  // Busca os dados do caso e suas tabelas filhas
  const { data: partes } = await supabase
    .from("casos_partes").select("*").eq("caso_id", casoId).single();

  const { data: juridico } = await supabase
    .from("casos_juridico").select("*").eq("caso_id", casoId).single();

  const { data: caso } = await supabase
    .from("casos").select("numero_vara, tipo_acao").eq("id", casoId).single();

  if (!partes || !juridico) {
    throw new Error(`Dados incompletos para o caso ${casoId}`);
  }

  const percentualStr = juridico.percentual_salario
    ? juridico.percentual_salario.toString().replace(".00", "")
    : "[PERCENTUAL]";

  const valorCausaExtensoParts = juridico.debito_valor
    ? numeroParaExtenso(parseFloat(juridico.debito_valor.replace(/[^\d,]/g, "").replace(",", ".")))
    : "";

  return {
    // ── Cabeçalho ──────────────────────────────────────────────────────────
    NUMERO_VARA:    caso.numero_vara || "[VARA]",
    numero_vara:    caso.numero_vara || "[VARA]",    // resolve inconsistência exec_prisao
    CIDADE:         comarca || "Salvador",
    cidade:         comarca || "Salvador",           // resolve inconsistência exec_prisao
    numero_processo: juridico.numero_processo_titulo || "[NÚMERO DO PROCESSO]",

    // ── Loop de filhos ─────────────────────────────────────────────────────
    // docxtemplater expande automaticamente o array com {#lista_filhos}...{/lista_filhos}
    lista_filhos: (partes.exequentes || []).map(e => ({
      NOME_EXEQUENTE:            e.nome,
      data_nascimento_exequente: e.nascimento,
    })),

    // ── Representante legal ────────────────────────────────────────────────
    nome_representacao:     partes.nome_assistido,
    NOME_REPRESENTACAO:     partes.nome_assistido,   // resolve inconsistência exec_prisao
    emprego_exequente:      partes.profissao || "",
    rg_exequente:           partes.rg_assistido || "",
    emissor_rg_exequente:   partes.emissor_rg_assistido || "",
    cpf_exequente:          partes.cpf_assistido || "",
    nome_mae_representante: partes.nome_mae_representante || "",
    nome_pai_representante: partes.nome_pai_representante || "",
    "endereço_exequente":   partes.endereco_assistido || "",  // tag tem acento
    telefone_exequente:     partes.telefone_assistido || "",
    email_exequente:        partes.email_assistido || "",

    // ── Executado ──────────────────────────────────────────────────────────
    nome_executado:      partes.nome_requerido || "",
    NOME_EXECUTADO:      partes.nome_requerido || "",   // resolve inconsistência exec_*
    emprego_executado:   partes.profissao_requerido || "",
    nome_mae_executado:  partes.nome_mae_requerido || "",
    nome_pai_executado:  partes.nome_pai_requerido || "",
    rg_executado:        partes.rg_requerido || "",
    emissor_rg_executado:partes.emissor_rg_requerido || "",
    cpf_executado:       partes.cpf_requerido || "",
    telefone_executado:  partes.telefone_requerido || "",
    telephone_executado: partes.telefone_requerido || "",  // resolve typo exec_prisao
    email_executado:     partes.email_requerido || "",
    endereco_executado:  partes.endereco_requerido || "",

    // ── Dados do processo ──────────────────────────────────────────────────
    porcetagem_salario: percentualStr,   // typo intencional do template
    data_pagamento:     juridico.vencimento_dia?.toString() || "",
    dados_conta:        montarDadosConta(juridico),
    data_inadimplencia: juridico.periodo_inadimplencia || "",
    empregador_folha:   montarEmpregador(juridico),
    data_atual:         montarDataAtual(comarca),

    // ── Valores principais ─────────────────────────────────────────────────
    valor_causa:         juridico.debito_valor || "",
    valor_causa_extenso: valorCausaExtensoParts,

    // ── Valores cumulados (prov_cumulado e def_cumulado) ───────────────────
    valor_debito_penhora:         juridico.debito_penhora_valor || "",
    valor_debito_penhora_extenso: juridico.debito_penhora_extenso || "",
    valor_debito_prisao:          juridico.debito_prisao_valor || "",
    valor_debito_prisao_extenso:  juridico.debito_prisao_extenso || "",

    // ── DOS FATOS (para fixacao_alimentos e alimentos_gravidicos) ──────────
    dos_fatos: dosFatosGerado || "",
  };
};
```

### 5.3 `backend/src/services/pipelineService.js` — CRIAR

Este serviço orquestra o pipeline completo de processamento de um caso. Substitui a função `processarCasoEmBackground` que está misturada no `casosController.js`.

```javascript
/**
 * pipelineService.js
 *
 * Orquestra o pipeline completo: OCR → DOS FATOS → Merge Template → Upload
 * Registra cada etapa em logs_pipeline para debug granular.
 * Chamado pelo jobController via QStash webhook.
 */

import { supabase } from "../config/supabase.js";
import { getConfigAcaoBackend } from "../config/dicionarioAcoes.js";
import { visionOCR } from "./aiService.js";
import { generateDosFatos } from "./geminiService.js";
import { generateDocx } from "./documentGenerationService.js";
import { montarDadosMerge } from "./templateMergeService.js";
import logger from "../utils/logger.js";

/**
 * Registra uma etapa do pipeline no banco para debug.
 */
const logPipeline = async (casoId, tentativa, etapa, status, duracaoMs, detalhes, erroMensagem) => {
  await supabase.from("logs_pipeline").insert({
    caso_id: casoId, job_tentativa: tentativa,
    etapa, status, duracao_ms: duracaoMs,
    detalhes: detalhes || null, erro_mensagem: erroMensagem || null,
  });
};

/**
 * Pipeline principal.
 * @param {number} casoId
 * @param {number} tentativa - Número da tentativa atual (incrementado pelo retry do QStash)
 */
export const executarPipeline = async (casoId, tentativa = 1) => {
  logger.info(`🚀 [Pipeline] Iniciando caso ${casoId}, tentativa ${tentativa}`);

  // Atualiza status para processando_ia
  await supabase.from("casos").update({
    status: "processando_ia", status_job: "processando"
  }).eq("id", casoId);

  try {
    // ── Busca dados necessários ──────────────────────────────────────────
    const { data: caso } = await supabase.from("casos")
      .select("id, tipo_acao, unidade_id, retry_count")
      .eq("id", casoId).single();

    const { data: unidade } = await supabase.from("unidades")
      .select("comarca, sistema").eq("id", caso.unidade_id).single();

    const { data: ia } = await supabase.from("casos_ia")
      .select("relato_texto").eq("caso_id", casoId).single();

    const { data: documentos } = await supabase.from("documentos")
      .select("storage_path, nome_original, tipo").eq("caso_id", casoId);

    const config = getConfigAcaoBackend(caso.tipo_acao);
    let dosFatosGerado = "";
    let dadosExtraidos = {};

    // ── Etapa OCR (apenas se usaOCR = true) ─────────────────────────────
    if (config.usaOCR && documentos?.length > 0) {
      const inicioOCR = Date.now();
      await logPipeline(casoId, tentativa, "ocr_gpt", "iniciado", null, { total_docs: documentos.length });
      try {
        // Busca signed URLs e processa cada documento
        for (const doc of documentos) {
          const { data: signedUrl } = await supabase.storage
            .from("documentos").createSignedUrl(doc.storage_path, 300);
          if (!signedUrl?.signedUrl) continue;

          const response = await fetch(signedUrl.signedUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          const mimeType = doc.storage_path.endsWith(".pdf") ? "application/pdf" : "image/jpeg";

          const resultado = await visionOCR(buffer, mimeType,
            `Extraia todos os dados relevantes deste documento jurídico. Retorne JSON.`);
          dadosExtraidos[doc.nome_original || doc.storage_path] = resultado;
        }
        await logPipeline(casoId, tentativa, "ocr_gpt", "concluido", Date.now() - inicioOCR,
          { documentos_processados: documentos.length });
      } catch (err) {
        await logPipeline(casoId, tentativa, "ocr_gpt", "erro", Date.now() - inicioOCR,
          null, err.message);
        throw err;
      }
    }

    // ── Etapa Geração DOS FATOS (apenas se promptIA !== null) ─────────────
    if (config.promptIA) {
      const inicioFatos = Date.now();
      await logPipeline(casoId, tentativa, "geracao_dos_fatos", "iniciado");
      try {
        // Monta dados básicos para o prompt
        const dadosParaPrompt = {
          relato_texto: ia?.relato_texto || "",
          dados_extraidos: dadosExtraidos,
        };
        dosFatosGerado = await generateDosFatos(dadosParaPrompt, caso.tipo_acao);
        await logPipeline(casoId, tentativa, "geracao_dos_fatos", "concluido",
          Date.now() - inicioFatos, { chars_gerados: dosFatosGerado?.length || 0 });
      } catch (err) {
        await logPipeline(casoId, tentativa, "geracao_dos_fatos", "erro",
          Date.now() - inicioFatos, null, err.message);
        throw err;
      }
    }

    // ── Etapa Merge do Template ───────────────────────────────────────────
    const inicioMerge = Date.now();
    await logPipeline(casoId, tentativa, "merge_template", "iniciado",
      null, { template: config.templateDocx });
    let docxBuffer;
    try {
      const dadosMerge = await montarDadosMerge(casoId, unidade?.comarca, dosFatosGerado);
      docxBuffer = await generateDocx(dadosMerge, caso.tipo_acao);
      await logPipeline(casoId, tentativa, "merge_template", "concluido",
        Date.now() - inicioMerge, { template: config.templateDocx });
    } catch (err) {
      await logPipeline(casoId, tentativa, "merge_template", "erro",
        Date.now() - inicioMerge, null, err.message);
      throw err;
    }

    // ── Etapa Upload do .docx gerado ──────────────────────────────────────
    const inicioUpload = Date.now();
    await logPipeline(casoId, tentativa, "upload_docx", "iniciado");
    const storagePath = `peticoes/${casoId}_v${tentativa}_${Date.now()}.docx`;
    const { error: uploadError } = await supabase.storage
      .from("peticoes").upload(storagePath, docxBuffer,
        { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    if (uploadError) {
      await logPipeline(casoId, tentativa, "upload_docx", "erro",
        Date.now() - inicioUpload, null, uploadError.message);
      throw uploadError;
    }
    await logPipeline(casoId, tentativa, "upload_docx", "concluido",
      Date.now() - inicioUpload, { storage_path: storagePath, bytes: docxBuffer.length });

    // ── Salva resultados e atualiza status ────────────────────────────────
    await supabase.from("casos_ia").upsert({
      caso_id: casoId,
      dos_fatos_gerado: dosFatosGerado || null,
      dados_extraidos: Object.keys(dadosExtraidos).length ? dadosExtraidos : null,
      url_peticao: storagePath,
    }, { onConflict: "caso_id" });

    await supabase.from("casos").update({
      status: "pronto_para_analise",
      status_job: "concluido",
      processed_at: new Date().toISOString(),
      erro_processamento: null,
    }).eq("id", casoId);

    await logPipeline(casoId, tentativa, "status_atualizado", "concluido",
      null, { novo_status: "pronto_para_analise" });

    logger.info(`✅ [Pipeline] Caso ${casoId} concluído na tentativa ${tentativa}`);

  } catch (err) {
    logger.error(`❌ [Pipeline] Caso ${casoId} falhou: ${err.message}`);
    await supabase.from("casos").update({
      status: "erro_processamento",
      status_job: "erro",
      erro_processamento: err.message,
      retry_count: (await supabase.from("casos").select("retry_count").eq("id", casoId).single())
        .data?.retry_count + 1 || 1,
      last_retry_at: new Date().toISOString(),
    }).eq("id", casoId);
    throw err;
  }
};
```

### 5.4 `backend/src/controllers/lockController.js` — CRIAR

Gerencia o sistema de locking de dois níveis (atendimento + protocolo).

```javascript
import { supabase } from "../config/supabase.js";
import logger from "../utils/logger.js";

const LOCK_TIMEOUT_MINUTES = 30;

/**
 * Atribuição nível 1 — servidor jurídico pega o caso para atendimento.
 * Usa UPDATE atômico com WHERE para evitar race condition.
 */
export const atribuirServidor = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    // UPDATE atômico — só atualiza se o lock está livre ou expirou
    const { data, error } = await supabase.rpc("lock_caso_servidor", {
      p_caso_id: parseInt(id),
      p_servidor_id: usuarioId,
      p_timeout_minutes: LOCK_TIMEOUT_MINUTES,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      // Busca quem está com o caso para informar
      const { data: caso } = await supabase.from("casos")
        .select("servidor_id, servidor_at, defensores!casos_servidor_id_fkey(nome)")
        .eq("id", id).single();

      return res.status(423).json({
        error: "Caso bloqueado",
        atendente: caso?.defensores?.nome || "outro servidor",
        desde: caso?.servidor_at,
      });
    }

    res.json({ message: "Caso atribuído com sucesso", caso: data[0] });
  } catch (err) {
    logger.error(`Erro ao atribuir servidor: ${err.message}`);
    res.status(500).json({ error: "Erro ao atribuir caso" });
  }
};

/**
 * Liberação pelo servidor — muda status para liberado_para_protocolo.
 */
export const liberarParaProtocolo = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    const { data, error } = await supabase.from("casos")
      .update({ status: "liberado_para_protocolo", updated_at: new Date() })
      .eq("id", id).eq("servidor_id", usuarioId)
      .select().single();

    if (error || !data) {
      return res.status(403).json({ error: "Você não é o servidor atribuído a este caso." });
    }

    res.json({ message: "Caso liberado para protocolo", caso: data });
  } catch (err) {
    res.status(500).json({ error: "Erro ao liberar caso" });
  }
};

/**
 * Atribuição nível 2 — defensor pega o caso para protocolar.
 */
export const atribuirDefensor = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  try {
    const { data, error } = await supabase.rpc("lock_caso_defensor", {
      p_caso_id: parseInt(id),
      p_defensor_id: usuarioId,
      p_timeout_minutes: LOCK_TIMEOUT_MINUTES,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      const { data: caso } = await supabase.from("casos")
        .select("defensor_id, defensor_at, defensores!casos_defensor_id_fkey(nome)")
        .eq("id", id).single();

      return res.status(423).json({
        error: "Caso em protocolo por outro defensor",
        defensor: caso?.defensores?.nome || "outro defensor",
        desde: caso?.defensor_at,
      });
    }

    res.json({ message: "Caso atribuído para protocolo", caso: data[0] });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atribuir defensor" });
  }
};

/**
 * Unlock explícito — chamado ao finalizar ou cancelar atendimento.
 */
export const unlock = async (req, res) => {
  const { id } = req.params;
  const { nivel } = req.body; // "servidor" ou "defensor"
  const usuarioId = req.user.id;

  try {
    const updateData = nivel === "defensor"
      ? { defensor_id: null, defensor_at: null }
      : { servidor_id: null, servidor_at: null };

    const whereClause = nivel === "defensor"
      ? { defensor_id: usuarioId }
      : { servidor_id: usuarioId };

    await supabase.from("casos").update(updateData).eq("id", id).match(whereClause);

    res.json({ message: "Lock liberado" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao liberar lock" });
  }
};

/**
 * Protocolar — salva número do processo e finaliza.
 */
export const protocolar = async (req, res) => {
  const { id } = req.params;
  const { numero_processo } = req.body;
  const usuarioId = req.user.id;

  try {
    let urlCapa = null;

    // Se enviou arquivo de capa
    if (req.file) {
      const storagePath = `capas/${id}_capa_${Date.now()}.${req.file.originalname.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("documentos").upload(storagePath, req.file.buffer,
          { contentType: req.file.mimetype });
      if (uploadError) throw uploadError;
      urlCapa = storagePath;
    }

    const { data, error } = await supabase.from("casos")
      .update({
        status: "protocolado",
        numero_processo,
        url_capa: urlCapa,
        protocolado_at: new Date().toISOString(),
        defensor_id: usuarioId,
      })
      .eq("id", id)
      .select().single();

    if (error || !data) throw new Error(error?.message || "Caso não encontrado");

    res.json({ message: "Caso protocolado com sucesso", caso: data });
  } catch (err) {
    logger.error(`Erro ao protocolar caso ${id}: ${err.message}`);
    res.status(500).json({ error: "Erro ao protocolar" });
  }
};
```

**Funções RPC necessárias no Supabase (SQL Editor):**

```sql
-- Lock atômico nível 1 (servidor)
CREATE OR REPLACE FUNCTION lock_caso_servidor(
  p_caso_id bigint, p_servidor_id uuid, p_timeout_minutes int
) RETURNS SETOF casos AS $$
  UPDATE casos SET servidor_id = p_servidor_id, servidor_at = now(),
    status = CASE WHEN status = 'pronto_para_analise' THEN 'em_atendimento' ELSE status END
  WHERE id = p_caso_id
    AND (servidor_id IS NULL OR servidor_at < now() - make_interval(mins => p_timeout_minutes))
  RETURNING *;
$$ LANGUAGE sql;

-- Lock atômico nível 2 (defensor)
CREATE OR REPLACE FUNCTION lock_caso_defensor(
  p_caso_id bigint, p_defensor_id uuid, p_timeout_minutes int
) RETURNS SETOF casos AS $$
  UPDATE casos SET defensor_id = p_defensor_id, defensor_at = now(),
    status = 'em_protocolo'
  WHERE id = p_caso_id AND status = 'liberado_para_protocolo'
    AND (defensor_id IS NULL OR defensor_at < now() - make_interval(mins => p_timeout_minutes))
  RETURNING *;
$$ LANGUAGE sql;
```

### 5.5 Atualizar `backend/src/controllers/jobController.js`

Substituir a chamada a `processarCasoEmBackground` pela chamada ao novo `pipelineService`:

```javascript
import { executarPipeline } from "../services/pipelineService.js";

// Dentro do setImmediate, substituir:
// await processarCasoEmBackground(...)
// por:

setImmediate(async () => {
  const startTime = Date.now();
  // Busca o número da tentativa atual para o log granular
  const tentativa = (caso.retry_count || 0) + 1;
  try {
    await executarPipeline(caso.id, tentativa);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`✅ [Background] Pipeline concluído para ${protocolo} em ${duration}s`);
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error(`❌ [Background] Pipeline falhou após ${duration}s no caso ${protocolo}: ${err.message}`);
  }
});
```

### 5.6 Atualizar `backend/src/routes/casos.js`

Adicionar as novas rotas de locking e protocolo:

```javascript
import {
  atribuirServidor, liberarParaProtocolo,
  atribuirDefensor, unlock, protocolar
} from "../controllers/lockController.js";

// Adicionar após as rotas protegidas existentes:
router.patch("/:id/atribuir-servidor", atribuirServidor);
router.patch("/:id/liberar-protocolo", liberarParaProtocolo);
router.patch("/:id/atribuir-defensor", atribuirDefensor);
router.patch("/:id/unlock",           unlock);
router.post("/:id/protocolar", upload.single("capa"), protocolar);
```

### 5.7 Atualizar `backend/src/routes/casos.js` — rota de busca por CPF

A busca por CPF precisa retornar dados da tabela `casos_partes` no novo schema:

```javascript
// Em casosController.js, função buscarPorCpf — atualizar query:
export const buscarPorCpf = async (req, res) => {
  const { cpf } = req.query;
  if (!cpf) return res.status(400).json({ error: "CPF é obrigatório." });

  const cpfLimpo = cpf.replace(/\D/g, "");

  const { data: partes, error } = await supabase
    .from("casos_partes")
    .select("caso_id, nome_assistido, cpf_assistido, casos(protocolo, status, tipo_acao, created_at, unidade_id)")
    .eq("cpf_assistido", cpfLimpo)
    .order("created_at", { foreignTable: "casos", ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json(partes || []);
};
```

### 5.8 Nova rota de scanner — `backend/src/routes/scanner.js`

```javascript
import express from "express";
import { upload } from "../middleware/upload.js";
import { supabase } from "../config/supabase.js";
import { Client as QStashClient } from "@upstash/qstash";
import logger from "../utils/logger.js";

const router = express.Router();
const qstash = new QStashClient({ token: process.env.QSTASH_TOKEN });

/**
 * POST /api/scanner/:casoId/documentos
 * Recebe os documentos do scanner, salva no Storage e dispara o job de IA.
 */
router.post("/:casoId/documentos",
  upload.fields([{ name: "documentos", maxCount: 20 }]),
  async (req, res) => {
    const { casoId } = req.params;

    try {
      const files = req.files?.documentos || [];
      if (files.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      // Salva cada arquivo no Storage e registra na tabela documentos
      const uploadPromises = files.map(async (file) => {
        const ext = file.originalname.split(".").pop();
        const storagePath = `documentos/${casoId}/${Date.now()}_${Math.random().toString(36).substr(2,6)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("documentos").upload(storagePath, file.buffer,
            { contentType: file.mimetype });
        if (uploadError) throw uploadError;

        await supabase.from("documentos").insert({
          caso_id: parseInt(casoId),
          storage_path: storagePath,
          nome_original: file.originalname,
          tamanho_bytes: file.size,
        });

        return storagePath;
      });

      await Promise.all(uploadPromises);

      // Atualiza status para documentacao_completa
      await supabase.from("casos").update({
        status: "documentacao_completa",
      }).eq("id", casoId);

      // Responde imediatamente — IA processa em background
      res.json({ message: "Documentos recebidos. Processando em background.", casoId });

      // Dispara job no QStash
      await qstash.publishJSON({
        url: process.env.WEBHOOK_URL,
        body: { casoId: parseInt(casoId) },
        retries: 3,
      });

      logger.info(`📨 Job publicado no QStash para o caso ${casoId}`);

    } catch (err) {
      logger.error(`Erro no scanner: ${err.message}`);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  }
);

export default router;
```

Registrar em `server.js`:
```javascript
import scannerRoutes from "./src/routes/scanner.js";
app.use("/api/scanner", scannerRoutes);
```

---

## PARTE 6 — MIDDLEWARE DE PERMISSÕES (RBAC)

Substituir o `requireWriteAccess.js` por um middleware genérico baseado na tabela de permissões:

```javascript
// backend/src/middleware/requirePermissao.js
import { prisma } from "../config/prisma.js";

/**
 * Middleware que verifica se o usuário tem uma permissão específica.
 * Uso: router.post("/rota", requirePermissao("casos:criar"), controller)
 */
export const requirePermissao = (chavePermissao) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Não autenticado." });

  try {
    const tem = await prisma.cargoPermissao.findFirst({
      where: {
        cargo: { defensores: { some: { id: req.user.id } } },
        permissao: { chave: chavePermissao },
      },
    });

    if (!tem) {
      return res.status(403).json({
        error: `Acesso negado. Permissão '${chavePermissao}' necessária.`,
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ error: "Erro ao verificar permissões." });
  }
};
```

---

## PARTE 7 — CONFIGURAÇÃO DO FRONTEND

### 7.1 Atualizar `frontend/src/config/formularios/acoes/familia.js`

Adicionar os novos tipos de ação e remover os que não fazem parte do mutirão:

```javascript
export const ACOES_FAMILIA = {

  fixacao_alimentos: {
    titulo: "Fixação de Alimentos",
    status: "ativo",
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido"],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: true,
    usaIA: true,
  },

  exec_penhora: {
    titulo: "Execução de Alimentos — Rito da Penhora",
    status: "ativo",
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido", "SecaoProcessoOriginal", "SecaoDadosDebito"],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: true,
    usaIA: false,  // Apenas merge de variáveis
  },

  exec_prisao: {
    titulo: "Execução de Alimentos — Rito da Prisão",
    status: "ativo",
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido", "SecaoProcessoOriginal", "SecaoDadosDebito"],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: true,
    usaIA: false,
  },

  exec_cumulado: {
    titulo: "Execução de Alimentos — Rito Cumulado (Penhora + Prisão)",
    status: "ativo",
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido", "SecaoProcessoOriginal", "SecaoDebitosCumulados"],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: true,
    usaIA: false,
  },

  def_penhora: {
    titulo: "Cumprimento de Sentença — Rito da Penhora",
    status: "ativo",
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido", "SecaoProcessoOriginal", "SecaoDadosDebito"],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: true,
    usaIA: false,
  },

  def_prisao: {
    titulo: "Cumprimento de Sentença — Rito da Prisão",
    status: "ativo",
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido", "SecaoProcessoOriginal", "SecaoDadosDebito"],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: true,
    usaIA: false,
  },

  def_cumulado: {
    titulo: "Cumprimento de Sentença — Rito Cumulado (Penhora + Prisão)",
    status: "ativo",
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido", "SecaoProcessoOriginal", "SecaoDebitosCumulados"],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: true,
    usaIA: false,
  },

  alimentos_gravidicos: {
    titulo: "Alimentos Gravídicos",
    status: "ativo",
    secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido"],
    camposGerais: { mostrarBensPartilha: false },
    forcaRepresentacao: false,
    usaIA: true,
  },
};
```

### 7.2 Novos campos no formulário de triagem

Os seguintes campos são novos e precisam ser adicionados ao formulário:

**Campos do processo (para modelos de execução):**
- `numero_vara` — input text — "Número da Vara (ex: 1ª, 7ª)"
- `numero_processo_titulo` — input text — "Número do Processo (ex: 0535602-84.2017.8.05.0001)"
- `periodo_inadimplencia` — input text — "Período de Inadimplência (ex: Jan/2024 a Mar/2025)"
- `percentual_salario` — input number — "Percentual do Salário Mínimo (ex: 32)"
- `vencimento_dia` — input number — "Dia de Vencimento (ex: 5)"

**Campos da conta bancária (4 campos separados):**
- `conta_banco` — input text — "Banco (ex: CEF, Bradesco)"
- `conta_agencia` — input text — "Agência"
- `conta_operacao` — input text — "Operação"
- `conta_numero` — input text — "Número da Conta"

**Campos do empregador (opcionais):**
- `empregador_nome` — input text — "Nome do Empregador"
- `empregador_cnpj` — input text — "CNPJ do Empregador"
- `empregador_endereco` — input text — "Endereço do Empregador"

**Campos para modelos cumulados (apenas exec_cumulado e def_cumulado):**
- `debito_penhora_valor` — input currency — "Valor do Débito para Penhora (parcelas antigas)"
- `debito_prisao_valor` — input currency — "Valor do Débito para Prisão (últimas 3 parcelas)"

**Campos de qualificação das partes expandidos:**
- `emissor_rg_assistido` — input text — "Órgão Emissor do RG (ex: SSP/BA)"
- `nome_mae_representante` — input text — "Nome da Mãe da Representante"
- `nome_pai_representante` — input text — "Nome do Pai da Representante"
- `emissor_rg_requerido` — input text — "Órgão Emissor do RG do Requerido"
- `nome_mae_requerido` — input text — "Nome da Mãe do Requerido"
- `nome_pai_requerido` — input text — "Nome do Pai do Requerido"

### 7.3 Novas páginas do frontend a criar

**`frontend/src/areas/servidor/pages/Scanner.jsx`** — Tela do scanner. Busca caso por CPF ou protocolo e exibe a Dropzone para upload. Chama `POST /api/scanner/:casoId/documentos`. Após envio, exibe sucesso e permite buscar próximo caso.

**`frontend/src/areas/defensor/pages/PainelAtendimento.jsx`** — Fila de casos com status `pronto_para_analise` filtrados pela `unidade_id` do defensor logado. Botão "Pegar Caso" chama `PATCH /api/casos/:id/atribuir-servidor`. Ao abrir um caso, exibe alerta se estiver bloqueado (HTTP 423).

**`frontend/src/areas/defensor/pages/PainelProtocolo.jsx`** — Fila de casos com status `liberado_para_protocolo`. Botão "Pegar para Protocolar" chama `PATCH /api/casos/:id/atribuir-defensor`. Campo para informar número do processo e upload de capa.

**`frontend/src/areas/defensor/pages/PainelAdmin.jsx`** — Visível apenas para cargo `admin`. Mostra `vw_analise_erros` com botão "Reprocessar". Mostra `vw_analise_por_sede` para monitoramento em tempo real.

---

## PARTE 8 — REGRAS DE NEGÓCIO CRÍTICAS

### 8.1 Quais ações usam IA e quais não usam

Esta é a regra mais importante do sistema. A IA é usada **apenas** para gerar o texto jurídico da seção "DOS FATOS" em ações que requerem narrativa — não em ações de execução onde os dados já vêm estruturados do formulário.

| Tipo de ação | Usa OCR? | Gera DOS FATOS? | Pipeline |
|---|---|---|---|
| `fixacao_alimentos` | Sim | Sim | OCR → Groq → Merge |
| `alimentos_gravidicos` | Sim | Sim | OCR → Groq → Merge |
| `exec_penhora` | Não | Não | Merge direto |
| `exec_prisao` | Não | Não | Merge direto |
| `exec_cumulado` | Não | Não | Merge direto |
| `def_penhora` | Não | Não | Merge direto |
| `def_prisao` | Não | Não | Merge direto |
| `def_cumulado` | Não | Não | Merge direto |

Para os modelos de execução, o custo de IA é **zero** — apenas merge de variáveis. Isso é fundamental para o controle de custos no mutirão.

### 8.2 Fluxo de status completo

```
aguardando_documentos → documentacao_completa → processando_ia → pronto_para_analise
                                                               → erro_processamento (retry manual)
pronto_para_analise → em_atendimento → liberado_para_protocolo → em_protocolo → protocolado
```

### 8.3 Regras de locking

Lock expira após 30 minutos de inatividade (baseado em `servidor_at` ou `defensor_at`). O unlock explícito deve ser chamado nos botões "Finalizar Atendimento", "Cancelar Atendimento" e "Cancelar Protocolo". Nunca depender só do timeout de 30 minutos. O retorno HTTP 423 (Locked) deve exibir o nome e horário do usuário que está com o caso.

### 8.4 Regras de segurança inegociáveis

Nunca salvar URLs públicas permanentes no Storage — sempre `storage_path`. Gerar signed URL na hora de servir ao frontend com expiração de 1 hora. Nunca registrar CPF, nome ou dados pessoais em `logs_auditoria` ou `logs_pipeline`. Sempre validar CPF algoritmicamente antes de salvar (função `validarCPF` já existe no `casosController.js`).

### 8.5 Inconsistências dos templates que o backend resolve

O backend deve SEMPRE enviar estas chaves duplicadas no objeto de merge, sem lógica condicional por tipo de ação:

- `nome_representacao` E `NOME_REPRESENTACAO` — mesmo valor
- `nome_executado` E `NOME_EXECUTADO` — mesmo valor  
- `telefone_executado` E `telephone_executado` — mesmo valor (typo exec_prisao)
- `NUMERO_VARA` E `numero_vara` — mesmo valor
- `CIDADE` E `cidade` — mesmo valor
- `endereço_exequente` (com acento) — campo tem acento no nome no template

---

## PARTE 9 — TESTES OBRIGATÓRIOS

### 9.1 Testes críticos antes do deploy

**Teste 1 — dicionarioAcoes:** Para cada um dos 8 tipos de ação, verificar que `getConfigAcaoBackend("tipo")` retorna o template correto e que o arquivo existe em `backend/templates/`.

**Teste 2 — templateMergeService:** Gerar o objeto de merge para um caso de teste e verificar que todas as 35+ tags estão presentes no objeto, incluindo as chaves duplicadas.

**Teste 3 — Pipeline exec_penhora:** Criar um caso de teste com `exec_penhora`, disparar o pipeline, e verificar que o .docx é gerado sem erros e sem tags `{variavel}` literais no documento final.

**Teste 4 — Pipeline fixacao_alimentos:** Criar um caso de teste com `fixacao_alimentos`, disparar o pipeline, e verificar que o DOS FATOS é gerado pelo Groq e inserido no .docx.

**Teste 5 — Locking:** Simular dois usuários tentando atribuir o mesmo caso simultaneamente. O segundo deve receber HTTP 423.

**Teste 6 — QStash retry:** Derrubar artificialmente o endpoint `/api/jobs` e verificar que o QStash tenta novamente após o backoff.

**Teste 7 — logs_pipeline:** Após um pipeline completo, verificar que existem registros em `logs_pipeline` para cada etapa (`upload_recebido`, `merge_template`, `upload_docx`, `status_atualizado`).

### 9.2 Teste de carga pré-mutirão

Usar k6 ou Artillery para simular 40 requests simultâneos por 10 minutos. Métricas alvo: tempo de resposta das rotas críticas abaixo de 2 segundos, taxa de erro abaixo de 1%, RAM do Railway abaixo de 70%.

---

## PARTE 10 — CHECKLIST DE DEPLOY FINAL RESTANTE

Múltiplos alicerces originais já foram desenvolvidos nas sessões recentes (formulários flexíveis, mapping de variáveis com fallback local, identidade visual e padronização de status). Abaixo as etapas ainda requeridas ou pendentes integrativas:

- [ ] 1. Rodar os scripts de banco (`casos_ia`, schemas parciais de fila) faltantes no Supabase Pro.
- [ ] 2. Rodar as funções RPC de Lock Transacional (`lock_caso_servidor`, `lock_caso_defensor`).
- [x] 3. Atualizar `schema.prisma` (Unidade, CaseStatus e Roles estruturalmente implementados).
- [ ] 4. Efetivar variáveis no Railway de Prod (atenção ao Database_URL com pgBouncer na porta 6543).
- [x] 5. Reescrever e revisar de cabo a rabo a arquitetura de `dicionarioAcoes.js` (Evoluído na adequação local).
- [x] 6. Migrar processamentos de Merge do docxtemplater para absorção nativa.
- [ ] 7. Confirmar o orquestrador `pipelineService.js` no Job Queue.
- [ ] 8. Estruturar endpoints `lockController.js`.
- [ ] 9. Disparo webhook `jobController.js` → QStash → pipelineService.
- [ ] 10. Testar as travas do UI do Atendente limitando as rotas finalizadas do lock no Backend.
- [ ] 11. Endpoint e componente massificado `/api/scanner`.
- [x] 12. Atualizar as config views `familia.js` e UI de TriagemCaso ("Enviar depois" + Dropdowns).
- [x] 13. Adicionar campos extras sem complexidades não usadas nas execuções.
- [x] 14. Regionalização da cidade assinatura nos componentes.
- [x] 15. Tabela Unidades atrelada aos formulários no Frontend/Backend.
- [ ] 16. Testes E2E mandatórios - Parte 9.1.
- [ ] 17. Load Test - Parte 9.2 (Simulando Varas locais mutirão).
- [ ] 18. Consolidar Private Storage Buckets sem exposições RLS nulas do Supabase.
- [ ] 19. "Smoke Test" End to End do Protocolo.

---

## PARTE 11 — O QUE NÃO FAZER

Esta seção existe para evitar erros comuns ao trabalhar com IA de código.

**Não alterar os arquivos .docx dos templates.** As inconsistências de capitalização são resolvidas no backend com chaves duplicadas no objeto de merge.

**Não usar Supabase Auth.** A autenticação é JWT próprio via `defensoresController.js` + Prisma.

**Não chamar GPT-4o-mini ou Groq de forma síncrona em requests HTTP.** Todo processamento de IA vai para o QStash.

**Não usar WebSocket.** O polling simples a cada 20s no painel do defensor é suficiente para o volume do mutirão.

**Não adicionar serverless functions no Vercel.** O backend é exclusivamente o Railway.

**Não salvar URLs públicas permanentes no Storage.** Sempre `storage_path`, sempre signed URLs na hora de servir.

**Não remover o Gemini como fallback no aiService.js.** Ele serve de segurança se o Groq falhar durante o mutirão.

**Não usar `localhost` no WEBHOOK_URL.** O QStash precisa de uma URL pública acessível — a URL do Railway em produção.

**Não fazer deploy sem popular a tabela `unidades`.** O campo `CIDADE` no template vem da comarca da unidade — sem isso todos os documentos saem com valor vazio ou erro.

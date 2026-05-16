-- ============================================================================
-- MAES EM ACAO - SCHEMA DE REFERENCIA
-- Versao: 6.0
-- Atualizado em: 2026-05-12
-- Fonte canonica: backend/prisma/schema.prisma
--
-- Este arquivo e um DDL de referencia derivado do Prisma.
-- Para alterar o banco real, altere primeiro backend/prisma/schema.prisma.
-- Geracao usada:
--   .\backend\node_modules\.bin\prisma.cmd migrate diff --from-empty --to-schema-datamodel backend\prisma\schema.prisma --script
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS "public";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE "status_assistencia" AS ENUM ('pendente', 'aceito', 'recusado');

CREATE TYPE "status_caso" AS ENUM (
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

CREATE TYPE "status_job" AS ENUM ('pendente', 'processando', 'concluido', 'erro');

CREATE TYPE "tipo_acao" AS ENUM (
  'exec_penhora',
  'exec_prisao',
  'exec_cumulado',
  'def_penhora',
  'def_prisao',
  'def_cumulado',
  'fixacao_alimentos',
  'alimentos_gravidicos'
);

CREATE TYPE "sistema_judicial" AS ENUM ('solar', 'sigad');

CREATE TYPE "etapa_pipeline" AS ENUM (
  'upload_recebido',
  'compressao_imagem',
  'ocr_gpt',
  'extracao_dados',
  'geracao_dos_fatos',
  'merge_template',
  'upload_docx',
  'status_atualizado'
);

-- ============================================================================
-- TABELAS BASE
-- ============================================================================

CREATE TABLE "cargos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissoes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "chave" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  CONSTRAINT "permissoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cargo_permissoes" (
  "cargo_id" UUID NOT NULL,
  "permissao_id" UUID NOT NULL,
  CONSTRAINT "cargo_permissoes_pkey" PRIMARY KEY ("cargo_id", "permissao_id")
);

CREATE TABLE "unidades" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome" TEXT NOT NULL,
  "comarca" TEXT NOT NULL,
  "sistema" "sistema_judicial" NOT NULL DEFAULT 'solar',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "regional" TEXT,
  CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "defensores" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supabase_uid" TEXT,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senha_hash" TEXT,
  "cargo_id" UUID NOT NULL,
  "unidade_id" UUID,
  "regional" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "defensores_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- CASOS E TABELAS FILHAS
-- ============================================================================

CREATE TABLE "casos" (
  "id" BIGSERIAL NOT NULL,
  "protocolo" TEXT NOT NULL,
  "unidade_id" UUID NOT NULL,
  "tipo_acao" "tipo_acao" NOT NULL,
  "status" "status_caso" NOT NULL DEFAULT 'aguardando_documentos',
  "numero_vara" TEXT,
  "servidor_id" UUID,
  "servidor_at" TIMESTAMPTZ(6),
  "defensor_id" UUID,
  "defensor_at" TIMESTAMPTZ(6),
  "numero_processo" TEXT,
  "url_capa" TEXT,
  "protocolado_at" TIMESTAMPTZ(6),
  "status_job" "status_job" DEFAULT 'pendente',
  "erro_processamento" TEXT,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_retry_at" TIMESTAMPTZ(6),
  "processed_at" TIMESTAMPTZ(6),
  "arquivado" BOOLEAN NOT NULL DEFAULT false,
  "motivo_arquivamento" TEXT,
  "criado_por" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "agendamento_data" TIMESTAMPTZ(6),
  "agendamento_link" TEXT,
  "agendamento_status" TEXT,
  "chave_acesso_hash" TEXT,
  "data_sugerida_reagendamento" TEXT,
  "descricao_pendencia" TEXT,
  "feedback" TEXT,
  "finished_at" TIMESTAMPTZ(6),
  "motivo_reagendamento" TEXT,
  "processing_started_at" TIMESTAMPTZ(6),
  "url_capa_processual" TEXT,
  "compartilhado" BOOLEAN NOT NULL DEFAULT false,
  "numero_solar" TEXT,
  "observacao_arquivamento" TEXT,
  CONSTRAINT "casos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "casos_partes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "caso_id" BIGINT NOT NULL,
  "nome_assistido" TEXT NOT NULL,
  "cpf_assistido" TEXT NOT NULL,
  "rg_assistido" TEXT,
  "emissor_rg_assistido" TEXT,
  "estado_civil" TEXT,
  "profissao" TEXT,
  "nome_mae_assistido" TEXT,
  "nome_pai_assistido" TEXT,
  "nome_mae_representante" TEXT,
  "nome_pai_representante" TEXT,
  "endereco_assistido" TEXT,
  "telefone_assistido" TEXT,
  "email_assistido" TEXT,
  "nome_requerido" TEXT,
  "cpf_requerido" TEXT,
  "rg_requerido" TEXT,
  "emissor_rg_requerido" TEXT,
  "profissao_requerido" TEXT,
  "nome_mae_requerido" TEXT,
  "nome_pai_requerido" TEXT,
  "endereco_requerido" TEXT,
  "telefone_requerido" TEXT,
  "email_requerido" TEXT,
  "exequentes" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cpf_representante" TEXT,
  "emissor_rg_representante" TEXT,
  "estado_civil_representante" TEXT,
  "nacionalidade_representante" TEXT,
  "nome_representante" TEXT,
  "profissao_representante" TEXT,
  "rg_representante" TEXT,
  "nacionalidade" TEXT,
  "assistido_eh_incapaz" TEXT,
  "data_nascimento_assistido" TEXT,
  "data_nascimento_representante" TEXT,
  "data_nascimento_requerido" TEXT,
  "nacionalidade_requerido" TEXT,
  "estado_civil_requerido" TEXT,
  CONSTRAINT "casos_partes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "casos_juridico" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "caso_id" BIGINT NOT NULL,
  "numero_processo_titulo" TEXT,
  "percentual_salario" DECIMAL(5,2),
  "vencimento_dia" INTEGER,
  "periodo_inadimplencia" TEXT,
  "debito_valor" TEXT,
  "debito_extenso" TEXT,
  "debito_penhora_valor" TEXT,
  "debito_penhora_extenso" TEXT,
  "debito_prisao_valor" TEXT,
  "debito_prisao_extenso" TEXT,
  "dados_bancarios_deposito" TEXT,
  "conta_banco" TEXT,
  "conta_agencia" TEXT,
  "conta_operacao" TEXT,
  "conta_numero" TEXT,
  "empregador_nome" TEXT,
  "empregador_cnpj" TEXT,
  "empregador_endereco" TEXT,
  "empregador_email" TEXT,
  "memoria_calculo" TEXT,
  "descricao_guarda" TEXT,
  "opcao_guarda" TEXT,
  "bens_partilha" TEXT,
  "situacao_financeira_genitora" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cidade_assinatura" TEXT,
  "cidade_originaria" TEXT,
  "tipo_decisao" TEXT,
  "vara_originaria" TEXT,
  CONSTRAINT "casos_juridico_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "casos_ia" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "caso_id" BIGINT NOT NULL,
  "relato_texto" TEXT,
  "dados_extraidos" JSONB,
  "dos_fatos_gerado" TEXT,
  "resumo_ia" TEXT,
  "peticao_inicial_rascunho" TEXT,
  "peticao_completa_texto" TEXT,
  "url_peticao" TEXT,
  "url_peticao_penhora" TEXT,
  "url_peticao_prisao" TEXT,
  "versao_peticao" INTEGER NOT NULL DEFAULT 1,
  "regenerado_at" TIMESTAMPTZ(6),
  "regenerado_por" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "casos_ia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documentos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "caso_id" BIGINT NOT NULL,
  "storage_path" TEXT NOT NULL,
  "nome_original" TEXT,
  "tipo" TEXT,
  "tamanho_bytes" BIGINT,
  "tamanho_original_bytes" BIGINT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- LOGS, COLABORACAO, CONFIGURACOES E NOTIFICACOES
-- ============================================================================

CREATE TABLE "logs_auditoria" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "usuario_id" UUID,
  "caso_id" BIGINT,
  "acao" TEXT NOT NULL,
  "detalhes" JSONB,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now()),
  "entidade" TEXT,
  "registro_id" TEXT,
  CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "logs_pipeline" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "caso_id" BIGINT NOT NULL,
  "job_tentativa" INTEGER NOT NULL DEFAULT 1,
  "etapa" "etapa_pipeline" NOT NULL,
  "status" TEXT NOT NULL,
  "duracao_ms" INTEGER,
  "detalhes" JSONB,
  "erro_mensagem" TEXT,
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now()),
  CONSTRAINT "logs_pipeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assistencia_casos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "caso_id" BIGINT NOT NULL,
  "remetente_id" UUID NOT NULL,
  "destinatario_id" UUID NOT NULL,
  "status" "status_assistencia" NOT NULL DEFAULT 'pendente',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assistencia_casos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "configuracoes_sistema" (
  "chave" VARCHAR(100) NOT NULL,
  "valor" TEXT NOT NULL,
  "descricao" TEXT,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "configuracoes_sistema_pkey" PRIMARY KEY ("chave")
);

CREATE TABLE "notificacoes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "usuario_id" UUID NOT NULL,
  "titulo" TEXT,
  "mensagem" TEXT NOT NULL,
  "lida" BOOLEAN NOT NULL DEFAULT false,
  "tipo" TEXT,
  "link" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "referencia_id" UUID,
  CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- UNIQUE INDEXES
-- ============================================================================

CREATE UNIQUE INDEX "cargos_nome_key" ON "cargos"("nome");
CREATE UNIQUE INDEX "permissoes_chave_key" ON "permissoes"("chave");
CREATE UNIQUE INDEX "defensores_supabase_uid_key" ON "defensores"("supabase_uid");
CREATE UNIQUE INDEX "defensores_email_key" ON "defensores"("email");
CREATE UNIQUE INDEX "casos_protocolo_key" ON "casos"("protocolo");
CREATE UNIQUE INDEX "casos_partes_caso_id_key" ON "casos_partes"("caso_id");
CREATE UNIQUE INDEX "casos_juridico_caso_id_key" ON "casos_juridico"("caso_id");
CREATE UNIQUE INDEX "casos_ia_caso_id_key" ON "casos_ia"("caso_id");

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX "idx_casos_protocolo" ON "casos"("protocolo");
CREATE INDEX "idx_casos_status" ON "casos"("status");
CREATE INDEX "idx_casos_unidade" ON "casos"("unidade_id");
CREATE INDEX "idx_casos_tipo" ON "casos"("tipo_acao");
CREATE INDEX "idx_casos_status_job" ON "casos"("status_job");
CREATE INDEX "idx_casos_servidor" ON "casos"("servidor_id", "status");
CREATE INDEX "idx_casos_defensor" ON "casos"("defensor_id", "status");
CREATE INDEX "idx_casos_servidor_at" ON "casos"("servidor_at");
CREATE INDEX "idx_casos_defensor_at" ON "casos"("defensor_at");
CREATE INDEX "idx_casos_protocolado_at" ON "casos"("protocolado_at");
CREATE INDEX "idx_casos_created_at" ON "casos"("created_at");
CREATE INDEX "idx_casos_arquivado" ON "casos"("arquivado");
CREATE INDEX "idx_casos_bi_status" ON "casos"("arquivado", "status");
CREATE INDEX "idx_casos_bi_unidade_status" ON "casos"("arquivado", "unidade_id", "status");
CREATE INDEX "idx_casos_bi_tipo" ON "casos"("arquivado", "tipo_acao");
CREATE INDEX "idx_casos_bi_processed_at" ON "casos"("processed_at");
CREATE INDEX "idx_casos_cpf" ON "casos_partes"("cpf_assistido");
CREATE INDEX "idx_casos_cpf_rep" ON "casos_partes"("cpf_representante");
CREATE INDEX "idx_partes_caso" ON "casos_partes"("caso_id");
CREATE INDEX "idx_casos_ia_caso" ON "casos_ia"("caso_id");
CREATE INDEX "idx_docs_caso" ON "documentos"("caso_id");
CREATE INDEX "idx_logs_auditoria_caso" ON "logs_auditoria"("caso_id");
CREATE INDEX "idx_logs_auditoria_user" ON "logs_auditoria"("usuario_id");
CREATE INDEX "idx_logs_auditoria_acao" ON "logs_auditoria"("acao");
CREATE INDEX "idx_logs_auditoria_entidade_data" ON "logs_auditoria"("entidade", "criado_em");
CREATE INDEX "idx_logs_auditoria_caso_acao" ON "logs_auditoria"("caso_id", "acao");
CREATE INDEX "idx_logs_pipeline_caso" ON "logs_pipeline"("caso_id");
CREATE INDEX "idx_logs_pipeline_etapa" ON "logs_pipeline"("etapa", "status");
CREATE INDEX "idx_logs_pipeline_tempo" ON "logs_pipeline"("criado_em");
CREATE INDEX "assistencia_casos_caso_id_idx" ON "assistencia_casos"("caso_id");
CREATE INDEX "assistencia_casos_destinatario_id_idx" ON "assistencia_casos"("destinatario_id");
CREATE INDEX "notificacoes_usuario_id_idx" ON "notificacoes"("usuario_id");

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

ALTER TABLE "cargo_permissoes"
  ADD CONSTRAINT "cargo_permissoes_cargo_id_fkey"
  FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "cargo_permissoes"
  ADD CONSTRAINT "cargo_permissoes_permissao_id_fkey"
  FOREIGN KEY ("permissao_id") REFERENCES "permissoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "defensores"
  ADD CONSTRAINT "defensores_cargo_id_fkey"
  FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "defensores"
  ADD CONSTRAINT "defensores_unidade_id_fkey"
  FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "casos"
  ADD CONSTRAINT "casos_criado_por_fkey"
  FOREIGN KEY ("criado_por") REFERENCES "defensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "casos"
  ADD CONSTRAINT "casos_defensor_id_fkey"
  FOREIGN KEY ("defensor_id") REFERENCES "defensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "casos"
  ADD CONSTRAINT "casos_servidor_id_fkey"
  FOREIGN KEY ("servidor_id") REFERENCES "defensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "casos"
  ADD CONSTRAINT "casos_unidade_id_fkey"
  FOREIGN KEY ("unidade_id") REFERENCES "unidades"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "casos_partes"
  ADD CONSTRAINT "casos_partes_caso_id_fkey"
  FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "casos_juridico"
  ADD CONSTRAINT "casos_juridico_caso_id_fkey"
  FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "casos_ia"
  ADD CONSTRAINT "casos_ia_caso_id_fkey"
  FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "casos_ia"
  ADD CONSTRAINT "casos_ia_regenerado_por_fkey"
  FOREIGN KEY ("regenerado_por") REFERENCES "defensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "documentos"
  ADD CONSTRAINT "documentos_caso_id_fkey"
  FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "logs_auditoria"
  ADD CONSTRAINT "logs_auditoria_caso_id_fkey"
  FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "logs_auditoria"
  ADD CONSTRAINT "logs_auditoria_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "defensores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "logs_pipeline"
  ADD CONSTRAINT "logs_pipeline_caso_id_fkey"
  FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "assistencia_casos"
  ADD CONSTRAINT "assistencia_casos_caso_id_fkey"
  FOREIGN KEY ("caso_id") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistencia_casos"
  ADD CONSTRAINT "assistencia_casos_destinatario_id_fkey"
  FOREIGN KEY ("destinatario_id") REFERENCES "defensores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assistencia_casos"
  ADD CONSTRAINT "assistencia_casos_remetente_id_fkey"
  FOREIGN KEY ("remetente_id") REFERENCES "defensores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notificacoes"
  ADD CONSTRAINT "notificacoes_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "defensores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- DADOS INICIAIS MINIMOS
-- ============================================================================

INSERT INTO "cargos" ("nome", "descricao") VALUES
  ('admin', 'Administrador do sistema'),
  ('gestor', 'Gestor com acesso global operacional'),
  ('coordenador', 'Coordenador regional'),
  ('defensor', 'Defensor publico'),
  ('servidor', 'Servidor juridico'),
  ('estagiario', 'Estagiario'),
  ('visualizador', 'Perfil de leitura')
ON CONFLICT ("nome") DO NOTHING;

INSERT INTO "permissoes" ("chave", "descricao") VALUES
  ('atender_caso', 'Pode atender e assumir casos'),
  ('protocolar_caso', 'Pode protocolar casos no SOLAR/SIGAD'),
  ('gerenciar_equipe', 'Pode ver e gerenciar membros da equipe')
ON CONFLICT ("chave") DO NOTHING;

INSERT INTO "cargo_permissoes" ("cargo_id", "permissao_id")
SELECT c."id", p."id"
FROM "cargos" c
CROSS JOIN "permissoes" p
WHERE c."nome" IN ('admin', 'gestor', 'coordenador', 'defensor', 'servidor', 'estagiario')
  AND NOT (
    c."nome" IN ('servidor', 'estagiario') AND p."chave" = 'protocolar_caso'
  )
  AND NOT (
    c."nome" IN ('gestor', 'coordenador', 'defensor', 'servidor', 'estagiario') AND p."chave" = 'gerenciar_equipe'
  )
ON CONFLICT ("cargo_id", "permissao_id") DO NOTHING;

INSERT INTO "unidades" ("nome", "comarca", "sistema", "ativo", "regional")
SELECT 'Sede Central - Mutirao', 'Sede Central', 'solar', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "unidades"
  WHERE "nome" = 'Sede Central - Mutirao'
    AND "comarca" = 'Sede Central'
);

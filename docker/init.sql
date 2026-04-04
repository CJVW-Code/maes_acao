-- ══════════════════════════════════════════════════════════════════════════
-- MÃES EM AÇÃO — SCHEMA COMPLETO v1.0
-- DPE-BA · Mutirão Estadual · Maio 2026
-- ══════════════════════════════════════════════════════════════════════════
-- Executado automaticamente pelo PostgreSQL no primeiro docker compose up


-- ───────────────────────────────────────────────────────────────────────────
-- 1. TIPOS
-- ───────────────────────────────────────────────────────────────────────────

-- Status do caso — transições controladas pelo backend
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

-- Status interno do job de IA
CREATE TYPE status_job AS ENUM (
  'pendente',
  'processando',
  'concluido',
  'erro'
);

-- Tipo de ação jurídica
CREATE TYPE tipo_acao AS ENUM (
  'exec_penhora',
  'exec_prisao',
  'exec_cumulado',
  'def_penhora',
  'def_prisao',
  'def_cumulado',
  'fixacao_alimentos',
  'alimentos_gravidicos'
);

-- Sistema judicial da sede
CREATE TYPE sistema_judicial AS ENUM (
  'solar',
  'sigad'
);

-- Etapa do pipeline de IA
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


-- ───────────────────────────────────────────────────────────────────────────
-- 2. RBAC
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE cargos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL UNIQUE,
  descricao   text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissoes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave     text NOT NULL UNIQUE,
  descricao text NOT NULL
);

CREATE TABLE cargo_permissoes (
  cargo_id      uuid NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  permissao_id  uuid NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
  PRIMARY KEY (cargo_id, permissao_id)
);


-- ───────────────────────────────────────────────────────────────────────────
-- 3. TABELAS BASE
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE unidades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  comarca     text NOT NULL,
  sistema     sistema_judicial NOT NULL DEFAULT 'solar',
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE defensores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  email       text NOT NULL UNIQUE,
  senha_hash  text NOT NULL,
  cargo_id    uuid NOT NULL REFERENCES cargos(id),
  unidade_id  uuid REFERENCES unidades(id),
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 4. CASOS
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE casos (
  id                    bigserial PRIMARY KEY,
  protocolo             text NOT NULL UNIQUE,
  unidade_id            uuid NOT NULL REFERENCES unidades(id),
  tipo_acao             tipo_acao NOT NULL,
  status                status_caso NOT NULL DEFAULT 'aguardando_documentos',
  numero_vara           text,
  servidor_id           uuid REFERENCES defensores(id),
  servidor_at           timestamptz,
  defensor_id           uuid REFERENCES defensores(id),
  defensor_at           timestamptz,
  numero_processo       text,
  url_capa              text,
  protocolado_at        timestamptz,
  status_job            status_job DEFAULT 'pendente',
  erro_processamento    text,
  retry_count           integer NOT NULL DEFAULT 0,
  last_retry_at         timestamptz,
  processed_at          timestamptz,
  arquivado             boolean NOT NULL DEFAULT false,
  motivo_arquivamento   text,
  criado_por            uuid REFERENCES defensores(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 5. TABELAS FILHAS
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE casos_partes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                 bigint NOT NULL UNIQUE REFERENCES casos(id) ON DELETE CASCADE,
  nome_assistido          text NOT NULL,
  cpf_assistido           text NOT NULL,
  rg_assistido            text,
  emissor_rg_assistido    text,
  estado_civil            text,
  profissao               text,
  nome_mae_assistido      text,
  nome_pai_assistido      text,
  nome_mae_representante  text,
  nome_pai_representante  text,
  endereco_assistido      text,
  telefone_assistido      text,
  email_assistido         text,
  nome_requerido          text,
  cpf_requerido           text,
  rg_requerido            text,
  emissor_rg_requerido    text,
  profissao_requerido     text,
  nome_mae_requerido      text,
  nome_pai_requerido      text,
  endereco_requerido      text,
  telefone_requerido      text,
  email_requerido         text,
  exequentes              jsonb NOT NULL DEFAULT '[]',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE casos_juridico (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                     bigint NOT NULL UNIQUE REFERENCES casos(id) ON DELETE CASCADE,
  numero_processo_titulo      text,
  percentual_salario          numeric(5,2),
  vencimento_dia              integer,
  periodo_inadimplencia       text,
  debito_valor                text,
  debito_extenso              text,
  debito_penhora_valor        text,
  debito_penhora_extenso      text,
  debito_prisao_valor         text,
  debito_prisao_extenso       text,
  conta_banco                 text,
  conta_agencia               text,
  conta_operacao              text,
  conta_numero                text,
  empregador_nome             text,
  empregador_cnpj             text,
  empregador_endereco         text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE casos_ia (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                 bigint NOT NULL UNIQUE REFERENCES casos(id) ON DELETE CASCADE,
  relato_texto            text,
  dados_extraidos         jsonb,
  dos_fatos_gerado        text,
  peticao_completa_texto  text,
  url_peticao             text,
  versao_peticao          integer NOT NULL DEFAULT 1,
  regenerado_at           timestamptz,
  regenerado_por          uuid REFERENCES defensores(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE documentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id         bigint NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  nome_original   text,
  tipo            text,
  tamanho_bytes   bigint,
  tamanho_original_bytes bigint,
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 6. LOGS
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE logs_auditoria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid REFERENCES defensores(id),
  caso_id     bigint REFERENCES casos(id),
  acao        text NOT NULL,
  detalhes    jsonb,
  criado_em   timestamptz NOT NULL
                DEFAULT timezone('America/Sao_Paulo', now())
);

CREATE TABLE logs_pipeline (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id         bigint NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  job_tentativa   integer NOT NULL DEFAULT 1,
  etapa           etapa_pipeline NOT NULL,
  status          text NOT NULL,
  duracao_ms      integer,
  detalhes        jsonb,
  erro_mensagem   text,
  criado_em       timestamptz NOT NULL
                    DEFAULT timezone('America/Sao_Paulo', now())
);


-- ───────────────────────────────────────────────────────────────────────────
-- 7. VIEWS
-- ───────────────────────────────────────────────────────────────────────────

CREATE VIEW vw_analise_status AS
SELECT
  status,
  COUNT(*)                                    AS total,
  COUNT(*) FILTER (WHERE arquivado = false)   AS ativos,
  MIN(created_at)                             AS primeiro_caso,
  MAX(updated_at)                             AS ultima_atualizacao
FROM casos
GROUP BY status
ORDER BY total DESC;

CREATE VIEW vw_analise_por_sede AS
SELECT
  u.nome                                        AS sede,
  u.comarca,
  COUNT(c.id)                                   AS total_casos,
  COUNT(c.id) FILTER (WHERE c.status = 'aguardando_documentos')    AS aguardando_docs,
  COUNT(c.id) FILTER (WHERE c.status = 'pronto_para_analise')      AS fila_atendimento,
  COUNT(c.id) FILTER (WHERE c.status = 'em_atendimento')           AS em_atendimento,
  COUNT(c.id) FILTER (WHERE c.status = 'liberado_para_protocolo')  AS fila_protocolo,
  COUNT(c.id) FILTER (WHERE c.status = 'protocolado')              AS protocolados,
  COUNT(c.id) FILTER (WHERE c.status = 'erro_processamento')       AS com_erro,
  ROUND(
    COUNT(c.id) FILTER (WHERE c.status = 'protocolado') * 100.0
    / NULLIF(COUNT(c.id), 0), 1
  )                                             AS pct_conclusao
FROM unidades u
LEFT JOIN casos c ON c.unidade_id = u.id
WHERE u.ativo = true
GROUP BY u.id, u.nome, u.comarca
ORDER BY total_casos DESC;

CREATE VIEW vw_analise_erros AS
SELECT
  c.id,
  c.protocolo,
  u.nome                  AS sede,
  c.tipo_acao,
  c.retry_count,
  c.last_retry_at,
  c.erro_processamento,
  c.created_at,
  lp.etapa                AS ultima_etapa_pipeline,
  lp.erro_mensagem        AS ultimo_erro_pipeline
FROM casos c
JOIN unidades u ON c.unidade_id = u.id
LEFT JOIN LATERAL (
  SELECT etapa, erro_mensagem
  FROM logs_pipeline
  WHERE caso_id = c.id
  ORDER BY criado_em DESC
  LIMIT 1
) lp ON true
WHERE c.status = 'erro_processamento'
ORDER BY c.retry_count DESC, c.last_retry_at ASC;

CREATE VIEW vw_analise_pipeline AS
SELECT
  etapa,
  status,
  COUNT(*)                              AS total_execucoes,
  COUNT(*) FILTER (WHERE status = 'erro') AS total_erros,
  ROUND(AVG(duracao_ms))                AS media_ms,
  MAX(duracao_ms)                       AS max_ms,
  MIN(duracao_ms) FILTER (WHERE status = 'concluido') AS min_ms,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'erro') * 100.0
    / NULLIF(COUNT(*), 0), 1
  )                                     AS pct_erro
FROM logs_pipeline
GROUP BY etapa, status
ORDER BY etapa, status;

CREATE VIEW vw_analise_por_usuario AS
SELECT
  d.nome                                                            AS usuario,
  c_cargo.nome                                                      AS cargo,
  u.nome                                                            AS sede,
  COUNT(c.id) FILTER (WHERE c.servidor_id = d.id)                  AS casos_atendidos,
  COUNT(c.id) FILTER (WHERE c.defensor_id = d.id
                        AND c.status = 'protocolado')               AS casos_protocolados,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (c.updated_at - c.servidor_at)) / 60
  ) FILTER (WHERE c.servidor_id = d.id), 1)                        AS tempo_medio_atendimento_min
FROM defensores d
JOIN cargos c_cargo ON d.cargo_id = c_cargo.id
LEFT JOIN unidades u ON d.unidade_id = u.id
LEFT JOIN casos c ON c.servidor_id = d.id OR c.defensor_id = d.id
WHERE d.ativo = true
GROUP BY d.id, d.nome, c_cargo.nome, u.nome
ORDER BY casos_protocolados DESC;

CREATE VIEW vw_analise_tempo_fluxo AS
SELECT
  ROUND(AVG(
    EXTRACT(EPOCH FROM (processed_at - created_at)) / 60
  ), 1)                           AS tempo_medio_triagem_ia_min,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (protocolado_at - processed_at)) / 60
  ), 1)                           AS tempo_medio_ia_protocolo_min,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (protocolado_at - created_at)) / 60
  ), 1)                           AS tempo_medio_total_min,
  COUNT(*) FILTER (WHERE status = 'protocolado')  AS total_protocolados,
  COUNT(*)                                        AS total_casos
FROM casos;

CREATE VIEW vw_divulgacao_resumo AS
SELECT
  COUNT(DISTINCT cp.cpf_assistido)                            AS assistidas_unicas,
  COUNT(c.id)                                                 AS total_casos_registrados,
  COUNT(c.id) FILTER (WHERE c.status = 'protocolado')         AS peticoes_protocoladas,
  COUNT(DISTINCT c.unidade_id)
    FILTER (WHERE c.status = 'protocolado')                   AS sedes_com_protocolo,
  COUNT(DISTINCT c.tipo_acao)                                 AS tipos_acao_utilizados,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (c.protocolado_at - c.created_at)) / 60
  ) FILTER (WHERE c.status = 'protocolado'), 0)               AS tempo_medio_atendimento_min,
  MIN(c.created_at)                                           AS inicio_mutirao,
  MAX(c.protocolado_at) FILTER (WHERE c.status = 'protocolado') AS ultimo_protocolo
FROM casos c
LEFT JOIN casos_partes cp ON cp.caso_id = c.id;

CREATE VIEW vw_divulgacao_por_sede AS
SELECT
  u.nome                                                        AS sede,
  u.comarca,
  COUNT(c.id)                                                   AS casos_registrados,
  COUNT(c.id) FILTER (WHERE c.status = 'protocolado')           AS peticoes_protocoladas,
  ROUND(
    COUNT(c.id) FILTER (WHERE c.status = 'protocolado') * 100.0
    / NULLIF(COUNT(c.id), 0), 1
  )                                                             AS pct_conclusao
FROM unidades u
LEFT JOIN casos c ON c.unidade_id = u.id
WHERE u.ativo = true
GROUP BY u.id, u.nome, u.comarca
ORDER BY peticoes_protocoladas DESC;

CREATE VIEW vw_divulgacao_por_acao AS
SELECT
  tipo_acao,
  COUNT(*)                                                AS total,
  COUNT(*) FILTER (WHERE status = 'protocolado')          AS protocolados,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'protocolado') * 100.0
    / NULLIF(COUNT(*), 0), 1
  )                                                       AS pct_conclusao
FROM casos
GROUP BY tipo_acao
ORDER BY total DESC;


-- ───────────────────────────────────────────────────────────────────────────
-- 8. ÍNDICES
-- ───────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_casos_protocolo      ON casos (protocolo);
CREATE INDEX idx_casos_status         ON casos (status);
CREATE INDEX idx_casos_unidade        ON casos (unidade_id);
CREATE INDEX idx_casos_tipo_acao      ON casos (tipo_acao);
CREATE INDEX idx_casos_status_job     ON casos (status_job);
CREATE INDEX idx_casos_servidor       ON casos (servidor_id, status);
CREATE INDEX idx_casos_defensor       ON casos (defensor_id, status);
CREATE INDEX idx_casos_servidor_at    ON casos (servidor_at);
CREATE INDEX idx_casos_defensor_at    ON casos (defensor_at);
CREATE INDEX idx_partes_cpf           ON casos_partes (cpf_assistido);
CREATE INDEX idx_partes_caso          ON casos_partes (caso_id);
CREATE INDEX idx_documentos_caso      ON documentos (caso_id);
CREATE INDEX idx_casos_ia_caso        ON casos_ia (caso_id);
CREATE INDEX idx_logs_auditoria_caso  ON logs_auditoria (caso_id);
CREATE INDEX idx_logs_auditoria_user  ON logs_auditoria (usuario_id);
CREATE INDEX idx_logs_auditoria_acao  ON logs_auditoria (acao);
CREATE INDEX idx_logs_pipeline_caso   ON logs_pipeline (caso_id);
CREATE INDEX idx_logs_pipeline_etapa  ON logs_pipeline (etapa, status);
CREATE INDEX idx_logs_pipeline_tempo  ON logs_pipeline (criado_em);
CREATE INDEX idx_casos_protocolado_at ON casos (protocolado_at);
CREATE INDEX idx_casos_created_at     ON casos (created_at);
CREATE INDEX idx_casos_arquivado      ON casos (arquivado);


-- ───────────────────────────────────────────────────────────────────────────
-- 9. TRIGGERS
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_casos_updated_at
  BEFORE UPDATE ON casos
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_defensores_updated_at
  BEFORE UPDATE ON defensores
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_partes_updated_at
  BEFORE UPDATE ON casos_partes
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_juridico_updated_at
  BEFORE UPDATE ON casos_juridico
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_ia_updated_at
  BEFORE UPDATE ON casos_ia
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- 10. DADOS INICIAIS — RBAC
-- ───────────────────────────────────────────────────────────────────────────

INSERT INTO permissoes (chave, descricao) VALUES
  ('casos:criar',           'Criar novo caso na triagem'),
  ('casos:buscar',          'Buscar caso por CPF ou protocolo'),
  ('casos:ver_unidade',     'Ver casos da própria unidade'),
  ('casos:ver_todos',       'Ver casos de todas as unidades'),
  ('casos:atribuir',        'Atribuir caso ao próprio nome (locking nível 1)'),
  ('casos:liberar',         'Liberar caso para protocolo'),
  ('casos:protocolar',      'Protocolar caso (locking nível 2)'),
  ('casos:arquivar',        'Arquivar um caso'),
  ('docs:upload',           'Enviar documentos via scanner'),
  ('docs:ver',              'Visualizar documentos de um caso'),
  ('ia:reprocessar',        'Reprocessar caso com erro de IA'),
  ('ia:regenerar',          'Regenerar DOS FATOS de um caso'),
  ('usuarios:gerenciar',    'Criar, editar e desativar usuários'),
  ('relatorios:ver',        'Acessar relatórios de análise e divulgação'),
  ('relatorios:exportar',   'Exportar relatórios em CSV/PDF');

INSERT INTO cargos (nome, descricao) VALUES
  ('atendente', 'Atendente primário — triagem e scanner'),
  ('servidor',  'Servidor jurídico — atendimento e revisão de peças'),
  ('defensor',  'Defensor público — protocolo e atendimento'),
  ('admin',     'Administrador do sistema');

-- Permissões por cargo
INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'atendente'
  AND p.chave IN ('casos:criar', 'casos:buscar', 'docs:upload', 'docs:ver');

INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'servidor'
  AND p.chave IN (
    'casos:buscar', 'casos:ver_unidade', 'casos:atribuir',
    'casos:liberar', 'docs:ver', 'ia:regenerar'
  );

INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'defensor'
  AND p.chave IN (
    'casos:buscar', 'casos:ver_unidade', 'casos:atribuir',
    'casos:liberar', 'casos:protocolar', 'docs:ver',
    'ia:regenerar', 'relatorios:ver'
  );

INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'admin';

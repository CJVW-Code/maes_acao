-- ═══════════════════════════════════════════════════════════════════════════
-- MÃES EM AÇÃO — SCHEMA COMPLETO v1.0
-- DPE-BA · Mutirão Estadual · Maio 2025
-- ═══════════════════════════════════════════════════════════════════════════
-- Ordem de execução:
-- 1. Tipos e enums
-- 2. Tabelas base (sem FK)
-- 3. Tabelas dependentes
-- 4. Tabelas filhas de casos
-- 5. Logs e auditoria
-- 6. Views de relatório
-- 7. Índices
-- 8. Triggers
-- ═══════════════════════════════════════════════════════════════════════════


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
  'exec_penhora',          -- Execução de Alimentos Provisórios — Rito da Penhora
  'exec_prisao',           -- Execução de Alimentos Provisórios — Rito da Prisão
  'exec_cumulado',         -- Execução Provisória — Rito da Prisão e Penhora
  'def_penhora',           -- Cumprimento de Sentença — Rito da Penhora
  'def_prisao',            -- Cumprimento de Sentença — Rito da Prisão
  'def_cumulado',          -- Cumprimento de Sentença — Rito da Prisão e Penhora
  'fixacao_alimentos',     -- Fixação de Alimentos
  'alimentos_gravidicos'   -- Alimentos Gravídicos
);

-- Sistema judicial da sede
CREATE TYPE sistema_judicial AS ENUM (
  'solar',   -- padrão na maioria das sedes
  'sigad'    -- Salvador usa SIGAD no mutirão
);

-- Etapa do pipeline de IA — para log granular
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
-- 2. RBAC — CONTROLE DE ACESSO FLEXÍVEL
-- ───────────────────────────────────────────────────────────────────────────

-- Tabela de cargos — adicione novos cargos aqui sem tocar no código
CREATE TABLE cargos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL UNIQUE,
  -- 'atendente' | 'servidor' | 'defensor' | 'admin' | futuros...
  descricao   text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Permissões disponíveis no sistema
CREATE TABLE permissoes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave     text NOT NULL UNIQUE,
  -- ex: 'casos:criar' | 'casos:ver_todos' | 'casos:protocolar'
  --     'docs:upload' | 'ia:reprocessar' | 'usuarios:gerenciar'
  --     'relatorios:ver' | 'relatorios:exportar'
  descricao text NOT NULL
);

-- Vínculo cargo ↔ permissões (N:N)
CREATE TABLE cargo_permissoes (
  cargo_id      uuid NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  permissao_id  uuid NOT NULL REFERENCES permissoes(id) ON DELETE CASCADE,
  PRIMARY KEY (cargo_id, permissao_id)
);


-- ───────────────────────────────────────────────────────────────────────────
-- 3. TABELAS BASE
-- ───────────────────────────────────────────────────────────────────────────

-- Sedes da DPE-BA
CREATE TABLE unidades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  -- ex: 'Núcleo de Teixeira de Freitas'
  comarca     text NOT NULL,
  -- ex: 'Teixeira de Freitas' — usado no template como {CIDADE}
  sistema     sistema_judicial NOT NULL DEFAULT 'solar',
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Usuários do sistema (todos os perfis)
CREATE TABLE defensores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_uid text UNIQUE,
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
-- 4. CASOS — NÚCLEO
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE casos (
  id                    bigserial PRIMARY KEY,
  protocolo             text NOT NULL UNIQUE,
  unidade_id            uuid NOT NULL REFERENCES unidades(id),
  tipo_acao             tipo_acao NOT NULL,
  status                status_caso NOT NULL DEFAULT 'aguardando_documentos',

  -- Vara — informada pelo servidor na triagem (varia por caso)
  numero_vara           text,
  -- ex: '1ª', '2ª', '7ª' — usado no template como {NUMERO_VARA}

  -- Locking nível 1: servidor jurídico (atendimento)
  servidor_id           uuid REFERENCES defensores(id),
  servidor_at           timestamptz,

  -- Locking nível 2: defensor (protocolo)
  defensor_id           uuid REFERENCES defensores(id),
  defensor_at           timestamptz,

  -- Resultado do protocolo
  numero_processo       text,
  url_capa              text,
  url_capa_processual   text,
  chave_acesso_hash     text,
  -- path no Storage — nunca URL pública
  protocolado_at        timestamptz,

  -- Pipeline de IA
  status_job            status_job DEFAULT 'pendente',
  erro_processamento    text,
  retry_count           integer NOT NULL DEFAULT 0,
  last_retry_at         timestamptz,
  processed_at          timestamptz,

  -- Controle
  arquivado             boolean NOT NULL DEFAULT false,
  motivo_arquivamento   text,

  -- Agendamento e Pendências
  agendamento_data            timestamptz,
  agendamento_link            text,
  agendamento_status          text,
  motivo_reagendamento        text,
  data_sugerida_reagendamento text,
  feedback                    text,
  descricao_pendencia         text,

  -- Rastreabilidade de criação
  criado_por            uuid REFERENCES defensores(id),
  -- quem fez o cadastro na triagem

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 5. TABELAS FILHAS DE CASOS (1:1)
-- ───────────────────────────────────────────────────────────────────────────

-- Qualificação completa das partes
CREATE TABLE casos_partes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                 bigint NOT NULL UNIQUE REFERENCES casos(id) ON DELETE CASCADE,

  -- Assistida / representante legal
  nome_assistido          text NOT NULL,
  cpf_assistido           text NOT NULL,
  rg_assistido            text,
  emissor_rg_assistido    text,
  -- ex: 'SSP/BA'
  estado_civil            text,
  profissao               text,
  -- {emprego_exequente} no template exec_penhora
  nome_mae_assistido      text,
  -- filiação da assistida (para qualificação)
  nome_pai_assistido      text,
  nome_mae_representante  text,
  -- {nome_mae_representante} no template — pode ser diferente
  nome_pai_representante  text,
  -- {nome_pai_representante} no template
  endereco_assistido      text,
  telefone_assistido      text,
  email_assistido         text,

  -- Requerido / executado
  nome_requerido          text,
  cpf_requerido           text,
  rg_requerido            text,
  emissor_rg_requerido    text,
  profissao_requerido     text,
  -- {emprego_executado} no template
  nome_mae_requerido      text,
  nome_pai_requerido      text,
  endereco_requerido      text,
  telefone_requerido      text,
  email_requerido         text,

  -- Filhos / exequentes (array — suporta múltiplos)
  exequentes              jsonb NOT NULL DEFAULT '[]',
  -- estrutura: [{ "nome": "NOME COMPLETO", "nascimento": "DD/MM/AAAA" }]
  -- {#lista_filhos}{NOME_EXEQUENTE} nascido(a) em {data_nascimento_exequente}{/lista_filhos}

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Dados jurídicos específicos da ação
CREATE TABLE casos_juridico (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                     bigint NOT NULL UNIQUE REFERENCES casos(id) ON DELETE CASCADE,

  -- Título executivo
  numero_processo_titulo      text,
  -- {numero_processo} no template

  -- Obrigação alimentar
  percentual_salario          numeric(5,2),
  -- ex: 32.00 → renderiza como "32" no template {porcetagem_salario}
  vencimento_dia              integer,
  -- ex: 5 → "dia 5 de cada mês" {data_pagamento}
  periodo_inadimplencia       text,
  -- ex: 'Jan/2018 a Dez/2024' {data_inadimplencia}

  -- Débito — campos separados para modelos simples e cumulados
  debito_valor                text,
  -- valor principal {valor_causa} — nos cumulados é o TOTAL
  debito_extenso              text,
  -- gerado pelo backend automaticamente
  debito_penhora_valor        text,
  -- {valor_debito_penhora} — só nos modelos cumulados
  debito_penhora_extenso      text,
  debito_prisao_valor         text,
  -- {valor_debito_prisao} — só nos modelos cumulados
  debito_prisao_extenso       text,

  -- Conta bancária (campos separados → backend monta a string do template)
  conta_banco                 text,
  -- ex: 'CEF'
  conta_agencia               text,
  -- ex: '0618'
  conta_operacao              text,
  -- ex: '023'
  conta_numero                text,
  -- ex: '00015065-6 03/24'
  -- backend monta: "CEF, Ag. 0618, 023, C.c. 00015065-6 03/24" → {dados_conta}

  -- Empregador (para ofício desconto em folha — opcional)
  empregador_nome             text,
  empregador_cnpj             text,
  empregador_endereco         text,
  -- backend monta: "GRUPO BRASPE, CNPJ nº ..., Rua..." → {empregador_folha}

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Dados e outputs de IA
CREATE TABLE casos_ia (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id                 bigint NOT NULL UNIQUE REFERENCES casos(id) ON DELETE CASCADE,

  -- Input
  relato_texto            text,
  -- digitado pelo servidor na triagem

  -- Output do OCR (GPT-4o-mini)
  dados_extraidos         jsonb,
  -- dados extraídos dos documentos para conferência

  -- Output da redação (Groq)
  dos_fatos_gerado        text,
  -- seção "DOS FATOS" gerada pela IA

  resumo_ia               text,
  peticao_inicial_rascunho text,
  -- Petição final
  peticao_completa_texto  text,
  url_peticao             text,
  url_peticao_penhora     text,
  url_peticao_prisao      text,
  -- path no Storage — nunca URL pública

  -- Controle de versão (a cada "Regerar com IA")
  versao_peticao          integer NOT NULL DEFAULT 1,
  regenerado_at           timestamptz,
  regenerado_por          uuid REFERENCES defensores(id),

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Documentos enviados pelo scanner
CREATE TABLE documentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id         bigint NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  storage_path    text NOT NULL,
  -- path no Storage — nunca URL pública
  nome_original   text,
  tipo            text,
  -- 'rg' | 'cpf' | 'comprovante_renda' | 'decisao_judicial' | 'certidao_nascimento' | 'outro'
  tamanho_bytes   bigint,
  tamanho_original_bytes bigint,
  -- antes da compressão — para saber o quanto foi reduzido
  created_at      timestamptz NOT NULL DEFAULT now()
);


-- ───────────────────────────────────────────────────────────────────────────
-- 5.1. COLABORAÇÃO E NOTIFICAÇÕES
-- ───────────────────────────────────────────────────────────────────────────

CREATE TYPE status_assistencia AS ENUM ('pendente', 'aceito', 'recusado');

CREATE TABLE assistencia_casos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id         bigint NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  remetente_id    uuid NOT NULL REFERENCES defensores(id),
  destinatario_id uuid NOT NULL REFERENCES defensores(id),
  status          status_assistencia NOT NULL DEFAULT 'pendente',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notificacoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES defensores(id) ON DELETE CASCADE,
  titulo      text,
  mensagem    text NOT NULL,
  lida        boolean NOT NULL DEFAULT false,
  tipo        text,
  link        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- 6. LOGS — DOIS NÍVEIS
-- ───────────────────────────────────────────────────────────────────────────

-- Nível 1: Auditoria de ações humanas
-- "Quem fez o quê e quando" — rastreabilidade para gestão
CREATE TABLE logs_auditoria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid REFERENCES defensores(id),
  caso_id     bigint REFERENCES casos(id),
  acao        text NOT NULL,
  -- 'caso_criado'          → triagem registrou novo caso
  -- 'docs_enviados'        → scanner finalizou upload
  -- 'job_publicado'        → backend publicou no QStash
  -- 'caso_atribuido'       → servidor/defensor pegou o caso
  -- 'caso_liberado'        → servidor liberou para protocolo
  -- 'ia_regenerada'        → defensor clicou em Regerar
  -- 'protocolo_salvo'      → número do processo registrado
  -- 'lock_expirado'        → lock liberado por timeout
  -- 'unlock_manual'        → lock liberado manualmente
  -- 'reprocessamento'      → admin reprocessou caso com erro
  -- 'caso_arquivado'
  -- 'login' | 'logout'
  detalhes    jsonb,
  -- NUNCA salvar CPF, nome ou dados pessoais aqui
  -- apenas: { status_anterior, status_novo, campo_alterado, etc }
  criado_em   timestamptz NOT NULL
                DEFAULT timezone('America/Sao_Paulo', now())
);

-- Nível 2: Log granular do pipeline de IA
-- "O que aconteceu em cada etapa antes do erro" — para debug técnico
CREATE TABLE logs_pipeline (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id         bigint NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  job_tentativa   integer NOT NULL DEFAULT 1,
  -- incrementa a cada retry do QStash
  etapa           etapa_pipeline NOT NULL,
  status          text NOT NULL,
  -- 'iniciado' | 'concluido' | 'erro'
  duracao_ms      integer,
  -- tempo da etapa em milissegundos
  detalhes        jsonb,
  -- para 'ocr_gpt': { tokens_input, tokens_output, modelo }
  -- para 'geracao_dos_fatos': { tokens_input, tokens_output, temperatura }
  -- para 'merge_template': { template_usado, campos_preenchidos, campos_vazios }
  -- para 'upload_docx': { storage_path, tamanho_bytes }
  -- para erros: { codigo_erro, mensagem, stack (em dev) }
  erro_mensagem   text,
  -- mensagem limpa do erro — sem stack trace
  criado_em       timestamptz NOT NULL
                    DEFAULT timezone('America/Sao_Paulo', now())
);


-- ───────────────────────────────────────────────────────────────────────────
-- 7. VIEWS DE RELATÓRIO
-- ───────────────────────────────────────────────────────────────────────────

-- ── RELATÓRIO DE ANÁLISE (uso interno — granular) ──────────────────────────

-- Painel em tempo real: visão geral por status
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

-- Produtividade por sede — quantos casos em cada etapa
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

-- Fila de erros — casos com problema para reprocessamento
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
  -- última etapa registrada antes do erro
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

-- Performance do pipeline de IA por etapa
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

-- Produtividade por servidor/defensor
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

-- Tempo médio por etapa do fluxo (do caso ao protocolo)
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


-- ── RELATÓRIO DE DIVULGAÇÃO (público — impacto social) ─────────────────────

-- Números principais do mutirão — para press release e relatório oficial
CREATE VIEW vw_divulgacao_resumo AS
SELECT
  COUNT(DISTINCT cp.cpf_assistido)                            AS assistidas_unicas,
  -- conta pessoas únicas, não casos
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

-- Produtividade por sede — para divulgação (sem dados internos)
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

-- Distribuição por tipo de ação — para mostrar variedade de atendimentos
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

-- Buscas frequentes
CREATE INDEX idx_casos_protocolo      ON casos (protocolo);
CREATE INDEX idx_casos_status         ON casos (status);
CREATE INDEX idx_casos_unidade        ON casos (unidade_id);
CREATE INDEX idx_casos_tipo_acao      ON casos (tipo_acao);
CREATE INDEX idx_casos_status_job     ON casos (status_job);

-- Locking — queries de verificação e atribuição
CREATE INDEX idx_casos_servidor       ON casos (servidor_id, status);
CREATE INDEX idx_casos_defensor       ON casos (defensor_id, status);
CREATE INDEX idx_casos_servidor_at    ON casos (servidor_at);
CREATE INDEX idx_casos_defensor_at    ON casos (defensor_at);

-- Busca por CPF — query mais frequente do sistema
CREATE INDEX idx_partes_cpf           ON casos_partes (cpf_assistido);
CREATE INDEX idx_partes_caso          ON casos_partes (caso_id);

-- Documentos e IA
CREATE INDEX idx_documentos_caso      ON documentos (caso_id);
CREATE INDEX idx_casos_ia_caso        ON casos_ia (caso_id);

-- Logs — queries de debug e auditoria
CREATE INDEX idx_logs_auditoria_caso  ON logs_auditoria (caso_id);
CREATE INDEX idx_logs_auditoria_user  ON logs_auditoria (usuario_id);
CREATE INDEX idx_logs_auditoria_acao  ON logs_auditoria (acao);
CREATE INDEX idx_logs_pipeline_caso   ON logs_pipeline (caso_id);
CREATE INDEX idx_logs_pipeline_etapa  ON logs_pipeline (etapa, status);
CREATE INDEX idx_logs_pipeline_tempo  ON logs_pipeline (criado_em);

-- Relatórios — queries de agregação
CREATE INDEX idx_casos_protocolado_at ON casos (protocolado_at);
CREATE INDEX idx_casos_created_at     ON casos (created_at);
CREATE INDEX idx_casos_arquivado      ON casos (arquivado);


-- ───────────────────────────────────────────────────────────────────────────
-- 9. TRIGGERS
-- ───────────────────────────────────────────────────────────────────────────

-- updated_at automático
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

-- Permissões do sistema
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

-- Cargos base
INSERT INTO cargos (nome, descricao) VALUES
  ('atendente', 'Atendente primário — triagem e scanner'),
  ('servidor',  'Servidor jurídico — atendimento e revisão de peças'),
  ('defensor',  'Defensor público — protocolo e atendimento'),
  ('admin',     'Administrador do sistema');

-- Permissões por cargo
-- atendente: triagem e scanner
INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'atendente'
  AND p.chave IN ('casos:criar', 'casos:buscar', 'docs:upload', 'docs:ver');

-- servidor: atendimento jurídico
INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'servidor'
  AND p.chave IN (
    'casos:buscar', 'casos:ver_unidade', 'casos:atribuir',
    'casos:liberar', 'docs:ver', 'ia:regenerar'
  );

-- defensor: protocolo + tudo do servidor
INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'defensor'
  AND p.chave IN (
    'casos:buscar', 'casos:ver_unidade', 'casos:atribuir',
    'casos:liberar', 'casos:protocolar', 'docs:ver',
    'ia:regenerar', 'relatorios:ver'
  );

-- admin: tudo
INSERT INTO cargo_permissoes (cargo_id, permissao_id)
SELECT c.id, p.id FROM cargos c, permissoes p
WHERE c.nome = 'admin';

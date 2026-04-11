/* 
  ===========================================================================
  SCRIPT DE RESTAURAÇÃO COMPLETA — MÃES EM AÇÃO (DPE-BA)
  Unifica: RBAC, Onboarding Automático e Segurança RLS
  Versão: 2.0 (Supabase Ready)
  ===========================================================================
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ESTRUTURA BASE E RBAC (Cargos e Permissões)
-- ─────────────────────────────────────────────────────────────────────────────

-- Restaurar Cargos
INSERT INTO cargos (nome, descricao) VALUES
  ('atendente', 'Atendente primário — triagem e scanner'),
  ('servidor',  'Servidor jurídico — atendimento e revisão de peças'),
  ('defensor',  'Defensor público — protocolo e atendimento'),
  ('admin',     'Administrador do sistema')
ON CONFLICT (nome) DO NOTHING;

-- Restaurar Unidade Padrão
INSERT INTO unidades (nome, comarca, sistema) VALUES
  ('Sede Central - Mutirão', 'Sede Central', 'solar')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AUTOMAÇÃO DE ONBOARDING (Função + Trigger)
-- ─────────────────────────────────────────────────────────────────────────────

-- Função que cria o perfil em public.defensores ao criar um usuário no Auth
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_cargo_id uuid;
    default_unidade_id uuid;
BEGIN
    SELECT id INTO default_cargo_id FROM public.cargos WHERE nome = 'atendente' LIMIT 1;
    SELECT id INTO default_unidade_id FROM public.unidades LIMIT 1;

    INSERT INTO public.defensores (supabase_uid, email, nome, cargo_id, unidade_id, ativo)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 
        default_cargo_id, 
        default_unidade_id, 
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger disparado após inserção no Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SEGURANÇA — ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Funções Auxiliares (Security Definer para evitar recursão no RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.defensores d
    JOIN public.cargos c ON d.cargo_id = c.id
    WHERE d.supabase_uid::uuid = auth.uid()
    AND c.nome = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_unidade()
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT unidade_id FROM public.defensores WHERE supabase_uid::uuid = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ativar RLS em todas as tabelas sensíveis
ALTER TABLE casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos_partes ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE casos_juridico ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistencia_casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargo_permissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE defensores ENABLE ROW LEVEL SECURITY;

-- Limpar politicas antigas (Prevenção)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admin Tudo" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Leitura Geral Autenticada" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Ver Proprios Casos" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Ver Proprias Notificacoes" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Ver Proprias Assistencias" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Ver Casos da Unidade" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Ver Partes da Unidade" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Ver IA da Unidade" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Ver Juridico da Unidade" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Ver Documentos da Unidade" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Leitura Propria ou Admin" ON %I', t);
    END LOOP;
END $$;

-- Política Global: Admin pode TUDO
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name <> 'defensores' -- EVITA RECURSÃO INFINITA NA TABELA DE USUÁRIOS
    LOOP
        EXECUTE format('CREATE POLICY "Admin Tudo" ON %I FOR ALL TO authenticated USING (public.is_admin())', t);
    END LOOP;
END $$;

-- Política: Unidades e Cargos — Leitura para qualquer autenticado
CREATE POLICY "Leitura Geral Autenticada" ON unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura Geral Autenticada" ON cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura Geral Autenticada" ON permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leitura Geral Autenticada" ON cargo_permissoes FOR SELECT TO authenticated USING (true);

-- Admin pode ver e editar todos os defensores (A recursão é evitada pelo SECURITY DEFINER da função)
CREATE POLICY "Admin Tudo Defensores" ON defensores FOR ALL TO authenticated 
USING (public.is_admin());

-- Política: Casos — Somente da mesma unidade do defensor
CREATE POLICY "Ver Casos da Unidade" ON casos FOR SELECT TO authenticated 
USING (unidade_id = public.get_my_unidade());

CREATE POLICY "Ver Partes da Unidade" ON casos_partes FOR SELECT TO authenticated 
USING (caso_id IN (SELECT id FROM casos WHERE unidade_id = public.get_my_unidade()));

CREATE POLICY "Ver IA da Unidade" ON casos_ia FOR SELECT TO authenticated 
USING (caso_id IN (SELECT id FROM casos WHERE unidade_id = public.get_my_unidade()));

CREATE POLICY "Ver Juridico da Unidade" ON casos_juridico FOR SELECT TO authenticated 
USING (caso_id IN (SELECT id FROM casos WHERE unidade_id = public.get_my_unidade()));

CREATE POLICY "Ver Documentos da Unidade" ON documentos FOR SELECT TO authenticated 
USING (caso_id IN (SELECT id FROM casos WHERE unidade_id = public.get_my_unidade()));

-- Política: Notificações e Assistência (Proprietário)
CREATE POLICY "Ver Proprias Notificacoes" ON notificacoes FOR SELECT TO authenticated 
USING (usuario_id IN (SELECT id FROM defensores WHERE supabase_uid::uuid = auth.uid()));

CREATE POLICY "Ver Proprias Assistencias" ON assistencia_casos FOR SELECT TO authenticated 
USING (remetente_id IN (SELECT id FROM defensores WHERE supabase_uid::uuid = auth.uid()) OR destinatario_id IN (SELECT id FROM defensores WHERE supabase_uid::uuid = auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. FIX IMEDIATO — ACESSO ADMIN
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    admin_cargo_id uuid;
    central_unidade_id uuid;
BEGIN
    SELECT id INTO admin_cargo_id FROM public.cargos WHERE nome = 'admin' LIMIT 1;
    SELECT id INTO central_unidade_id FROM public.unidades LIMIT 1;

    INSERT INTO public.defensores (email, nome, cargo_id, unidade_id, ativo)
    VALUES ('weslleyc.dev@gmail.com', 'Weslley Admin', admin_cargo_id, central_unidade_id, true)
    ON CONFLICT (email) DO UPDATE 
    SET cargo_id = admin_cargo_id, ativo = true;
END $$;

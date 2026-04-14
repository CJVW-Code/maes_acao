# Plano de Ação: Evolução do Sistema de Gestão de Qualidade e Feedbacks (IA)

> **Objetivo:** Transformar o sistema de um simples "gerador de documentos" em uma Plataforma de Gestão de Eficiência, adicionando auditoria de IA, timeline do atendimento e dashboards para a gestão da Defensoria.

---

## 1. Banco de Dados (Supabase)

- [x] **Criar a tabela `interacoes_caso`:**
  - Executar script SQL no Supabase Editor para criar a tabela com os campos: `id`, `caso_id`, `autor_id`, `tipo`, `categoria`, `conteudo`, `visibilidade`, `metadata`, `created_at`.
  - Configurar Foreign Keys referenciando `casos(id)` e `defensores(id)`.
- [x] **Migração de Dados (Opcional):**
  - Mover os textos antigos da coluna `feedback` da tabela `casos` para a nova tabela `interacoes_caso` (como tipo "nota_expediente").
- [x] **Limpeza:**
  - Remover a coluna `feedback` da tabela `casos` (após garantir que tudo foi migrado).
- [x] **Segurança (RLS):**
  - Configurar Row Level Security no Supabase para garantir que notas `privadas` só sejam lidas pelo autor ou por usuários com cargo `admin`.

---

## 2. Backend (Node.js / Express)

- [x] **Novo Controller (`interacoesController.js`):**
  - Implementar `criarInteracao` (POST).
  - Implementar `listarInteracoesDoCaso` (GET).
- [x] **Atualização do Controller Antigo (`casosController.js`):**
  - Remover o método antigo `salvarFeedback`.
- [x] **Adicionar Novas Rotas em `routes/casos.js`:**
  - Conectar os métodos do controller às novas rotas da API (`/api/casos/:id/interacoes`).
- [x] **Serviço de Auditoria de IA (`aiService.js` / `geminiService.js`):**
  - Criar a função `auditarPeticaoIA(textoPeticao)`.
  - Definir o Prompt exigindo um retorno estrito em JSON (ex: `{ "score": 85, "alertas": ["Falta RG"] }`).
- [x] **Endpoint do Widget de IA:**
  - Criar rota `POST /api/casos/:id/auditar-ia` que invoca a função acima, salva o resultado na `interacoes_caso` (tipo: 'auditoria_ia') e retorna o JSON para o frontend.

---

## 3. Frontend - Nível Operacional (O "Cockpit" em `DetalhesCaso.jsx`)

- [x] **Refatoração do Layout:**
  - Ajustar o layout atual para acomodar um painel lateral retrátil ou uma barra fixa (Sidebar direita) para a Linha do Tempo.
- [x] **Componente: `TimelineInteracoes.jsx`**
  - Criar componente que consome o endpoint via `useSWR` para listar os eventos em ordem cronológica (Notas, Mudanças de Status, Feedbacks).
  - Estilizar de forma limpa (bolinhas conectadas por uma linha vertical).
- [x] **Componente: `NotaExpedienteForm.jsx`**
  - Formulário simples para inserir texto com um _toggle_ (Público / Privado) e um _select_ de categoria.
- [x] **Componente: `AiQualityWidget.jsx`**
  - Card de destaque ("Selo de Qualidade IA").
  - Exibe a nota de 0 a 100 com cores dinâmicas (Vermelho < 60, Amarelo < 80, Verde >= 80).
  - Exibe a lista de _warnings_ (alertas de erro).
  - Botão "Auditar Petição Agora" (chama o endpoint de auditoria e atualiza a tela).
- [x] **Utilizar o @index.css**
- [x] **Acessibilidade (A11y):**
  - Adicionar `aria-label` e `aria-live` para garantir compatibilidade com leitores de tela nos componentes do Cockpit.

---

## 4. Frontend - Nível de Gestão (O Dashboard em `/admin/feedbacks`)

- [x] **Rota de Backend (KPIs):**
  - Criar o método `obterResumoFeedbacks` no controller e a rota `GET /api/casos/feedbacks-resumo` para consolidar Score, Erros e Notas.
- [x] **Nova Página e Rota:**
  - Criar a página principal em `src/areas/defensor/pages/DashboardFeedbacks.jsx`.
  - Adicionar a rota protegida no roteador (acessível idealmente só para admins/defensores).
- [x] **Sem Dependências Adicionais:**
  - Utilizado os componentes da `lucide-react` e barras flexíveis com o próprio Tailwind CSS para o gráfico.
- [x] **Componente: `KpiCards.jsx`**
  - Cards numéricos (Score Médio Geral, Total de Erros Jurídicos detectados, Total de Notas Privadas).
- [x] **Componente: `GraficoErrosCategoria.jsx`**
  - Gráfico de barras ou pizza mostrando em quais áreas a IA mais erra (ex: 80% dos erros são em Família).
- [x] **Componente: `TabelaAuditoria.jsx`**
  - Tabela densa (Data, Autor, Caso, Tipo, Conteúdo) com filtro e paginação para o Gestor auditar o sistema.
- [x] **Utilizar o @index.css**
- [x] **Acessibilidade (A11y):**
  - Garantir navegação por teclado e `aria-labels` nos gráficos e controles da tabela de gestão.

---

## 5. O Pulo do Gato (Preparação para a Apresentação)

- [ ] **Calibrar o Prompt do Gemini (System Prompt):**
  - Testar exaustivamente o prompt do `auditarPeticaoIA` no backend para garantir que ele nunca fuja do formato JSON, caso contrário o Frontend vai quebrar ao tentar ler o `score`.
- [ ] **Preparar o Discurso de Demonstração:**
  - **Ato 1:** Gerar uma petição falha de propósito (ex: apagar o RG de uma parte).
  - **Ato 2:** Clicar no botão "Auditar com IA". Mostrar o sistema dando nota baixa e apontando "Falta qualificação completa".
  - **Ato 3:** Mostrar o gestor entrando no Dashboard de Feedbacks e vendo aquele erro entrar nas estatísticas globais da Regional para melhoria de prompts futuros.

---

## Resumo de Esforço Estimado

- **Banco de Dados:** 2 horas
- **Backend:** 1 a 2 dias
- **Frontend (Cockpit):** 2 a 3 dias
- **Frontend (Dashboard):** 2 a 3 dias
- **Testes JSON IA:** 4 horas

> **Total Estimado:** ~5 a 8 dias úteis focados.

---

## 6. Seguranca de Migracao (Backup, Validacao e Rollback)

- [ ] **Snapshot/Backup antes da remocao da coluna legada:**
  - Executar backup da tabela `casos` e da nova tabela `interacoes_caso` antes de qualquer `ALTER TABLE ... DROP COLUMN feedback`.
  - Salvar o backup com timestamp e responsavel da execucao.
- [ ] **Contagem pre-migracao:**
  - Registrar total de linhas em `casos` com `feedback IS NOT NULL` e `feedback <> ''`.
  - Registrar total de linhas existentes em `interacoes_caso` antes da carga.
- [ ] **Contagem pos-migracao:**
  - Confirmar que o numero de registros migrados para `interacoes_caso` (tipo `nota_expediente`) bate com a contagem previa esperada.
  - Validar se nao houve duplicacao indevida por `caso_id`.
- [ ] **Criterios de integridade:**
  - Amostragem manual de casos para comparar texto do `feedback` legado com `conteudo` em `interacoes_caso`.
  - Validar `autor_id`, `visibilidade` e `created_at` conforme regra definida para migracao.
  - Conferir que dashboards e timeline continuam carregando sem regressao.
- [ ] **Estrategia de rollback:**
  - Em falha de validacao, restaurar snapshot das tabelas e cancelar a remocao da coluna legada.
  - Se a coluna `feedback` ja tiver sido removida, recriar coluna com script versionado e repovoar a partir do backup.
  - Reexecutar migracao somente apos correcao da causa raiz e nova janela controlada.

# Histórico de Modificações - Chat Af0d7cf5

Este documento resume todas as alterações técnicas realizadas no projeto **Assistente Def Sul Bahia** durante esta sessão de desenvolvimento, focada na otimização da **Execução de Alimentos** e melhoria da experiência do usuário (UX).

## 1. Otimização do Fluxo "Execução de Alimentos"
Para tornar a triagem de cobrança de pensão mais ágil e objetiva, as seguintes mudanças foram feitas:

- **Bypass de Inteligência Artificial**: Configurado para que o sistema não tente gerar o "Relato dos Fatos" via IA para esta ação específica, visto que a petição é baseada em documentos e números objetivos.
  - Arquivos: `backend/src/config/dicionarioAcoes.js`, `backend/src/controllers/casosController.js`.
- **Simplificação da Interface**:
  - Removidos campos de **WhatsApp** redundantes (usa-se o telefone principal).
  - Removido o passo de **Dados Processuais** (Solar) da triagem.
  - Ocultados os blocos de **Vínculos, Guarda e Situação Financeira** na triagem de execução.
  - Ocultada a seção de **Relato de Fatos e Gravação de Áudio** no passo de documentos.
  - Arquivos: `frontend/src/config/formularios/acoes/familia.js`, `frontend/src/areas/servidor/pages/TriagemCaso.jsx`, `frontend/src/areas/servidor/components/StepRelatoDocs.jsx`, `frontend/src/areas/servidor/components/secoes/SecaoCamposGeraisFamilia.jsx`.

## 2. Melhorias em Dados Pessoais e Jurídicos
- **Filiação Obrigatória**: Adicionados campos de nome da mãe e do pai para o Assistido, Representante e Requerido, conforme exigência legal para petição de execução.
  - Arquivos: `frontend/src/areas/servidor/components/StepDadosPessoais.jsx`, `frontend/src/areas/servidor/components/StepRequerido.jsx`.
- **Gestão de RG de Menores**: Removidos os campos de RG para crianças/adolescentes no modo representação, simplificando o preenchimento para as mães.
- **Dados da Decisão/Acordo**: Introduzidos campos para Tipo de Decisão (Sentença/Acordo), Mês Inicial e Mês Final do débito.
  - Arquivo: `frontend/src/areas/servidor/components/secoes/SecaoProcessoOriginal.jsx`.

## 3. Experiência do Usuário (UX) e Máscaras
- **Máscara de Data (Método 1)**: Implementada máscara de digitação rápida (`DD/MM/AAAA`) em todos os campos de data, substituindo o calendário nativo do navegador para maior velocidade.
- **Máscara de Mês/Ano**: Criada máscara específica para os períodos de débito (`MM/AAAA`).
  - Arquivos: `frontend/src/utils/formatters.js`, `frontend/src/areas/servidor/hooks/useFormHandlers.js`.
- **RG Autocomplete**: O seletor de Órgão Emissor de RG foi transformado em um campo de busca inteligente (`SearchableSelect`).
  - Arquivos: `frontend/src/components/ui/SearchableSelect.jsx`, `StepDadosPessoais.jsx`, `StepRequerido.jsx`.

## 4. Lógica de Submissão e Backend
- **Conversão de Datas**: O sistema agora converte automaticamente `DD/MM/AAAA` para `AAAA-MM-DD` antes de salvar no banco, mantendo a integridade dos dados.
- **Envio Posterior de Documentos**: Criada caixa de seleção "Entregarei depois" no passo de documentos.
  - Se marcada, exibe um alerta de confirmação e libera o envio do formulário sem anexos.
  - Arquivos: `frontend/src/areas/servidor/components/StepRelatoDocs.jsx`, `frontend/src/areas/servidor/services/submissionService.js`.
- **Mapeamento de Tags**: Atualizado o payload enviado para o gerador de DOCX para incluir todas as novas variáveis (Filiação, Datas de Débito, etc.).
  - Arquivo: `backend/src/controllers/casosController.js`.
- **Resiliência do Servidor (Correção de Erro 500)**: Foi resolvido um erro interno do servidor (500) que ocorria ao rodar o ambiente Docker local sem chaves do Supabase. O controller principal (`casosController.js`) foi reescrito para utilizar diretamente o **Prisma** (banco PostgreSQL local) no cadastro da triagem e no worker de background, caso a API do Supabase Storage esteja desligada/nula, evitando a queda (`Crash`) por `Cannot read properties of null (reading 'from')`.
- **Ajustes Finos de Validação Silenciosa**:
  - **CPF Opcional para Representação**: Crianças/Adolescentes não são mais bloqueados se não possuírem CPF.
  - **Relato Flexível**: Execuções não exigem relato; a validação agora respeita a flag `ocultarRelato` definida na configuração visual.
  - **Identificação de "Execução"**: A trava nativa para "Período do Débito" agora identifica corretamente a ação pela variável `acaoEspecifica`.
  - **Repasse do Objeto Erros da Submissão**: Os erros não identificados agora marcam em vermelho corretamente o próprio componente afetado.

## 5. Próximos Passos Recomendados
- [ ] Testar a geração completa da petição de execução com os novos campos e garantir envio total local.
- [ ] Validar o layout do `SearchableSelect` em dispositivos móveis.
- [ ] Confirmar se o defensor recebe o campo `periodo_debito` concatenado corretamente no sistema interno.

---

# Histórico de Modificações - Sessão de 06/04/2026

Este documento resume as alterações técnicas realizadas na sessão de **06 de Abril de 2026**, focada em **padronização de tags de execução**, **gestão de unidades regionais**, **filtro de casos por unidade** e **fluxo de documentos pendentes**.

## 1. Padronização de Tags de Templates (Execução de Alimentos)

### Frontend
- **Novos campos no estado inicial** (`formState.js`): `vara`, `percentualSalarioMinimo`, `rgExequente`, `cpfExequente`.
- **Mapeamento atualizado** (`formConstants.js`): Adicionados mapeamentos para os novos campos de execução e inclusão de `rgExequente`/`cpfExequente` na lista de campos com máscara de dígitos.
- **Interface atualizada** (`SecaoProcessoOriginal.jsx`): Adicionados campos de input para **Vara** e **Percentual do Salário Mínimo**.

### Backend
- **Mapeamento de tags** (`casosController.js` → `buildDocxTemplatePayload`): Priorização da vara informada pelo formulário e implementação de **alias mapping** para garantir compatibilidade entre modelos de Penhora e Prisão (ex: `{NOME_REPRESENTACAO}` vs `{REPRESENTANTE_NOME}`).

## 2. Sistema de Gestão de Unidades (NOVO)

### Backend — Novos Arquivos
- **`unidadesController.js`**: CRUD completo para o modelo `unidades`:
  - `GET /api/unidades` — Lista todas com contagem de membros e casos.
  - `POST /api/unidades` — Cria nova unidade (somente admin).
  - `PUT /api/unidades/:id` — Atualiza dados da unidade.
  - `DELETE /api/unidades/:id` — Remove com **validação de integridade** (bloqueia exclusão se houver membros ou casos vinculados).
- **`unidadesRoutes.js`**: Rotas protegidas por `authMiddleware` e `auditMiddleware`.
- **`server.js`**: Registro da rota `/api/unidades`.

### Frontend — Interface Administrativa
- **`GerenciarEquipe.jsx`** (REESCRITO TOTALMENTE):
  - Sistema de **duas abas**: **Membros** e **Unidades**.
  - **Aba Membros**: Tabela com filtro por unidade, colunas Nome/Email/Cargo/**Unidade**/Ações. Modal de edição agora inclui **seletor de unidade**.
  - **Aba Unidades**: Cards com nome, comarca, contagem de membros/casos e botões Editar/Excluir. Modal para criar/editar unidade com campos Nome, Comarca e Sistema Judicial.
- **`Cadastro.jsx`** (REESCRITO):
  - Campo **Unidade obrigatório** ao criar novos membros.
  - Dropdown populado via API `/api/unidades`.

## 3. Filtro Regional de Casos (Isolamento por Unidade)

### Backend
- **Login (`defensoresController.js`)**: Token JWT agora inclui `unidade_id`, eliminando consultas extras ao banco.
- **Listagem (`defensoresController.js`)**: Retorna `unidade_nome` para exibição na tabela de equipe.
- **Criação de Casos (`casosController.js`)**: O campo `cidade_assinatura` do formulário é usado para encontrar automaticamente a unidade correspondente via busca case-insensitive pela comarca.
- **Listagem de Casos (`casosController.js` → `listarCasos`)**: Filtro obrigatório — defensores/estagiários veem apenas casos da sua `unidade_id`. Administradores mantêm visão global.
- **Dashboard (`casosController.js` → `resumoCasos`)**: Mesmo filtro aplicado para que as estatísticas reflitam apenas a unidade do usuário logado.

## 4. Sincronização de Status "Documentos Pendentes"

### Backend
- **Status corrigido** (`resumoCasos`): Agora reconhece tanto `aguardando_documentos` quanto `aguardando_docs` no contador do Dashboard.

### Frontend
- **`BuscaCentral.jsx`**: Botão "Anexar Documentos" agora reconhece corretamente o status `aguardando_documentos`.
- **`EnvioDoc.jsx`**: Upload simples substituído pelo componente **`DocumentUpload.jsx`** avançado com gavetas organizadas (RG frente/verso, Certidão, Comprovantes), compressão automática de imagem e renomeação padronizada.

## 5. Arquivos Modificados (Resumo)

| Arquivo | Tipo | Descrição |
|:--------|:-----|:----------|
| `backend/src/controllers/unidadesController.js` | **NOVO** | CRUD de unidades |
| `backend/src/routes/unidades.js` | **NOVO** | Rotas de unidades |
| `backend/server.js` | Modificado | Registro da rota `/api/unidades` |
| `backend/src/controllers/defensoresController.js` | Modificado | JWT com `unidade_id`, listagem com unidade |
| `backend/src/controllers/casosController.js` | Modificado | Filtro por unidade, vinculação por cidade, status sync |
| `frontend/src/areas/defensor/pages/GerenciarEquipe.jsx` | **REESCRITO** | Sistema de abas (Unidades + Equipe) |
| `frontend/src/areas/defensor/pages/Cadastro.jsx` | **REESCRITO** | Seletor de unidade obrigatório |
| `frontend/src/areas/servidor/pages/BuscaCentral.jsx` | Modificado | Status `aguardando_documentos` |
| `frontend/src/areas/servidor/pages/EnvioDoc.jsx` | Modificado | Integração com `DocumentUpload.jsx` |
| `frontend/src/areas/servidor/state/formState.js` | Modificado | Novos campos de estado |
| `frontend/src/areas/servidor/utils/formConstants.js` | Modificado | Novo mapeamento de campos |
| `frontend/src/areas/servidor/components/secoes/SecaoProcessoOriginal.jsx` | Modificado | Campos Vara e Percentual |

## 6. Próximos Passos
- [ ] Cadastrar unidades no painel administrativo (Salvador, Teixeira de Freitas, etc.)
- [ ] Alocar membros da equipe às suas respectivas unidades
- [ ] Testar submissão de caso com "enviar docs depois" e verificar status no Dashboard
- [ ] Consultar pelo CPF e verificar se o DocumentUpload aparece corretamente
- [ ] Apagar branch `master` do remote GitHub (migrado para `main`)

---
*Documento atualizado automaticamente pelo Assistente IA em 06/04/2026.*

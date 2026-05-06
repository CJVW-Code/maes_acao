# Mudanças Não Commitadas — 2026-04-22

> **Data:** 2026-04-22 (sessão do dia)
> **Status:** Trabalho em andamento — aguardando commit
> **52 entradas no `git status`** (31 modificados + 3 deletados + 14 não-rastreados + 4 novos arquivos/dirs gerados em runtime)

---

## Resumo Executivo

Esta sessão consolidou múltiplas melhorias de segurança, UX e fluxo de trabalho no sistema Mães em Ação, organizadas em 5 grandes frentes:

1. **Downloads seguros via Ticket JWT** — substituição de signed URLs por tickets de curta duração
2. **Upload e substituição de minutas** — novo endpoint para versionar documentos gerados
3. **Melhorias no Dashboard e na tela de Casos** — filtro por status, banner de inatividade, card "Meus Atendimentos"
4. **Refinamentos no fluxo de triagem** — validações de execução, anti-zombie draft, remoção da barra de progresso do relato
5. **Scanner aprimorado** — categorias "Decisão" e "Cálculos", preview de imagem, dropzone como `<label>`

---

## 1. Backend

### `backend/src/middleware/auth.js`
- **Nova função exportada:** `validateDownloadTicket`
  - Valida um JWT com `purpose === "download"` passado via query string `?ticket=...`
  - Reconstrói o `req.user` a partir do payload do ticket
  - Retorna `401` se o ticket estiver ausente, expirado ou com propósito errado
- **`authMiddleware` refatorado:** agora aceita token por header `Authorization: Bearer` OU por query string (`?token=`), sem quebrar o contrato atual

### `backend/src/routes/casos.js`
- **Novas rotas de download seguro** (antes do middleware `authMiddleware`, usando `validateDownloadTicket`):
  - `GET /:id/download-zip` → `baixarTodosDocumentosZip`
  - `GET /:id/documento/download` → `baixarDocumentoIndividual`
- **Nova rota protegida:**
  - `POST /:id/gerar-ticket-download` → `gerarTicketDownload` (requer JWT normal)
  - `POST /:id/upload-minuta` → `substituirMinuta` (requer escrita, multer single)
- **Remoção:** rota `POST /:id/regerar-minuta` duplicada foi removida

### `backend/src/controllers/casosController.js` *(+744 linhas)*
Quatro novas funções exportadas:

| Função | Descrição |
|:-------|:----------|
| `gerarTicketDownload` | Gera um JWT de curta duração com `purpose: "download"` para o caso. O frontend usa este ticket nas chamadas de download para não expor o token principal na URL. |
| `baixarDocumentoIndividual` | Valida o ticket e faz proxy do arquivo do Supabase Storage para o cliente, com Content-Disposition adequado para download. |
| `baixarTodosDocumentosZip` | Valida o ticket, coleta todos os documentos do caso (exceto minutas), cria um arquivo ZIP em memória via `archiver` e faz stream para o cliente. |
| `substituirMinuta` | Recebe um `.docx` via multipart, salva no Storage sobrescrevendo a minuta existente, atualiza a URL no banco (`casos_ia`). Suporta versão Penhora ou Prisão via `documentKey`. |

**Outras melhorias no controller:**
- `mapCasoRelations`: lógica de fallback hierárquico para `empregador_nome` e `CIDADEASSINATURA` (prioridade: `casos_juridico` → `unidade` → string padrão)
- `regerarMinuta`: inclui dados da unidade no payload para resolver o fallback de `CIDADEASSINATURA`

### `backend/package.json` / `backend/package-lock.json`
- Dependência adicionada: `archiver` (para criação de ZIP em memória)

### `backend/templates/` *(arquivos binários)*
- Todos os 7 templates `.docx` foram atualizados (versões limpas, sem lock-files de edição abertos)
- Removidos arquivos de lock temporários: `.~lock.executacao_alimentos_penhora.docx#`, `.~lock.executacao_alimentos_prisao.docx#`, `.~lock.prov_cumulado.docx#`

### `backend/tests/submissionFlow.test.js`
- +4 linhas: ajustes nos mocks para alinhar com novos modelos Prisma

---

## 2. Frontend — Área do Defensor

### `frontend/src/areas/defensor/pages/DetalhesCaso.jsx` *(+331 / -155 linhas)*
- **Painel de Download via Ticket:** função `executarDownloadComTicket` — solicita ticket ao backend e abre download sem expor o JWT principal na URL
- **Painel Informações Financeiras (Cumulado):** movido para a aba "Minuta" (antes era na aba "Gestão")
  - Campos de Penhora: valor + extenso (com máscara de moeda e conversão automática para extenso)
  - Campos de Prisão: valor + extenso
  - Valor total calculado automaticamente
- **Upload de Minuta Manual:** novo botão "Substituir Minuta" — permite ao servidor jurídico fazer upload de uma versão corrigida do `.docx`
  - Estado `isUploadingMinuta` com feedback visual de loading
  - Endpoint: `POST /:id/upload-minuta`
- **Campo "Sistema de Peticionamento":** substituição dinâmica de "Solar" por `caso.sistema_peticionamento || "Solar"` em todos os locais relevantes
- **Botão de Regerar com loading visual** aprimorado (`btn-regenerate`)
- **Timeline (histórico):** expandida para todos os usuários, não apenas admin

### `frontend/src/areas/defensor/pages/Dashboard.jsx` *(+180 / -75 linhas)*
- **Card "Meus Atendimentos"** adicionado ao grid de resumo, com filtro interativo
- **Banner de Alerta de Inatividade:** `banner-alerta-ocioso` — exibido quando `resumo.temCasoOcioso === true`, alerta sobre atendimentos parados há mais de 20 minutos. Não-intrusivo (sem polling, lido do resumo do servidor).
- **Cards de Resumo redesenhados:** layout compacto com `border-l-4`, animação hover, indicador "Filtro aplicado"
- **Casos "Em Colaboração":** card dedicado mostrando `contagens.colaboracao`
- **Destaque de casos compartilhados:** classe CSS `card-compartilhado-highlight`
- **Badge "Compartilhado com você"** nos itens da lista de casos recentes
- **Lista de casos recentes:** voltou ao formato original (list-based, não cards), mostrando `sistema_peticionamento || "Solar"` ao invés de "Solar" fixo

### `frontend/src/areas/defensor/pages/Casos.jsx` *(+63 / -23 linhas)*
- **Filtro de Status** adicionado à página de listagem (select com todos os status disponíveis)
- Filtro combinado: busca por texto + filtro por status funcionam em conjunto
- Label "Solar" substituída por `caso.sistema_peticionamento || "Solar"` em ambas as visões (tabela e card mobile)

### `frontend/src/areas/defensor/pages/Login.jsx` *(+7 linhas)*
- Botão de toggle de visibilidade da senha adicionado: ícone `Eye`/`EyeOff` (Lucide)

### `frontend/src/areas/defensor/components/layout/NotificacoesBell.jsx` *(+54 / -35 linhas)*
- Refactoring do componente de notificações (sem mudança de comportamento, limpeza de código)

### `frontend/src/areas/defensor/components/detalhes/PainelDocumentos.jsx` *(+150 / -45 linhas)*
- **Download individual via ticket:** cada documento agora tem um botão de download dedicado com spinner de loading
- **Destaque de documentos complementares:** borda/background mais visível para documentos do Scanner
- Labels dos tipos de documento atualizados (Sentença, Cálculo disponíveis para o tipo correto)
- Botão "Enviar Documentos" usa nova classe `btn-upload` (estilização premium)
- **Tags de tipo aprimoradas** (sentença, cálculo adicionadas ao mapeamento de cores)

---

## 3. Frontend — Área do Servidor

### `frontend/src/areas/servidor/pages/ScannerBalcao.jsx` *(+44 / -12 linhas)*
- **Novas categorias de documento:** "Decisão" (ícone Gavel) e "Cálculos" (ícone Calculator)
- **Grid de categorias:** de 3 para 4 colunas para acomodar as novas opções
- **Dropzone como `<label>`:** a área de drag-and-drop agora é um `<label>` clicável, resolvendo problema em que clicar na área não abria o explorador de arquivos no Safari/iOS
- **Preview de imagens:** arquivos de imagem exibem thumbnail real (via `URL.createObjectURL`); PDFs exibem ícone FileText como antes

### `frontend/src/areas/servidor/components/StepRelatoDocs.jsx` *(−23 linhas)*
- **Removida** a barra de progresso de 250 caracteres do relato
- **Removido** o contador "X / 250 caracteres"
- Validação de relato agora aceita qualquer texto não-vazio (ver `submissionService.js`)

### `frontend/src/areas/servidor/components/secoes/SecaoProcessoOriginal.jsx` *(+37 / -2 linhas)*
- **Campo "Valor Total do Débito"** marcado como obrigatório (`*`) com validação via `validar()`
- **Novo campo "Anexar Documento do Cálculo"** (input file, obrigatório para execuções, oculto se "Enviar depois")
- **Campo "Link da Calculadora"** — agora apenas label com link externo para Dr. Calc (campo de input removido)

### `frontend/src/areas/servidor/hooks/useFormEffects.js` *(+10 / -5 linhas)*
- **Anti-zombie draft:** o auto-save agora recebe `isSubmitted` como prop; se `true`, o `useEffect` retorna cedo sem salvar no localStorage. Elimina o problema de rascunhos persistindo após envio bem-sucedido.
- Dependência `formState` adicionada corretamente ao array de `useEffect` do prefill

### `frontend/src/areas/servidor/pages/TriagemCaso.jsx` *(+1 linha)*
- Passa `isSubmitted: !!generatedCredentials` para `useFormEffects`

### `frontend/src/areas/servidor/services/submissionService.js` *(+26 / -16 linhas)*
- **Validação de relato simplificada:** de 250 caracteres mínimos → obrigatório (não vazio)
- **Validações novas para execuções** (`exigeDadosProcessoOriginal`):
  - `valor_debito`: obrigatório
  - `calculo_arquivo`: obrigatório (exceto se "Enviar depois")
- **Upload do arquivo de cálculo:** o `calculo_arquivo` é enviado via FormData com prefixo `CALCULO_` no nome
- **Correção do `enviarDocumentosDepois`:** comparação agora aceita tanto `true` (boolean) quanto `"true"` (string)
- `calculo_arquivo` adicionado ao `fieldsToIgnore` para não ser serializado como campo de texto

### `frontend/src/areas/servidor/components/StepDadosPessoais.jsx` *(-1 linha)*
- Prop `assistidoNacionalidade` removida da assinatura destrutural do componente (limpeza de prop não utilizada)

### `frontend/src/config/formularios/acoes/familia.js` *(+1 / -1 linha)*
- `fixacao_alimentos`: adicionada flag `ocultarDetalhesGerais: true` para ocultar seção de campos gerais redundantes

---

## 5. Outros

### `frontend/.env.development`
- Linha alterada (provavelmente URL da API local ajustada)

### `tests/performance/lib/config.js` *(+30 / -6 linhas)*
- Ajustes de configuração do ambiente de testes de carga (k6)

---

## 4. Frontend — CSS Global

### `frontend/src/index.css` *(+70 linhas)*
Novas classes de design:

| Classe CSS | Descrição |
|:-----------|:----------|
| `.heading-2` / `.heading-3` | Tipografia hierárquica para subtítulos |
| `.btn-download` | Botão de download premium (gradiente verde) com hover scale |
| `.btn-upload` | Botão de upload premium (gradiente primary) |
| `.btn-regenerate` | Botão de regerar minuta (gradiente índigo) |
| `.casos-grid-compact` | Grid compacta de cards (minmax 320px) |
| `.banner-alerta-ocioso` | Banner laranja pulsante para casos com inatividade |
| `.badge-atendimento-meu` | Badge do filtro "Meus Atendimentos" |
| `.card-compartilhado-highlight` | Destaque visual para casos compartilhados |

---

## 6. Arquivos Não-Rastreados (??) — Novos Arquivos Criados

### `AI_WORKFLOW.md` *(novo na raiz do projeto)*
- **Guia de Desenvolvimento com IA** — documenta o fluxo de 4 fases para uso de assistentes de IA no projeto:
  - **PLANEJAR** → Prompt de Arquiteto (Pre-Mortem + Implementation Plan)
  - **AUDITAR** → Prompt de Auditoria (gaps, padrões, segurança)
  - **DECOMPOR** → Prompt de Task List (tasks atômicas)
  - **EXECUTAR** → Prompt de Execução (uma task por vez)
- Inclui regras de segurança inegociáveis, cheklist de commit e referência rápida de arquivos críticos
- Instrui como injetar o `claude.md` em Cursor, Claude.ai, ChatGPT e API direta

### `claude.md` *(novo na raiz do projeto — MEGA CONTEXTO)*
- Compilação de toda a documentação do projeto em um único arquivo (~250KB)
- Contém: ARCHITECTURE.md + BUSINESS_RULES.md + CODING_STANDARDS.md + API_REFERENCE.md
- Deve ser injetado como contexto em toda sessão de desenvolvimento com IA
- **Versão atual:** 2.2 (atualizada nesta sessão)

### `diagnostico_maes_em_acao.docx` *(novo na raiz)*
- Documento Word de diagnóstico do sistema
- Gerado para documentar o estado atual antes do mutirão

### `tests/performance/how to use.md` *(novo)*
- Guia de execução dos testes de performance com k6 no Windows/PowerShell
- Documenta 3 cenários de teste:
  - `perf:load` — 100 usuários simultâneos (simula mutirão)
  - `perf:soak` — estabilidade por 2 horas (verifica memory leak)
  - `perf:reliability` — rate limit e erros 500 sob estresse
- Inclui tabela de referência de métricas (latência p95, taxa de falhas, checks)

### `backend/uploads/peticoes/202604224920378/` *(diretório gerado em runtime)*
- Arquivo: `peticao_inicial_202604224920378.docx` (~1.9MB)
- Petição gerada em tempo real durante testes locais
- **Não deve ser commitado** — diretório `uploads/peticoes/` deve estar no `.gitignore`

### Arquivos do `04-Historico/` (planos e tasks de sessões anteriores)

Os seguintes arquivos estavam no diretório `04-Historico/` e não foram rastreados pelo Git:

| Arquivo | Descrição |
|:--------|:-----------|
| `Implementação de Sistema Seguro de Tickets para Downloads` | Plano da feature de tickets JWT |
| `Planejamento de Implementação — Refinamentos Mães em Ação` | Plano da reunião de refinamentos de UI/UX |
| `Plano de Implementação Auditado - Correção de Fluxo de Documentos` | Plano auditado de correção do mapeamento de dados |
| `Task List — Tickets Seguros de Download + Correção Minuta Cumulada` | Lista de tasks executadas nesta sessão |
| `correções` | Tasks de correções pontuais |
| `plano_fluxo_documentos_tasks.md` | Plano estruturado do fluxo de documentos |
| `task  Refinamentos Mães em Ação` | Tasks de refinamentos de UX |
| `task.md` | Task list geral da sessão |
| `taskcorrecoes` | Tasks de correções |

> **Nota:** Esses arquivos são artefatos de planejamento gerados pelo assistente de IA durante as sessões. Devem ser commitados junto com o código para rastreabilidade ou adicionados ao `.gitignore` se não forem desejados no histórico.

---

## Contagem Completa de Entradas no `git status`

| Categoria | Qtd | Exemplos |
|:----------|:----|:---------|
| **Modificados (M)** | 31 | casosController.js, auth.js, DetalhesCaso.jsx, Dashboard.jsx, index.css... |
| **Deletados (D)** | 3 | `.~lock.*.docx#` (arquivos de lock do LibreOffice) |
| **Não-rastreados (??)** | 14 | AI_WORKFLOW.md, claude.md, diagnostico.docx, how to use.md, arquivos do 04-Historico, diretório de upload |
| **Total** | **48** | — |

> O `git diff --stat` retornou "34 files changed" porque conta apenas os arquivos **já rastreados** pelo Git (tracked). Os arquivos `??` (untracked) não aparecem nessa contagem.



## Padrões e Regras Reforçados

- ✅ Nenhum dado pessoal em URLs (tickets substituem tokens diretamente na query string)
- ✅ Signed URLs continuam exclusivas para acesso via painel (não usadas para download direto)
- ✅ Arquivos de lock temporários do LibreOffice removidos do repositório
- ✅ Sistema de templates atualizado (todos os 7 `.docx` revisados)
- ✅ Anti-zombie draft implementado via flag `isSubmitted`

---

## Próximos Passos Sugeridos

- [ ] Commit e tag de versão `v2.2-pre`
- [ ] Testar fluxo completo de download via ticket em produção (Google Cloud Run)
- [ ] Validar upload de minuta manual em casos reais
- [ ] Verificar se `temCasoOcioso` está sendo calculado corretamente no endpoint `/resumo`

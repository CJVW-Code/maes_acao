- `[x]` **ID: 1** - `backend/src/middleware/requireWriteAcess.js`
  - **Context:** Middleware de autorização que checa o cargo do usuário para rotas de escrita.
  - **Action:** Corrigir o TypeError de `req.user.cargo.toLowerCase()` e preparar para renomear o arquivo via bash (para `requireWriteAccess.js`).
  - **Logic Details:** 
    - Tratar null/undefined verificando `typeof req.user?.cargo === 'string'`.
    - O fallback caso não exista deve ser uma string vazia `""` para que `allowedRoles.includes()` recuse graciosamente com 403.
  - **Acceptance Criteria:** O middleware deve proteger rotas sem crachar (Erro 500) se o cargo for inválido.

- `[x]` **ID: 2** - `backend/src/routes/casos.js`
  - **Context:** Roteador principal de casos que protege rotas sensíveis via middleware.
  - **Action:** Atualizar a importação do middleware `requireWriteAcess.js` para o novo nome `requireWriteAccess.js`.
  - **Logic Details:**
    - Alterar `import { requireWriteAccess } from "../middleware/requireWriteAcess.js";` para o caminho com a grafia correta.
  - **Acceptance Criteria:** A inicialização do backend não pode falhar por erro de importação na rota.

- `[x]` **ID: 3** - `backend/src/controllers/biController.js`
  - **Context:** Controlador que busca metadados de casos para dashboards de BI.
  - **Action:** Refatorar `fetchCasosMetadata` para delegar o filtro de datas ao Supabase e Prisma.
  - **Logic Details:**
    - No `supabase.from("casos")`, formatar corretamente a query com `.or()` do PostgREST validando as colunas `created_at`, `updated_at`, `protocolado_at` contra `range.gte` e `range.lte`.
    - No `prisma.casos.findMany`, adicionar bloco `OR` no `where` com os mesmos limites.
  - **Acceptance Criteria:** `fetchCasosMetadata` deve retornar o dataset já reduzido do banco de dados ao invés de usar filtro `.filter()` em memória no Node.js.

- `[x]` **ID: 4** - `backend/src/controllers/biController.js`
  - **Context:** Controlador que agrupa e exporta os XLSX do BI em lote.
  - **Action:** Refatorar `exportarXlsxLote` para buscar todos os dados de uma só vez e evitar colisão de abas.
  - **Logic Details:**
    - Realizar uma única chamada para `fetchCasosMetadata` com `unidadeId = "todas"` e com o range selecionado, e não num loop `for...of` por unidade.
    - Iterar as `unidades` e realizar a filtragem dos casos em memória para evitar requests redundantes no banco.
    - Sanitizar o nome da aba usando `.replace(/[\/\\*?\[\]:]/g, "").slice(0, 31)`.
    - Usar um objeto `Set` ou um mapa de frequências para garantir que não existam abas com nomes duplicados, anexando um sufixo (ex: `(1)`) caso necessário.
  - **Acceptance Criteria:** O relatório em lote deve gerar o arquivo com todas as abas realizando apenas 1 leitura de metadata no banco e sem crash por violação do `ExcelJS`.

- `[x]` **ID: 5** - `frontend/src/areas/servidor/services/submissionService.js`
  - **Context:** Serviço de processamento e submissão do formulário de triagem.
  - **Action:** Refatorar a validação do campo CEP.
  - **Logic Details:**
    - Trocar a checagem literal `.includes("CEP:")` pela checagem regex explícita `/\b\d{5}-?\d{3}\b/.test(formState.requerente_endereco_residencial)`.
  - **Acceptance Criteria:** A submissão deve processar corretamente um endereço válido sem bloquear o usuário por falsos negativos de formatação.

- `[x]` **ID: 6** - `frontend/src/areas/servidor/hooks/useFormEffects.js`
  - **Context:** Hook que manipula o carregamento e prefill de rascunhos.
  - **Action:** Otimizar o endereço da representante no momento do prefill remoto.
  - **Logic Details:**
    - Certificar que no repasse (merge) dos dados retornados pelo Supabase para a chave `requerente_endereco_residencial`, não sejam forçadas manipulações que destruam o CEP vindo do backend. O novo validador em `submissionService.js` já cuidará da regex.
  - **Acceptance Criteria:** O formulário deve aceitar o endereço legado da base e validá-lo corretamente na hora do envio.

- `[x]` **ID: 7** - `frontend/src/areas/defensor/hooks/useBiData.js`
  - **Context:** Hook que processa exportação de gráficos do BI para PDF.
  - **Action:** Armazenar o estado visual original (classe `hidden`) e preservá-lo.
  - **Logic Details:**
    - Em `exportarPdf()`, durante a busca dos botões que devem ser escondidos pro print (`hiddenControls`), salvar `node.dataset.wasHidden = node.classList.contains("hidden") ? "true" : "false"`.
    - No `finally`, só aplicar `node.classList.remove("hidden")` naqueles cujo `wasHidden !== "true"`.
  - **Acceptance Criteria:** A UI do usuário deve voltar ao estado idêntico ao de antes da exportação do PDF.

- `[x]` **ID: 8** - `Terminal / Validação`
  - **Context:** Pipeline de Teste e Validação.
  - **Action:** Executar bash commands para realizar a renomeação do arquivo, e validações para garantir que o código suba de forma limpa.
  - **Logic Details:**
    - Renomear o middleware `mv requireWriteAcess.js requireWriteAccess.js`.
    - Levantar o servidor backend se houver rotina de testes, ou validar sintaxe.
  - **Acceptance Criteria:** Todos os testes de sintaxe passam e o servidor inicializa sem erros de carregamento.

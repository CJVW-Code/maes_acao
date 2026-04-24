# Task List — Hardening de Downloads e Substituição de Minutas

> Gerada em: 2026-04-23 | Base: Plano auditado (Gaps 1–10)
> Arquivo alvo principal: `backend/src/controllers/casosController.js` (4665 linhas)

---

## INFRAESTRUTURA

---

ID: 01
File Path: `backend/.env`
Context: Arquivo de variáveis de ambiente do backend. Atualmente não contém `API_BASE_URL`, forçando fallback de processamento síncrono local.
Action: Adicionar a variável `API_BASE_URL` com a URL base do backend (local ou Railway).
Logic Details:
  - Inserir linha: `API_BASE_URL=http://localhost:8001` para desenvolvimento local.
  - Em produção (Railway), usar a URL pública do serviço (ex: `https://api.mutirao.dpe.ba.gov.br`).
  - A variável é consumida em `buildSignedUrl` (ln 824) e na publicação de jobs QStash para montar o webhook de retorno.
  - **Não** adicionar `/api` ao final — o sufixo já é adicionado internamente onde necessário.
Acceptance Criteria:
  - Após restart, os logs do backend NÃO exibem `[QStash] API_BASE_URL invalida` ou equivalente.
  - O sistema usa processamento via QStash (não `setImmediate`) ao criar novos casos.

---

## BACKEND — casosController.js

---

ID: 02
File Path: `backend/src/controllers/casosController.js`
Context: Constante `DOC_URL_KEY_BY_TIPO` (ln 503–513) mapeia chaves curtas do frontend para nomes de colunas do banco. Não existe allowlist de colunas permitidas para substituição de minuta.
Action: Adicionar a constante `ALLOWED_MINUTA_KEYS` no escopo do módulo, imediatamente após `DOC_URL_KEY_BY_TIPO` (após ln 513).
Logic Details:
  - Declarar como `const ALLOWED_MINUTA_KEYS = new Set([...])` com as quatro colunas diretas de `casos_ia` permitidas:
    - `"url_peticao"` — coluna direta da petição principal
    - `"url_peticao_penhora"` — coluna direta da minuta de penhora
    - `"url_peticao_prisao"` — coluna direta da minuta de prisão
    - `"url_termo_declaracao"` — coluna direta do termo de declaração
  - Chaves JSONB (`url_peticao_execucao_cumulado`, etc.) **não** entram na allowlist — são escritas exclusivamente via `dados_extraidos`.
  - Posicionar após ln 513 (após o fechamento de `DOC_URL_KEY_BY_TIPO`) para estar disponível na função `substituirMinuta`.
Acceptance Criteria:
  - `ALLOWED_MINUTA_KEYS.has("url_peticao")` retorna `true`.
  - `ALLOWED_MINUTA_KEYS.has("id")` retorna `false`.
  - `ALLOWED_MINUTA_KEYS.has("penhora")` retorna `false` (chave curta, não normalizada).

---

ID: 03
File Path: `backend/src/controllers/casosController.js`
Context: `substituirMinuta` (ln 3704–3822) busca o caso via `prisma.casos.findUnique` com locking manual que ignora colaboradores de `assistencia_casos`. Não valida MIME type, tamanho nem allowlist.
Action: Refatorar o bloco de validação e autorização da função `substituirMinuta` — substituir `prisma.casos.findUnique` + locking manual (ln 3716–3738) por `carregarCasoDetalhado` e adicionar validações de arquivo + allowlist.
Logic Details:
  - **Ordem das validações** (antes do `try` principal):
    1. Normalizar: `let documentKey = DOC_URL_KEY_BY_TIPO[rawDocumentKey] || rawDocumentKey;` (já existe na ln 3713 — manter).
    2. `if (documentKey === "termo") documentKey = "url_termo_declaracao";` (já existe na ln 3714 — manter).
    3. Validar MIME: `file.mimetype !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document"` → `400`.
    4. Validar extensão: `!file.originalname.toLowerCase().endsWith(".docx")` → `400`.
    5. Validar tamanho: `file.size > 10 * 1024 * 1024` → `400`.
    6. Validar allowlist: `!ALLOWED_MINUTA_KEYS.has(documentKey)` → `400 "Chave de documento inválida."`.
  - **Dentro do `try`**, substituir ln 3718–3738 por:
    ```js
    const caso = await carregarCasoDetalhado(id, req.user);
    const ia = await prisma.casos_ia.findUnique({ where: { caso_id: BigInt(id) } });
    const protocolo = caso.protocolo;
    const extras = safeJsonParse(ia?.dados_extraidos, {});
    ```
  - O `HttpError(423)` lançado por `carregarCasoDetalhado` é capturado pelo `catch` externo — nenhum locking manual adicional é necessário.
  - Remover a variável `casoRaw` e todas as referências a ela.
Acceptance Criteria:
  - `POST /api/casos/:id/upload-minuta` com `documentKey = "id"` retorna `400`.
  - `POST /api/casos/:id/upload-minuta` com arquivo `.pdf` retorna `400`.
  - `POST /api/casos/:id/upload-minuta` com arquivo > 10MB retorna `400`.
  - Colaborador com `assistencia_casos.status = "aceito"` consegue substituir minuta (não recebe `423`).
  - Usuário sem vínculo com o caso recebe `423`.

---

ID: 04
File Path: `backend/src/controllers/casosController.js`
Context: `substituirMinuta` (ln 3789–3793) usa `iaUpdateData[documentKey] = storagePath` — escrita dinâmica de coluna com chave controlada pelo usuário. Risco de Mass Assignment em mutações futuras.
Action: Eliminar a escrita dinâmica de coluna em `iaUpdateData` e substituir por `if` explícitos por chave conhecida (ln 3789–3793).
Logic Details:
  - Remover completamente:
    ```js
    if (documentKey in ia) {
      iaUpdateData[documentKey] = storagePath;
    }
    ```
  - Substituir por bloco explícito e seguro:
    ```js
    if (documentKey === "url_peticao")          iaUpdateData.url_peticao = storagePath;
    if (documentKey === "url_peticao_penhora")  iaUpdateData.url_peticao_penhora = storagePath;
    if (documentKey === "url_peticao_prisao")   iaUpdateData.url_peticao_prisao = storagePath;
    if (documentKey === "url_termo_declaracao") iaUpdateData.url_termo_declaracao = storagePath;
    ```
  - A escrita no JSONB `dados_extraidos` (já existente com `updatedExtras`) deve ser mantida para cobrir chaves que vivem apenas no JSONB.
  - Esta task depende da Task 02 (allowlist) para garantir que apenas as 4 chaves acima chegam a este ponto.
Acceptance Criteria:
  - O objeto `iaUpdateData` passado ao Supabase/Prisma nunca contém uma chave gerada dinamicamente a partir de input do usuário.
  - Substituição de `url_peticao_penhora` atualiza **tanto** `casos_ia.url_peticao_penhora` (coluna direta) **quanto** `casos_ia.dados_extraidos` (JSONB).

---

ID: 05
File Path: `backend/src/controllers/casosController.js`
Context: `substituirMinuta` executa `fs.unlink` dentro do bloco `try` (ln 3763–3767), após o `throw` de erro de upload. Se o upload falhar, o arquivo temporário nunca é removido (vazamento de disco).
Action: Mover o `fs.unlink` do arquivo temporário para um bloco `finally`, garantindo execução independente de sucesso ou falha.
Logic Details:
  - Reestruturar o `try/catch` atual (ln 3716–3821) para `try/catch/finally`:
    ```js
    try {
      // ... upload + prisma update + registrarLog + res.status(200)
    } catch (error) {
      logger.error(`Erro ao substituir minuta do caso ${id}: ${error.message}`);
      if (!res.headersSent) res.status(500).json({ error: "Erro interno ao substituir minuta." });
    } finally {
      if (file?.path) {
        try { await fs.unlink(file.path); }
        catch (e) { logger.warn(`[substituirMinuta] Falha ao limpar temp: ${file.path}`); }
      }
    }
    ```
  - Remover o bloco `try { await fs.unlink... } catch` que estava dentro do `try` principal (ln 3762–3767).
  - O `HttpError` com `statusCode` lançado por `carregarCasoDetalhado` (Task 03) deve ser tratado no `catch`:
    ```js
    if (error.statusCode) {
      return res.status(error.statusCode).json(error.payload || { error: error.message });
    }
    ```
Acceptance Criteria:
  - Ao simular falha de upload ao Supabase, o arquivo em `file.path` é removido do disco (verificável por `fs.existsSync` após a request).
  - O endpoint retorna `500` corretamente na falha de upload.
  - `HttpError(423)` lançado por `carregarCasoDetalhado` resulta em resposta `423` (não `500`).

---

ID: 06
File Path: `backend/src/controllers/casosController.js`
Context: `registrarLog` em `substituirMinuta` (ln 3809–3812) inclui `nome_arquivo: file.originalname`, que pode conter CPF do assistido no nome do arquivo — violação LGPD.
Action: Remover o campo `nome_arquivo` do payload do `registrarLog` em `substituirMinuta`.
Logic Details:
  - Alterar o bloco do log (ln 3809–3812) de:
    ```js
    await registrarLog(req.user.id, "substituir_minuta", "casos", id, {
      documento: documentKey,
      nome_arquivo: file.originalname,
    });
    ```
    Para:
    ```js
    await registrarLog(req.user.id, "substituir_minuta", "casos", id, {
      documento: documentKey,
    });
    ```
  - O campo `documento` (chave técnica normalizada, ex: `"url_peticao_penhora"`) é suficiente para rastreabilidade e não expõe dados pessoais.
  - Conforme LGPD: logs de auditoria devem conter apenas IDs, chaves técnicas e timestamps — nunca nomes de arquivos, CPFs ou outros dados pessoais.
Acceptance Criteria:
  - O registro em `logs_auditoria` para a ação `"substituir_minuta"` não contém o campo `nome_arquivo`.
  - O campo `documento` (chave normalizada) está presente no log.

---

ID: 07
File Path: `backend/src/controllers/casosController.js`
Context: `baixarTodosDocumentosZip` (ln 2098–2185) não verifica se o ticket JWT pertence ao caso sendo baixado. Um ticket válido de caso A poderia baixar o ZIP do caso B.
Action: Adicionar guard de ticket binding em `baixarTodosDocumentosZip`, logo após `carregarCasoDetalhado` (após ln 2101).
Logic Details:
  - Inserir imediatamente após `const caso = await carregarCasoDetalhado(id, req.user);` (ln 2101):
    ```js
    if (req.ticket?.casoId && String(req.ticket.casoId) !== String(id)) {
      return res.status(403).json({ error: "Ticket não autorizado para este caso." });
    }
    ```
  - Usar `String()` em ambos os lados para blindar contra divergência de tipo (`casoId` como número no payload vs. `id` como string de `req.params`).
  - `req.ticket` é populado pelo middleware `validateDownloadTicket` (já aplicado na rota `GET /:id/download-zip` — ln 61 de `casos.js`).
  - Se `req.ticket?.casoId` for `undefined` (ticket sem o campo), a guard **não bloqueia** — compatibilidade com tickets legados.
Acceptance Criteria:
  - Request com ticket do caso `42` para `GET /api/casos/99/download-zip` retorna `403`.
  - Request com ticket do caso `42` para `GET /api/casos/42/download-zip` prossegue normalmente.
  - Request sem campo `casoId` no ticket não é bloqueada pela guard.

---

ID: 08
File Path: `backend/src/controllers/casosController.js`
Context: `baixarTodosDocumentosZip` move `res.setHeader` (ln 2105–2106) para antes dos handlers de evento e antes de `archive.pipe(res)`. Headers enviados antes de um erro de inicialização do archiver poderiam ser respondidos com status 200 incorreto.
Action: Reposicionar os dois `res.setHeader` para imediatamente antes de `archive.pipe(res)` (após todos os handlers `archive.on` e `res.on`).
Logic Details:
  - Mover as linhas:
    ```js
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${caso.protocolo}_documentos.zip"`);
    ```
    De ln 2105–2106 (posição atual, antes dos handlers) para logo antes de `archive.pipe(res)` (ln 2135).
  - Ordem final dentro do `try`:
    1. `carregarCasoDetalhado` + guard de ticket (Task 07)
    2. `const archive = archiver(...)`
    3. Handlers: `archive.on("error")`, `archive.on("warning")`, `res.on("error")`
    4. `res.setHeader(...)` × 2 ← **nova posição**
    5. `archive.pipe(res)`
    6. Loop de documentos
    7. `archive.finalize()`
  - Não altera comportamento funcional no fluxo feliz, mas evita headers enviados antes de erros de inicialização.
Acceptance Criteria:
  - Headers `Content-Type` e `Content-Disposition` são enviados apenas após todos os handlers de evento serem registrados.
  - O download do ZIP continua funcionando corretamente no fluxo feliz.

---

ID: 09
File Path: `backend/src/controllers/casosController.js`
Context: O loop de documentos em `baixarTodosDocumentosZip` (ln 2138–2153) não possui tratamento de erro individual. Falha em um arquivo aborta todo o ZIP.
Action: Envolver cada iteração do loop de documentos em `try/catch` individual e gerar `RELATORIO_ERROS.txt` no ZIP se houver falhas.
Logic Details:
  - Antes do loop, declarar: `const arquivosFalharam = [];`
  - Envolver o corpo do `for (const doc of caso.documentos)` em `try/catch`:
    ```js
    try {
      // lógica de download + archive.append (existente)
    } catch (err) {
      // LGPD: logar apenas ID, nunca nome/CPF do arquivo
      logger.error(`[ZIP] Falha no doc id=${doc.id}: ${err.message}`);
      arquivosFalharam.push(doc.nome_original || `documento_${doc.id}`);
    }
    ```
  - Após o loop, antes de `archive.finalize()`:
    ```js
    if (arquivosFalharam.length > 0) {
      archive.append(
        `Arquivos não incluídos neste ZIP:\n${arquivosFalharam.join('\n')}`,
        { name: 'RELATORIO_ERROS.txt' }
      );
    }
    ```
  - A regra de log LGPD aplica-se aqui: **nunca** incluir `nome_original` no log do servidor, apenas no relatório do ZIP (para o usuário final).
Acceptance Criteria:
  - Ao simular falha de download de 1 de 3 documentos no Supabase, o ZIP contém os 2 documentos válidos + `RELATORIO_ERROS.txt` listando o documento que falhou.
  - A falha em um documento não aborta a geração do ZIP inteiro.
  - O `RELATORIO_ERROS.txt` não é adicionado ao ZIP quando todos os downloads são bem-sucedidos.

---

ID: 10
File Path: `backend/src/controllers/casosController.js`
Context: `regerarMinuta` (ln 3528) define `baseData = caso.dados_formulario || caso`. Campos como `outros_filhos_detalhes` existem no JSONB `dados_formulario` mas não no nível raiz de `caso`, causando perda de dados de filhos secundários na regeneração.
Action: Refatorar a atribuição de `baseData` em `regerarMinuta` (ln 3528) para garantir disponibilidade de campos JSONB sem sobrescrever os normalizados.
Logic Details:
  - Substituir (ln 3528):
    ```js
    const baseData = caso.dados_formulario || caso;
    ```
    Por:
    ```js
    // Garante que campos do JSONB bruto (dados_formulario) preencham lacunas,
    // sem sobrescrever campos já normalizados pelo mapCasoRelations (que têm prioridade).
    const baseData = {
      ...(caso.dados_formulario || {}),
      ...caso,
    };
    ```
  - **Atenção CAUTION:** NÃO aplicar este merge em `mapCasoRelations`. A correção é exclusivamente em `regerarMinuta`. Aplicar em `mapCasoRelations` reverteria a normalização de `nome`, `cpf`, `NOME`, etc.
  - O campo `outros_filhos_detalhes` é um array JSON armazenado em `casos_ia.dados_extraidos` e refletido em `caso.dados_formulario`. Com o merge, ele fica disponível em `baseData.outros_filhos_detalhes`.
Acceptance Criteria:
  - Ao chamar `POST /api/casos/:id/regerar-minuta` em caso com 3 filhos registrados, o `.docx` gerado contém os dados dos 3 filhos.
  - Campos normalizados como `NOME`, `cpf`, `nome_assistido` (vindos de `mapCasoRelations`) não são sobrescritos pelos valores brutos do JSONB.

---

## VALIDAÇÃO

---

ID: 11
File Path: `backend/src/controllers/casosController.js` (leitura) + chamadas manuais via cliente HTTP
Context: Tasks 02–10 modificam duas funções críticas de segurança. Validação manual é necessária antes de deploy.
Action: Executar os cenários de teste manuais listados abaixo e registrar resultados.
Logic Details:

  **`substituirMinuta` — cenários obrigatórios:**
  1. `documentKey = "id"` (chave proibida, pré-normalização) → espera `400 "Chave de documento inválida."`
  2. `documentKey = "penhora"` (chave curta do frontend) → espera `200` (confirma allowlist pós-normalização)
  3. `documentKey = "url_peticao"` (chave direta) → espera `200`
  4. Arquivo `.pdf` em vez de `.docx` → espera `400`
  5. Arquivo > 10MB → espera `400`
  6. Usuário sem vínculo com o caso → espera `423`
  7. Colaborador com `assistencia_casos.status = "aceito"` → espera `200`
  8. Simular falha de upload Supabase → confirmar que `file.path` foi removido do disco
  9. Verificar `logs_auditoria` após substituição → confirmar ausência de `nome_arquivo`

  **`baixarTodosDocumentosZip` — cenários obrigatórios:**
  10. Ticket de caso `A` em URL de caso `B` → espera `403`
  11. Ticket de caso `A` em URL de caso `A` → espera ZIP válido
  12. Simular falha em 1 de N documentos → ZIP deve conter documentos válidos + `RELATORIO_ERROS.txt`

  **`regerarMinuta` — cenário obrigatório:**
  13. Caso com `outros_filhos_detalhes` preenchido → `.docx` deve conter todos os filhos

Acceptance Criteria:
  - Todos os 13 cenários passam conforme o resultado esperado.
  - Nenhum arquivo temporário permanece em disco após falha de upload.
  - Nenhuma coluna de `casos_ia` fora da allowlist é atualizada dinamicamente.

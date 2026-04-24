# Atomic Task List - Document & Finance Flow Fixes

Esta lista contém as tarefas técnicas atômicas para execução. Siga rigorosamente cada ID na ordem apresentada.

---

### ID: 1
**File Path:** `backend/src/controllers/casosController.js`
**Context:** Prepara o payload de dados para o Docxtemplater através da função `buildDocxTemplatePayload`.
**Action:** Modificar `buildDocxTemplatePayload` para tratar especificamente os campos da minuta cumulada.
**Logic Details:**
- Identificar se a `acaoKey` é de execução/cumprimento cumulado.
- Garantir que `valor_debito_penhora_extenso` e `valor_debito_prisao_extenso` sejam calculados usando `numeroParaExtenso`.
- Se `baseData.valor_debito` estiver vazio/ausente, atribuir a ele a soma formatada de penhora e prisão.
- Mapear os campos para as tags: `{valor_debito_penhora}`, `{valor_debito_penhora_extenso}`, `{valor_debito_prisao}`, `{valor_debito_prisao_extenso}`, `{valor_debito}` e `{valor_debito_extenso}`.
- **RESTRIÇÃO:** Não alterar lógicas de tags fora deste contexto de execução cumulada.
**Acceptance Criteria:** O payload retornado para ações cumuladas deve conter todos os 6 campos citados preenchidos corretamente (valores e extensos).

---

### ID: 2
**File Path:** `backend/src/controllers/casosController.js`
**Context:** Controlador central de casos.
**Action:** Implementar a função exportada `baixarDocumentoIndividual`.
**Logic Details:**
- Validar se o `id` (caso) existe e se o usuário tem permissão (Admin ou Vínculo).
- Obter o `path` via query string.
- Buscar o arquivo no Supabase Storage: `supabase.storage.from('documentos').download(path)`.
- Configurar header `Content-Disposition: attachment; filename="[nome_extraido_do_path]"`.
- Realizar o pipe do stream para a `res`.
- Tratar erros de "Arquivo não encontrado" com 404.
**Acceptance Criteria:** Chamada a este controlador deve forçar o download do arquivo solicitado.

---

### ID: 3
**File Path:** `backend/src/controllers/casosController.js`
**Context:** Controlador central de casos.
**Action:** Implementar a função exportada `baixarTodosDocumentosZip`.
**Logic Details:**
- Validar permissões de acesso ao caso.
- Utilizar a biblioteca `archiver` para criar um arquivo ZIP.
- Iterar sobre `caso.documentos` e as URLs de minutas em `casos_ia`.
- Adicionar cada arquivo ao ZIP via stream (não carregar tudo em memória).
- Nomear o arquivo de saída como `protocolo_documentos.zip`.
- Finalizar o stream e enviar a resposta.
**Acceptance Criteria:** Chamada a este controlador deve baixar um ZIP íntegro contendo todos os anexos e minutas do caso.

---

### ID: 4
**File Path:** `backend/src/routes/casos.js`
**Context:** Define as rotas da API para o módulo de casos.
**Action:** Registrar os novos endpoints de download.
**Logic Details:**
- Adicionar `router.get("/:id/download-zip", authMiddleware, baixarTodosDocumentosZip);`
- Adicionar `router.get("/:id/documento/download", authMiddleware, baixarDocumentoIndividual);`
**Acceptance Criteria:** As rotas devem estar registradas e protegidas pelo `authMiddleware`.

---

### ID: 5
**File Path:** `frontend/src/areas/defensor/components/detalhes/PainelDocumentos.jsx`
**Context:** Renderiza a lista de arquivos anexos com ícones de ação.
**Action:** Isolar o ícone de download para disparo do proxy de download.
**Logic Details:**
- Manter o componente `<a>` principal como está (abre em nova aba).
- No ícone `<Download />`, adicionar um `onClick`.
- O handler do ícone deve usar `e.preventDefault()` e `e.stopPropagation()`.
- Disparar o download via: `window.location.assign(`${API_URL}/casos/${caso.id}/documento/download?path=${encodeURIComponent(url)}`)`.
**Acceptance Criteria:** Clicar no ícone de download deve baixar o arquivo; clicar no nome do arquivo deve continuar abrindo em nova guia.

---

### ID: 6
**File Path:** `frontend/src/areas/defensor/components/detalhes/PainelDocumentos.jsx`
**Context:** Exibe documentos e opções de ação.
**Action:** Adicionar o botão de download em lote (ZIP).
**Logic Details:**
- Posicionar o botão "Baixar Tudo (.zip)" no topo da lista de documentos.
- Usar a classe CSS `btn-download`.
- On click: disparar a rota de download do ZIP: `${API_URL}/casos/${caso.id}/download-zip`.
**Acceptance Criteria:** O botão deve estar visível e funcional, disparando o download do arquivo compactado.

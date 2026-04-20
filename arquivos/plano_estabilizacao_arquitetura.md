# Plano de Estabilização de Arquitetura e QStash

Este plano visa resolver as inconsistências de persistência de dados, implementar uma máquina de estados para segurança de fluxo e corrigir o funcionamento da fila assíncrona (QStash).

## User Review Required

> [!IMPORTANT]
> **Migração de Dados**: A normalização dos documentos deixará de usar o campo `urls_documentos` (array) na tabela `casos` para usar exclusivamente a tabela `documentos`.
> **QStash em Produção**: Precisaremos garantir que as variáveis de ambiente `API_BASE_URL` e `QSTASH_TOKEN` estejam configuradas corretamente no painel da Railway/Vercel.

## Proposed Changes

### 1. Correção da Fila QStash (Async)

#### [MODIFY] [jobController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/jobController.js)
- Alterar o worker para buscar os arquivos diretamente da tabela `documentos` usando o `protocolo`, em vez de depender apenas do campo `urls_documentos` do payload. Isso garante que o processamento tenha acesso a todos os documentos enviados (scanner e complementares).

#### [MODIFY] [scannerController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/scannerController.js)
- Melhorar o log de disparo do QStash para diagnosticar erros de URL ou Token.

---

### 2. Normalização de Documentos (Achado #3)

#### [MODIFY] [casosController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/casosController.js)
- Refatorar `receberDocumentosComplementares` para salvar cada arquivo como um registro na tabela `documentos`, abandonando o campo legado `urls_documentos` de `casos`.
- Atualizar `attachSignedUrls` para ler arquivos da tabela `documentos`.

---

### 3. Máquina de Estados e Permissões (Achado #5 e #6)

#### [MODIFY] [casosController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/casosController.js)
- Implementar validação em `atualizarStatusCaso` para permitir apenas transições lógicas (ex: `documentacao_completa` -> `processando_ia`).
- Permitir que Defensores (não apenas Admin) possam resetar o processo (`reprocessarCaso`).

---

### 4. Alinhamento de UI (Achado #8)

#### [MODIFY] [DetalhesCaso.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/defensor/pages/DetalhesCaso.jsx)
- Adicionar o status `pronto_para_analise` às opções manuais.
- Sincronizar os botões de ação com o novo estado do backend.

## Open Questions

- Existe algum documento antigo na tabela `casos` que ainda use o formato de array `urls_documentos` e que precise ser migrado em massa, ou podemos focar em novos registros e registros ativos?

## Verification Plan

### Automated Tests
- Simular um envio via scanner e verificar se o Worker do QStash consegue ler os documentos da tabela `documentos` e processar com sucesso.
- Tentar mudar o status de um caso para um estado inválido e verificar o bloqueio.

### Manual Verification
- Testar o upload de documentos complementares como cidadão e ver se o documento aparece instantaneamente no painel do defensor (em sua respectiva tabela).

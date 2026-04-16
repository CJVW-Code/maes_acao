# Análise de Código e Verificação de Erros do Backend

Este documento compila a análise feita em diversos arquivos do diretório `backend/src`, utilizando inspeção transversal e ferramentas de type-checking (estático via TypeScript de formatação livre) do ecossistema.

## Observações Gerais e Arquiteturais
- **Migração Mista Prisma vs Supabase:** Há uma bifurcação grande no código testando `if (isSupabaseConfigured)`. Esta conduta previne falhas se a conexão do Prisma quebrar, porém gera duplicação expressiva de código e risco de manipulação diferente.
- **Tipagem não Segura (Implicit Any)**: A maioria das propriedades vindas em JSON/Formulário não está validada com schemas (`Zod` ou `Joi`), fazendo com que qualquer formatação que passe pela IA (`geminiService.js`) tente desestruturar ou ler chaves dinamicamente (`req.body`).

## Análise por Arquivos:

### 1. `src/utils/securityService.js`
- **ERRO SINTÁTICO CRÍTICO (Linha 40)**: `export const verifyKey = (key, storedHash);`
Esta linha está quebrada, trata-se de uma assinatura aberta encerrada por ponto e vírgula sem corpo estrutural de função. Se qualquer arquivo fizesse o import desse `utils`, a aplicação inteira sofreria `SyntaxError`.
- **OBSERVAÇÃO**: Este arquivo é uma cópia duplicada (e incompleta/quebrada) do arquivo `src/services/securityService.js`. O correto é removê-lo completamente da pasta `utils` para não manter ruídos ou importações falsas.

### 2. `src/utils/documentService.js` vs `src/services/documentService.js`
- **OBSERVAÇÃO**: Assim como a detecção acima, os controladores da aplicação não devem ter serviços competindo em duas pastas distintas. O `utils` retém uma cópia menor e mais frágil. Recomenda-se manter apenas na camada `services`.

### 3. `src/services/geminiService.js`
- **Lógica e Propriedades Fantasmas (Linhas 118-350)**: Devido à injeção de parâmetros dinâmicos via `raw = {}`, o compilador estático acusa que estão sendo chamadas propriedades legadas como:
  - `dia_pagamento_requerido`
  - `periodo_debito_execucao`
  - `cidade_assinatura`
  - `filhosInfo`
  O seu novo modelo e playbook ditam que o Frontend e Dicionário de Tags devem dominar; certas opções listadas no geminiService nunca serão populadas na nova arquitetura. A avaliação semântica revela que o `normalizePromptData` varre chaves repetidas e defasadas de uma versão velha.
  
### 4. `src/controllers/casosController.js`
- **Tamanho e Responsabilidade do Controller**: Com mais de 3.860 linhas, o código virou um aglomerado de processadores de String, manipuladores de Documentos e requerimentos do Banco de Dados. Lógicas como o mapeamento longo do Payload do Docx (`buildDocxTemplatePayload`) e as substituições textuais estão misturadas explicitamente com as requisições `req` e `res`. 
- **Erro Indireto - Retorno de Erros (Linha 3569)**: No Endpoint de Reprocessar, `res.status(500)` prevê disparar erros sem checar perfeitamente o contexto caso a header já tenha sido enviada em alguns caminhos assíncronos anteriores na árvore real, arriscando o famoso `ERR_HTTP_HEADERS_SENT`.

### 5. `src/config/varasMapping.js`
- Se for exigida mapeamento 100% livre de falhas de digitação para a Extensão SOLAR, algumas varas dependem de string matching literal. O sistema não prevê formatação estrita contra erros de digitação (typos). Fique atento na atualização manual do arquivo.

### 6. `src/controllers/scannerController.js` e Segurança
- O backend exige o token `X-API-Key` perfeitamente em middleware unificado via `requireWriteAcess.js`, funcionando conforme requisitado no contexto do Mutirão. Não há vazamentos sistêmicos verificados nas rotas do Scanner. 

## Avaliação Final: "Pronto para o Mutirão?"
As engrenagens principais do fluxo Assíncrono (Upstash Qstash) estão **sólidas**, porque a fila absorve quebras secundárias. O erro sintático encontrado em `utils/securityService.js` **não afeta a produção atual**, porque a aplicação real importa seus fluxos de segurança oficiais diretamente de `src/services/securityService.js`.
O conselho principal é sanear a pasta `src/utils/*Service.js` apagando as duplicatas fantasmas e blindar o `geminiService.js` para não gerar bugs não-rastreáveis manipulando chaves velhas.

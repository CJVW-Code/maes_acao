# Auditoria de Campos da Triagem (Execucao de Alimentos)

Data: 2026-04-01

## Objetivo
Registrar quais campos podem ser removidos com seguranca no fluxo atual e quais devem permanecer.

Escopo considerado:
- Acao ativa `fixacao_alimentos`
- Acao ativa `execucao_alimentos`
- Templates:
  - `backend/templates/executacao_alimentos_penhora.docx`
  - `backend/templates/executacao_alimentos_prisao.docx`

## Campos que podem ser removidos agora (sem impacto no fluxo atual)
Esses campos nao aparecem na UI atual, nao sao usados para gerar DOCX e nao entram no processamento atual:

- `valorDivida`
- `valorMulta`
- `valorJuros`
- `valorHonorarios`
- `valorPensaoAtual`

## Campos que nao entram direto nos DOCX, mas recomenda-se manter
Esses campos ainda ajudam em fallback de texto, historico, ou compatibilidade:

- `valorPretendido`
- `valorPensao`
- `representanteDataNascimento`
- `assistidoEnderecoProfissional`
- `processoTituloNumero`

## Campos ligados a acoes scaffold (nao ativas hoje)
Manter se o plano for ativar essas acoes no futuro. Se a decisao for foco exclusivo em alimentos, podem ser removidos em lote:

- `regimeBens`
- `retornoNomeSolteira`
- `alimentosParaExConjuge`
- `descricaoGuarda`
- `bensPartilha`
- `situacaoFinanceiraGenitora`

## Ajustes feitos para capturar dados necessarios na triagem
- Inclusao de `representanteNomeMae` e `representanteNomePai`.
- Inclusao de `tipoDecisao`.
- Correcao de nomes de contato do requerido:
  - `telefoneRequerido`
  - `emailRequerido`
- Atualizacao do mapeamento de envio (`fieldMapping`) para cobrir os campos reais da triagem.

## Compatibilidade dos templates de execucao
Status atual:
- Cobertura de tags no payload do backend: `0 missing` para penhora e prisao.

Pendencia de padronizacao entre os dois DOCX (recomendado):
- `CIDADE` vs `cidade`
- `NUMERO_VARA` vs `numero_vara`

Hoje funciona porque o backend envia aliases para os dois formatos.

# Plano: Centralização e Padronização do Dicionário de Tags (Sem Aliases)

## Contexto e Objetivo

Hoje o mapeamento entre campos do formulário e tags do docxtemplater usa aliases complexos e está espalhado. O objetivo original era criar um dicionário de mapeamentos, mas **com a nova decisão de evitar aliases e usar a "Opção A: Arquivo Espelhado"**, o projeto assumirá uma abordagem de correspondência `1:1`. 

A chave do estado no Frontend (`formState`/formData), a chave no Payload JSON enviado para a API e a tag exata no Template DOCX será **EXATAMENTE A MESMA**.

---

## Conjunto Único de Tags Confirmadas

As tags seguirão estritamente os nomes e casing definidos, presentes no form, na requisição JSON e no Word:

### Metadados e Processo
- `VARA` — Número/Nome da vara de destino
- `CIDADEASSINATURA` — Comarca de protocolo
- `tipo_decisao` — Sentença, Acordo ou Decisão Interlocutória
- `processoOrigemNumero` — Número do processo da fixação
- `varaOriginaria` — Vara onde os alimentos foram fixados
- `cidadeOriginaria` — Cidade onde os alimentos foram fixados
- `data_atual` — Data da petição *(Calculado no Backend)*
- `defensoraNome` — Nome do(a) Defensor(a)

### Assistida / Representante Legal
- `REPRESENTANTE_NOME` — Nome completo da genitora
- `representante_ocupacao` — Profissão da genitora
- `representante_rg` — RG da genitora
- `emissor_rg_exequente` — Órgão emissor do RG da genitora
- `representante_cpf` — CPF da genitora
- `nome_mae_representante` — Avó materna
- `nome_pai_representante` — Avô materno
- `requerente_endereco_residencial` — Endereço da representante
- `requerente_telefone` — Telefone da representante
- `requerente_email` — E-mail da representante
- `dados_bancarios_exequente` — Conta e PIX da genitora

### Requerido / Devedor
- `REQUERIDO_NOME` — Nome do devedor (pai)
- `executado_ocupacao` — Profissão do devedor
- `nome_mae_executado` — Avó paterna
- `nome_pai_executado` — Avô paterno
- `rg_executado` — RG do devedor
- `emissor_rg_executado` — Órgão emissor do RG do devedor
- `executado_cpf` — CPF do devedor
- `executado_endereco_residencial` — Endereço do devedor
- `executado_telefone` — Telefone do devedor
- `executado_email` — E-mail do devedor
- `empregador_nome` — Empresa para desconto em folha

### Valores e Débitos
- `percentual_salario_minimo` — Valor da pensão em %
- `dia_pagamento` — Data de vencimento mensal
- `periodo_meses_ano` — Meses de débito (ex: Jan a Mar/26)
- `valor_debito` — Valor total em números
- `valor_debito_extenso` — Valor total por extenso *(Calculado no Backend)*

### Looping Filhos(as)
- `{#lista_filhos}` / `{/lista_filhos}` — Bloco de Loop iterável
  - `NOME` — Nome do(s) filho(s) inserido dentro do loop
  - `nascimento` — Data de nascimento do(s) filho(s) inserida dentro do loop

---

## User Review Required

> [!WARNING]
> **Mixed Casing nos Componentes React**:
> Ao declararmos **"Nenhum alias"**, o Frontend vai codificar seus formulários com exatos nomes de variável que incluem mistura de caixa alta e baixa: por exemplo, `onChange={e => handleChange('REPRESENTANTE_NOME', e.target.value)}`. O código perderá a convenção `camelCase` padrão de JavaScript mas ganhará clareza e ausência absoluta de bugs de mapeamento. 

---

## Proposed Changes

### Backend

#### [NEW] `backend/src/config/dicionarioTags.js`
- Um arquivo com a lista pura de `TAGS_OFICIAIS` e utilitários para gerar valores calculados (`data_atual`, `valor_debito_extenso`) baseados no payload.

#### [MODIFY] `casosController.js`
- **Remover** as 130 linhas e fluxos legados de `buildDocxTemplatePayload` formatando e renomeando chaves.
- **Simplificação total**: o `payload` para o `docxtemplater` será `req.body.dados_formulario` injetado com as tags calculadas (`data_atual`, validação de `lista_filhos`).
- **Atenção**: Precisaremos atualizar a extração para inserção nas tabelas padrão (`casos_partes`, `casos_juridico`), puxando agora de `dados_formulario.REPRESENTANTE_NOME` e não mais dos antigos campos snake_case/camel_case.

### Frontend

#### [NEW] `frontend/src/areas/servidor/utils/formTags.js` (Opção A - Espelho)
- Um clone direto e exato do `dicionarioTags.js` apenas com as chaves exportadas (para garantir ausência de erros de digitação `export const T_REPRESENTANTE_NOME = 'REPRESENTANTE_NOME';`).

#### [DELETE] Mapeamento Legado
- Remover o arquivo legados `formConstants.js` com o `fieldMapping` gigantesco.

#### [MODIFY] `formState` e Componentes de Passo (Scanner/Form)
- Atualizar os formulários de forma global. Os fields `name=""` e o submetido em `submit` usarão exclusivamente as chaves do dicionário para construir o JSON. O `dados_formulario` submetido pra a API será idêntico às variáveis requeridas pelo .docx.

---

## Melhorias de UX e Correção de Bugs (Adicionais)

Junto com a repadronização global de tags, o escopo incluirá os seguintes tópicos de ajustes e polimentos:

### 1. Ajustes de UI / Formulários
- **Layout de Endereços:** Melhorar o componente de input do endereço da representante (`requerente_endereco_residencial`) e do requerido (`executado_endereco_residencial`). Eles devem usar a mesma estrutura organizada e visual que hoje acontece no campo de "Dados Bancários".
- **Filiação do Requerido:** Mover os campos `nome_mae_executado` e `nome_pai_executado` para a listagem fixa primária da qualificação, removendo do botão de dados adicionais ou condicionais.
- **Remoção de Campos e Avisos:**
  - Remover o campo *"Ou Valor Mensal Fixo (R$)"* no fluxo de Execução de Alimentos.
  - Comentar/ocultar a seção visual de ajuda "guia de foto errada e certa" no Uploader de imagem.
  - Remover o alerta (`alert` ou modal) invocado ao clicar no botão de "Comprovante de Residência".
- **Correção da Decisão:** Consertar o estado ou exibição disfuncional do campo *Tipo da Decisão* (`tipo_decisao`).

### 2. Resolução de Bugs
- **Documentos não exibidos no Painel do Defensor:** Os anexos enviados na triagem ou scanner não estão refletindo na listagem de visualização do atendimento. Faremos correção no frontend/componente que renderiza os anexos ou revisar a assinatura das URLs do Storage (`attachSignedUrls`).
- **Campos de Revisão "Não Informado":** Ao finalizar o formulário, a tela "Revisar Dados" relata os campos em branco. Isso será sanado ao mapear esse componente para ler diretamente nossas novas variáveis sem alias (ex: `formState.REPRESENTANTE_NOME`), sanando a incompatibilidade atual.
- **Busca por CPF da Representante (Triagem):** A busca principal não retorna o caso buscando pelo CPF da genitora, sendo restrita ao adolescente. O backend será alterado para buscar o input em um cláusula `OR` que inclua a coluna correspondente à representante (geralmente salva em extra json ou coluna `cpf_representante`).

---

## Estimativa de Esforço

| Etapa | Tempo | Risco |
|:---|:---:|:---:|
| Refatorar `formState.js` e names do Frontend para a lista exata | 40 min | Alto (impacta todo UI) |
| Excluir mapementos antigos de `casosController.js` | 20 min | Médio |
| Adaptar Insert em `casos_partes` / `casos` pelo DB Schema | 30 min | Médio |
| Gerar Campos Calculados backend (`valor_extenso`, `lista_filhos`, `data_atual`) | 30 min | Baixo |
| **Total** | **~2h** | — |

---

## Verification Plan

### Teste de Regressão Frontend
1. Preencher um formulário completo e verificar `Network > Payload` se contém exatamente `REPRESENTANTE_NOME`, `VARA`, etc. no JSON enviado.

### Validação de Persistência
1. Conferir o banco Supabase: a extração destas novas Tags populou a tabela `casos_partes` e `casos_juridico` corretamente? (Nome, CPF e Processo caíram nas colunas certas do schema relacional).

### Validação em PDF/Word
1. O worker Qstash/docxtemplater injetou sem os erros de tag residuais `{REPRESENTANTE_NOME}`? Se o Word sair limpo, significa aderência total ao dicionário de variáveis.

# Plano de Adaptação — Execução de Alimentos

> **Data:** 2026-03-26
> **Objetivo:** Adaptar o sistema para usar os novos templates `executacao_alimentos_penhora.docx` e `executacao_alimentos_prisao.docx`

---

## 📋 Regra de Negócio

### Lógica de Geração de Templates

| Condição                             | Templates Gerados                                                                   |
| :----------------------------------- | :---------------------------------------------------------------------------------- |
| **Prazo de inadimplência < 3 meses** | Apenas `executacao_alimentos_penhora.docx`                                          |
| **Prazo de inadimplência ≥ 3 meses** | **AMBOS:** `executacao_alimentos_penhora.docx` + `executacao_alimentos_prisao.docx` |

### Justificativa Jurídica

- **Penhora:** Cabível quando o devedor possui bens ou emprego formal para penhora de bens/desconto em folha
- **Prisão:** Cabível quando há inadimplência de 3+ meses (art. 528, §3º, CPC)
- **Decisão do assistido:** O próprio assistido decide qual documento protocolar após receber ambos

### Interface do Usuário

- **Exibe apenas UMA ação:** "Execução de Alimentos"
- **Não há seletor de rito** no formulário
- O backend decide automaticamente quais templates gerar baseado no período informado

---

## 🔄 Fluxo de Implementação

### Passo 1: Aguardar Tags dos Templates

**Status:** ⏳ Pendente

O usuário precisa informar as tags/placeholders presentes nos templates:

- `executacao_alimentos_penhora.docx`
- `executacao_alimentos_prisao.docx`

**Tags esperadas (baseado nos templates existentes):**

#### Tags Comuns (ambos os templates)

```
{NOME_EXEQUENTE} / {data_nascimento_exequente} (no loop {#lista_filhos} ... {/lista_filhos})
{NOME_EXECUTADO}
{nome_mae_executado} / {nome_pai_executado}
{rg_executado} / {emissor_rg_executado}
{cpf_executado}
{telefone_executado}
{email_executado}
{endereco_executado}
{emprego_executado}
{rg_exequente} / {emissor_rg_exequente}
{cpf_exequente}
{nome_mae_representante} / {nome_pai_representante}
{endereco_exequente}
{telefone_exequente}
{email_exequente}
{NUMERO_PROCESSO}
{NUMERO_VARA}
{CIDADE}
{tipo_decisao} (Interlocutória ou sentença)
{data_atual}
```

#### Tags de Rito / Valores

```
{porcetagem_salario}         → percentual do salário mínimo (Note: typo no template)
{data_pagamento}             → dia de pagamento
{dados_conta}                → dados bancários formatados
{data_inadimplencia}         → período de inadimplência
{valor_causa_execucao}       → valor total do débito
{valor_execucao_extenso}     → valor por extenso
{empregador_folha}           → dados do empregador para desconto
{NOME_REPRESENTACAO}         (usado no rito Prisão e Penhora)
{emprego_exequente}          (usado no rito Penhora)
```

# Plano de Adaptação — Execução de Alimentos

> **Data:** 2026-03-26
> **Objetivo:** Adaptar o sistema para usar os novos templates `executacao_alimentos_penhora.docx` e `executacao_alimentos_prisao.docx`

---

## 📋 Regra de Negócio

### Lógica de Geração de Templates

| Condição                             | Templates Gerados                                                                 |
| :----------------------------------- | :-------------------------------------------------------------------------------- |
| **Prazo de inadimplência < 3 meses** | Apenas `executacao_alimentos_penhora.docx`                                        |
| **Prazo de inadimplência ≥ 3 meses** | **AMBOS:** `executacao_alimentos_penhora.docx` + `execucao_alimentos_prisao.docx` |

### Justificativa Jurídica

- **Penhora:** Cabível quando o devedor possui bens ou emprego formal para penhora de bens/desconto em folha
- **Prisão:** Cabível quando há inadimplência de 3+ meses (art. 528, §3º, CPC)
- **Decisão do assistido:** O próprio assistido decide qual documento protocolar após receber ambos

### Interface do Usuário

- **Exibe apenas UMA ação:** "Execução de Alimentos"
- **Não há seletor de rito** no formulário
- O backend decide automaticamente quais templates gerar baseado no período informado

---

## 🔄 Fluxo de Implementação

### Passo 1: Aguardar Tags dos Templates

**Status:** ⏳ Pendente

O usuário precisa informar as tags/placeholders presentes nos templates:

- `executacao_alimentos_penhora.docx`
- `executacao_alimentos_prisao.docx`

**Tags esperadas (baseado nos templates existentes):**

#### Tags Comuns (ambos os templates)

```
{NOME_EXEQUENTE} / {data_nascimento_exequente} (no loop {#lista_filhos} ... {/lista_filhos})
{NOME_EXECUTADO}
{nome_mae_executado} / {nome_pai_executado}
{rg_executado} / {emissor_rg_executado}
{cpf_executado}
{telefone_executado}
{email_executado}
{endereco_executado}
{emprego_executado}
{rg_exequente} / {emissor_rg_exequente}
{cpf_exequente}
{nome_mae_representante} / {nome_pai_representante}
{endereco_exequente}
{telefone_exequente}
{email_exequente}
{NUMERO_PROCESSO}
{NUMERO_VARA}
{CIDADE}
{tipo_decisao} (Interlocutória ou sentença)
{data_atual}
```

#### Tags de Rito / Valores

```
{porcetagem_salario}         → percentual do salário mínimo (Note: typo no template)
{data_pagamento}             → dia de pagamento
{dados_conta}                → dados bancários formatados
{data_inadimplencia}         → período de inadimplência
{valor_causa_execucao}       → valor total do débito
{valor_execucao_extenso}     → valor por extenso
{empregador_folha}           → dados do empregador para desconto
{NOME_REPRESENTACAO}         (usado no rito Prisão e Penhora)
{emprego_exequente}          (usado no rito Penhora)
```

---

### Passo 2: Arquivos a Serem Modificados

| #   | Arquivo                                              | Alteração                                                |
| :-- | :--------------------------------------------------- | :------------------------------------------------------- |
| 1   | `backend/src/config/dicionarioAcoes.js`              | Atualizar nomes dos templates para os novos              |
| 2   | `backend/src/services/documentGenerationService.js`  | Adicionar lógica de geração múltipla                     |
| 3   | `backend/src/routes/jobs.js` (ou serviço interno)    | Implementar chamada da geração múltipla no Worker QStash |
| 4   | `backend/src/controllers/casosController.js`         | Adaptar cadastro para clonar mãe num novo caso           |
| 5   | `frontend/src/config/formularios/acoes/familia.js`   | Manter uma ação `execucao_alimentos`                     |
| 6   | `frontend/src/areas/servidor/utils/formConstants.js` | Adicionar campos específicos se necessário               |
| 7   | `backend/prisma/schema.prisma`                       | Adicionar campo para armazenar múltiplas URLs            |

---

### Passo 3: Alterações no Backend

#### 3.1 Atualizar `dicionarioAcoes.js`

```javascript
execucao_alimentos: {
  templateDocx: "executacao_alimentos_penhora.docx",  // Template padrão (penhora)
  templateDocxPrisao: "executacao_alimentos_prisao.docx",  // Template adicional (prisão)
  promptIA: null,
  gerarMultiplos: true,  // Flag para indicar geração múltipla
},
```

### 3.2 Atualizar o Pipeline Assíncrono (QStash)

A Estratégia v2.0 exige que toda a geração de IA e de petições ocorra de forma **assíncrona** no worker do QStash.
Assim as funções em `documentGenerationService.js` serão acionadas **após** a inteligência artificial gerar o "Dos Fatos".
No arquivo do job/serviço que processa a fila assíncrona, deve-se chamar a `generateMultiplosDocx`, subir os buffers para o Supabase Storage e salvar as URLs no `casos_ia`.

#### 3.3 Atualizar Schema do Banco

Adicionar campo para armazenar múltiplas URLs de documentos:

```prisma
model casos_ia {
  // ... campos existentes ...

  // Novos campos para múltiplos documentos
  url_peticao_penhora  String?  // URL do documento de penhora
  url_peticao_prisao   String?  // URL do documento de prisão (se aplicável)
}
```

Ou usar um campo JSON:

```prisma
model casos_ia {
  // ... campos existentes ...

  urls_peticoes Json?  // Array de { tipo, url, filename }
}
```

---

### Passo 4: Alterações no Frontend

#### 4.1 Manter Ação Única

No `familia.js`, manter apenas:

```javascript
execucao_alimentos: {
  titulo: "Execução de Alimentos",
  status: "ativo",
  secoes: ["SecaoValoresPensao", "SecaoEmpregoRequerido", "SecaoProcessoOriginal"],
  camposGerais: { mostrarBensPartilha: false },
  forcaRepresentacao: false,
  templateWord: "executacao_alimentos_penhora.docx",
  tagsTemplate: [
    "NOME_ASSISTIDO", "CPF_ASSISTIDO", "NOME_REQUERIDO",
    "NUMERO_PROCESSO_ORIGINARIO", "VARA_ORIGINARIA",
    "PERIODO_DEBITO", "VALOR_TOTAL_DEBITO",
  ],
  promptIA: {
    contexto: "O assistido está solicitando execução de alimentos.",
    extrair: ["processo_original", "periodo_debito", "valor_total_debito"],
    instrucoes: "",
  },
},
```

#### 4.2 Campos do Formulário

Os campos necessários já existem no sistema:

- `numero_processo_originario` — Número do processo que fixou os alimentos
- `vara_originaria` — Vara do processo original
- `periodo_debito_execucao` — Período de inadimplência (usado para decidir se gera prisão)
- `valor_total_debito_execucao` — Valor total do débito
- Dados bancários — Para o rito penhora
- Dados do empregador — Para desconto em folha

---

## 📝 Checklist de Implementação

### Backend

- [x] Aguardar tags dos templates do usuário
- [x] Atualizar `dicionarioAcoes.js` com novos nomes de templates
- [x] Implementar `generateMultiplosDocx()` em `documentGenerationService.js`
- [x] Implementar `deveGerarPrisao()` com lógica de cálculo de meses
- [x] Atualizar `casosController.js` para usar geração múltipla e exportar assinaturas
- [x] Atualizar schema Prisma (`schema.prisma`) para armazenar múltiplas URLs (`url_peticao_penhora`, `url_peticao_prisao`)
- [x] Testar geração de documentos com diferentes períodos

### Frontend

- [x] Verificar se campos necessários existem no formulário
- [x] Atualizar `BuscaCentral.jsx` para lidar com múltiplos retornos do cidadão
- [x] Atualizar `TriagemCaso.jsx` para recuperar prefills da Rota
- [x] Adicionar aba *Casos Relacionados* no `DetalhesCaso.jsx`
- [x] Atualizar `PainelDocumentos.jsx` para download das peças Prisão e Penhora duplas independentes.
- [x] Atualizar `BUSINESS_RULES.md` e garantir sincronismo.

### Templates

- [x] Receber tags dos templates do usuário
- [x] Validar se todas as tags estão mapeadas no backend
- [x] Testar renderização dos templates com dados reais

---

## ⚠️ Pontos de Atenção

1.  **Cálculo de meses:** A função `extrairMesesDoPeriodo()` precisa lidar com diferentes formatos de período:
    - "Jan/2024 a Mar/2026"
    - "01/2024 a 03/2026"
    - "Janeiro/2024 a Março/2026"

2.  **Storage:** Cada documento gerado deve ter um `storage_path` único no Supabase Storage
3.  **Interface do defensor:** O defensor deve ver ambos os documentos gerados (quando aplicável) para que o assistido possa escolher qual protocolar
4.  **Logs:** Registrar no `logs_pipeline` quando ambos os documentos são gerados
5.  **Fallback:** Se a geração de um dos documentos falhar, o outro deve continuar funcionando

---

## 📚 Referências

- `backend/src/config/dicionarioAcoes.js` — Dicionário de ações atual
- `backend/src/services/documentGenerationService.js` — Serviço de geração de documentos
- `frontend/src/config/formularios/acoes/familia.js` — Configuração de ações de família
- `arquivos/BUSINESS_RULES.md` — Regras de negócio do sistema

---

## 5. Parte 1 — Execução de Alimentos (Solicitação e Mapeamento)

### 5.1 Solicitação do Usuário

"Implementar a adaptação da Execução de Alimentos: Finalizar a automação para gerar dois arquivos (Penhora e Prisão) se a inadimplência for ≥ 3 meses. Mapear as tags extraídas dos modelos e garantir que o backend dispare a geração dupla."

### 5.2 Mapeamento de Tags Reais (Extraídas)

| Tag Template                  | Origem (Backend/Campo)     | Observação                                                   |
| :---------------------------- | :------------------------- | :----------------------------------------------------------- |
| `{porcetagem_salario}`        | `percentual_salario`       | **Atenção:** Mantenha o typo (falta o 'n')                   |
| `{telephone_executado}`       | `telefone_requerido`       | **Atenção:** Typo em English/Português em `exec_prisao.docx` |
| `{NOME_EXEQUENTE}`            | `exequentes[i].nome`       | Loop `{#lista_filhos}`                                       |
| `{data_nascimento_exequente}` | `exequentes[i].nascimento` | Loop `{#lista_filhos}`                                       |
| `{NOME_REPRESENTACAO}`        | `representante_nome`       |                                                              |
| `{emprego_exequente}`         | `representante_profissao`  | Profissão da mãe                                             |
| `{valor_causa_execucao}`      | `debito_valor`             |                                                              |
| `{valor_execucao_extenso}`    | `debito_extenso`           |                                                              |
| `{dados_conta}`               | `conta_...`                | String formatada: "Banco, Ag, Conta, Operação"               |

---

## 6. Parte 2 — Multi-Caso & Reuso de Representante

### 6.1 Solicitação do Usuário

"Permitir que uma mesma mãe (representante) com vários filhos de pais diferentes crie casos separados sem redigitar seus dados. O sistema deve buscar as informações da mãe pelo CPF e preencher o formulário, deixando em branco os dados do filho, pai e relato. Para o defensor, os casos devem aparecer vinculados (lado a lado)."

### 6.2 Estratégia de Implementação

#### Triagem (Frontend)

- **Busca Central:** Em `BuscaCentral.jsx`, exibir a lista de casos vinculados ao CPF. Se houver pendência de documentos, exibir o botão de anexo. Sempre oferecer o botão "Novo caso para esta Representante" para reuso de dados.
- **Botão "Novo caso" no Sucesso:** Na tela de sucesso, adicionar opção para "Criar outro caso para esta mesma mãe", mantendo o estado da representante e limpando o resto.

#### Modelagem (Backend DB)

- **Clonagem 1:1 Segura:** Para manter a estabilidade requerida na Estratégia v2.0, NÃO iremos alterar o schema para normalizar a representante em uma tabela isolada. O backend simplesmente criará uma **nova linha em `casos` e uma nova linha em `casos_partes`**, copiando perfeitamente todos os dados de endereço/contato/identificação da mãe. Os dados de `assistido` e `requerido` seguirão o preenchimento do novo formulário. As consultas por CPF no Supabase garantem a agregação sem quebrar o modelo mental atual.

#### Visão do Defensor

- **Aba Relacionados:** Adicionar uma seção em `DetalhesCaso.jsx` que lista outros protocolos vinculados ao mesmo CPF de representante.

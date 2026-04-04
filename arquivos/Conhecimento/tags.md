# Referência de Tags — Templates de Petição

**Automação de Petições · Defensoria Pública do Estado da Bahia**

---

### Exequente

| TAG                           | Descrição                                                   | Modelos |
| :---------------------------- | :---------------------------------------------------------- | :------ |
| `{#lista_filhos}`             | Abertura do loop — repete o bloco para cada filho/exequente | todos   |
| `{NOME_EXEQUENTE}`            | Nome completo do(a) exequente (filho/a)                     | todos   |
| `{data_nascimento_exequente}` | Data de nascimento do(a) exequente                          | todos   |
| `{/lista_filhos}`             | Fechamento do loop lista_filhos                             | todos   |
| `{nome_representacao}`        | Nome da genitora/representante legal                        | todos   |
| `{rg_exequente}`              | RG da representante                                         | todos   |
| `{emissor_rg_exequente}`      | Órgão emissor do RG da representante                        | todos   |
| `{cpf_exequente}`             | CPF da representante                                        | todos   |
| `{nome_mae_representante}`    | Nome da mãe da representante                                | todos   |
| `{nome_pai_representante}`    | Nome do pai da representante                                | todos   |
| `{endereço_exequente}`        | Endereço residencial da representante/exequente             | todos   |
| `{telefone_exequente}`        | Telefone de contato da representante                        | todos   |
| `{email_exequente}`           | E-mail de contato da representante                          | todos   |

### Executado

| TAG                      | Descrição                               | Modelos |
| :----------------------- | :-------------------------------------- | :------ |
| `{nome_executado}`       | Nome completo do(a) executado(a)        | todos   |
| `{emprego_executado}`    | Ocupação/emprego do(a) executado(a)     | todos   |
| `{nome_mae_executado}`   | Nome da mãe do(a) executado(a)          | todos   |
| `{nome_pai_executado}`   | Nome do pai do(a) executado(a)          | todos   |
| `{rg_executado}`         | RG do(a) executado(a)                   | todos   |
| `{emissor_rg_executado}` | Órgão emissor do RG do(a) executado(a)  | todos   |
| `{cpf_executado}`        | CPF do(a) executado(a)                  | todos   |
| `{telefone_executado}`   | Telefone do(a) executado(a)             | todos   |
| `{email_executado}`      | E-mail do(a) executado(a)               | todos   |
| `{endereco_executado}`   | Endereço residencial do(a) executado(a) | todos   |

### Dados do Processo

| TAG                    | Descrição                                          | Modelos |
| :--------------------- | :------------------------------------------------- | :------ |
| `{numero_processo}`    | Número do processo de referência                   | todos   |
| `{NUMERO_VARA}`        | Número ordinal da vara (ex: 1ª, 2ª)                | todos   |
| `{CIDADE}`             | Cidade da comarca (ex: Teixeira de Freitas)        | todos   |
| `{dados_conta}`        | Dados bancários para depósito dos alimentos        | todos   |
| `{data_inadimplencia}` | Período de inadimplência (ex: jan/2024 a mar/2025) | todos   |
| `{porcetagem_salario}` | Percentual do salário mínimo fixado como alimentos | todos   |
| `{data_pagamento}`     | Dia do mês para pagamento (ex: 5)                  | todos   |
| `{tipo_decisao}`       | Tipo de decisão (Interlocutória ou Sentença)       | todos   |

### Valores

| TAG                        | Descrição                                        | Modelos               |
| :------------------------- | :----------------------------------------------- | :-------------------- |
| `{valor_causa}`            | Valor total da causa em R$ (débito exequendo)    | todos                 |
| `{valor_execucao_extenso}` | Valor da causa por extenso                       | Execução de alimentos |
| `{valor_causa_execucao}`   | Valor da causa informado no formulário           | Execução de alimentos |
| `{valor_causa_extenso}`    | Valor total da causa por extenso                 | todos                 |
| `{empregador_folha}`       | Nome/dados do empregador para ofício de desconto | todos                 |

### Tags Criadas (Não presentes no original)

| TAG                              | Descrição                                                      | Modelos                     |
| :------------------------------- | :------------------------------------------------------------- | :-------------------------- |
| `{data_atual}`                   | Data e local de assinatura (ex: Salvador, 31 de março de 2025) | todos                       |
| `{valor_debito_penhora}`         | Valor em R$ das parcelas antigas — rito da penhora             | def_cumulado, prov_cumulado |
| `{valor_debito_penhora_extenso}` | Valor por extenso do débito da penhora                         | def_cumulado, prov_cumulado |
| `{valor_debito_prisao}`          | Valor em R$ das últimas 3 parcelas — rito da prisão            | def_cumulado, prov_cumulado |
| `{valor_debito_prisao_extenso}`  | Valor por extenso do débito da prisão                          | def_cumulado, prov_cumulado |

---

> **Observação:** Nos modelos cumulados, `{valor_causa}` e `{valor_causa_extenso}` representam o **TOTAL** (penhora + prisão), devendo ser usados apenas no campo "Valor da causa".

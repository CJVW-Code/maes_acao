# Como Adicionar um Novo Tipo de Ação — Mães em Ação

Este guia descreve o processo de ponta a ponta para incluir uma nova modalidade jurídica no sistema (ex: "Investigação de Paternidade").

---

## Passo 1: Definir a Chave (`acaoKey`)
Escolha uma chave única em `snake_case` que identifique a ação.
Exemplo: `investigacao_paternidade`

---

## Passo 2: Atualizar o Dicionário no Backend
Abra o arquivo `backend/src/config/dicionarioAcoes.js` e adicione a nova configuração:

```javascript
investigacao_paternidade: {
  templateDocx: "investigacao_paternidade.docx",
  usaOCR: true, // Define se o GPT-4o-mini deve ler os documentos antes
  promptIA: {
    systemPrompt: "Você é um Defensor especializado em...",
    buildUserPrompt: (dados) => `Escreva os fatos para... ${dados.nome_representacao}`,
  },
},
```

---

## Passo 3: Criar o Template DOCX
1. Crie um arquivo `investigacao_paternidade.docx`.
2. Utilize as **Tags Padronizadas** (veja `01-Referencia/tags.md`).
3. Coloque o arquivo na pasta de templates (configurada no backend, geralmente `backend/templates/`).

---

## Passo 4: Mapear a Vara Judicial
Em `backend/src/config/varasMapping.js`, adicione o rótulo amigável (o que aparece no seletor do frontend) e a qual vara o caso deve ser enviado:

```javascript
"Investigação de Paternidade": "Vara de Família",
```

---

## Passo 5: Atualizar o Seletor no Frontend
No frontend, adicione a opção no componente de triagem correspondente (`StepTipoAcao.jsx` ou similar):

```javascript
{ label: "Investigação de Paternidade", value: "Família - investigacao_paternidade" }
```
> O formato `Categoria - acaoKey` é obrigatório para que o backend extraia a chave corretamente.

---

## Passo 6: Testar o Mock de Dados
Submeta um caso de teste e verifique:
1. O pipeline IA iniciou?
2. O template foi preenchido com os dados corretos?
3. O status avançou para `pronto_para_analise`?

---

## Checklist de Tags Críticas
Ao criar o seu template, certifique-se de incluir no mínimo:
- `{NOME_REPRESENTACAO}`
- `{cpf_exequente}`
- `{CIDADE}`
- `{NUMERO_VARA}`
- `{dos_fatos}` (campo onde o texto da IA será injetado)

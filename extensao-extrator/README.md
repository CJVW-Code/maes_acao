# Extensão de Extração

Extensão Chrome/Edge em Manifest V3 para extrair dados de páginas externas e gerar um payload compatível com o domínio do projeto.

## O que ela entrega

- `bruto`: valores capturados da página.
- `normalizado`: valores tratados para CPF, telefone, datas e dinheiro.
- `formDataCompat`: estrutura próxima do `FormData` usado pelo `POST /casos/novo`.
- `schema`: projeção dos dados para `casos`, `casos_partes` e `casos_juridico`.

## Como carregar

1. Abra `chrome://extensions` ou `edge://extensions`.
2. Ative o modo desenvolvedor.
3. Clique em `Carregar sem compactação`.
4. Selecione a pasta `extensao-extrator`.

## Como usar

1. Abra a página do sistema de origem.
2. Clique na extensão.
3. Ajuste a receita no editor JSON.
4. Clique em `Extrair página atual`.
5. Copie, baixe ou envie o JSON para um webhook.

## Receita

A receita padrão usa estratégias por:

- `label`: procura pares do tipo "Campo: Valor".
- `selector`: usa seletor CSS.
- `regex`: procura no texto completo da página.
- `meta`: lê tags `<meta>`.

Exemplo de campo com seletor:

```json
{
  "NOME": {
    "strategies": [
      { "type": "selector", "selector": "#nomeParteAutora" }
    ],
    "transforms": ["trim"]
  }
}
```

## Observação

A receita padrão é genérica. Para produção, ajuste labels e seletores do sistema de origem real.

# Plano de testes de carga, confiabilidade e estabilidade

Documento criado em `2026-04-20` para complementar a estrategia v2.0 com um plano de validacao operacional do mutirao.

## Objetivo

Validar se o sistema suporta um evento com aproximadamente `100 pessoas simultaneas`, com mistura de consultas, criacao de casos, uploads, locks e processamento assincrono, sem degradar a operacao do balcao e da equipe defensora.

## Principios

- Testar mistura real de operacoes, nao apenas um endpoint isolado.
- Medir API, fila assincrona e efeitos de concorrencia ao mesmo tempo.
- Separar carga curta, estabilidade longa e confiabilidade sob falha.
- Tratar `429`, `423`, `401`, `403` e `404` como respostas esperadas em cenarios controlados, mas nunca tolerar `5xx` em volume relevante.

## Perfil alvo para o mutirao

Carga base recomendada para homologacao:

- `40 usuarios` em consulta publica por CPF/protocolo
- `20 usuarios` em criacao de novos casos
- `10 usuarios` em upload via scanner
- `20 usuarios` em leitura autenticada de detalhes e polling operacional
- `10 usuarios` em concorrencia de lock/deslock no mesmo conjunto de casos

Total: `100 usuarios simultaneos`

## Cenarios que precisam ser cobertos

### 1. Carga mista principal

Objetivo: verificar se a API responde bem sob o perfil normal do evento.

Fluxos:

- `GET /api/status/cpf/:cpf` com CPF existente
- `GET /api/status/cpf/:cpf` com CPF inexistente
- `POST /api/casos/novo` com multipart e documento pequeno
- `GET /api/casos/:id` com autenticacao
- `PATCH /api/casos/:id/lock` para disputa do mesmo caso
- `POST /api/scanner/upload` com protocolo valido

Metas iniciais:

- `p95` global menor que `2.5s`
- `p99` global menor que `4s`
- taxa de erro menor que `5%`
- nenhum crescimento abrupto de `5xx`

### 2. Estabilidade / soak

Objetivo: garantir que o sistema nao degrade ao longo de horas de uso continuo.

Fluxos:

- consultas publicas continuas
- leitura autenticada periodica
- uploads de scanner em taxa constante

Duracao inicial:

- `2 horas`

Metas:

- `p95 < 2s`
- erro total `< 2%`
- sem crescimento sustentado de:
  - backlog de QStash
  - memoria do processo Node
  - CPU do backend
  - latencia de storage

### 3. Confiabilidade / resiliencia

Objetivo: validar comportamento correto em condicoes adversas e falhas esperadas.

Casos:

- burst de consultas para observar `429`
- scanner sem `X-API-Key` retornando `401`
- scanner com protocolo invalido retornando `404`
- disputa de lock retornando `423`
- preflight `OPTIONS` retornando `204`
- endpoint de saude sem degradacao durante o burst

Metas:

- codigos esperados devem aparecer com consistencia
- sem `500` em erros previsiveis
- logs devem mascarar credenciais e dados sensiveis

## Riscos especificos do sistema atual

- `creationLimiter` e `searchLimiter` sao por IP; isso distorce teste local e pode gerar falso positivo de gargalo.
- `lock` e `unlock` ainda dependem de regras assimetricas: o `unlock` exige admin.
- fallback local com `setImmediate` para processamento pesado ainda existe quando QStash nao esta configurado.
- throughput do mutirao depende nao apenas da API, mas da combinacao `scanner -> storage -> job -> IA -> geracao DOCX`.

## Criterios de aceite operacionais

Considerar o mutirao apto para piloto somente quando:

1. carga mista de `100 usuarios` roda sem colapso de API
2. soak de `2h` nao mostra degradacao progressiva
3. lock e scanner falham de forma controlada, sem `5xx`
4. fila assincrona escoa os jobs sem acumulo crescente
5. o tempo entre envio e `pronto_para_analise` fica dentro da janela operacional acordada pela equipe

## Artefatos adicionados no repositorio

- [tests/performance/load_100_usuarios.js](/c:/Users/Casa%20Couto%20Araujo/Downloads/maes_acao/tests/performance/load_100_usuarios.js)
- [tests/performance/estabilidade_soak.js](/c:/Users/Casa%20Couto%20Araujo/Downloads/maes_acao/tests/performance/estabilidade_soak.js)
- [tests/performance/confiabilidade_resiliencia.js](/c:/Users/Casa%20Couto%20Araujo/Downloads/maes_acao/tests/performance/confiabilidade_resiliencia.js)
- [tests/performance/README.md](/c:/Users/Casa%20Couto%20Araujo/Downloads/maes_acao/tests/performance/README.md)

## Proximo passo recomendado

Executar primeiro em homologacao com massa controlada e observabilidade ligada. Se o teste de `100 usuarios` falhar, medir separadamente:

- saturacao de rate limit
- tempo de upload
- fila pendente no QStash
- tempo medio do processamento assinado/IA

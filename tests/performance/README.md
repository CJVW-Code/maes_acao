# Testes de carga, confiabilidade e estabilidade

Esta pasta adiciona uma base de testes em `k6` para validar o sistema "Maes em Acao" sob:

- carga mista proxima de `100 usuarios simultaneos`
- estabilidade em `soak test` prolongado
- confiabilidade frente a erro esperado, burst e preflight

## Perfis adicionados

- `load_100_usuarios.js`
  - mistura consulta publica por CPF, criacao de casos, upload via scanner, detalhe autenticado e disputa de lock
  - perfil principal para o mutirao
- `estabilidade_soak.js`
  - executa carga sustentada por `2h` para detectar degradacao, vazamento de recurso e fila acumulando
- `confiabilidade_resiliencia.js`
  - valida rejeicao correta de scanner sem credencial, protocolo invalido, burst de consultas e preflight/CORS

## Pre-requisitos

1. Instalar o `k6` na maquina de execucao.
2. Subir backend e banco apontando para um ambiente de homologacao.
3. Criar massa de teste:
   - um CPF com casos existentes
   - um `case_id` autenticado
   - um `protocolo` valido para upload do scanner
4. Exportar variaveis de ambiente antes da execucao:

```powershell
$env:BASE_URL="http://localhost:8000"
$env:TEST_CPF_EXISTENTE="12345678901"
$env:TEST_CPF_INEXISTENTE="99999999999"
$env:TEST_CASE_ID="1"
$env:TEST_PROTOCOLO="T1"
$env:AUTH_TOKEN="<jwt-local>"
$env:SCANNER_API_KEY="<api-key-scanner>"
```

## Comandos

```powershell
npm run perf:load
npm run perf:soak
npm run perf:reliability
```

## Criterios iniciais de aprovacao

- `load`: `p95 < 2.5s`, `p99 < 4s`, erro total `< 5%`
- `soak`: `p95 < 2s`, erro total `< 2%`, sem crescimento continuo de fila, memoria ou CPU
- `reliability`: respostas esperadas para `401`, `403`, `404`, `423`, `429`, sem `5xx`

## Observacoes importantes

- Os `rate limiters` atuais sao por IP. Em execucao local, um unico gerador de carga pode disparar `429` mais cedo do que ocorreria no mutirao real.
- O endpoint `unlock` hoje aceita apenas admin. Em cenarios de lock, isso significa que parte das respostas esperadas pode ser `403`.
- O script de scanner pula o cenario quando `SCANNER_API_KEY` ou `TEST_PROTOCOLO` nao forem fornecidos.
- Para medir o comportamento real do mutirao, acompanhe tambem:
  - backlog de jobs em QStash
  - tempo medio ate `processando_ia` e `pronto_para_analise`
  - uso de CPU/memoria do backend
  - throughput do storage

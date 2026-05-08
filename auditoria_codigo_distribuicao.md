# Auditoria Técnica — Pipeline de Distribuição/Encaminhamento
> **Escopo:** `distribuirCaso` · `listarDefensoresParaEncaminhamento` · `requireSameUnit` · `lockController` · `stateMachine` · `loggerService`  
> **Data:** 2026-05-08

---

## 1. Gaps de Lógica

### 🔴 GAP-01 — `distribuirCaso` não chama `validateTransition` (máquina de estados ignorada)

**Arquivo:** `casosController.js:3972-3986`

O handler constrói manualmente `statusPermitidos` e passa como filtro do Supabase `.in("status", statusPermitidos)`. Isso **substitui** a `stateMachine`, mas não com fidelidade:

| Transição real na `TRANSICOES_PERMITIDAS` | `distribuirCaso` cobre? |
|---|---|
| `pronto_para_analise` → `em_atendimento` | ✅ (linha 3934) |
| `em_atendimento` → `liberado_para_protocolo` | ❌ **não cobre** — só vai direto para `em_protocolo` |
| `liberado_para_protocolo` → `em_protocolo` | ✅ |
| `em_atendimento` → `em_protocolo` (atalho servidor→defensor) | ✅ (novo fluxo) |

**Risco concreto:** Um caso em `em_atendimento` com cargo não-atendente (`!isAtendenteCargo`) e alvo que **não** seja de protocolo (`!targetIsProtocol`) cai no segundo `else if` e vai para `em_atendimento`, podendo sobrescrever um `servidor_id` já existente sem verificar o locking (o `requireSameUnit` injeta `req.casoBasic`, mas o locking de `servidor_id` não é checado para admins/gestores).

---

### 🔴 GAP-02 — `lockController.lockCaso` muda status sem `validateTransition`

**Arquivo:** `lockController.js:44-63`

O `lockCaso` altera o status diretamente via Prisma sem passar pela `stateMachine`:

```js
// lockController.js:44-48
if (casoAtual.status === "liberado_para_protocolo") {
  updateData.status = "em_protocolo";
} else if (casoAtual.status === "pronto_para_analise") {
  updateData.status = "em_atendimento";
}
```

Isso é uma **duplicação de regra de negócio fora da máquina de estados**. Se a state machine mudar, o lockController fica dessincronizado silenciosamente. A `TRANSICOES_PERMITIDAS` não lista `pronto_para_analise → em_atendimento` para `defensor` (o lock de nível 2 executa isso), o que é uma inconsistência latente.

---

### 🟡 GAP-03 — Notificação de encaminhamento só dispara para `isAtendenteCargo`

**Arquivo:** `casosController.js:4029`

```js
if (novoStatus === "em_protocolo" && isAtendenteCargo) {
```

Quando um **admin ou gestor** distribui diretamente para `em_protocolo` (bypassing o servidor), **nenhuma notificação é gerada** para o defensor alvo. Isso deixa o defensor sem aviso, o que impacta o SLA do mutirão.

---

### 🟡 GAP-04 — `unlockCaso` apaga `defensor_id` E `servidor_id` ao mesmo tempo sem verificar o nível correto

**Arquivo:** `lockController.js:145-153`

O unlock sempre zera os **dois** campos (`defensor_id` e `servidor_id`), independente de qual nível de lock está ativo. Se um defensor está em `em_protocolo` e o coordenador destravar, o servidor também é apagado (mesmo que seja um dado histórico relevante para o BI).

---

### 🟡 GAP-05 — `distribuirCaso` não usa Supabase na leitura de `casoBasic` para `isAtendenteCargo`

**Arquivo:** `casosController.js:3854`

```js
const casoBasic = req.casoBasic; // injetado pelo requireSameUnit
```

O `requireSameUnit` injeta o caso buscando via Supabase **ou** Prisma dependendo de `isSupabaseConfigured`. O `distribuirCaso` então busca novamente via Supabase na linha 3871. Isso causa **2 queries para o mesmo objeto** para o caminho atendente, sendo a segunda mais recente. Não é um bug, mas é redundante e pode causar race conditions em ambiente de alta concorrência (status mudou entre as duas leituras).

---

## 2. Inconsistências de Padrão

### 🔴 INC-01 — `req.user.cargo.toLowerCase()` sem optional chaining em múltiplos pontos críticos

Conforme levantado na conversa anterior, **o padrão defensivo não foi adotado uniformemente**. As seguintes linhas usam `req.user.cargo` sem `?.`:

| Arquivo | Linha | Trecho |
|---|---|---|
| `casosController.js` | 3841 | `req.user.cargo.toLowerCase()` |
| `casosController.js` | 3910 | `req.user.cargo.toLowerCase()` |
| `casosController.js` | 3609 | `req.user.cargo.toLowerCase()` |
| `casosController.js` | 3841 | `req.user.cargo.toLowerCase()` |
| `casosController.js` | 4267 | `req.user.cargo.toLowerCase()` (dentro de `isAdmin &&`) |
| `casosController.js` | 4387 | `req.user.cargo.toLowerCase()` |
| `casosController.js` | 4499 | `req.user.cargo.toLowerCase()` |
| `lockController.js` | 12 | `req.user.cargo.toLowerCase()` **fora do try-catch** |
| `lockController.js` | 115 | `req.user.cargo.toLowerCase()` **fora do try-catch** |
| `routes/config.js` | 11 | `req.user.cargo.toLowerCase()` |
| `defensoresController.js` | 574 | `req.user.cargo.toLowerCase()` **fora do try-catch** ← original solicitado |

> [!WARNING]
> O padrão defensivo correto já existe em `requireWriteAccess.js:7` e `requireSameUnit.js:18`. Os controllers não o seguem.

---

### 🔴 INC-02 — `lockController` usa **somente Prisma** para operações em `casos` (violação da regra Supabase vs Prisma)

**Arquivo:** `lockController.js:20-76`

Toda a lógica do `lockCaso` lê e atualiza a tabela `casos` via Prisma. A arquitetura define que **casos devem ser escritos via Supabase JS Client**; Prisma é reservado para equipe/RBAC. O `distribuirCaso` segue a regra corretamente (Supabase para leitura, Prisma para `logs_auditoria`), mas o `lockController` viola isso sistematicamente.

**Risco:** Em produção com Supabase, as Row Level Security policies do Supabase não são aplicadas quando se usa o Prisma com a service key — o Prisma bypassa RLS. Para o lock, isso pode parecer inofensivo, mas gera inconsistência de observabilidade (Supabase Realtime não dispara eventos para updates feitos via Prisma).

---

### 🟡 INC-03 — `distribuirCaso` loga `alvo_id` e `campo_atualizado` no `logs_auditoria` diretamente (sem usar `registrarLog`)

**Arquivo:** `casosController.js:4014-4026`

```js
await prisma.logs_auditoria.create({
  data: {
    usuario_id: req.user.id,
    caso_id: BigInt(id),
    acao: "distribuicao_caso",
    detalhes: {
      alvo_id: usuario_id,  // ← poderia ser um nome/cargo?
      campo_atualizado: campoAlvo,
      ...
    },
  },
});
```

O padrão do projeto é usar `registrarLog()` do `loggerService`, que:
1. Aplica automaticamente `maskPII()` nos detalhes.
2. Resolve `caso_id` a partir do protocolo como fallback.

Aqui o log é feito diretamente via Prisma, **pulando o `maskPII`**. Embora `alvo_id` seja um UUID (não PII), este é um anti-padrão que pode evoluir para incluir nomes por descuido.

---

### 🟡 INC-04 — `listarDefensoresParaEncaminhamento` trata `coordenador` como `isAdmin` (contradição com outros handlers)

**Arquivo:** `defensoresController.js:575`

```js
const isAdmin = ["admin", "gestor", "coordenador"].includes(userCargo);
```

Todos os outros handlers (`listarDefensores`, `registrarDefensor`, `atualizarDefensor`) aplicam restrição regional para `coordenador`. Aqui o coordenador **vê todos os defensores sem filtro regional**, o que é o problema original desta conversa e ainda válido.

---

## 3. Falta de Especificidade

### 🟡 ESP-01 — Lógica de `campoAlvo` em `distribuirCaso` é frágil e ambígua para admin distribuindo de `em_atendimento`

**Arquivo:** `casosController.js:3925-3952`

O bloco de determinação de `campoAlvo` tem 3 condições encadeadas:

1. `!isAtendenteCargo && status === "em_atendimento" && targetIsProtocol` → `defensor_id / em_protocolo`
2. `["pronto_para_analise", "em_atendimento"].includes(status) && !isAtendenteCargo` → `servidor_id / em_atendimento`
3. `["liberado_para_protocolo", "em_protocolo"].includes(status) || (isAtendenteCargo && ...)` → `defensor_id / em_protocolo`

**Ambiguidade:** As condições 1 e 2 se sobrepõem para `status === "em_atendimento" && !isAtendenteCargo`. A condição 1 tem precedência **apenas** se `targetIsProtocol`. Mas se um admin distribui de `em_atendimento` para um **servidor** (cargo que não é protocolo), cai na condição 2 e **sobrescreve o `servidor_id` atual** sem checar o lock de nível 1. Não há mensagem de erro específica para esse cenário.

---

### 🟡 ESP-02 — `allowedDistributors` em `distribuirCaso` é construído de forma confusa

**Arquivo:** `casosController.js:3843`

```js
const allowedDistributors = [
  "admin", "gestor", "coordenador",
  ...isAtendenteCargo ? [userCargo] : ["servidor", "estagiario"]
];
```

O spread ternário é redundante: se `isAtendenteCargo` é true, `userCargo` já é `"servidor"` ou `"estagiario"`, então o segundo ramo `["servidor", "estagiario"]` é equivalente. O resultado final é sempre `["admin", "gestor", "coordenador", "servidor", "estagiario"]`. O check `if (!allowedDistributors.includes(userCargo))` nunca bloqueia nenhum cargo autenticado — o `defensor` também pode distribuir e não é bloqueado aqui, sendo bloqueado apenas pelo `requireWriteAccess` mais acima na rota.

> [!NOTE]
> Um `defensor` autenticado que chame `POST /:id/distribuir` passaria pelo `allowedDistributors` sem ser bloqueado porque o array inclui todos os cargos operacionais. O bloqueio real vem do `requireWriteAccess` (que verifica `visualizador`). Isso não é um bug, mas torna a guarda explícita inútil.

---

### 🟡 ESP-03 — `requireSameUnit` usa `caso.unidades?.regional` (Supabase) e `caso.unidade?.regional` (Prisma) sem abstração

**Arquivo:** `requireSameUnit.js:95`

```js
const casoRegional = caso.unidades?.regional || caso.unidade?.regional;
```

A diferença entre `unidades` (Supabase join) e `unidade` (Prisma include) é silenciosa. Se o ambiente mudar ou um dos paths retornar `undefined`, o coordenador perde o acesso regional sem log de aviso. Um helper `getCasoRegional(caso)` evitaria esse padrão espalhado.

---

## 4. Segurança

### 🔴 SEG-01 — `lockController.js:12` e `:115` acessam `req.user.cargo` fora do try-catch

**Arquivo:** `lockController.js`

```js
// linha 12 — fora do try
const cargo = req.user.cargo.toLowerCase();
// linha 115 — fora do try
const userCargo = req.user.cargo.toLowerCase();
```

Se `req.user` for `undefined` (bug de middleware ou misconfiguration), o servidor lança um `TypeError` não capturado, expondo um stack trace via HTTP 500. Deve estar dentro do try-catch com optional chaining.

---

### 🔴 SEG-02 — `routes/config.js:11` acessa `req.user.cargo` sem guarda

**Arquivo:** `routes/config.js:11`

```js
const cargo = req.user.cargo.toLowerCase();
```

Não foi visto no escopo solicitado, mas é o mesmo padrão. Deve ser corrigido junto.

---

### 🟡 SEG-03 — Signed URLs: expiração configurável via env, mas sem validação de mínimo

**Arquivo:** `casosController.js:732`

```js
const signedExpires = Number.parseInt(process.env.SIGNED_URL_EXPIRES || "3600", 10);
```

Se `SIGNED_URL_EXPIRES=0` ou um valor negativo for injetado por engano, o Supabase Storage retornará erro silencioso ou URL imediatamente expirada. Não há validação de `signedExpires > 0`. Recomendado:

```js
const signedExpires = Math.max(300, Number.parseInt(process.env.SIGNED_URL_EXPIRES || "3600", 10));
```

---

### 🟡 SEG-04 — `maskPII` não cobre `alvo_id` semanticamente, mas `usuario_alvo.nome` pode vazar

**Arquivo:** `casosController.js:4035`

```js
mensagem: `${req.user.nome} encaminhou um caso para você protocolar.`
```

O **nome do servidor** é embutido diretamente na string da notificação sem mascaramento. A notificação é armazenada em `prisma.notificacoes` (tabela de usuário), e não em `logs_auditoria` — portanto não passa pelo `maskPII`. Para fins de LGPD, o nome do servidor é um dado pessoal que pode ser visível a terceiros com acesso à tabela. Isso é aceitável por design (é uma notificação para o defensor), mas deve ser documentado explicitamente.

---

### 🟢 SEG-05 — `loggerService.maskPII` cobre os campos mais críticos ✅

A lista de `sensitiveKeys` inclui `cpf`, `rg`, `email`, `telefone`, `nome`, `senha`, `token`. O regex de CPF e email no `maskStringPII` funciona corretamente. Não há exposição de CPF nos logs da distribuição.

---

## Resumo Priorizado

| ID | Severidade | Categoria | Ação |
|---|---|---|---|
| GAP-01 | 🔴 Alta | Lógica | `distribuirCaso` ignora `validateTransition`; checar transição `em_atendimento → em_protocolo` na state machine |
| INC-01 | 🔴 Alta | Padrão | `req.user.cargo` sem `?.` em múltiplos controllers fora de try-catch |
| INC-02 | 🔴 Alta | Padrão | `lockController` usa Prisma para `casos` — viola regra Supabase/Prisma |
| SEG-01 | 🔴 Alta | Segurança | `lockController` acessa `req.user.cargo` fora do try-catch → TypeError exposto |
| GAP-02 | 🟡 Média | Lógica | `lockCaso` muda status sem `validateTransition` |
| GAP-03 | 🟡 Média | Lógica | Notificação não disparada para admin/gestor que distribui para `em_protocolo` |
| GAP-04 | 🟡 Média | Lógica | `unlockCaso` zera ambos `defensor_id` e `servidor_id` sem granularidade de nível |
| INC-03 | 🟡 Média | Padrão | Log direto via Prisma em `distribuirCaso` — bypassa `maskPII` |
| INC-04 | 🟡 Média | Padrão | `coordenador` tratado como admin em `listarDefensoresParaEncaminhamento` |
| ESP-01 | 🟡 Média | Especificidade | Lógica de `campoAlvo` ambígua para admin em `em_atendimento` distribuindo para servidor |
| ESP-02 | 🟡 Baixa | Especificidade | `allowedDistributors` redundante e nunca bloqueia cargo real |
| GAP-05 | 🟡 Baixa | Lógica | Double-query no caminho do servidor (`requireSameUnit` + `distribuirCaso`) |
| ESP-03 | 🟡 Baixa | Especificidade | Acesso a `unidades`/`unidade` sem abstração em `requireSameUnit` |
| SEG-02 | 🔴 Alta | Segurança | `routes/config.js` acessa `req.user.cargo` sem guarda |
| SEG-03 | 🟡 Baixa | Segurança | `signedExpires` sem validação de valor mínimo |
| SEG-04 | 🟢 Info | Segurança | Nome do servidor em notificação — aceitável por design, mas deve ser documentado |

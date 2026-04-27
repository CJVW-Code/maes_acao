# Pre-Mortem e Plano de Implementação: Gestor, Coordenador, BI e Distribuição de Casos

> **Versão:** 2.1 · **Atualizado em:** 2026-04-26 · Baseado no `claude.md` v3.3 / `BUSINESS_RULES.md` v2.5

---

## 🔴 Pre-Mortem: 5 Riscos Técnicos e Soluções Concretas

### Risco 1 — Race Condition no Distribuir/Devolver e Conflito de Cliente DB

**Contexto:** O backend deve usar Supabase JS Client para mutações na tabela `casos` (Prisma é reservado para a hierarquia `equipe/RBAC`). O Supabase não suporta `SELECT FOR UPDATE` atômico diretamente no cliente JS como o Prisma.

**Cenário de falha:** O uso de `prisma.$transaction` para manipular o `casos` violaria o padrão arquitetural definido. Ao mesmo tempo, se usarmos duas queries Supabase (um `select` seguido de um `update`), teremos uma Race Condition clássica.

**Solução concreta:**
- A rota `POST /casos/:id/distribuir` e `POST /casos/:id/unlock` usarão mutação atômica nativa do PostgreSQL via **Supabase JS Client** usando filtros estritos (`eq` e `in`), que aproveitam o row-level lock intrínseco do banco:
  ```javascript
  const { data, error } = await supabase
    .from('casos')
    .update({ defensor_id: alvo, servidor_id: null /* conforme nível */ })
    .eq('id', id)
    .in('status', statusPermitidos) // Segurança da máquina de estados na mesma query
    .select()
    .single();
  ```
- O erro será avaliado: se `data` for vazio e não houver erro de rede, o caso mudou de status ou não existe (Race condition prevenida e tratada com resposta HTTP `409 Conflict`).

---

### Risco 2 — Violação da Máquina de Estados e Locking N1/N2

**Contexto:** O sistema possui Locking Nível 1 (`servidor_id`) e Nível 2 (`defensor_id`). O plano anterior dizia "Atualizar defensor_id/servidor_id", ignorando as regras de qual campo preencher com base no status do caso.

**Cenário de falha:** Um Coordenador "distribui" um caso `pronto_para_analise` (que deveria receber um Servidor - Lock Nível 1) e acaba preenchendo o `defensor_id` (Lock Nível 2). Isso quebra o fluxo e a interface `DetalhesCaso.jsx`, que espera o `servidor_id` preenchido nesta fase. Outra falha: "Devolver" um caso em `processando_ia` corromperia o pipeline de jobs.

**Solução concreta:**
- **Distribuição Estrita por Nível:**
  1. Se `status` in `['pronto_para_analise', 'em_atendimento']`: Trata-se do fluxo primário. O alvo selecionado é gravado em `servidor_id`. O status passa para `em_atendimento`.
  2. Se `status` in `['liberado_para_protocolo', 'em_protocolo']`: Fluxo final. O alvo é gravado em `defensor_id`. O status passa para `em_protocolo`.
- **Whitelist de Devolução (Unlock):**
  - Coordenadores só poderão destravar/devolver via query Supabase `in('status', ['pronto_para_analise', 'em_atendimento', 'liberado_para_protocolo', 'em_protocolo', 'erro_processamento'])`.
  - Tentativas em `protocolado`, `aguardando_documentos` ou `processando_ia` serão sumariamente ignoradas.

---

### Risco 3 — IDOR Horizontal (Bypass de Unidade)

**Contexto:** O JWT do usuário contém `unidade_id` no payload (conforme `claude.md` — seção Auth). Mas o `casosController.js` e o `lockController.js` **não validam** se o `unidade_id` do caso bate com o do usuário na maioria das operações. O locking atual é "funcional" — quem chegar primeiro trava.

**Cenário de falha:** Um Coordenador de Salvador (unidade_id: `ABC`) faz uma requisição manual `POST /casos/9999/distribuir` para um caso de Feira de Santana (unidade_id: `XYZ`). Sem validação horizontal, a operação passa, violando LGPD e a privacidade por design.

**Solução concreta:**
- Criar middleware `requireSameUnit` que pode ser aplicado seletivamente:
  ```js
  export const requireSameUnit = async (req, res, next) => {
    if (['admin', 'gestor'].includes(req.user.cargo)) return next(); // bypass
    const caso = await prisma.casos.findUnique({ where: { id: BigInt(req.params.id) }, select: { unidade_id: true } });
    if (!caso || caso.unidade_id !== req.user.unidade_id) {
      return res.status(403).json({ error: 'Acesso negado. Caso pertence a outra unidade.' });
    }
    next();
  };
  ```
- Aplicar nas rotas: `router.post('/:id/distribuir', authMiddleware, requireCoordenadorOrAbove, requireSameUnit, distribuirCaso)`
- A listagem de defensores no modal "Distribuir" também filtra no banco: `WHERE unidade_id = req.user.unidade_id AND ativo = true`

---

### Risco 4 — Gargalo de Performance no Cache de Horários do BI

**Contexto:** O BI atual faz queries paginadas de 1000 linhas por vez (`PAGE_SIZE = 1000`) nos 52 centros do mutirão. Adicionar uma leitura de configuração de horário em cada requisição ao banco (mesmo que seja 1 linha) multiplicaria a carga em pico.

**Cenário de falha:** Em horários de pico (09h-12h), 52 coordenadores abrindo o Dashboard simultaneamente disparariam 52+ queries extras de `SELECT configuracoes WHERE chave = 'bi_horario'` por minuto. No Supabase Pro com pool limitado, isso causa timeout em cascata.

**Solução concreta:**
- Implementar **cache em memória no processo Node.js** com TTL de 5 minutos:
  ```js
  // configCache.js (novo arquivo)
  let _cache = null;
  let _cacheExpiry = 0;
  const TTL_MS = 5 * 60 * 1000; // 5 minutos

  export const getConfiguracoes = async () => {
    if (_cache && Date.now() < _cacheExpiry) return _cache;
    const rows = await prisma.configuracoes_sistema.findMany();
    _cache = Object.fromEntries(rows.map(r => [r.chave, r.valor]));
    _cacheExpiry = Date.now() + TTL_MS;
    return _cache;
  };

  export const invalidarCache = () => { _cache = null; }; // Chamado após salvar config
  ```
- Quando o Admin/Gestor salvar novos horários, o endpoint chama `invalidarCache()` para forçar refresh imediato.
- No frontend: o hook `useBiData.js` (já existente) terá um estado `bloqueadoPorHorario` que vem da resposta do backend, não da verificação local — evitando dessincronização de timezone.

---

### Risco 5 — UI Quebrada para o Cargo Gestor (Botões sem Permissão)

**Contexto:** O `AuthContext.jsx` expõe `user.cargo` para o frontend. Muitos componentes verificam apenas `user.cargo === 'admin'` para renderizar controles administrativos (ex: "Excluir Caso", "Resetar Senha" em `GerenciarEquipe.jsx`).

**Cenário de falha:** Um Gestor abre o painel e vê os botões de "Criar Usuário" e "Resetar Senha" (porque o componente não verifica se é admin). Ao clicar, recebe `403 Forbidden` do backend. Isso cria confusão operacional durante o mutirão.

**Solução concreta:**
- Criar um helper de permissões centralizado no `AuthContext.jsx` em vez de verificações inline:
  ```js
  // Dentro do AuthContext
  const permissions = useMemo(() => ({
    canManageTeam: user?.cargo === 'admin',
    canViewBiGlobal: ['admin', 'gestor'].includes(user?.cargo),
    canViewBiUnidade: ['admin', 'gestor', 'coordenador'].includes(user?.cargo),
    canDistribuirCaso: ['admin', 'gestor', 'coordenador'].includes(user?.cargo),
    canUnlockCaso: ['admin', 'gestor', 'coordenador'].includes(user?.cargo),
    canProtocolar: ['admin', 'gestor', 'coordenador', 'defensor'].includes(user?.cargo),
  }), [user?.cargo]);
  ```
- Todos os componentes passarão a usar `permissions.canManageTeam` etc., em vez de `user.cargo === 'admin'` hardcoded.
- O botão "Criar Membro" em `GerenciarEquipe.jsx` só renderiza se `permissions.canManageTeam`.

---

## 1. Impact Analysis

| Arquivo | Tipo de Impacto | Módulos Afetados |
|:--------|:----------------|:-----------------|
| `lockController.js` | Alto | Adicionar validação de unidade + whitelist de status para Coordenador |
| `casosController.js` | Alto | Novo endpoint `distribuirCaso` + validação transacional |
| `biController.js` | Alto | Integrar cache de horário + scoping por `unidade_id` + **adicionar métricas de produtividade por `usuario_id` (estatísticas de defensores)** |
| `bi.js` (routes) | Médio | Novos cargos permitidos (`gestor`, `coordenador`) com escopos distintos |
| `requireWriteAccess.js` | Baixo | Adicionar `gestor` na whitelist |
| `seed_permissions.cjs` | Baixo | Inserir cargo `gestor` |
| `AuthContext.jsx` | Alto | Centralizar permissões em objeto `permissions` |
| `DetalhesCaso.jsx` | Alto | Botões Devolver + Distribuir + Modal de distribuição |
| `GerenciarEquipe.jsx` | Médio | Badges do Gestor, guardar visibilidade por `permissions` |
| `Dashboard.jsx` | Médio | Estado bloqueado do BI com horário disponível |
| **[NOVO]** `configCache.js` | Alto | Cache em memória das `configuracoes_sistema` |
| **[NOVO]** `middleware/requireSameUnit.js` | Alto | Validação horizontal de unidade |
| **[NOVO]** `controllers/configController.js` | Médio | CRUD de `configuracoes_sistema` (horários do BI) |
| **[NOVO]** `pages/ConfiguracoesSistema.jsx` | Médio | Tela admin/gestor para editar horários do BI |

---

## 2. Technical Approach

### Hierarquia de Cargos (Canônica)

```
gestor > coordenador > defensor > servidor > estagiario > visualizador
admin (separado — TI/sistema, não operacional)
```

| Cargo | BI Acesso | BI Escopo | Distribuir | Devolver | Protocolar | Gerenciar Equipe |
|:------|:----------|:----------|:-----------|:---------|:-----------|:-----------------|
| `admin` | ✅ | Todas | ✅ | ✅ | ✅ | ✅ |
| `gestor` | ✅ | Todas | ✅ | ✅ | ✅ | ❌ |
| `coordenador` | ✅ | Sua unidade | ✅ (sua unidade) | ✅ (sua unidade) | ✅ | ❌ |
| `defensor` | ❌ | — | ❌ | ❌ | ✅ | ❌ |
| `servidor` | ❌ | — | ❌ | ❌ | ❌ | ❌ |

### Tabela `configuracoes_sistema` (nova — via Prisma Migration)

> [!IMPORTANT]
> Toda alteração de schema **OBRIGATORIAMENTE** passa pelo fluxo:
> `schema.prisma` → `prisma migrate dev` → `prisma generate` → deploy.
> **Nunca executar DDL direto no Supabase Dashboard.**

O modelo a adicionar no `schema.prisma`:

```prisma
model configuracoes_sistema {
  chave      String   @id @db.VarChar(100)
  valor      String
  descricao  String?
  updated_at DateTime @default(now()) @updatedAt

  @@map("configuracoes_sistema")
}
```

Após `prisma migrate dev`, o seed inserirá os valores padrão no `seed_permissions.cjs`:

```js
// Trecho a adicionar no seed_permissions.cjs
await prisma.configuracoes_sistema.upsert({
  where: { chave: 'bi_horarios' },
  update: {},
  create: {
    chave: 'bi_horarios',
    valor: JSON.stringify([{ inicio: '07:00', fim: '09:00' }, { inicio: '17:00', fim: '23:59' }]),
    descricao: 'Janelas de horário permitidas para gerar relatórios de BI',
  },
});
await prisma.configuracoes_sistema.upsert({
  where: { chave: 'bi_timezone' },
  update: {},
  create: { chave: 'bi_timezone', valor: 'America/Bahia', descricao: 'Timezone do BI' },
});
```

### Fluxo do `distribuirCaso`

```text
Coordenador/Gestor → POST /casos/:id/distribuir { usuario_id: "uuid" }
  → authMiddleware (Valida JWT e expiração)
  → requireCoordenadorOrAbove (Checa se user.cargo é valido)
  → requireSameUnit (Compara req.user.unidade_id com supabase casos.unidade_id)
  → distribuirCaso():
      1. Busca status atual via Supabase
      2. Determina Nível:
         - Se status in ['pronto_para_analise', 'em_atendimento']: Nível 1 (`servidor_id`)
         - Se status in ['liberado_para_protocolo', 'em_protocolo']: Nível 2 (`defensor_id`)
      3. Executa mutação atômica via Supabase:
         supabase.from('casos').update({ [campoAlvo]: alvo, status: novoStatus })
                 .eq('id', id).in('status', permitidos_da_fase)
      4. Log de auditoria via Prisma (sem expor PII)
      5. Retorna 200 { message, caso_id }
```

---

## 3. Edge Case Mitigation

| Cenário | Tratamento |
|:--------|:-----------|
| Caso já `protocolado` | `409` com mensagem "Caso já finalizado. Redistribuição não permitida." |
| Caso em `processando_ia` | `409` com mensagem "IA processando. Aguarde." |
| Defensor alvo inativo | `400` com mensagem "Usuário inativo. Selecione outro defensor." |
| Defensor alvo de outra unidade | `403` — validado tanto no frontend quanto no backend |
| Config de horário indisponível (banco offline) | Fallback: verificar env `BI_DEFAULT_ALLOW=true/false` |
| Coordenador sem `unidade_id` | `403` — "Sua conta não possui unidade configurada. Contate o Admin." |
| `dados_formulario` nulo no caso | Distribuição continua — o campo não é acessado nessa operação |
| Race condition no Distribuir | `prisma.$transaction` garante atomicidade; resposta `409` ao segundo chamador |

---

## 4. Step-by-Step Strategy (Dependências Primeiro)

```
Fase 1 — Schema e Banco (Prisma First)
  1.1 Adicionar model `configuracoes_sistema` no `schema.prisma`
  1.2 Rodar `prisma migrate dev --name add_configuracoes_sistema`
  1.3 Rodar `prisma generate`
  1.4 Inserir cargo `gestor` no `seed_permissions.cjs` + valores padrão de horário
  1.5 Rodar `node seed_permissions.cjs` para popular o banco local

Fase 2 — Backend (dependências primeiro)
  2.1 Criar `configCache.js` (cache em memória 5min)
  2.2 Criar `middleware/requireSameUnit.js`
  2.3 Atualizar `requireWriteAccess.js` (adicionar `gestor`)
  2.4 Criar `controllers/configController.js` (CRUD horários)
  2.5 Refatorar `lockController.js` (whitelist de status + bypass Gestor)
  2.6 Criar `casosController.distribuirCaso` com transação atômica
  2.7 Refatorar `biController.js`:
      - Implementar cache de horário.
      - Escopo por unidade para Coordenador.
      - **Nova Métrica:** Agrupar estatísticas não apenas por unidade, mas também por **Usuário (Defensor)** para exibir a produtividade individual de quem protocolou/atendeu.
  2.8 Atualizar `routes/bi.js` (novos cargos permitidos)
  2.9 Adicionar rotas: POST /casos/:id/distribuir + /api/config

Fase 3 — Frontend e Padrões UI (Tailwind v4)
  3.1 Centralizar `permissions` no `AuthContext.jsx` (remover hardcodes `user.cargo === 'admin'`)
  3.2 Criar `ConfiguracoesSistema.jsx` (tela de horários do BI) usando classes utilitárias do Tailwind e design tokens.
  3.3 Atualizar `Dashboard.jsx` (estado bloqueado do BI com horário) e adicionar visualização de Produtividade por Defensor.
  3.4 Adicionar botões Devolver/Distribuir em `DetalhesCaso.jsx`. Sem CSS inline, aplicar `@apply btn-primary` ou similar.
  3.5 Criar `ModalDistribuicao.jsx`. O modal de lista de membros deve usar classes nativas do Tailwind para o backdrop, focus trap, etc.
  3.6 Atualizar badges e menus em `GerenciarEquipe.jsx` e `Cadastro.jsx`.

Fase 4 — Verificação
  4.1 Testes de RBAC horizontal (tentar distribuir caso de outra unidade)
  4.2 Testar bloqueio de horário do BI (simular hora fora da janela)
  4.3 Testar race condition (duas requisições simultâneas de distribuição)
  4.4 Verificar logs_auditoria sem PII
```

---

## Decisões Pendentes

> [!NOTE]
> **Notificações do Gestor:** Ainda não definido se o cargo `gestor` terá tipo de notificação dedicado ou herdará o comportamento do `defensor`. A implementação da Fase 2 será feita de forma que esse comportamento seja fácil de configurar depois (sem refactor grande). Por padrão, o `gestor` receberá as mesmas notificações do `defensor` até a decisão final.

---

## User Review Required

> [!IMPORTANT]
> Plano atualizado com as duas decisões confirmadas:
> - ✅ Schema via `prisma migrate dev` + `prisma generate` (nunca DDL direto no Supabase)
> - ⏳ Notificações do `gestor`: pendente — implementação inicial herdará comportamento do `defensor`
>
> **Pronto para iniciar a implementação?** Confirme e começarei pela Fase 1 (schema + seed).

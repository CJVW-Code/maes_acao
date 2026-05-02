# Plano de Implementação — Lock Permanente: Visibilidade na UI

> **Objetivo:** Melhorar o feedback visual sobre o lock permanente de casos no sistema, garantindo que todos os usuários — especialmente quem abre um caso já travado — saibam claramente quem é o responsável e como proceder.

---

## Contexto Atual

### Backend (já implementado corretamente)
O `lockController.js` já implementa lock permanente:

- **`PATCH /:id/lock`** → Vincula o caso ao `servidor_id` ou `defensor_id` do usuário. Sem expiração.
- **`PATCH /:id/unlock`** → Apenas `admin`, `gestor` ou `coordenador` pode liberar. Registra auditoria.
- O `GET /:id` em `casosController.js` (linha ~3504) já retorna **HTTP 423** quando outro usuário tenta acessar um caso bloqueado, incluindo `holder` (nome do responsável) e `message`.

### Frontend (problema atual)
O `DetalhesCaso.jsx` já trata o erro 423 (linha 1093–1117), mas:
- Exibe uma **página inteira de erro** em vez de um banner contextual
- Não mostra o nome do responsável de forma proeminente
- Não oferece ação clara para quem não pode liberar (ex: "Contate o coordenador")
- Na listagem (`Casos.jsx`), o ícone de lock aparece mas sem nome do responsável em destaque — apenas um ícone âmbar

---

## Mudanças Propostas

### 1. `DetalhesCaso.jsx` — Banner de Lock no topo da página

**Situação:** Usuário abre um caso já travado por outra pessoa.

**Mudança:** Em vez de renderizar uma tela de erro vazia, manter o acesso **somente-leitura** à página do caso com um **banner fixo e destacado** no topo informando quem tem o lock.

#### Lógica de renderização
```
caso carregado com sucesso  →  renderiza normalmente
caso retorna 423 (locked)   →  renderiza página em modo leitura + banner de lock
caso retorna 401/404        →  mensagem de erro atual (sem mudança)
```

#### Componente do Banner (novo, inline em DetalhesCaso.jsx)

```jsx
// Renderizado logo após o header do caso, antes das abas
{caso && !isOwner && isLockedByOther && (
  <div className="sticky top-0 z-30 bg-amber-500 text-white px-6 py-4 flex items-center justify-between gap-4 shadow-lg rounded-b-2xl animate-fade-in">
    <div className="flex items-center gap-3">
      <Lock size={20} className="shrink-0" />
      <div>
        <p className="font-bold text-sm">Caso em atendimento por {caso.servidor?.nome || caso.defensor?.nome}</p>
        <p className="text-xs opacity-80">Você está em modo leitura. Para assumir, solicite a liberação ao coordenador.</p>
      </div>
    </div>
    {/* Botão liberação apenas para admin/gestor/coordenador */}
    {canUnlock && (
      <button onClick={handleUnlock} className="btn btn-sm bg-white text-amber-700 hover:bg-amber-50 font-bold shrink-0">
        Liberar Caso
      </button>
    )}
  </div>
)}
```

#### Variáveis de controle a adicionar
```js
const isOwner = caso && user && (
  String(caso.servidor_id) === String(user.id) ||
  String(caso.defensor_id) === String(user.id) ||
  user.cargo === "admin"
);
const isLockedByOther = caso && (caso.servidor_id || caso.defensor_id) && !isOwner;
const canUnlock = ["admin", "gestor", "coordenador"].includes(user?.cargo?.toLowerCase());
```

> **Nota:** A variável `isColaborador` já existe no código (linha 242). O banner de lock é diferente — `isColaborador` é para casos compartilhados explicitamente, o banner é para lock de acesso.

---

### 2. `Casos.jsx` — Tooltip com nome do responsável na listagem

**Situação:** Na listagem de casos, casos travados mostram um ícone âmbar de cadeado sem detalhe de quem travou.

**Mudança:** Adicionar tooltip com o nome do responsável ao passar o mouse na célula "Responsável".

#### Mudança na coluna "Responsável" (tabela desktop, linha ~230)

```jsx
// Atual
<td className="p-4">
  {caso.defensor || caso.servidor ? (
    <div className="flex items-center gap-2 text-xs">
      <div className={`p-1 rounded-full ${isMyCase ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-600"}`}>
        {isMyCase ? <User size={14} /> : <Lock size={14} />}
      </div>
      <span className="font-medium whitespace-nowrap">
        {isMyCase ? "Meu Atendimento" : (caso.defensor?.nome || caso.servidor?.nome)}
      </span>
    </div>
  ) : (
    <span className="text-xs text-muted italic">Disponível</span>
  )}
</td>

// Proposto: adicionar badge "Travado" quando não for o usuário atual
// + garantir que o nome apareça em destaque mesmo quando não é "Meu Atendimento"
```

**Resultado esperado:**
- "Meu Atendimento" (verde) → quando o caso é do usuário logado
- "🔒 João Silva" (âmbar) → quando travado por outro (nome visível diretamente, sem precisar abrir)
- "Disponível" (cinza) → sem responsável

---

### 3. `Dashboard.jsx` — Seção de "Casos Travados" para Coordenadores

**Situação:** Coordenadores e gestores não têm uma visão centralizada dos casos atualmente bloqueados.

**Mudança:** Adicionar uma seção colapsável no Dashboard (visível apenas para `admin`, `gestor`, `coordenador`) mostrando todos os casos com `servidor_id IS NOT NULL` ou `defensor_id IS NOT NULL` que ainda não estão `protocolado`.

#### Endpoint necessário (novo ou adaptação)
- Opção A: `GET /api/casos?locked=true` — adicionar filtro `locked` no endpoint existente de casos
- Opção B: `GET /api/casos/travados` — endpoint dedicado (mais limpo, recomendado)

#### UI no Dashboard
```
┌─────────────────────────────────────────────────────────┐
│  🔒 Casos com Lock Ativo          [Expandir ▼]    (12)  │
│─────────────────────────────────────────────────────────│
│  Protocolo   │  Assistida  │  Responsável  │  Ação      │
│  MAE-001     │  Maria S.   │  João Silva   │ [Liberar]  │
│  MAE-002     │  Ana P.     │  Carlos R.    │ [Liberar]  │
└─────────────────────────────────────────────────────────┘
```

---

## Arquivos Impactados

| Arquivo | Tipo de Mudança | Prioridade |
|---|---|---|
| `frontend/src/areas/defensor/pages/DetalhesCaso.jsx` | Adicionar banner de lock no topo + modo leitura | **Alta** |
| `frontend/src/areas/defensor/pages/Casos.jsx` | Melhorar exibição do responsável na listagem | **Média** |
| `frontend/src/areas/defensor/pages/Dashboard.jsx` | Seção de casos travados para coordenadores | **Baixa** |
| `backend/src/routes/casos.js` | Adicionar filtro `?locked=true` ou rota dedicada | **Baixa** (só se Dashboard for implementado) |

---

## Regras de Negócio Confirmadas

Conforme o `lockController.js` atual:

| Regra | Comportamento |
|---|---|
| Lock automático | **NÃO existe.** O lock só acontece ao clicar "Assumir Atendimento" |
| Auto-release por tempo | **REMOVIDO.** Lock é permanente desde sempre (comentário na linha 3504 do casosController) |
| Quem pode destravar | `admin`, `gestor`, `coordenador` (via `/unlock`) |
| Coordenador: restrições | Não pode destravar casos `protocolado` ou `processando_ia` |
| Lock Nível 1 | Servidor assume casos em estágios iniciais → usa campo `servidor_id` |
| Lock Nível 2 | Defensor assume casos `liberado_para_protocolo` ou `em_protocolo` → usa campo `defensor_id` |

---

## Impacto no Guia de Usuário (`PLANO_GUIA_PASSO_A_PASSO.md`)

O texto do guia já foi escrito assumindo lock permanente (sem mencionar 30 minutos). Nenhuma alteração necessária no guia após esta implementação.

---

## Checklist de Implementação

- [ ] **Alta:** Adicionar banner de lock em `DetalhesCaso.jsx` (modo leitura com identificação do responsável)
- [ ] **Média:** Melhorar coluna "Responsável" em `Casos.jsx` (nome visível diretamente na linha)
- [ ] **Baixa:** Adicionar seção "Casos Travados" no `Dashboard.jsx` para coordenadores/gestores
- [ ] **Baixa:** Endpoint `GET /api/casos/travados` no backend (só se Dashboard for implementado)
- [ ] Validar que o botão "Liberar Caso" existente (linha 2106 em DetalhesCaso) continua funcional
- [ ] Testar fluxo: Usuário A trava → Usuário B abre → vê banner → Coordenador libera → Usuário B assume

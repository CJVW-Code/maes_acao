# Plano 1 — Encaminhamento Direto: Servidor → Defensor

> **Escopo:** Permitir que o servidor jurídico, ao clicar em "Liberar para Protocolo",  
> escolha **explicitamente** um defensor destinatário antes de soltar o caso.

---

## 🚨 Pre-Mortem (riscos específicos deste plano)

| # | Risco | Probabilidade | Impacto |
|---|-------|:---:|:---:|
| 1 | Race condition: dois servidores liberam o mesmo caso simultaneamente | Alta (mutirão) | Crítico |
| 2 | Servidor cria lock para defensor de outra unidade (bypassa `requireSameUnit`) | Média | Alto |
| 3 | Frontend renderiza o dropdown antes de receber lista de defensores, causando seleção vazia | Média | Médio |
| 4 | A máquina de estados rejeita `liberado_para_protocolo` com `defensor_id` preenchido (state machine não espera isso) | Alta | Alto |
| 5 | Defensor selecionado já está inativo/removido no momento do encaminhamento | Baixa | Alto |

---

## 1. Impact Analysis

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `backend/src/controllers/casosController.js` | Novo handler `encaminharParaProtocolo` |
| `backend/src/routes/casos.js` | Nova rota `POST /:id/encaminhar-protocolo` |
| `frontend/src/areas/defensor/pages/DetalhesCaso.jsx` | Interceptar `handleStatusChange` para o status `liberado_para_protocolo` |
| `frontend/src/areas/defensor/components/casos/ModalDistribuicao.jsx` | Reutilização + novo modo `protocolo` |

### Efeitos Colaterais

- O fluxo atual de `atualizarStatusCaso` para `liberado_para_protocolo` **não será removido** — o admin/gestor/coordenador ainda pode usar o dropdown direto (admin bypass da state machine).
- A coluna `defensor_id` que hoje é zerada ao liberar para protocolo passa a ser **preenchida** neste novo fluxo, mudando o comportamento da consulta de lock do frontend.
- O middleware `requireSameUnit` precisa permitir que o servidor consulte a lista de defensores da **própria unidade** (hoje só defensores recebem essa rota).

---

## 2. Technical Approach

### Backend: Endpoint Atômico

**Rota:** `POST /api/casos/:id/encaminhar-protocolo`  
**Auth:** `authMiddleware` + `requireWriteAccess` + `requireSameUnit`

```
Recebe: { defensor_id: UUID }

1. Busca caso atual (status, servidor_id, unidade_id) — via Supabase (dados mais frescos)
2. Valida:
   - status DEVE ser "em_atendimento" (apenas o servidor que está atendendo pode liberar)
   - req.user.id === caso.servidor_id   ← impede que outro servidor roube o encaminhamento
   - defensor_id é de um usuário ativo com cargo em ["defensor", "coordenador", "admin", "gestor"]
   - defensor.unidade_id === caso.unidade_id  (isolamento de unidade)
3. Atualização ATÔMICA (Prisma em transação):
   - status          → "liberado_para_protocolo"
   - defensor_id     → defensor_id recebido
   - defensor_at     → new Date()
   - servidor_id     → null
   - servidor_at     → null
4. Log de auditoria: acao="encaminhar_protocolo", sem PII no payload
5. Retorna 200 com caso atualizado
```

> **Mitigação Falha 1 (race condition):** A query no Prisma usará `where: { id, servidor_id: req.user.id }` — se outro usuário já tiver zerado o `servidor_id`, o `update` retornará `count: 0` e responderemos com `409 Conflict`.

### Frontend: Interceptação no Dropdown

Em `DetalhesCaso.jsx`, a função `handleStatusChange` deve ser modificada:

```
handleStatusChange(novoStatus):
  SE novoStatus === "liberado_para_protocolo":
    → NÃO chama API imediatamente
    → Seta estado: setEncaminhandoParaProtocolo(true)
    → Abre <ModalEscolhaDefensor />
  SENÃO:
    → Fluxo atual (chama PATCH /status)
```

### Frontend: Modal de Escolha de Defensor

Reutilizar `ModalDistribuicao` com uma nova prop `modo="protocolo"`:

- Título: *"Encaminhar para Protocolo"*
- Subtítulo: *"Selecione o defensor responsável pelo protocolo deste caso"*
- Filtra lista: apenas defensores **da mesma unidade** do caso, com cargo em `["defensor", "coordenador"]`
- Ao confirmar: chama `POST /casos/:id/encaminhar-protocolo` com `{ defensor_id }`
- Toast de sucesso: *"Caso encaminhado! [Nome do Defensor] foi notificado."*
- Fecha modal e força `mutate(undefined, { revalidate: true })`

---

## 3. Edge Case Mitigation

| Edge Case | Solução |
|-----------|---------|
| Servidor tenta liberar caso em status diferente de `em_atendimento` | Backend retorna 409 com mensagem clara |
| Nenhum defensor disponível na unidade | Modal exibe empty state com instrução de contatar o gestor |
| Defensor selecionado foi desativado entre listagem e confirmação | Backend valida `ativo: true` no momento do `update` |
| Usuário sem permissão de escrita acessa o dropdown | `requireWriteAccess` retorna 403 antes de chegar no handler |
| Admin não quer escolher defensor (fluxo atual) | Cargo `admin` mantém o comportamento de `atualizarStatusCaso` sem modal |
| Caso arquivado tenta ser encaminhado | Verificação de `arquivado: false` no início do handler |

---

## 4. Step-by-Step Strategy

```
Passo 1 — Backend: Handler `encaminharParaProtocolo`
  - Criar a função no casosController.js
  - Lógica de validação + update atômico com Prisma transaction
  - Log de auditoria sem PII

Passo 2 — Backend: Rota
  - Registrar POST /:id/encaminhar-protocolo em casos.js
  - Atrás de authMiddleware + requireWriteAccess + requireSameUnit

Passo 3 — Frontend: Interceptação em DetalhesCaso.jsx
  - Adicionar estado isEncaminhando e defensorSelecionado
  - Modificar handleStatusChange para bifurcar na hora de liberar protocolo
  - Garantir que a bifurcação só ocorra para cargos SEM permissão de admin bypass

Passo 4 — Frontend: ModalDistribuicao.jsx (modo protocolo)
  - Adicionar prop `modo` ("protocolo" | "distribuicao")
  - Filtrar lista de defensores por unidade + cargo elegível
  - Trocar título, subtítulo e endpoint de confirmação

Passo 5 — Notificação (opcional, mas recomendado)
  - Ao encaminhar, criar registro na tabela `notificacoes`
  - tipo: "encaminhamento_protocolo", texto: "Caso #{protocolo} encaminhado para você"
  - O sino do defensor no frontend já carrega notificações automaticamente
```

---

## 5. Integridade da Máquina de Estados

O novo fluxo **não quebra** a state machine:

```
em_atendimento → liberado_para_protocolo   ← já é uma transição válida
```

A diferença é que agora o `defensor_id` é preenchido atomicamente **junto** com a transição de status, antes de qualquer lock de nível 2. A tabela de locking visual do frontend usa `defensor_id !== null` para mostrar "Em Protocolo com [Nome]" — esse comportamento passa a funcionar automaticamente.

---

## ✅ Critérios de Aceite

- [ ] Servidor ao selecionar "Liberar para Protocolo" abre o modal de escolha de defensor
- [ ] O caso aparece imediatamente travado para o defensor escolhido no Dashboard
- [ ] O defensor recebe uma notificação no sino
- [ ] Outros usuários veem "Em Protocolo com [Nome do Defensor]" na listagem
- [ ] O admin pode continuar usando o dropdown sem o modal
- [ ] Race condition testada: segundo servidor recebe 409 ao tentar liberar o mesmo caso

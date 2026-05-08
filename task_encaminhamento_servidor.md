# Task List — Encaminhamento Direto: Servidor → Defensor

> **Baseado na auditoria validada.** Nenhuma nova rota de protocolo será criada.
> A rota `POST /:id/distribuir` já existe com todos os middlewares necessários.

---

## ID: 1
**File Path:** `backend/src/middleware/requireSameUnit.js`

**Context:** Injeta `req.casoBasic` com `{ id, unidade_id, status, unidades, assistencia_casos }`. O campo `servidor_id` **não está** no select atual.

**Action:** Adicionar `servidor_id` ao select do Supabase e ao `include` do Prisma dentro do middleware.

**Logic Details:**
- No bloco Supabase (L36–48), adicionar `servidor_id` ao template string do `.select()`:
  ```js
  .select(`
    id,
    unidade_id,
    status,
    servidor_id,
    unidades ( regional ),
    assistencia_casos (
      destinatario_id,
      status
    )
  `)
  ```
- No bloco Prisma (L53–59), adicionar `servidor_id: true` ao `select`:
  ```js
  select: {
    id: true,
    unidade_id: true,
    status: true,
    servidor_id: true,
    unidade: { select: { regional: true } },
    assistencia_casos: { select: { destinatario_id: true, status: true } }
  }
  ```
- Nenhuma outra lógica do middleware deve ser alterada.

**Acceptance Criteria:**
- `req.casoBasic.servidor_id` está disponível nos handlers que rodam após `requireSameUnit`.
- O middleware continua bloqueando acesso de outras unidades normalmente.
- Testes existentes de `requireSameUnit` continuam passando.

---

## ID: 2
**File Path:** `backend/src/controllers/casosController.js`

**Context:** `distribuirCaso` (L3789) restringe distribuidores a `["admin", "gestor", "coordenador"]`. Servidores não podem encaminhar nenhum caso. O `statusPermitidos` para fase de defensor só aceita `["liberado_para_protocolo", "em_protocolo"]`.

**Action:** Expandir `allowedDistributors` para incluir `"servidor"`, adicionar guarda de ownership para esse cargo, e permitir `em_atendimento` como status de origem quando o distribuidor for servidor.

**Logic Details:**
- Alterar L3797: `const allowedDistributors = ["admin", "gestor", "coordenador", "servidor"];`
- Inserir bloco de validação logo após a checagem de cargo (após L3803), **antes** da query de status:
  ```js
  if (req.user.cargo.toLowerCase() === "servidor") {
    const casoBasic = req.casoBasic; // injetado pelo requireSameUnit (Task 1)
    if (!casoBasic || String(casoBasic.servidor_id) !== String(req.user.id)) {
      return res.status(403).json({
        error: "Acesso Negado",
        message: "Você só pode encaminhar casos que esteja atendendo.",
      });
    }
    if (casoBasic.status !== "em_atendimento") {
      return res.status(409).json({
        error: "Status inválido",
        message: "O caso precisa estar 'em_atendimento' para ser encaminhado.",
      });
    }
  }
  ```
- Nos blocos de determinação de `campoAlvo` e `statusPermitidos` (L3875–3882), adicionar `"em_atendimento"` como status de origem válido para encaminhar a defensor quando o distribuidor for servidor:
  ```js
  // Adicionar "em_atendimento" no array quando o request vier de um servidor
  const isServidor = req.user.cargo.toLowerCase() === "servidor";
  if (["pronto_para_analise", "em_atendimento"].includes(casoAtual.status) && !isServidor) {
    campoAlvo = "servidor_id";
    novoStatus = "em_atendimento";
    statusPermitidos = ["pronto_para_analise", "em_atendimento"];
  } else if (["liberado_para_protocolo", "em_protocolo"].includes(casoAtual.status)
             || (isServidor && casoAtual.status === "em_atendimento")) {
    campoAlvo = "defensor_id";
    novoStatus = "em_protocolo";
    statusPermitidos = isServidor
      ? ["em_atendimento"]  // servidor parte diretamente de em_atendimento
      : ["liberado_para_protocolo", "em_protocolo"];
  }
  ```
- O update atômico já usa `.in("status", statusPermitidos)` — garante que nenhuma race condition ocorra.
- O log de auditoria existente (L3933–3945) registra `alvo_id`, `campo_atualizado`, `status_anterior`, `status_novo` — sem PII.

**Acceptance Criteria:**
- `POST /api/casos/:id/distribuir` com token de servidor retorna 200 quando `caso.servidor_id === req.user.id`, `caso.status === "em_atendimento"`, e `usuario_id` é defensor ativo da mesma unidade.
- Retorna 403 se o servidor tentar encaminhar um caso que não é dele.
- Retorna 409 se o caso não estiver em `em_atendimento`.
- Admin/gestor/coordenador continuam funcionando sem alteração de comportamento.
- O `defensor_id` do caso é preenchido com o defensor escolhido e `status` vai para `em_protocolo`.

---

## ID: 3
**File Path:** `backend/src/controllers/defensoresController.js`

**Context:** `listarDefensores` (L201) só é acessível por `admin/gestor/coordenador` e não aceita filtro por `unidade_id` via query string. Servidores não podem consultar defensores.

**Action:** Criar o handler `listarDefensoresParaEncaminhamento` — rota de leitura que retorna defensores elegíveis para protocolo de uma unidade específica, acessível por qualquer usuário autenticado com `writeAccess`.

**Logic Details:**
- Adicionar a função no final do arquivo, antes do fechamento do módulo:
  ```js
  export const listarDefensoresParaEncaminhamento = async (req, res) => {
    const { unidade_id } = req.query;
    if (!unidade_id) {
      return res.status(400).json({ error: "unidade_id é obrigatório." });
    }
    const userCargo = req.user.cargo.toLowerCase();
    const isAdmin = ["admin", "gestor", "coordenador"].includes(userCargo);
    if (!isAdmin && String(req.user.unidade_id) !== String(unidade_id)) {
      return res.status(403).json({
        error: "Acesso negado. Você só pode consultar defensores da sua unidade.",
      });
    }
    try {
      const CARGOS_ELEGIVEIS = ["defensor", "coordenador", "admin", "gestor"];
      const defensores = await prisma.defensores.findMany({
        where: {
          ativo: true,
          unidade_id,
          cargo: { nome: { in: CARGOS_ELEGIVEIS } },
        },
        select: {
          id: true,
          nome: true,
          cargo: { select: { nome: true } },
          unidade: { select: { nome: true } },
        },
        orderBy: { nome: "asc" },
      });
      res.json(
        defensores.map((d) => ({
          id: d.id,
          nome: d.nome,
          cargo: d.cargo.nome,
          unidade_nome: d.unidade?.nome || "Sem unidade",
        }))
      );
    } catch (err) {
      logger.error(`Erro ao listar defensores para encaminhamento: ${err.message}`);
      res.status(500).json({ error: "Erro ao buscar defensores." });
    }
  };
  ```
- Não incluir `email`, `senha_hash` ou qualquer dado sensível na resposta.
- Não alterar `listarDefensores` (rota de gestão de equipe).
- Usar ES Module syntax.

**Acceptance Criteria:**
- `GET /api/defensores/encaminhamento?unidade_id=X` retorna lista com `id`, `nome`, `cargo`, `unidade_nome`.
- Servidor que tenta buscar `?unidade_id=Y` (outra unidade) recebe 403.
- Admin pode buscar qualquer `unidade_id`.
- Requisição sem `unidade_id` retorna 400.
- Resposta não inclui dados sensíveis.

---

## ID: 4
**File Path:** `backend/src/routes/defensores.js`

**Context:** Registra as rotas do módulo de defensores. Não expõe rota de leitura acessível para servidores.

**Action:** Importar `listarDefensoresParaEncaminhamento` e registrar `GET /encaminhamento` protegida por `authMiddleware` + `requireWriteAccess`.

**Logic Details:**
- Adicionar ao bloco de imports do controller:
  ```js
  import {
    ...,
    listarDefensoresParaEncaminhamento,
  } from "../controllers/defensoresController.js";
  ```
- Registrar a rota antes das rotas que exigem `admin/gestor` exclusivo:
  ```js
  router.get(
    "/encaminhamento",
    authMiddleware,
    requireWriteAccess,
    listarDefensoresParaEncaminhamento
  );
  ```
- `requireWriteAccess` já bloqueia `visualizador` com 403. Servidores têm writeAccess. ✅
- Usar ES Module syntax (`import/export`), não `require`.

**Acceptance Criteria:**
- `GET /api/defensores/encaminhamento?unidade_id=X` com token de servidor retorna 200.
- Com token de `visualizador` retorna 403.
- Sem token retorna 401.
- A rota existente `GET /api/defensores` (listarDefensores) continua funcionando e inalterada.

---

## ID: 5
**File Path:** `frontend/src/areas/defensor/pages/DetalhesCaso.jsx`

**Context:** Página de detalhes do caso com ações de mudança de status. Não há lógica de bifurcação para o status `liberado_para_protocolo`.

**Action:** Interceptar a ação de "Liberar para Protocolo" para cargos `servidor` e `estagiario`, abrindo o `ModalDistribuicao` no modo `"protocolo"`.

**Logic Details:**
- Adicionar estado local:
  ```jsx
  const [isModalProtocoloOpen, setIsModalProtocoloOpen] = useState(false);
  ```
- Localizar a função ou handler que dispara a mudança de status para `"liberado_para_protocolo"` (pode ser um `<select onChange>`, um botão inline, ou uma função `handleStatusChange`).
- Envolver essa ação com a bifurcação:
  ```jsx
  const handleLiberarParaProtocolo = () => {
    const cargo = user?.cargo?.toLowerCase(); // user do AuthContext
    if (["servidor", "estagiario"].includes(cargo)) {
      setIsModalProtocoloOpen(true);
    } else {
      // Comportamento existente para admin/gestor/coordenador/defensor
      handleStatusChange("liberado_para_protocolo");
    }
  };
  ```
- Substituir a chamada direta ao handler no botão/select por `handleLiberarParaProtocolo`.
- Adicionar o modal ao JSX, ao final do componente antes do `return` fechar:
  ```jsx
  {isModalProtocoloOpen && (
    <ModalDistribuicao
      caso={caso}
      isOpen={isModalProtocoloOpen}
      onClose={() => setIsModalProtocoloOpen(false)}
      onRefresh={fetchCaso}  // usar o nome real da função de re-fetch no arquivo
      modo="protocolo"
    />
  )}
  ```
- `fetchCaso` é a função que re-busca os dados via `authFetch`. Verificar o nome real no arquivo.
- Não usar `mutate()`.
- Importar `ModalDistribuicao` se ainda não estiver importado no arquivo.

**Acceptance Criteria:**
- Servidor/estagiário que aciona "Liberar para Protocolo" vê o modal de escolha de defensor.
- Admin/gestor/coordenador/defensor continuam usando o comportamento atual (PATCH direto, sem modal).
- Fechar o modal sem confirmar mantém o caso em `em_atendimento`.
- Após confirmação bem-sucedida, a página re-carrega os dados atualizados do caso.

---

## ID: 6
**File Path:** `frontend/src/areas/defensor/components/casos/ModalDistribuicao.jsx`

**Context:** Modal de distribuição. Busca `/defensores` globalmente sem filtro de unidade. Usa cores `gray-*` hardcoded que violam o design system do projeto (`index.css`).

**Action:** Adicionar prop `modo` (`"distribuicao"` | `"protocolo"`), corrigir a busca para `/defensores/encaminhamento?unidade_id=X` no modo protocolo, e migrar todas as classes de cor para tokens do `index.css`.

**Logic Details:**

**1. Nova assinatura:**
```jsx
export const ModalDistribuicao = ({ caso, isOpen, onClose, onRefresh, modo = "distribuicao" }) => {
```

**2. Busca condicional por modo (substituir o useEffect atual):**
```jsx
React.useEffect(() => {
  if (!isOpen) return;
  const endpoint =
    modo === "protocolo"
      ? `/defensores/encaminhamento?unidade_id=${caso.unidade_id}`
      : "/defensores";
  authFetch(endpoint)
    .then(async (r) => {
      if (!r.ok) return [];
      const data = await r.json().catch(() => []);
      return Array.isArray(data) ? data : [];
    })
    .then(setDefensores)
    .catch(() => setDefensores([]));
}, [isOpen, modo, caso.unidade_id]);
```

**3. Endpoint de confirmação (handleDistribuir — endpoint já é /distribuir em ambos os modos):**
```jsx
const response = await authFetch(`/casos/${caso.id}/distribuir`, {
  method: "POST",
  body: JSON.stringify({ usuario_id: usuarioId }),
});
// Toast condicional:
addToast(
  modo === "protocolo" ? "Caso encaminhado para protocolo!" : "Caso distribuído com sucesso!",
  "success"
);
```

**4. Título e subtítulo condicionais:**
```jsx
const titulo = modo === "protocolo" ? "Encaminhar para Protocolo" : "Distribuir Atendimento";
const subtitulo =
  modo === "protocolo"
    ? "Selecione o defensor responsável pelo protocolo deste caso"
    : `Caso: ${caso.nome_assistido} (#${caso.id})`;
```

**5. Migração de estilo para tokens do `index.css` (eliminar `gray-*`, `white` hardcoded):**

| Elemento | Classe atual | Classe correta |
|---|---|---|
| Container modal | `bg-white rounded-4xl` | `card w-full max-w-lg overflow-hidden` |
| Título | `text-gray-800` | `text-main` |
| Subtítulo | `text-gray-500` | `text-muted` |
| Input busca | `bg-gray-50 border-gray-200 ...` | `input pl-11` |
| Rodapé | `bg-gray-50` | `bg-surface` |
| Botão cancelar | `text-gray-600 hover:bg-gray-200` | `btn btn-secondary` |
| Empty state | `text-gray-400` | `text-muted` |

**Acceptance Criteria:**
- Modo `"protocolo"`: busca `GET /defensores/encaminhamento?unidade_id=X`, lista apenas defensores da unidade do caso.
- Modo `"distribuicao"` (padrão): mantém comportamento atual — `GET /defensores`, endpoint `/distribuir`.
- Ambos os modos chamam `POST /casos/:id/distribuir` com `{ usuario_id }`.
- Nenhuma referência a `bg-white`, `text-gray-*`, `border-gray-*`, `bg-gray-*` permanece no componente.
- `unidade_nome` de cada defensor é exibido no card.
- `onRefresh?.()` é chamado após sucesso. `mutate()` não é utilizado.
- Empty state visível quando nenhum defensor elegível existe na unidade.

---

## ID: 7
**File Path:** `backend/src/controllers/casosController.js`

**Context:** `distribuirCaso` não cria notificação ao encaminhar. A tabela `notificacoes` já existe e é utilizada em `solicitarAssistencia` e outros fluxos.

**Action:** Após o update atômico bem-sucedido, criar um registro em `notificacoes` quando `campoAlvo === "defensor_id"` e o distribuidor for `"servidor"`.

**Logic Details:**
- Verificar o schema `prisma/schema.prisma` para confirmar os campos obrigatórios do model `notificacoes` antes de implementar (esperado: `defensor_id`, `tipo`, `texto`, `lida`).
- Inserir após o update atômico e **dentro** do bloco `try`, após a construção de `casoAtualizado`:
  ```js
  if (campoAlvo === "defensor_id" && req.user.cargo.toLowerCase() === "servidor") {
    try {
      await prisma.notificacoes.create({
        data: {
          defensor_id: usuario_id,
          tipo: "encaminhamento_protocolo",
          texto: `Caso #${id} encaminhado para você pelo servidor.`,
          lida: false,
        },
      });
    } catch (notifErr) {
      logger.warn(`[distribuirCaso] Falha ao criar notificação: ${notifErr.message}`);
      // Falha na notificação NÃO interrompe o fluxo — o 200 já foi determinado
    }
  }
  ```
- Não incluir CPF, nome da assistida ou qualquer PII no campo `texto` — apenas ID do caso.
- A notificação **não** deve ser criada para distribuições feitas por `admin/gestor/coordenador` (fluxo existente sem alteração).

**Acceptance Criteria:**
- Após encaminhamento por servidor, um registro aparece em `notificacoes` com `defensor_id` do destinatário e `tipo = "encaminhamento_protocolo"`.
- Falha ao criar notificação não retorna 500 — o encaminhamento retorna 200 normalmente.
- Notificação não é criada em distribuições por admin/gestor/coordenador.
- Campo `texto` não contém dados pessoais.

---

## ID: 8 — Validação Manual End-to-End
**File Path:** n/a

**Context:** Validação funcional do fluxo completo após as tasks 1–7.

**Action:** Executar o roteiro de validação abaixo no ambiente local (`npm run dev` + `node server.js`).

**Logic Details:**

**Cenário 1 — Fluxo principal:**
- Logar como servidor → abrir caso em `em_atendimento` com `servidor_id === meu_id`
- Acionar "Liberar para Protocolo" → modal deve abrir (não PATCH direto)
- Modal deve listar apenas defensores com cargo `defensor/coordenador` da mesma unidade
- Selecionar defensor → confirmar
- Verificar: caso vai para `em_protocolo` com `defensor_id` preenchido
- Verificar: defensor recebe notificação no sino

**Cenário 2 — Race condition:**
- Dois navegadores com servidores diferentes no mesmo caso (`em_atendimento`)
- Servidor B encaminha primeiro → sucesso
- Servidor A tenta encaminhar → deve receber toast de erro (409/403)

**Cenário 3 — Admin bypass (sem regressão):**
- Admin usa dropdown de status para "Liberar para Protocolo"
- Não abre modal, muda status direto
- `defensor_id` é zerado (comportamento existente mantido)

**Cenário 4 — Isolamento de unidade:**
- Servidor tenta `GET /api/defensores/encaminhamento?unidade_id=OUTRA_UNIDADE` → 403
- Servidor sem `servidor_id` no caso tenta `POST /distribuir` → 403

**Acceptance Criteria:**
- Todos os 4 cenários passam conforme descrito.
- Nenhum erro 500 aparece no console do servidor.
- O BI credita o defensor destinatário pelo protocolo (não o servidor).

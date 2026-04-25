# Ciclo de Correção — Execução de Alimentos & Endurecimento RBAC
**Data:** 2026-04-24 (tarde)
**Branch:** `versao_1`
**Commit anterior:** `2ba8a9b`

---

## Contexto

Sessão de estabilização focada em dois eixos principais:

1. **Endurecimento do RBAC e máquina de estados** — implementação do plano documentado em `taskplan24.md` (IDs 1–9), garantindo que `servidor`/`estagiario` não consigam protocolar casos e que o locking de nível 2 seja exclusivo de `defensor`/`coordenador`/`admin`.
2. **Correção do fluxo de triagem para Execução de Alimentos** — busca por CPF quebrando por sintaxe errada no Supabase, validação obrigatória de CEP no endereço e exibição de documento específico da ação (cópia da sentença).

---

## Arquivos Modificados

### Backend

#### `backend/src/controllers/casosController.js` (+143 / -143 linhas net)

| Mudança | Descrição |
|---|---|
| `atualizarStatusCaso` — máquina de estados | `em_protocolo → protocolado` removido da rota genérica. Apenas `finalizarCasoSolar` pode atingir `protocolado`. |
| `atualizarStatusCaso` — RBAC | `servidor` e `estagiario` bloqueados com `403` ao tentar mover caso para `em_protocolo`. |
| `buscarPorCpf` — sintaxe Supabase | Corrigido filtro `.or()` que passava `partes.cpf_assistido.eq.X` (inválido). Agora usa `cpf_assistido.eq.X` com `{ foreignTable: 'casos_partes' }`. |
| `buscarPorCpf` — normalização | Introduzido `partesObj` para lidar corretamente quando `casoRaw.partes` é array (join Supabase) ou objeto (Prisma). Evita `undefined` no prefill. |
| `receberDocumentosComplementares` — resposta HTTP | Corrigido duplo `res.json()` causando crash no servidor. Adicionado `return` antes de cada `res.status(200).json(...)`. |
| `receberDocumentosComplementares` — notificações | Notificação movida para dentro de cada branch (`reprocessed: true` e `reprocessed: false`), com `try/catch` isolado para não propagar erro ao `catch` externo. |

#### `backend/src/controllers/lockController.js` (+35 / -0)

| Mudança | Descrição |
|---|---|
| Locking por nível | Introduzido `nivelLock` (1 ou 2) determinado pelo `status` atual do caso. |
| Consulta prévia | `lockCaso` agora busca o caso antes de tentar o lock, eliminando segunda consulta no bloco de erro `count === 0`. |
| RBAC por nível | `servidor`/`estagiario` recebem `403` se tentarem lock de nível 2 (`liberado_para_protocolo` ou `em_protocolo`). |
| `coordenador` = `defensor` | `isDefensorOrCoordenador` cobre ambos os cargos para atribuição de `defensor_id`/`defensor_at`. |

#### `backend/src/middleware/requireWriteAcess.js` (+6 / -6)

| Mudança | Descrição |
|---|---|
| Whitelist explícita | Substituído check `cargo === "visualizador"` por lista positiva: `["admin", "coordenador", "defensor", "servidor", "estagiario"]`. Qualquer cargo fora da lista recebe `403`. |

#### `backend/seed_permissions.cjs` (+7 / -1)

- Ajustes no seed para refletir catálogo de cargos atualizado com `coordenador`.

---

### Frontend

#### `frontend/src/areas/servidor/services/submissionService.js` (+16 / -6)

| Mudança | Descrição |
|---|---|
| Validação de endereço | Validação de `requerente_endereco_residencial` agora é **obrigatória para todos os casos** (removido `if assistidoEhIncapaz === "nao"`). |
| Validação de CEP | Adicionado check `!formState.requerente_endereco_residencial.includes("CEP:")` — endereço sem CEP preenchido falha a validação com mensagem específica. |
| Telefone obrigatório | Validação de `requerente_telefone` igualmente elevada para obrigatória independente de incapacidade. |

#### `frontend/src/components/DocumentUpload.jsx` (+32 / -0)

| Mudança | Descrição |
|---|---|
| Nova prop `acaoEspecifica` | Permite que o formulário informe o tipo de ação para o componente de upload. |
| Slot condicional `copia_sentenca` | Quando `acaoEspecifica === "execucao_alimentos"`, adiciona slot de "Cópia da sentença / título executivo" ao grupo de slots calculados. |
| Grupo D visual | Bloco visual "Documentos do Processo Original" renderizado condicionalmente na UI quando a ação é execução de alimentos. |

#### `frontend/src/areas/servidor/components/secoes/SecaoProcessoOriginal.jsx` (+88 / -88 net)

- Refatoração de formatação JSX (aspas duplas, indentação, labels inline).
- Label da vara simplificado: "Vara da Petição Atual (ex: 1ª ) Apenas numero *".
- Removida variável `isCustomDecision` que estava sendo calculada mas não utilizada.
- Limpeza de espaços e whitespace inconsistente em condicionais.

#### `frontend/src/areas/servidor/components/SecaoValoresPensao.jsx` (+18)

- Melhorias de layout e validação para campos de valores de pensão.

#### `frontend/src/areas/servidor/hooks/useFormEffects.js` (+2 / -2)

- Ajuste menor na inicialização de efeitos do formulário.

#### `frontend/src/areas/servidor/pages/ScannerBalcao.jsx` (+1)

- Correção pontual.

#### `frontend/src/areas/servidor/pages/TriagemCaso.jsx` (+2)

- Ajuste menor na tela de triagem.

#### `frontend/src/areas/servidor/components/EnderecoInput.jsx` (+2 / -2)

- Correção no componente de endereço com CEP.

#### `frontend/src/areas/servidor/components/StepRelatoDocs.jsx` (+2)

- Correção pontual.

#### `frontend/src/areas/defensor/contexts/AuthContext.jsx` (+1)

- Ajuste de inicialização de contexto.

#### `frontend/src/areas/defensor/pages/DetalhesCaso.jsx` (+4 / -4)

- Ajuste de RBAC na tela de detalhes (ocultar ações de protocolo para `servidor`/`estagiario`).

#### `frontend/src/config/formularios/acoes/familia.js` (+1)

- Adição de configuração para nova ação ou ajuste de flag existente.

---

## Impactos Operacionais

| Área | Impacto |
|---|---|
| **Triagem (busca CPF)** | Busca por CPF de representante volta a funcionar corretamente com Supabase |
| **Triagem (endereço)** | CEP obrigatório garante que petições saiam com endereço completo |
| **Execução de Alimentos** | Upload do título executivo agora é guiado pelo formulário |
| **Locking** | `servidor` não consegue mais adquirir lock de nível 2 inadvertidamente |
| **Máquina de estados** | `protocolado` não pode mais ser atingido por rota genérica de status |
| **Upload complementar** | Servidor não crasha mais ao enviar documentos extras |

---

## Pendências do `taskplan24.md`

Tasks executadas neste ciclo: **1, 2, 4, 5, 6, 9 (parcial)**

Tasks ainda abertas (a executar em próximos commits):
- **ID 3:** Alinhar `auth.js` para cargo/unidade consistentes
- **ID 7:** `finalizarCasoSolar` como única origem de `protocolado` (validar exclusividade)
- **ID 8:** Filtrar `em_protocolo` nas queries de listagem para `servidor`/`estagiario`
- **ID 11–17:** Frontend — dashboard de alertas, remoção de `NotificacoesBell`, estilos CSS

---

## Referências

- Plano: [`taskplan24.md`](./taskplan24.md)
- Arquitetura: [`../01-Referencia/ARCHITECTURE.md`](../01-Referencia/ARCHITECTURE.md)
- Regras de negócio: [`../01-Referencia/BUSINESS_RULES.md`](../01-Referencia/BUSINESS_RULES.md)
- Controller principal: `backend/src/controllers/casosController.js`

# Plano de Implementação - Avisos por Unidade

Este plano detalha a implementação da funcionalidade que permite exibir avisos ou comunicados personalizados para unidades específicas durante o processo de triagem.

## Alterações Propostas

### 1. Banco de Dados

#### [MODIFY] [schema.prisma](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/prisma/schema.prisma)
- Adicionar o campo `aviso String?` ao modelo `unidades`.

---

### 2. Backend

#### [MODIFY] [unidadesController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/unidadesController.js)
- Atualizar `listarUnidades` para retornar o campo `aviso`.
- Atualizar `criarUnidade` para aceitar o campo `aviso` opcional.
- Atualizar `atualizarUnidade` para permitir a edição do campo `aviso`.

---

### 3. Frontend

#### [MODIFY] [GerenciarEquipe.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/defensor/pages/GerenciarEquipe.jsx)
- Atualizar o estado `unidadeForm` para incluir `aviso`.
- Popular `aviso` na função `abrirFormUnidade` ao editar.
- Adicionar um campo `textarea` no modal de Unidade para o texto do aviso.
- Atualizar o card da unidade na listagem para indicar visualmente se um aviso está configurado.

#### [MODIFY] [StepDadosProcessuais.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/servidor/components/StepDadosProcessuais.jsx)
- Atualizar o componente para identificar a unidade selecionada.
- Exibir um alerta estilizado (usando as cores do sistema) caso a unidade selecionada possua um `aviso`.

## Plano de Verificação

### Testes Automatizados
- Executar `npx prisma generate` e `npx prisma db push` para atualizar o banco localmente.
- Verificar se a API retorna o campo `aviso` no endpoint `/api/unidades`.

### Verificação Manual
1.  **Gestão**: No painel "Gerenciar Equipe", editar uma unidade e adicionar um aviso de teste.
2.  **Exibição**: Iniciar um "Novo Pedido" e, no passo de seleção de unidade, verificar se o aviso aparece corretamente ao selecionar a unidade editada.
3.  **Estética**: Garantir que o alerta tenha um visual premium, consistente com o restante do sistema.

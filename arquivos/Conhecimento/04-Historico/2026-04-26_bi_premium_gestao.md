# Histórico de Mudanças — 26/04/2026 (BI Premium & Gestão)

## Contexto
Evolução do módulo de BI para suportar o novo cargo de **Gestor** e fornecer métricas de produtividade individual e ações de auditoria de gestão. Implementação de sistema de bloqueio de horário com bypass emergencial.

## Mudanças Realizadas

### Backend (BI & Segurança)
- **Novo Cargo: Gestor**: Implementado suporte ao cargo `gestor` com permissões similares ao `admin` no módulo de BI.
- **Isolamento de Dados**: Coordenadores agora só conseguem visualizar dados da sua própria unidade no BI.
- **Métricas de Produtividade**:
    - Agregação de protocolos por Defensor.
    - Agregação de atendimentos por Servidor/Estagiário.
- **Ações de Gestão**: Nova métrica que rastreia redistribuições e destravamentos manuais realizados por gestores (via `logs_auditoria`).
- **Sistema de Overrides (Horários)**:
    - Implementado `bi_overrides` no banco de dados para permitir liberações temporárias de acesso.
    - Endpoints para criar, listar e remover overrides.

### Frontend (UI/UX Relatórios)
- **Relatórios V4.0**:
    - Nova interface com cards e widgets premium.
    - **Personalização**: Botão para ocultar/mostrar widgets específicos (salvo localmente).
    - **Produtividade Individual**: Ranking Top N de defensores e servidores.
    - **Gestão**: Widget de ações de gestão para transparência administrativa.
- **Tela de Bloqueio Inteligente**:
    - Quando o acesso ao BI está fora do horário, exibe tela informativa.
    - Botão "Liberar Acesso por 1 Hora" disponível apenas para Admins e Gestores diretamente na tela de bloqueio.
- **Estilização Premium**:
    - Adicionadas classes CSS para badges de status, rankings e widgets de gestão no `index.css`.

## Arquivos Modificados
- `backend/src/controllers/biController.js`
- `backend/src/routes/bi.js`
- `backend/src/controllers/lockController.js`
- `frontend/src/areas/defensor/pages/Relatorios.jsx`
- `frontend/src/areas/defensor/hooks/useBiData.js`
- `frontend/src/index.css`
- `claude.md` (Documentação canônica)

## Impacto
- Maior controle sobre a produtividade das equipes.
- Segurança reforçada com bloqueio de horário, mas com flexibilidade para emergências.
- UX significativamente melhorada no dashboard de relatórios.

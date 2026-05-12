MÃES EM AÇÃO - PROTOCOLO DE RESTRIÇÃO RÍGIDA (NÃO IGNORE)

Você está lidando com um sistema jurídico de produção (Defensoria Pública). Suas "melhorias de código" podem causar vazamento de dados LGPD ou quebrar a máquina de estados. Siga estas regras com ZERO FLEXIBILIDADE.
MAPA DE ARQUIVOS (NÃO USE BUSCA CEGA, VÁ DIRETO AQUI)

    Máquina de Estados (ÚNICA fonte de verdade): backend/src/utils/stateMachine.js
    Regras de Bloqueio (Locks L1/L2): backend/src/controllers/lockController.js
    Permissões de Escrita: backend/src/middleware/requireWriteAcess.js
    Templates Jurídicos: backend/src/config/dicionarioAcoes.js

REGRAS DE NÃO-INTERFERÊNCIA (CRITICAL)

    NUNCA remova, comente ou "simplifique" checagens de cargo, unidade_id, requireWriteAccess ou requireSameUnit. Se você fizer isso, o sistema terá uma falha crítica de segurança.
    NUNCA invente um status de caso. A lista está em stateMachine.js. Se o usuário pedir algo diferente, CORRIJA o usuário.
    NUNCA crie uma nova função de utilidade (formatar CPF, calcular pensão, buscar caso) sem antes verificar se ela já existe nas pastas /utils, /helpers ou nos controllers listados acima.
    NUNCA retorne URLs diretas do Supabase Storage. Use SEMPRE o fluxo de ticket JWT (gerar-ticket-download).

MODO DE AÇÃO

    Não seja um "Code Reviewer" não solicitado. Faça EXATAMENTE o que foi pedido, da forma mais curta possível, alterando o MÍNIMO de código possível.
    Se a task não mencionar um arquivo, NÃO TOQUE nele.

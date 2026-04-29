# Relatório de Problemas Identificados (CodeRabbitAI)

Este documento detalha as vulnerabilidades, bugs lógicos e inconsistências identificadas na codebase do projeto **Mães em Ação** através da análise automatizada.

---

## 1. Backend: Controle de Acesso e Auditoria (`biController.js`)

### 1.1 Exposição de PII em Logs Operacionais
**Arquivo:** [biController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/biController.js) (Linhas 42, 49, 60, 102, 110)

**Problema:** O e-mail completo do usuário está sendo registrado em logs de console para auditoria de acesso ao BI. Isso fere princípios de privacidade (LGPD) ao espalhar dados sensíveis em logs operacionais.

**Código:**
```javascript
42: console.log(`[BI-Auth] ✅ Liberado por Override ativo (ID: ${overrideAtivo.id}) para ${user.email}`);
49: console.log(`[BI-Auth] ❌ Bloqueado Manualmente para ${user.email}`);
```

---

### 1.2 Filtro de Unidade Ignorado em Cache
**Arquivo:** [biController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/biController.js) (Linhas 361-372)

**Problema:** Quando o relatório é gerado em lote (XLSX), o parâmetro `preFetchedUnidades` é utilizado sem respeitar o filtro de `unidadeId`. Isso faz com que relatórios unitários retornem KPIs globais em vez de escopados à unidade solicitada.

**Código:**
```javascript
361:   const unidades =
362:     preFetchedUnidades
363:       ? preFetchedUnidades.filter(u => requestedRegional === "todas" || u.regional === requestedRegional)
364:       : (await prisma.unidades.findMany({ ... }));
```

---

### 1.3 Inconsistência de Resposta (Falso Erro 500)
**Arquivo:** [biController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/biController.js) (Linhas 924-934 e 967-977)

**Problema:** Operações críticas (invalidar cache e log de auditoria) ocorrem *fora* da transação e *depois* da persistência do `override`. Se essas etapas falharem, o sistema retorna erro 500, embora a mudança tenha sido aplicada com sucesso no banco de dados.

**Código:**
```javascript
922:    }); // Fim da transação
924:    invalidarCache();
926:    await prisma.logs_auditoria.create({ ... });
```

---

## 2. Backend: Lógica de Casos e Permissões (`casosController.js`)

### 2.1 Falha na Reidratação de Dados (`opcao_guarda`)
**Arquivo:** [casosController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/casosController.js) (Linhas 288-299)

**Problema:** O campo `opcao_guarda` (essencial para a lógica de títulos e cláusulas da minuta) não é reidratado a partir do objeto jurídico. Isso causa a perda do valor no payload enviado ao gerador de documentos, resultando em minutas incompletas.

**Código:**
```javascript
289:    enriched.guarda = juridico.descricao_guarda || ...;
291:    enriched.descricao_guarda = enriched.guarda;
// Falta: enriched.opcao_guarda = juridico.opcao_guarda || ...;
```

---

### 2.2 Regressão de Autorização para Cargo Gestor
**Arquivo:** [casosController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/casosController.js) (Linhas 4093 e 4201)

**Problema:** Os endpoints de geração de termo e regeração de minuta não incluem o cargo `gestor` na lista de permissões globais (Power Users). Isso impede que gestores realizem ações em casos que não "possuem" diretamente, mesmo tendo acesso visual ao dashboard.

**Código:**
```javascript
4093: if (!isAdmin && !isDono && !isShared) { ... } // Gestor fica de fora
```

---

## 3. Backend: Hierarquia e Validação de Membros (`defensoresController.js`)

### 3.1 Potencial Crash (TypeError) em `cargo.toLowerCase()`
**Arquivo:** [defensoresController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/defensoresController.js) (Linhas 34 e 350)

**Problema:** Chamada de `toLowerCase()` em `cargo` sem validação de nulidade. Se o payload vier sem o campo ou com tipo inválido, a API lança um erro 500 não tratado.

**Código:**
```javascript
34: const targetWeight = PESO_CARGO[cargo.toLowerCase()] ?? 0;
```

---

### 3.2 Erro 404 Inalcançável para Coordenadores
**Arquivo:** [defensoresController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/defensoresController.js) (Linhas 318 e 416)

**Problema:** O check de regionalidade do coordenador ocorre antes da validação de existência do membro alvo. Se o ID não existir, o fluxo retorna 403 (Regional) em vez de 404 (Não Encontrado), dificultando o debug.

**Código:**
```javascript
318: if (targetMember?.unidade?.regional !== userUnidade?.regional) {
319:    return res.status(403).json({ error: "Você só pode editar membros da sua regional." });
320: }
// O check 'if (!targetMemberFull)' só vem depois.
```

---

## 4. Frontend: Experiência do Usuário e Segurança

### 4.1 Inconsistência de Estado no Dashboard
**Arquivo:** [Dashboard.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/defensor/pages/Dashboard.jsx) (Linhas 153-168)

**Problema:** A navegação ocorre imediatamente após clicar em "Aceitar", antes de confirmar se o POST de resposta foi bem-sucedido no backend. Se a rede falhar, o usuário estará em uma tela de caso sem ter o acesso efetivado (colaboração).

---

### 4.2 Race Conditions em Ações de Assistência
**Arquivo:** [Dashboard.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/defensor/pages/Dashboard.jsx) (Linhas 600-612)

**Problema:** Botões "Aceitar" e "Recusar" não possuem estado de carregamento ou desabilitação após o primeiro clique, permitindo múltiplos disparos de requisições idênticas.

---

### 4.3 Vazamento de Contexto entre Casos
**Arquivo:** [DetalhesCaso.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/defensor/pages/DetalhesCaso.jsx) (Linhas 1025-1051)

**Problema:** A flag `feedbackInitialized` impede a reidratação dos campos quando o usuário navega entre diferentes casos sem recarregar o componente. O formulário mantém os dados do caso anterior.

**Código:**
```javascript
1027: if (!feedbackInitialized) {
1028:    setFeedback(caso.feedback || "");
...
1048:    setFeedbackInitialized(true); // Nunca é resetado no useEffect de mudança de ID
```

---

### 4.4 Exposição de PII ao Microsoft Office Online
**Arquivo:** [DetalhesCaso.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/defensor/pages/DetalhesCaso.jsx) (Linha 1648)

**Problema:** O uso do iframe do Office Online transmite o URL assinado (e consequentemente o conteúdo do documento com nomes, CPFs e relatos familiares) para servidores de terceiros para renderização.

---

### 4.5 Inconsistência de Labels em Filhos Extras
**Arquivo:** [DocumentUpload.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/components/DocumentUpload.jsx) (Linhas 143-150)

**Problema:** Slots dinâmicos para filhos adicionais exibem apenas "RG", enquanto os slots fixos da criança principal já foram atualizados para "RG/CPF", causando confusão no usuário final sobre qual documento enviar.

**Código:**
```javascript
143: label: `RG${safeName} (Frente)`, // Deveria ser RG/CPF
```

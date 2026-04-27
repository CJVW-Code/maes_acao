# Plano de Implementação: Otimização de BI, RBAC e Validações

O objetivo deste documento é traçar a estratégia de correção e melhoria de gargalos de performance no BI, bugs de validação no frontend, falhas de RBAC e exportação de PDF, mantendo estrita adesão às regras de negócio e arquitetura estabelecidas no `claude.md`.

## Análise Pre-Mortem (5 Riscos Técnicos)

1. **Performance e Conexões Simultâneas (Exaustão de Pool):** Refatorar `exportarXlsxLote` para não aguardar de forma sequencial previne a exaustão do banco de dados (Connection Pool Exhaustion) para 35-52 sedes.
2. **Valores Nulos e Inconsistências de JSONB:** A mudança na validação de CEP e prefill no frontend (`useFormEffects`) pode lidar mal com dados legados ou nulos oriundos do Supabase. Um falso negativo aqui impede a transição para `aguardando_documentos` (Triagem falha) e cria casos "órfãos" não concluídos.
3. **Concorrência e Locking de Sessões:** Se o erro 500 no `requireWriteAccess` (devido a `req.user.cargo` undefined) for acionado, as chamadas para `PATCH /casos/:id/lock` e `unlock` (Níveis 1 e 2 de Locking) irão falhar. Isso resultará em casos eternamente travados para outros usuários, quebrando a máquina de estado (ficam em `pronto_para_analise` ou `liberado_para_protocolo` indefinidamente, aguardando o auto-release de 30min).
4. **Segurança e Manipulação de Planilhas:** O truncate de nome da aba (`slice(0, 31)`) no `exportarXlsxLote` e caracteres inválidos (`\ / * ? [ ] :`) do lado do `ExcelJS`. Se houver colisão, o arquivo corrompe.
5. **Integridade Visual do PDF:** Remover a classe de controle visual sem verificar o estado anterior (em `exportarPdf`) revela botões indesejados, desestabilizando a UI.

---

## 1. Impact Analysis e Revisão de Arquitetura

- **Gaps de Lógica Resolvidos:**
  - **Transição de Estado:** A falha no CEP impede a finalização do Step 1 (Triagem), o que impede a criação do registro inicial (status `aguardando_documentos`). A correção garante o fluxo inicial.
  - **Locking:** Corrigir a rota de escrita restaura as funções de `lock` e `unlock`, essenciais para o fluxo multi-servidor do mutirão.
- **Inconsistências de Padrão Resolvidas:**
  - **Supabase vs Prisma:** O `claude.md` exige *Supabase JS Client* para `casos` e *Prisma* para `equipe/RBAC`. A refatoração do `biController.js` deve garantir que a leitura de `casos` para o BI ocorra **exclusivamente via Supabase** (`supabase.from("casos")`), aplicando os filtros de data na sintaxe do PostgREST.
  - **Tailwind CSS v4:** A manipulação de classes no PDF continuará usando classes utilitárias do Tailwind (como `hidden`). Observação: o `claude.md` cita "Vanilla CSS", mas seguiremos a instrução mais recente de adotar Tailwind.
  - **ES Modules:** O backend continuará utilizando estritamente `import/export`.
  - **JSONB (`dados_formulario`):** Nenhuma coluna nova será criada. A validação do CEP lidará diretamente com os dados no formato JSON do formulário em memória antes de serializar via `FormData`.

---

## 2. Technical Approach (Estratégia Específica)

### 2.1 Refatoração BI e Performance (`biController.js`)
- **Filtro Supabase (Específico):** A consulta atual faz um fetch total e filtra no `.filter()` do JS. Mudaremos para:
  ```javascript
  let query = supabase.from("casos").select(columns).order("created_at", { ascending: false });
  // Adicionaremos os filtros .gte() e .lte() nativamente na query Supabase, 
  // possivelmente utilizando .or(`created_at.gte.${start},updated_at.gte.${start}...`)
  ```
- **Exportação Lote:** Em vez de iterar sobre `unidades` e bater no banco N vezes, faremos UMA chamada com `unidadeId = "todas"` e com o `range` definido. Agruparemos os resultados no servidor Node.js usando `Map` (Key: `unidade_id`), preenchendo as planilhas em memória e despachando em lote (0 queries adicionais por aba).
- **Sanitização Excel:** `const safeName = unidade.nome.replace(/[\/\\*?\[\]:]/g, "").slice(0, 31);` mais um iterador de sufixo `(1)`, `(2)` se já existir no `Set` de abas criadas.

### 2.2 Fix RBAC e Segurança (`requireWriteAccess.js`)
- Renomeio de arquivo (`requireWriteAcess.js` → `requireWriteAccess.js`) e imports no `casos.js` e demais locais.
- **Tratamento:**
  ```javascript
  const userCargo = typeof req.user?.cargo === "string" ? req.user.cargo.toLowerCase() : "";
  if (!allowedRoles.includes(userCargo)) { return res.status(403).json(...); }
  ```
- **Auditoria Segura:** A modificação em casos (por exemplo, `lock`) manterá a regra de segurança do `claude.md`: **nenhum CPF ou dado pessoal** será injetado no log gerado (`logs_auditoria`), apenas IDs e referências.

### 2.3 Fix UI do PDF (`useBiData.js`)
- Em vez de manipular o DOM globalmente no `.finally()`, salvaremos as referências:
  ```javascript
  hiddenControls.forEach((node) => {
    node.dataset.wasHidden = node.classList.contains("hidden") ? "true" : "false";
    node.classList.add("hidden");
  });
  // No finally:
  hiddenControls.forEach((node) => {
    if (node.dataset.wasHidden !== "true") node.classList.remove("hidden");
  });
  ```

### 2.4 Validação CEP (`submissionService.js` e `useFormEffects.js`)
- Em `submissionService.js`: Substituir `!formState.requerente_endereco_residencial.includes("CEP:")` por `!/\b\d{5}-?\d{3}\b/.test(formState.requerente_endereco_residencial)`. Essa regex é altamente específica e resistente a manipulações (falsos positivos).
- Em `useFormEffects.js`: No prefill dos dados, formatar o endereço injetado: se ele não contiver um padrão de CEP, injetamos pelo menos a formatação básica para que o input de endereço reconheça os fragmentos.

---

## 3. Edge Case Mitigation e Segurança Adicional

- **Supabase vs Prisma Failover:** Caso a chave do Supabase falhe momentaneamente, o código atual faz fallback pro Prisma. Se o fallback do Prisma for acionado, a query do Prisma TAMBÉM terá o filtro `where: { OR: [...] }` com as datas, para evitar gargalo secundário.
- **Assinaturas e Permissões:** O acesso via API Key dos servidores (`X-API-Key`) continuará funcionando normalmente pois passa pelo middleware `auth.js` que define `cargo: "servidor"`. A correção do `requireWriteAccess.js` não vai quebrar os totens de autoatendimento/scanner.

## User Review Required

> [!WARNING]
> Confirme se a adoção do **Tailwind CSS v4** sobrescreve totalmente a instrução de "Vanilla CSS" descrita no arquivo de arquitetura original.
> A estratégia de Lote Único (buscar tudo e separar no JS) reduz para 1 a quantidade de hits no banco, garantindo segurança contra limites de requisição. Podemos prosseguir com essa refatoração?

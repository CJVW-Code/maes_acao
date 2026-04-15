# Plano de Correções — Mães em Ação
> Gerado em: 2026-04-14 | Versão: 1.0

Este documento consolida todos os bugs confirmados e a refatoração de UI a serem executados na próxima sessão de desenvolvimento. Cada item tem diagnóstico técnico preciso e a correção exata.

---

## Resumo Executivo

| # | Eixo | Arquivo | Prioridade | Status |
|---|------|---------|-----------|--------|
| 1 | Defensor não atribui caso (BigInt vs string) | `casosController.js` | 🔴 Crítica | Pendente |
| 2 | Unidade do usuário não muda no admin | `defensoresController.js` | 🔴 Crítica | Pendente |
| 3 | Caso sem documentos vira `pronto_para_analise` | `casosController.js` + Frontend | 🔴 Crítica | Pendente |
| 4 | Unidade errada ao criar caso (comarca) | `casosController.js` | 🟠 Alta | Pendente |
| 5 | 1º filho sumindo da minuta | `casosController.js` | 🟠 Alta | Pendente |
| 6 | Nome da mãe no lugar do filho nas listagens | `casosController.js` | 🟠 Alta | Pendente |
| 7 | Defensor não vê as duas minutas | `casosController.js` | 🟠 Alta | Pendente |
| 8 | Reorganização UI — DetalhesCaso | `DetalhesCaso.jsx` + `PainelDocumentos.jsx` | 🟡 Média | Pendente |

---

## Eixo 1 — Defensor Não Consegue Atribuir Caso (BigInt vs String)

### Arquivo
`backend/src/controllers/casosController.js` — função `obterDetalhesCaso` (~linha 2175)

### Causa Raiz

```js
// BUGADO: data.defensor_id é BigInt (Prisma), req.user.id é string (JWT)
const isOwner =
  data.defensor_id === req.user.id     // BigInt === string → SEMPRE false
  || data.servidor_id === req.user.id; // BigInt === string → SEMPRE false
```

Consequências:
- `isOwner` é sempre `false`
- O próprio defensor dono do caso recebe 423 Locked ao reabrir
- Qualquer defensor que abrir um caso já vinculado a alguém fica bloqueado

### Correção

```diff
 const isOwner =
-  data.defensor_id === req.user.id || data.servidor_id === req.user.id;
+  String(data.defensor_id) === String(req.user.id)
+  || String(data.servidor_id) === String(req.user.id);
```

> **Atenção:** Verificar também outras comparações de ID no mesmo arquivo por ocorrências similares.

---

## Eixo 2 — Unidade do Usuário Não Muda no Admin

### Arquivo
`backend/src/controllers/defensoresController.js` — função `atualizarDefensor` (linha 206)

### Causa Raiz

```js
// BUGADO: unidade_id não está na desestruturação → nunca entra em updateData
const { nome, email, cargo, ativo } = req.body;
//       ↑ faltando: unidade_id

let updateData = { nome, email, ativo };
// updateData jamais terá unidade_id
```

### Correção

```diff
- const { nome, email, cargo, ativo } = req.body;
+ const { nome, email, cargo, ativo, unidade_id } = req.body;

- let updateData = { nome, email, ativo };
+ let updateData = { nome, email, ativo };
+ if (unidade_id !== undefined) {
+   updateData.unidade_id = unidade_id || null; // null = remover unidade
+ }
```

---

## Eixo 3 — Caso Sem Documentos Vira `pronto_para_analise`

### Arquivos
- `frontend/src/areas/servidor/services/submissionService.js` (linha 187–214)
- `backend/src/controllers/casosController.js` (linha 1641–1647)

### Causa Raiz

No frontend, `enviarDocumentosDepois` pode não estar inicializado no `formState` (valor `undefined`). O loop de serialização (linha 195) ignora `undefined`:

```js
if (rawValue === undefined || ...) return; // undefined é ignorado
```

Se `enviarDocumentosDepois = undefined`, o campo **não é enviado** ao backend. O backend interpreta ausência como `false`:

```js
const enviarDocDepois =
  dados_formulario.enviar_documentos_depois === "true" || // false
  dados_formulario.enviar_documentos_depois === true;     // false
// → enviarDocDepois = false → pipeline executa sem documentos
```

O pipeline `processarCasoEmBackground` roda sem documentos, gera DOS FATOS vazio e sobe o status para `pronto_para_analise`.

### Correção — Backend (defesa primária)

No início de `processarCasoEmBackground`, verificar o status do caso antes de prosseguir:

```js
// Buscar status atual do caso no banco antes de processar
const casoAtual = await prisma.casos.findUnique({
  where: { protocolo },
  select: { status: true, documentos: { select: { id: true } } }
});

// Só processar se houver documentos e status correto
if (
  casoAtual?.status === 'aguardando_documentos' ||
  (casoAtual?.documentos?.length === 0 && !urls_documentos?.length)
) {
  logger.warn(`[Background] Caso ${protocolo} sem documentos. Processamento abortado.`);
  return; // Mantém status aguardando_documentos
}
```

### Correção — Frontend (defesa secundária)

Garantir que `enviarDocumentosDepois` tem valor padrão `false` no estado inicial do formulário e que o valor boolean é serializado corretamente:

```diff
// No state inicial do formulário
+ enviarDocumentosDepois: false,

// No submissionService, forçar envio do campo independente do valor:
+ formData.append('enviar_documentos_depois', String(formState.enviarDocumentosDepois ?? false));
```

---

## Eixo 4 — Caso Atrelado à Unidade Errada

### Arquivo
`backend/src/controllers/casosController.js` — função `criarNovoCaso` (~linha 1599)

### Causa Raiz

```js
// Comparação exata: "Teixeira de Freitas" ≠ "Teixeira de Freitas/BA"
// Também falha com variações de acento ou espaços
unidadeDb = todasUnidades.find(
  (u) => u.comarca.toLowerCase().trim() === cidadeFormulario.toLowerCase().trim()
);
// Fallback: usa findFirst() → qualquer unidade ativa (geralmente a primeira cadastrada)
```

### Correção

```diff
+ const normalizeComarca = (s) =>
+   (s || "")
+     .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
+     .replace(/\/[A-Z]{2}$/, "")                        // remove /BA, /SP, etc.
+     .toLowerCase().trim();

  unidadeDb = todasUnidades.find(
-   (u) => u.comarca.toLowerCase().trim() === cidadeFormulario.toLowerCase().trim()
+   (u) => normalizeComarca(u.comarca) === normalizeComarca(cidadeFormulario)
  );
+
+ if (!unidadeDb) {
+   logger.warn(`[Unidade] Nenhuma match exato para "${cidadeFormulario}". Tentando match parcial...`);
+   unidadeDb = todasUnidades.find(
+     (u) => normalizeComarca(u.comarca).includes(normalizeComarca(cidadeFormulario).split(" ")[0])
+   );
+ }
```

---

## Eixo 5 — 1º Filho Sumindo da Minuta

### Arquivo
`backend/src/controllers/casosController.js` — função `processarDadosFilhosParaPeticao` (~linha 649)

### Causa Raiz

O template usa `{NOME}` (maiúsculo) para o 1º filho. O frontend envia o campo como `NOME` (maiúsculo). No `baseData`, o campo existe como `baseData.NOME`. Mas a função busca apenas `baseData.nome` (minúsculo):

```js
// Tags dos templates DOCX confirmadas:
// {NOME}            → 1º filho
// {REPRESENTANTE_NOME} → mãe/representante

filhoPrincipal = {
  nome: ensureText(
    baseData.nome ||           // ← minúsculo, não existe no FormData
    baseData.nome_assistido || // ← É o nome da MÃE (bug!)
    normalizedData.requerente_nome,
  ),
  ...
};
```

### Correção

```diff
 nome: ensureText(
+  baseData.NOME ||           // ← 1º filho (tag maiúscula enviada pelo frontend)
   baseData.nome ||
-  baseData.nome_assistido || // ← removido: é nome da mãe, não do filho
   normalizedData.requerente_nome,
 ),
```

---

## Eixo 6 — Nome da Mãe no Lugar do Filho nas Listagens

### Arquivos
- `backend/src/controllers/casosController.js` — função `criarNovoCaso` (linha 1411)
- `frontend/src/areas/defensor/pages/Dashboard.jsx`
- `frontend/src/areas/defensor/pages/Casos.jsx`

### Causa Raiz

```js
// criarNovoCaso, linha 1411:
// nome = REPRESENTANTE_NOME = nome da MÃE
const nome = dados_formulario.REPRESENTANTE_NOME || dados_formulario.nome || "";

// Esse nome vai para casos_partes.nome_assistido (linha 1659)
// mapCasoRelations expõe: enriched.nome_assistido = partes.nome_assistido
// Dashboard e Casos exibem caso.nome_assistido como título → nome da mãe aparece
```

Em casos de incapaz, `nome_assistido` deveria ser o **filho** (titular do direito), e a mãe deveria aparecer como representante.

### Correção — Backend

```diff
- const nome = dados_formulario.REPRESENTANTE_NOME || dados_formulario.nome || "";
+ // Incapaz: assistido = filho (tag NOME), representante = mãe (tag REPRESENTANTE_NOME)
+ // Adulto: assistido = a própria autora (tag REPRESENTANTE_NOME)
+ const ehIncapaz = dados_formulario.assistidoEhIncapaz === "sim";
+ const nome = ehIncapaz
+   ? (dados_formulario.NOME || dados_formulario.nome || "")
+   : (dados_formulario.REPRESENTANTE_NOME || dados_formulario.nome || "");
```

> **Aviso:** Casos já existentes no banco não serão corrigidos automaticamente — apenas novos casos pós-deploy. Para casos antigos, seria necessário um script de migração pontual.

---

## Eixo 7 — Defensor Não Vê as Duas Minutas

### Arquivo
`backend/src/controllers/casosController.js` — função `attachSignedUrls` (~linha 403)

### Causa Raiz

```js
const ia = Array.isArray(caso.casos_ia) ? caso.casos_ia[0] : caso.casos_ia || caso.ia;
// Após mapCasoRelations, 'ia' pode ser o objeto flattened — sem sub-campos como dados_extraidos
// Os paths de penhora/prisão podem estar em casos_ia.dados_extraidos (JSONB) mas não são buscados
const iaPenhoraUrl = caso.url_peticao_penhora || ia?.url_peticao_penhora || null;
//                   ↑ pode existir   ↑ pode não existir se ia foi flattenado
```

### Correção

```diff
  const ia = Array.isArray(caso.casos_ia) ? caso.casos_ia[0] : caso.casos_ia || caso.ia;

  const iaPenhoraUrl =
    caso.url_peticao_penhora ||
    ia?.url_peticao_penhora ||
+   ia?.dados_extraidos?.url_peticao_penhora ||
    null;

  const iaPrisaoUrl =
    caso.url_peticao_prisao ||
    ia?.url_peticao_prisao ||
+   ia?.dados_extraidos?.url_peticao_prisao ||
    null;
```

---

## Eixo 8 — Reorganização da UI do Defensor

### Arquivos
- `frontend/src/areas/defensor/pages/DetalhesCaso.jsx`
- `frontend/src/areas/defensor/components/detalhes/PainelDocumentos.jsx`

### Mudanças

#### Aba "Visão Geral" — Seção de Minutas (topo)

Consolidar em um único card:
- ✅ Download Petição — Rito Penhora
- ✅ Download Petição — Rito Prisão
- ✅ Download Termo de Declaração
- ✅ Botão: Regerar Minuta (admin)
- ✅ Botão: Gerar / Regerar Termo (admin)

Remover desta aba: seção "Anotações / Feedback"

#### Aba "Gestão & Finalização"

Inserir no topo: seção "Anotações / Feedback" (movida da aba Visão Geral)

#### PainelDocumentos.jsx

Remover todos os blocos de download de minutas/termos e botões de regeneração.
Manter apenas:
- Lista de documentos digitalizados (com etiquetas coloridas)
- Botão "Adicionar Documentos ao Caso"

---

## Ordem de Execução Recomendada

```
Sessão de Trabalho:

1. [Backend]  Eixo 1: isOwner BigInt vs string         ← desbloqueia todos os defensores
2. [Backend]  Eixo 2: unidade_id no atualizarDefensor  ← correção trivial, 3 linhas
3. [Backend]  Eixo 3: caso sem docs → pronto_para_analise (guarda no processarCasoEmBackground)
4. [Frontend] Eixo 3: garantir enviarDocumentosDepois enviado sempre
5. [Backend]  Eixo 4: normalizeComarca na busca de unidade
6. [Backend]  Eixo 5: baseData.NOME no filhoPrincipal
7. [Backend]  Eixo 6: nome da mãe vs filho ao criar caso
8. [Backend]  Eixo 7: fallback JSONB nas URLs de minuta
9. [Frontend] Eixo 8: reorganização UI DetalhesCaso + PainelDocumentos
```

---

## Verificação Final

Após implementar todos os eixos, testar sequencialmente:

| Teste | Resultado Esperado |
|-------|-------------------|
| Defensor abre caso próprio | Acesso normal, sem 423 |
| Admin muda unidade do usuário | Reflete imediatamente no próximo login |
| Triagem "Deixar para Scanner" | Caso fica em `aguardando_documentos` |
| Scanner finaliza upload | Caso vai para `pronto_para_analise` |
| Caso com cidade "Teixeira de Freitas" | Vinculado à unidade `Teixeira de Freitas` |
| Minuta com 2 filhos | Dados de ambos presentes no DOCX |
| Listagem do Dashboard | Nome do filho como título, mãe como subtítulo |
| Aba Visão Geral do Defensor | 3 downloads + 2 botões de regerar |
| PainelDocumentos | Só lista de arquivos, sem botões de minuta |

---

*Documento gerado pelo assistente de IA — Mães em Ação DPE-BA*

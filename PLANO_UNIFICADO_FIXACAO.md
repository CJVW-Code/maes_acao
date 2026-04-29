# GIGA PLANO: Especificação Técnica e Operacional — Fixação de Alimentos (v5.0)

Este documento é a base canônica para a implementação. Ele consolida integralmente os planos de Correção Financeira, Melhorias de Fixação e as diretrizes de arquitetura v2.1. **Nenhum detalhe técnico foi simplificado ou omitido.**

---

## 1. ARQUITETURA DE DADOS E MAPEAMENTO PRISMA

### 1.1 Fonte da Verdade e Coalescência de Dados (Deep Merge)
Para resolver a perda de dados bancários e financeiros, implementaremos uma função de **Sanitização e Enriquecimento** que atua antes da renderização e da geração de documentos.

**Mapeamento de Prioridade (Truth Hierarchy):**
1.  **Tabela `casos_juridico` (Prisma)**:
    *   `conta_banco`, `conta_agencia`, `conta_numero`, `conta_operacao`
    *   `debito_valor`, `debito_penhora_valor`, `debito_prisao_valor`
    *   `vencimento_dia`, `percentual_salario`, `tipo_decisao`
2.  **JSONB `dados_formulario` (Triagem)**:
    *   Campos legados: `banco_deposito`, `agencia_deposito`, `conta_deposito`, `dia_pagamento`, `valor_pensao`.
3.  **JSONB `casos_ia.dados_extraidos` (Gemini)**:
    *   Dados capturados via OCR que ainda não foram validados pelo usuário.

**Lógica de Implementação (Pseudo-code):**
```javascript
const enriched = {
  ...ia_extraidos,
  ...dados_formulario,
  ...casos_juridico, // Ocupa o topo da pilha
};
// Regra de Ouro: Se casos_juridico.conta_numero existe, ele anula o que está no JSON.
// Se casos_juridico está vazio, o JSON preserva a informação.
```

### 1.2 Mapeamento de Campos (Database vs DOCX)
| Campo no Banco (Prisma) | Chave no JSONB | Tag no DOCXTEMPLATER |
| :--- | :--- | :--- |
| `conta_banco` | `banco_deposito` | `{dados_bancarios_exequente}` (formatado) |
| `conta_numero` | `conta_deposito` | `{dados_bancarios_exequente}` |
| `debito_valor` | `valor_debito` | `{valor_total_debito_execucao}` |
| `vencimento_dia`| `dia_pagamento` | `{dia_pagamento}` |
| `percentual_salario`| `percentual_salario_minimo` | `{percentual_salario_minimo}` |

---

## 2. REGRAS FINANCEIRAS E CÁLCULOS AUTOMATIZADOS

### 2.1 Matriz de Cálculo do Valor da Causa
A lógica de cálculo deve ser isolada por `acaoKey` para evitar contaminação de ritos:

*   **Rito: Fixação de Alimentos / Gravídicos**
    *   **Regra**: `valor_causa = (valor_mensal_pensao || valor_pensao) * 12`.
    *   **Trigger**: Acionado se `acaoKey === 'fixacao_alimentos'`.
*   **Rito: Execução (Prisão/Penhora/Cumulado)**
    *   **Regra**: `valor_causa = somatório(debito_penhora_valor, debito_prisao_valor)`.
    *   **Trigger**: Ignora o multiplicador de 12 meses. O valor da causa é o valor nominal da dívida.

### 2.2 Sanitização de Inputs
*   **Deep Flattening**: A função de enriquecimento deve transformar objetos aninhados em chaves planas para garantir que o Docxtemplater encontre as tags sem erros de "undefined".
*   **Currency Normalization**: Todos os campos financeiros devem passar por `parseCurrencyToNumber()` antes do cálculo e `formatCurrencyBr()` antes da exibição/DOCX.

---

## 3. NOVOS COMPONENTES E DESIGN SYSTEM (TAILWIND v4)

### 3.1 Estilização Premium (`index.css`)
Implementação de classes reutilizáveis no padrão Tailwind CSS v4:
```css
@layer components {
  .secao-juridica {
    @apply border-l-4 border-primary bg-primary/5 p-4 rounded-r-xl mb-6;
  }
  .input-destaque {
    @apply font-mono text-primary font-bold bg-white border-2 border-primary/20 focus:border-primary focus:ring-primary/10;
  }
}
```

### 3.2 Seção de Detalhes Defsul (`SecaoCamposGeraisFamilia.jsx`)
Adição de novos campos funcionais:
1.  **Guarda e Convivência (`descricaoGuarda`)**:
    *   Se preenchido: Injetar cláusula: "As partes acordam que a guarda será exercida de forma compartilhada..."
2.  **Bens e Partilha (`bensPartilha`)**:
    *   Campo de texto livre para descrição de patrimônio.
3.  **Situação Financeira (`situacaoFinanceiraGenitora`)**:
    *   Foco em descrever a vulnerabilidade da assistida para reforçar o pedido de alimentos.

---

## 4. SEGURANÇA E INTEGRIDADE (LGPD / RBAC)

### 4.1 Locking e Máquina de Estados
*   **Salvamento de Dados**: O endpoint `/api/casos/:id/juridico` deve validar o `requireLock(1)`.
*   **Proteção de Arquivados**: Bloquear qualquer alteração se `caso.arquivado === true`.

### 4.2 Higienização de Logs
*   **Regra**: Nunca registrar o objeto `enriched` ou `payload` no logger.
*   **Log Permitido**: `logger.info("[JURIDICO] Dados atualizados para o caso ${id} por ${user.nome}")`.

---

## 5. PLANO DE AÇÃO DETALHADO (STEP-BY-STEP)

### Fase 1: Fundação Visual e Estrutura (Frontend)
1.  Atualizar `index.css` com componentes Tailwind v4.
2.  Criar `SecaoCamposGeraisFamilia.jsx` integrando os campos de Guarda, Bens e Situação Financeira.
3.  Ajustar `DetalhesCaso.jsx` para incluir os novos `useState` e sincronizar com o salvamento.

### Fase 2: Inteligência e Mapeamento (Backend)
1.  **Refatorar `mapCasoRelations`**: Implementar a Coalescência (Seção 1.1) e o Deep Flattening.
2.  **Refatorar `buildDocxTemplatePayload`**: Aplicar a Matriz de Cálculos (Seção 2.1) e formatação de dados bancários.
3.  **Corrigir `salvarDadosJuridicos`**: Garantir persistência atômica dos campos bancários e financeiros.

### Fase 3: Flexibilização e IA (Pipeline)
1.  **`submissionService.js`**: Tornar RG/CPF de menores opcionais.
2.  **Worker de Background**: Impedir que a IA sobrescreva dados manuais na tabela `casos_juridico`.

---

## 6. PRE-MORTEM E MITIGAÇÕES

*   **Risco**: Concorrência entre IA e Usuário.
    *   *Solução*: Implementar check de `updated_at`. Se o usuário editou após o início do job de IA, a IA descarta sua alteração.
*   **Risco**: Tags quebradas no Word.
    *   *Solução*: Uso estrito das tags oficiais (`{VALOR_CAUSA}`, `{NOME_ASSISTIDO}`). Fallback para "______" se o dado for nulo.
*   **Risco**: Perda de dados bancários.
    *   *Solução*: Garantir que o frontend envie `conta_banco`, `conta_agencia`, `conta_numero` e `conta_operacao` em todo `handleSaveJuridico`.

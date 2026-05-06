# Estado Atual e Gaps Identificados — Mães em Ação v2.1

> **Criado:** 2026-04-13 · **Fonte:** Análise do histórico git + conversas de desenvolvimento

Este documento descreve o estado atual do sistema após os 9 commits registrados no git, consolidando os gaps técnicos conhecidos e os próximos passos estratégicos.

---

## 1. Estado Atual do Sistema (Baseline 2026-04-13)

### Stack em Produção

| Componente       | Tecnologia                         | Status          |
| :--------------- | :--------------------------------- | :-------------- |
| Frontend         | React 18 + Vite → Vercel           | ✅ Operacional  |
| Backend          | Node.js + Express → Google Cloud Run        | ✅ Operacional  |
| Banco            | Supabase PostgreSQL (sa-east-1)    | ✅ Operacional  |
| Storage          | Supabase Storage (3 buckets)       | ✅ Operacional  |
| Fila IA          | Upstash QStash                     | ✅ Operacional  |
| OCR              | Gemini Vision                      | ✅ Operacional  |
| Geração Texto    | Groq Llama 3.3 70B                 | ✅ Operacional  |
| Colaboração      | `assistencia_casos` + notificações | ✅ Implementado |
| Session Locking  | `lockController.js` Nível 1+2      | ✅ Implementado |
| Scanner Dedicado | `ScannerBalcao.jsx`                | ✅ Implementado |

---

## 2. Gaps Técnicos Conhecidos (Identificados no `relatorio_consolidado_v2.md`)

### 2.1 Retenção de Dados dos Filhos (`exequentes`)

**Problema:** No `casosController.js` (inserção via Prisma), o JSON `lista_filhos` do `dados_formulario` **não está sendo roteado para a coluna JSONB `exequentes`** na tabela `casos_partes`.

**Impacto:** As estatísticas de quantidade de crianças atendidas no mutirão se perdem. As peças processuais com múltiplos filhos podem não ter todos os exequentes no template.

**Solução esperada:**

```javascript
// No casosController.js, na criação do caso via Prisma:
await prisma.casos_partes.create({
  data: {
    caso_id: novoCaso.id,
    cpf_assistido: dados.cpf,
    representante_cpf: dados.representante_cpf,
    exequentes: JSON.parse(dados.outros_filhos_detalhes || "[]"), // ← FALTA ISSO
  },
});
```

---

### 2.2 Geração Dupla (Penhora + Prisão Simultâneas)

**Problema:** O pipeline assíncrono (`documentGenerationService.js`) não verifica se a inadimplência é ≥ 3 meses para disparar a geração simultânea dos dois ritos.

**Impacto:** Casos de execução com dívida acima de 3 meses precisam de intervenção manual para gerar as duas peças.

**Lógica esperada:**

```javascript
const mesesDebito = calcularMesesDebito(
  dados_formulario.periodo_debito_execucao,
);
if (mesesDebito >= 3 && tipoAcao.includes("exec")) {
  await Promise.all([
    generateDocx("exec_penhora.docx", payload),
    generateDocx("exec_prisao.docx", payload),
  ]);
}
```

---

### 2.3 Código Fantasma — Portal do Cidadão (Legado Mães em Ação anterior)

**Problema:** Existem componentes e referências remanescentes do sistema anterior que não se encaixam na dinâmica do mutirão presencial.

**O que precisa ser removido/ajustado:**

| Item                          | Arquivo                                                  | Ação                  |
| :---------------------------- | :------------------------------------------------------- | :-------------------- |
| Componente de autoatendimento | `PainelRecepcao.jsx`                                     | Remover ou ocultar    |
| Status obsoleto               | `reuniao_agendada` no Dashboard                          | Filtrar/ocultar da UI |
| Status obsoleto               | `reuniao_online_agendada`, `reuniao_presencial_agendada` | Avaliar remoção       |

---

### 2.4 Refatoração UI Form — Config-Driven

**Problema:** Parte da lógica de visibilidade/obrigatoriedade de campos ainda está hardcoded no `StepDadosPessoais.jsx` e outros Steps, não no arquivo de configuração (`familia.js`).

**Objetivo:** O formulário deve ser um consumidor puro da configuração da ação.

**Flags a implementar no `familia.js`:**

```javascript
{
  key: "exec_penhora",
  exigeDadosProcessoOriginal: true,     // exibe SecaoProcessoOriginal
  ocultarDadosRequerido: false,          // mostra seção do requerido
  isCpfRepresentanteOpcional: false,     // CPF da mãe obrigatório
  labelAutor: "Exequente",              // rótulo do campo autor
  exigeFilhos: true,                    // exibe lista de filhos/exequentes
}
```

---

## 3. Funcionalidades Implementadas Recentemente (Para Documentar)

### 3.1 Vínculo Automático de Irmãos (`BuscaCentral.jsx`)

Quando a `BuscaCentral` encontra um caso existente pelo CPF da mãe (`representante_cpf`), ela exibe um botão que pré-preenche os dados do representante no formulário de triagem de um **novo protocolo**. Dessa forma, não é necessário redigitar todos os dados da mãe ao abrir um caso para um segundo filho.

**Fluxo:**

1. Servidor busca CPF da mãe → encontra casos anteriores
2. Sistema exibe cards dos casos existentes
3. Botão "Novo Protocolo para este Representante" → navega para `TriagemCaso` com `location.state = { prefillRepresentante: dadosDaMae }`
4. `useFormEffects.js` detecta o `state` e dispara `PREFILL_REPRESENTATIVE_DATA`

### 3.2 Sistema de Notificações (`NotificacoesBell.jsx`)

Bell de notificações no header da área do defensor com:

- Badge de contador de não lidas
- Dropdown com lista das 20 mais recentes
- Marcar como lida individualmente
- Tipos: `upload` (novos documentos), `reagendamento`, `assistencia` (colaboração)

### 3.3 Múltiplas Minutas no `DetalhesCaso.jsx`

A tela de detalhes exibe abas para cada documento disponível no Storage:

- Petição Principal (`.docx`)
- Termo de Declaração (quando gerado)
- Capa Processual (pós-protocolo)

---

## 4. Próximos Passos Estratégicos

Em ordem de prioridade:

1. **[CRÍTICO] Sanar Gap `exequentes`** — garantir que `lista_filhos` seja gravada em `casos_partes.exequentes`
2. **[CRÍTICO] Geração Dupla** — implementar detecção de dívida ≥ 3 meses + geração simultânea
3. **[MÉDIO] Limpeza de Código Fantasma** — remover `PainelRecepcao.jsx` e status obsoletos
4. **[MÉDIO] Refatoração Config-Driven** — completar migração da lógica hardcoded para `familia.js`
5. **[BAIXO] Relatórios Avançados** — exportação CSV/PDF por período/unidade para gestão da DPE

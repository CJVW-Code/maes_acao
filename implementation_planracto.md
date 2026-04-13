# Plano de Implementação Estratégica, Limpeza e Alinhamentos Finais (Mães em Ação v2.1)

Este plano engloba a refatoração do UI formulário, a limpeza de UI legada (Portal do Cidadão), a garantia do fluxo correto de banco (exequentes) e as regras complexas de geração de petições do Mutirão "Mães em Ação".

## User Review Required

> [!IMPORTANT]
> - **Mudança DB Crítica:** O backend agora precisará suportar o múltiplo salvamento de petições JSON array (Penhora / Prisão simultâneas) e persistência de "exequentes" em `casos_partes`.
> - **Mudança UI Crítica:** Componentes do "Agendamento" / "PainelRecepcao" serão varridos da área do defensor para diminuir ruídos no balcão presencial.

## Proposed Changes

---

### 1. Correções Críticas de Backend (Banco e Normalização)

Garantir os gaps de dados levantados nos relatórios do Prisma.

#### [MODIFY] [casosController.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/controllers/casosController.js)
- Ao processar a `criarNovoCaso()`, resgatar a `lista_filhos` e inseri-los no objeto JSONB `exequentes` da modelagem do `casos_partes`.
- Garantir que a estrutura mantenha contagens oficiais de filhos validadas para as dashboards de mutirão.

#### [MODIFY] [schema.prisma](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/prisma/schema.prisma)
- Averiguar se o modelo `casos_ia` permite ou deve permitir array flexível de URLs para cobrir dupla-geração, através da adição de campos explícitos (ex: `url_peticao_penhora`, `url_peticao_prisao`) ou adaptação do armazenamento.

---

### 2. Pipeline de Documentos: Geração Dupla (Prisão + Penhora)

Suportar a geração bifurcada para Ação de Alimentos baseada na inadimplência.

#### [MODIFY] [documentGenerationService.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/backend/src/services/documentGenerationService.js)
- Adicionar lógica para parse do período: Se débito for ≥ 3 meses, gerar OBRIGATORIAMENTE duas instâncias de documento (`executacao_alimentos_penhora.docx` e `executacao_alimentos_prisao.docx`) e injetar suas URLs/Buffers nos storage handlers.

#### [MODIFY] [familia.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/config/formularios/acoes/familia.js) (Para o Backend)
- Modificar configuração do JSON da Execução para prever as chaves de "Gerar Múltiplos".

---

### 3. Ajustes no Frontend (Limpeza do Código Fantasma v1)

Remover todas as telas que existiam de auto-serviço e diminuir a bagunça em dashboard.

#### [DELETE] [PainelRecepcao.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/defensor/pages/PainelRecepcao.jsx)
- Excluir o componente não utilizado.

#### [MODIFY] [Dashboard.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/defensor/pages/Dashboard.jsx)
- Remover abas, contagens ou badging relacionados com reuniões virtuais, agendamentos onlines e portal. O painel deve ser 100% sobre andamento no recinto (Triagem -> Analisando -> Protocolando).

---

### 4. Vínculo Automático de Irmãos (Clonagem 1:1)

Implementar clonagem fluída para mães registrando múltiplos filhos na fila presencial.

#### [MODIFY] [BuscaCentral.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/servidor/components/BuscaCentral.jsx) / Telas de Nova Ação
- Incorporar lógica para verificar um CPF já existente e ofertar o botão: "Novo caso para esta Representante".
- Copiar em cache (zustand ou navigate state) os dados da representante (Nome, CPF, Endereço e Contato) pulando a fase de preenchimento inicial na TriagemCaso.

---

### 5. Estabilização e Guias do Dicionário

Transferir lógicas para o Dicionário, reduzindo side-effects em UI.

#### [MODIFY] [StepDadosPessoais.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/servidor/components/StepDadosPessoais.jsx) e `useFormValidation.js`
- Remover lógicas `if (tipoAcao === "Execução") { render(...) }`.
- Integrar propriedades de flags das configs (ex: `configAcao.isCpfRepresentanteOpcional` ou `configAcao.ocultarDadosRequerido`) dentro da estrutura declarativa de família.

#### [NEW] [PLAYBOOK_CAMPOS_E_TAGS.md](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/arquivos/Conhecimento/03-Guias/PLAYBOOK_CAMPOS_E_TAGS.md)
- Guia definitivo da engenharia sobre como a partir de agora criar novos checkboxes.

---

## Open Questions

- Como a arquitetura exata do `documentGenerationService.js` recebe os templates no fluxo de Qstash? É sincrono ao OCR ou em jobs divididos?
- Ao efetuar o *Vínculo de Irmãos*, a UI deve forçar a nova página de form para garantir validações obrigatórias de rito para a criança B.

## Verification Plan

### Teste de Regressão Sistêmica
- Gravação Isolada: Preencher um caso de *Fixação* do início ao fim e confirmar via Supabase DBeaver que `casos_partes -> exequentes` contém a string validada JSON.

### End 2 End Execução (Multiplas Peças)
- Fazer POST com período de Inadimplência `"Jan 2024 até Abril 2026"`.
- O servidor precisa retornar com Duas URLs de petições `.docx` (Penhora e Prisão) em vez de 1.

### Clean UI Verification
- Logar no Dashboard como Defensor admin e assegurar ausência do "Agendamentos".

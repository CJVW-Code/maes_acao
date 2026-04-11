# Refatoração: Lógica Baseada em Configuração (v2.1)

Este plano visa remover as verificações "hardcoded" (como `tipoAcao.includes('execucao')`) espalhadas pelos componentes, centralizando a inteligência no `DICIONARIO_ACOES`. Isso torna o sistema mais robusto, fácil de manter e evita "quebras" ao adicionar novas ações.

## User Review Required

> [!IMPORTANT]
> Esta refatoração altera o núcleo da validação e visibilidade do formulário. Embora o objetivo seja não quebrar nada, é uma mudança estrutural profunda. Recomendo testar os fluxos de **Fixação** e **Execução** logo após a aplicação.

## Proposed Changes

### 1. Configuração (Dicionário de Ações)
Mover a lógica de decisão para propriedades explícitas nas configurações das ações.

#### [MODIFY] [familia.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/config/formularios/acoes/familia.js)
- Adicionar flags como:
    - `exigeDadosProcessoOriginal`: (Para Execuções)
    - `ocultarDadosRequerido`: (Para Alvará)
    - `isCpfRepresentanteOpcional`: (Para casos onde o CPF pode não ser conhecido de imediato)
    - `labelAutor`: Customizar se é "Assistida", "Mãe", "Autor", etc.

---

### 2. Hooks de Validação e Handlers
Garantir que os hooks consumam as novas flags.

#### [MODIFY] [useFormValidation.js](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/servidor/hooks/useFormValidation.js)
- Substituir `isAlvara` por flags mais granulares vindas de `configAcao`.

---

### 3. Componentes de UI (Formulário)
Limpar o JSX para usar as propriedades da configuração.

#### [MODIFY] [StepDadosPessoais.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/servidor/components/StepDadosPessoais.jsx)
- Remover `configAcao?.titulo?.toLowerCase().includes("execução")`.
- Usar `configAcao.isCpfRepresentanteOpcional` para definir o label do CPF.

#### [MODIFY] [TriagemCaso.jsx](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/frontend/src/areas/servidor/pages/TriagemCaso.jsx)
- Simplificar a passagem de props para os steps.

---

### 4. Documentação Operacional (Manual do Dev)

#### [NEW] [PLAYBOOK_CAMPOS_E_TAGS.md](file:///c:/Users/weslley/Downloads/defensoria/maes%20em%20acao/defsul_maes/arquivos/Conhecimento/03-Guias/PLAYBOOK_CAMPOS_E_TAGS.md)
- Criar um guia visual e em checklist para:
    - **Adicionar Campo**: Onde inicializar no frontend, onde adicionar no componente, como garantir que o backend salve no Prisma.
    - **Tornar Opcional/Obrigatório**: Como mudar a validação no front sem quebrar o envio.
    - **Mapear Tags**: Onde registrar a tag no dicionário e como garantir que ela apareça no `.docx`. (Evitando o erro comum de salvar no banco mas não "chegar" no arquivo).

## Open Questions
- Existe alguma ação futura (além de família) que possa ter regras radicalmente diferentes? (Isso ajuda a nomear melhor as flags).

## Verification Plan

### Manual Verification
1. **Fluxo de Fixação:** Verificar se o campo CPF do representante continua obrigatório e os campos de processo original continuam ocultos.
2. **Fluxo de Execução:** Verificar se a seção de "Processo Original" aparece e se o CPF do representante/executado se comporta conforme o esperado.
3. **Fluxo de Alvará:** Confirmar que a seção de Requerido permanece oculta.

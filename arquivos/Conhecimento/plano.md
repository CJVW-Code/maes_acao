
# Plano: Consulta Instantânea de Caso por CPF com Auto-Redirecionamento

## Visão Geral
Implementar uma consulta de CPF em tempo real (com debounce) que verifica se um cidadão já possui um caso. Se possuir, exibir os detalhes do caso e fornecer botões de ação (anexar documentos se estiver pendente, caso contrário, mostrar o status). Se não houver caso, redirecionar para a criação de um novo caso (TriagemCaso).

**Contexto do sistema:** Apenas lado do servidor (sem acesso público) - utiliza busca por CPF sem chaves de acesso. Substituindo a busca baseada em chave por um endpoint mais simples, apenas por CPF.

## Decisões Chave do Usuário
1. **Estratégia de endpoint**: Criar novo endpoint em `statusController.js` que busca casos apenas por CPF (sem necessidade de `chave_acesso`) - renomear/adaptar o `consultarStatus()` existente.
2. **Busca instantânea**: Input com debounce enquanto o usuário digita (não baseado em clique).
3. **Manipulação de múltiplos casos**:Exibir nomes do exequente + representante + status.
4. **Cenário sem caso**: Redirecionar para `TriagemCaso` (página de criação de nova petição).
5. **Documentos pendentes**: Mostrar botão "Anexar Documentos" → redireciona para `EnvioDoc.jsx`.
6. **Outros status**: Exibir status + significado (reutilizar lógica de detalhes do caso).

## MODULARIZAÇÃO DO TRIAGEMCASO.JSX - STATUS ATUAL

### ✅ CONCLUÍDO

#### 1. Extração de Componentes (Redução: ~200 linhas)
- `StepTipoAcao.jsx` - Seleção do tipo de ação
- `StepDadosPessoais.jsx` - Dados pessoais do assistido/representante
- `StepRequerido.jsx` - Dados da outra parte
- `StepDetalhesCaso.jsx` - Detalhes específicos da ação
- `StepRelatoDocs.jsx` - Relato e upload de documentos
- `StepDadosProcessuais.jsx` - Dados processuais

#### 2. Extração de Estado e Reducer
- **Arquivo:** `src/areas/servidor/state/formState.js`
- **Conteúdo:** `initialState` (estado inicial completo) + `formReducer` (lida com UPDATE_FIELD, LOAD_RASCUNHO, ADD_FILHO, REMOVE_FILHO, UPDATE_FILHO, RESET_FORM)
- **Redução:** ~50 linhas do componente principal

#### 3. Extração de Constantes
- **Arquivo:** `src/areas/servidor/utils/formConstants.js`
- **Conteúdo:** `fieldMapping` (mapeamento camelCase → snake_case) + `digitsOnlyFields` (campos que devem conter apenas dígitos)
- **Redução:** ~30 linhas do componente principal

#### 4. Extração de Serviço de Submissão
- **Arquivo:** `src/areas/servidor/services/submissionService.js`
- **Conteúdo:** Função `processSubmission()` com toda lógica de validação, formatação e envio para API
- **Redução:** ~400 linhas do componente principal

#### 5. Estrutura de Pastas Criada
```
src/areas/servidor/
├── components/     # Componentes extraídos
├── services/       # Serviços de negócio
├── state/          # Estado e reducers
└── utils/          # Utilitários e constantes
```

### 📊 MÉTRICAS DE PROGRESSO
- **Tamanho original:** ~1000+ linhas
- **Tamanho atual:** 519 linhas
- **Redução total:** ~50% do código
- **Manutenibilidade:** Significativamente melhorada
- **Testabilidade:** Lógica isolada em módulos específicos

### 🔄 PRÓXIMOS PASSOS (A IMPLEMENTAR)

#### 1. Hook `useFormHandlers` (Próxima Prioridade)
- **Arquivo:** `src/areas/servidor/hooks/useFormHandlers.js`
- **Conteúdo:** Todos os event handlers do formulário
  - `handleFieldChange` - mudança genérica de campos
  - `handleNumericInput` - campos numéricos com formatação
  - `handleCurrencyChange` - campos monetários
  - `handleDayInputChange` - campos de dia
  - `handleCidadeChange` - busca de cidades
  - `handleSelecionaCidade` - seleção de cidade
  - `handleFilesChange` - upload de arquivos
  - `startRecording/stopRecording` - gravação de áudio
  - `removeAudioRecording` - remoção de áudio
  - `clearFieldError` - limpeza de erros
- **Redução esperada:** ~150 linhas

#### 2. Hook `useFormValidation`
- **Arquivo:** `src/areas/servidor/hooks/useFormValidation.js`
- **Conteúdo:** Lógica de validação em tempo real
  - Validação de CPF
  - Validação de campos obrigatórios
  - Validação de formato de dados
  - Retorno de mensagens de erro
- **Redução esperada:** ~50 linhas

#### 3. Hook `useFormEffects`
- **Arquivo:** `src/areas/servidor/hooks/useFormEffects.js`
- **Conteúdo:** Todos os useEffect do componente
  - Carregamento de rascunho do localStorage
  - Verificação de saúde da API
  - Efeitos de cidades e validação
- **Redução esperada:** ~30 linhas

#### 4. Simplificação Final do Componente
- **Arquivo:** `TriagemCaso.jsx` (reduzido a ~200 linhas)
- **Foco:** Apenas renderização e orquestração
- **Resultado final:** Componente limpo e legível

### 🎯 OBJETIVOS FINAIS DA MODULARIZAÇÃO
1. **TriagemCaso.jsx:** ~200 linhas (foco apenas em renderização)
2. **Separação clara:** UI ↔ Lógica ↔ Estado ↔ Serviços
3. **Reutilização:** Hooks e serviços podem ser reutilizados
4. **Testabilidade:** Cada módulo pode ser testado isoladamente
5. **Manutenibilidade:** Mudanças localizadas em módulos específicos

## Arquivos a Modificar
- `backend/src/controllers/statusController.js` - Novo `consultarPorCpf()` adaptar existente.
- `backend/src/routes/status.js` - Adicionar nova rota.
- `frontend/src/areas/servidor/pages/BuscaCentral.jsx` - Implementação completa da interface de busca instantânea.


## Fases de Implementação

### Fase 1: Backend (Endpoint apenas CPF)
1. Criar nova função `consultarPorCpf(cpf)` em `statusController.js`
   - Sem necessidade de verificação de `chave_acesso`.
   - Consultar tabela de casos por `cpf_assistido`.
   - Retornar o caso mais recente se existirem múltiplos.
   - Incluir: id, status, nome_assistido, nome_representante, inteiro_teor_representante, numero_processo, agendamento_data, descricao_pendencia.
2. Adicionar rota em `status.js`: `GET /api/status/cpf/:cpf` ou `/api/buscar-cpf`.
3. (Opcional) Criar utilitário de mapeamento status-para-descrição para exibição pública.

### Fase 2: Frontend - Refatoração de BuscaCentral.jsx
1. Substituir o card atual pela nova estrutura:
   - Input de CPF com debounce.
   - Seção de resultados (renderização condicional baseada no estado).
   - Spinner de carregamento durante a busca.
   - Exibição de erro.

2. Estados necessários:
   - `cpfInput`: valor bruto do input.
   - `loading`: verdadeiro durante a busca.
   - `error`: mensagem de erro ou nulo.
   - `caseFound`: objeto do caso ou nulo.
   - `noCase`: verdadeiro se nenhum caso for encontrado.

3. Função Debounce:
   - Disparar chamada de API 500-800ms após o usuário parar de digitar.
   - Validar formato do CPF (11 dígitos).
   - Limpar CPF (remover caracteres não numéricos).

4. Renderização Condicional:
   - **Carregando (Loading)**: Mostrar spinner.
   - **Erro**: Mostrar mensagem de erro em um alerta estilizado.
   - **Sem caso (No case)**: Mostrar mensagem + botão de redirecionamento para `TriagemCaso` ou auto-redirecionar.
   - **Caso encontrado (Case found)**: Mostrar card do caso com:
     - Nome do exequente.
     - Nome do representante.
     - Badge de status + significado.
     - Botão de ação ("Anexar Documentos" se pendente, caso contrário "Ver Status").

### Fase 3: Navegação & Roteamento
1. Se "Documentos Pendentes" → Botão linka para `/consultar?cpf=XXX` (`EnvioDoc.jsx`).
2. Se outro status → Mostrar detalhes, possivelmente um botão para `/consultar?cpf=XXX` para mais informações.
3. Se sem caso → Auto-redirecionar para `/novo-pedido` (`TriagemCaso`).

## Etapas de Verificação
1. Backend: Testar novo endpoint com curl/Postman.
   - `GET /api/status/cpf/12345678901` → retorna caso ou 404.
   - Verificar se múltiplos casos são tratados corretamente (retorna o mais recente).
2. Frontend: Teste manual no navegador.
   - Digitar CPF válido → Console sem erros, caso carrega em 1-2 segundos.
   - Digitar CPF inválido → Mensagem de erro exibida.
   - Status "Documentos pendentes" → Botão "Anexar Documentos" visível.
   - Outro status → Descrição correta do status exibida.
   - Sem caso → Redireciona para `TriagemCaso` (ou mostra link de redirecionamento).
3. UI/UX: Debounce funcionando (sem chamadas excessivas de API visíveis na aba network).

## Esclarecimentos Adicionais Necessários (resolvidos no Q&A)
- Multi-caso: Usará o caso mais recente por data de criação.
- Mapeamento de status: Pode reutilizar a lógica de `EnvioDoc.jsx` ou criar um utilitário compartilhado.
- Comportamento de redirecionamento: Usuário prefere condicional - mostrar detalhes do caso, depois ação baseada no status.


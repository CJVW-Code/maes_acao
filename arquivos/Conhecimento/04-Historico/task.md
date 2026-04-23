# Lista de Tarefas: Refinamento do Mutirão (14 Itens)

Esta lista reflete as instruções exatas da nossa conversa, divididas em etapas lógicas para execução do código.

## 🗄️ Backend (Banco, Fluxos e Locks)

- [x] **1. Ajustar Status Sem Documentos:**
      _Solução:_ No `casosController.js`, forçar a verificação de `enviarDocumentosDepois` em formato booleano. Se verdadeiro, forçar a role do status para `aguardando_documentos` em vez de mandar pra IA.
- [x] **2. Separar CPF Assistido (Criança) e Representante (Mãe):**
      _Solução:_ No `casosController.js`, desvincular as variáveis no objeto data do Prisma e criar mecanismo forte para assegurar que se a mãe representa, ela jamais herde o CPF da criança ou da própria mãe.
- [x] **3. Trava (Lock) de Servidor por 10 Minutos:**
      _Solução:_ No `lockController.js` (adicionado via `casosController.js`), alterar o tempo de expiração do bloqueio ativo no banco `interval '30 minutes'` para `interval '10 minutes'`.
- [x] **4. Autovincular Casos Relacionados p/ Defensor:**
      _Solução:_ Atualização no `casosController.js` (ou controller de status/lock). Ao um defensor travar a análise de um caso ou se assinalar nele, disparar query: "Seleiione todos os casos da mesma representante e mude `defensor_id` para o desse defensor atual".
- [x] **5. Restringir Notificações ao Próprio Usuário:**
      _Solução:_ No `notificacoesController.js`, filtrar os fetchs com a condição `usuario_id = req.user.id`, impedindo de ver sininho de terceiros.

## 🎨 Frontend Servidor (Triagem, Balcão e Formulários)

- [x] **6. Remover Validação de 250 Caracteres Mínimos:**
      _Solução:_ Alterar em `useFormValidation.js` e `StepRelatoDocs.jsx`, substituindo a validação rígida de `< 250` caracteres por uma menos restrita (> 10 caracteres lógicos).
- [x] **7. Adicionar Scanner (Sentença/Decisão e Cálculos):**
      _Solução:_ No dropdown de Tipos em `ScannerBalcao.jsx`, injetar as string literais, preservando o visual.
- [x] **8. Adicionar Upload "Cálculos" e "Link" em Valor Débito:**
      _Solução:_ Modificar `SecaoValoresPensao.jsx` inserindo os campos `input file` e `input text` mandatórios ao lado do output de valores, mapeando para o array de `documentos`.
- [x] **9. Ocultar Vínculos e Guarda de Fixação:**
      _Solução:_ Em `familia.js`, flag `ocultarGuardaeVinculos: true` dentro da propriedade da ação de fixação_alimentos.
- [x] **10. Corrigir Envio Booleano Sem Documentos:**
      _Solução:_ Em `submissionService.js`, enviar explicitamente `formData.append('enviarDocumentosDepois', !!state.enviarDocumentosDepois)`.

## 💼 Frontend Defensor (Painel, Casos e Acompanhamento)

- [x] **11. Consertar Card Solar do Dashboard:**
      _Solução:_ No `Dashboard.jsx`, alterar a referência de agregação que lia estritamente status obsoleto para ler com fidelidade a existência populada ou não do `numero_processo` solar.
- [x] **12. Criar Filtros por "Casos Liberados" (Para Protocolo):**
      _Solução:_ Em `Casos.jsx`, criar botão filtro de status `liberado_para_protocolo`.
- [x] **13. Filtro de Texto (Nome) no Colaborador/Compartilhar Casos:**
      _Solução:_ Em `ModalCompartilhar.jsx`, instanciar campo local e usar função iterativa de `.includes(inputBusca)` nas listas de defensores.
- [x] **14. Baixar Todos Arquivos ZIP Client-Side:**
      _Solução:_ Em `DocumentosList.jsx` ou similares do DetalhesCaso, instanciar a lib `jszip` (adicionar package) baixando sob demanda os blobs de URL e descarregando com nome da Assistida.

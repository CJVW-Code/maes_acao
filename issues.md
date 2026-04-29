# Relatório de Problemas Críticos (CodeRabbit Review)

Este documento detalha os problemas identificados pela análise automática do CodeRabbit, categorizados por área de impacto e severidade.

---

## 1. IA e Geração de Documentos (Petitório)

### [IA] Instrução de Guarda Excessivamente Rígida
- **Arquivo:** `backend/src/config/dicionarioAcoes.js`
- **Problema:** A instrução para a IA sobre Guarda e Convivência utiliza termos como "TERMINANTEMENTE PROIBIDO", o que pode levar o modelo a ignorar pedidos legítimos de regularização de guarda mesmo quando solicitado na triagem.
- **Impacto:** Petições geradas sem a cláusula de guarda, obrigando o defensor a redigir manualmente.
- **Sugestão:** Utilizar um flag estruturado (SIM/NÃO) no prompt para direcionar a IA de forma objetiva.

### [Qualificação] Mistura de Identificadores (Mãe vs. Filho)
- **Arquivo:** `backend/src/controllers/casosController.js`
- **Problema:** A lógica de montagem do payload está usando o nome da mãe (`REPRESENTANTE_NOME`), mas priorizando o CPF e Data de Nascimento do assistido (filho). 
- **Impacto:** **Grave.** Petições juridicamente incorretas, com a qualificação misturando dados de duas pessoas diferentes.
- **Sugestão:** Garantir que se a parte for o representante, todos os dados (nome, CPF, nasc) sejam consistentes com o representante.

### [Data Loss] Sobrescrita de Dados Editados por IA
- **Arquivo:** `backend/src/controllers/casosController.js`
- **Problema:** No merge de dados para o payload do documento, os dados extraídos pela IA (`dados_extraidos`) estão por último no spread operator, sobrescrevendo os dados que o defensor salvou manualmente no banco (`caso.juridico`).
- **Impacto:** Perda de edições manuais feitas pelo defensor (ex: correção de conta bancária ou valores) na hora de gerar o documento final.
- **Sugestão:** Inverter a ordem do merge para que `caso.juridico` tenha prioridade máxima.

### [Reprocessamento] Perda de Campos Novos
- **Arquivo:** `backend/src/controllers/casosController.js`
- **Problema:** A função de reprocessamento da IA não está preservando campos novos como `opcao_guarda` e `empregador_email`.
- **Impacto:** Ao clicar em "Regerar com IA", o sistema apaga informações importantes já salvas no banco.

---

## 2. Segurança e Controle de Acesso (RBAC)

### [RBAC] Falha "Aberta" para Cargos Não Mapeados
- **Arquivo:** `backend/src/controllers/defensoresController.js`
- **Problema:** O sistema usa `?? 0` para pesos de cargos desconhecidos. Se um cargo novo for inserido no banco sem atualização no código, ele será tratado como o nível mais baixo (subordinado).
- **Impacto:** Riscos de escalação de privilégios ou comportamento inesperado em permissões hierárquicas.
- **Sugestão:** O sistema deve negar a operação (Fail Closed) se o cargo não estiver explicitamente mapeado no mapa de pesos.

### [Segurança] Vazamento de Dados para Terceiros (Office Viewer)
- **Arquivo:** `frontend/src/areas/defensor/pages/DetalhesCaso.jsx`
- **Problema:** O uso do Microsoft Office Viewer via iframe envia a URL assinada (e sensível) do documento para servidores da Microsoft para renderização.
- **Impacto:** Risco de conformidade de dados sensíveis e LGPD. Além disso, o viewer não suporta PDFs.
- **Sugestão:** Migrar para um visualizador local de PDF/DOCX ou manter apenas o download seguro.

### [Bypass] Escapes na Proteção Regional do Coordenador
- **Arquivo:** `backend/src/controllers/defensoresController.js`
- **Problema:** O coordenador consegue alterar a unidade de um membro para uma unidade de *outra* regional durante o update, pois o sistema só valida a regional atual do alvo, não o destino. Além disso, comparações com `null` podem liberar o acesso indevidamente.
- **Impacto:** Coordenadores gerenciando usuários fora de sua jurisdição regional.

---

## 3. Integridade de Dados e Fluxo do Sistema

### [Login] Inconsistência na Normalização de E-mail
- **Arquivo:** `backend/src/controllers/defensoresController.js`
- **Problema:** O Login normaliza o e-mail (lowercase/trim), mas o Cadastro e Edição salvam o valor cru.
- **Impacto:** Usuários que foram cadastrados com letras maiúsculas ou espaços acidentais não conseguem logar, mesmo digitando o e-mail "correto".
- **Sugestão:** Normalizar o e-mail em todos os pontos de entrada (Cadastro, Update, Login).

### [Frontend] Dessincronia de Estado no Form (Hook useEffect)
- **Arquivo:** `frontend/src/areas/defensor/pages/DetalhesCaso.jsx`
- **Problema:** O formulário só se atualiza quando o ID do caso muda. Se houver um `mutate()` (atualização de dados) no mesmo caso, o formulário mantém os dados antigos da tela.
- **Impacto:** O defensor edita um dado, salva, mas a tela continua mostrando o valor anterior até que ele saia e volte na página.

### [Validação] CPF do Filho Opcional com Fallback Errado
- **Arquivo:** `frontend/src/areas/servidor/services/submissionService.js`
- **Problema:** Ao tornar o CPF da criança opcional na triagem, o backend faz fallback automático para o CPF da mãe.
- **Impacto:** Petição gerada com o CPF da mãe no campo reservado ao filho.

### [Nomenclatura] Mismatch de Campos (Snake vs Camel)
- **Arquivo:** `frontend/src/areas/servidor/state/formState.js`
- **Problema:** O frontend usa `opcaoGuarda`, mas o backend espera `opcao_guarda`.
- **Impacto:** Dados de guarda não são persistidos corretamente no banco de dados.

---

## 4. BI e Relatórios

### [BI] Filtro Regional quebra Exportação em Lote
- **Arquivo:** `backend/src/controllers/biController.js`
- **Problema:** O filtro de regional descarta unidades pré-carregadas que não possuem o campo `regional` preenchido corretamente no objeto, resultando em planilhas XLSX vazias.

### [PDF] Remoção de CSS no PDF Export
- **Arquivo:** `frontend/src/areas/defensor/hooks/useBiData.js`
- **Problema:** A função de sanitarização do PDF remove todos os `<link rel="stylesheet">`.
- **Impacto:** O PDF gerado perde todo o layout, cores e tipografia, ficando desconfigurado.

---

## 5. Interface de Usuário (UX)

### [Upload] Contagem de Documentos de Cálculo
- **Arquivo:** `frontend/src/areas/servidor/services/submissionService.js`
- **Problema:** Os uploads obrigatórios de cálculos de Prisão/Penhora não são somados ao total de documentos (`documentFiles.length`).
- **Impacto:** O sistema bloqueia o envio dizendo que "faltam documentos" mesmo quando o usuário anexou tudo corretamente nos campos específicos.

### [UI] Feedback Visual de PDF
- **Arquivo:** `frontend/src/components/DocumentUpload.jsx`
- **Problema:** Exibe "Otimizando imagem..." para arquivos PDF.
- **Impacto:** Confusão para o usuário, já que PDFs não passam por compressão de imagem.

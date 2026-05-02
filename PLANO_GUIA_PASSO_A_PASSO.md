# Plano de Implementação — Guia Passo a Passo (Documento de Apoio)

> **Objetivo:** Criar um documento de apoio em 4 "folhas" independentes para distribuição física ou digital, cobrindo cada perfil de usuário do sistema Mães em Ação — Def Sul.

---

## Escopo do Documento

O guia será organizado em **4 seções independentes** (uma por perfil), com linguagem simples, visual destacado e sem jargão técnico desnecessário. Cada seção cabe em uma folha A4 para impressão ou pode ser distribuída como imagem.

---

## Seção 1 — Servidor de Triagem (Formulário)

**Público:** Servidor que recebe a assistida e preenche o formulário no Defsul.

### Fluxo
1. Acessar o Defsul → Clicar em **"Nova Triagem"**
2. Buscar o CPF da assistida na tela de busca
   - Se já cadastrada: dados pré-preenchidos automaticamente
   - Se nova: preencher do zero
3. Preencher o formulário multi-step
4. Salvar → Sistema gera o **Protocolo**

### ⚠️ Campos que exigem atenção especial

| Campo | Por quê importa |
|---|---|
| **CPF da Assistida** | Vincula ao histórico de irmãos. CPF errado = caso duplicado |
| **Tipo de Ação** | Define o modelo da petição gerada pela IA. Seleção errada = petição errada |
| **Data da última parcela paga** | Campo crítico para execuções de alimentos |
| **Valor da dívida** | Determina se cabe rito de prisão (≥ 3 meses) |
| **Relato** | Não precisa ser jurídico. Precisa cobrir: O quê, Quando parou de pagar, Se há violência |
| **CPF do Requerido** | Preencher se disponível. Se não tiver, marcar "Não possui" |

### Status resultante
- O caso é criado com status **`aguardando_documentos`**
- Um número de protocolo é gerado automaticamente

---

## Seção 2 — Servidor do Scanner / Balcão

**Público:** Servidor responsável pela digitalização e upload dos documentos.

### Fluxo
1. Acessar a tela **"Scanner / Balcão"** no Defsul
2. Buscar o caso pelo **CPF** ou **Protocolo** gerado na triagem
3. Arrastar todos os documentos de uma vez na área de upload
4. Clicar em **"Finalizar Upload"**

### O que acontece depois?
- Status muda para **`documentação completa`**
- A **IA processa em background**: faz OCR nos documentos, extrai dados e gera a minuta (petição inicial)
- O servidor do jurídico será notificado quando estiver pronto

### ⚠️ Regras importantes
- Não é preciso aguardar na tela — o processamento é automático
- Imagens acima de 1,5 MB são comprimidas automaticamente
- Se o upload falhar, repetir a operação (não cria duplicidade)

---

## Seção 3 — Servidor Jurídico (Análise + SOLAR)

**Público:** Servidor que revisa a minuta gerada pela IA e realiza o cadastro no SOLAR.

### Momento 1 — Análise no Defsul

1. Acessar a lista de casos → filtrar por **"Pronto para Análise"**
2. Abrir o caso desejado
3. Clicar em **"Assumir Atendimento"** para vincular o caso ao seu nome
   > 🔒 **Regra de Lock:** Ao assumir, o caso fica **travado no seu nome permanentemente**.
   > Nenhum outro servidor consegue editar enquanto você estiver vinculado.
   > Para liberar, é necessário solicitar ao **Coordenador** ou **Gestor**.
4. Revisar o **"DOS FATOS"** gerado pela IA na aba **Minuta**
   - Editar se necessário
   - Clicar em **"Regerar com IA"** se preferir nova geração
5. Clicar em **"Liberar para Protocolo"** → caso vai para a fila do Defensor

### Momento 2 — Cadastro no SOLAR

1. Na aba **"Gestão & Finalização"**, clicar em **"Baixar Tudo (.zip)"**
2. Extrair o ZIP (contém `atendimento.json` + documentos)
3. Abrir o **SOLAR** (manter aba logada)
4. Usar a **Extensão Mães em Ação** no Chrome para automatizar o preenchimento
5. Conferir todos os dados antes de salvar

### ⚠️ Avisos
- Ao assumir um caso, você é o único responsável por ele até liberar
- Se precisar passar para outro colega: solicite ao **Coordenador** que libere o lock
- Não fechar a aba do SOLAR durante a automação

---

## Seção 4 — Defensor Público

**Público:** Defensor que realiza o protocolo final e entrega a capa à assistida.

### Fluxo
> O Defensor segue o mesmo fluxo do Servidor Jurídico (Seção 3), com a etapa extra de finalização.

1. Filtrar casos com status **"Liberado para Protocolo"**
2. Assumir o caso → Revisar minuta → Cadastrar no SOLAR (igual Seção 3)
3. Após protocolar no SOLAR/SIGAD, retornar ao Defsul
4. Na aba **"Gestão & Finalização"**, preencher:
   - **Número SOLAR/SIGAD**
   - **Número do Processo (PJE/TJ)**
5. Anexar a **Capa Processual (PDF)**
6. Clicar em **"Concluir Caso e Enviar ao Cidadão"**

### Entrega à Assistida
- Após finalizar, a capa fica salva no sistema
- Imprimir a capa e entregar à assistida junto com o número do processo
- A assistida pode consultar o status do caso a qualquer momento com o CPF e a Chave de Acesso fornecida na triagem

### ⚠️ Regras de finalização
- É obrigatório preencher Número SOLAR, Número do Processo e anexar a Capa
- Após "Concluir", o caso muda para status **`protocolado`** e não pode mais ser editado
- Apenas o **Admin** pode reverter uma finalização

---

## Seção Bônus — Coordenação e Gestão

**Público:** Coordenadores, Gestores e Administradores.

### Funções exclusivas
- **Liberar Lock:** Destravar um caso vinculado a um servidor/defensor via botão "Liberar Caso" no Controle do Caso
- **BI e Relatórios:** Acompanhar volume por unidade, por status e por período
- **Gerenciar Equipe:** Adicionar/editar membros, alterar cargos e vincular a unidades
- **Reprocessar IA:** Reiniciar o pipeline de IA em casos com erro (apenas Admin)
- **Configurações:** Horários de funcionamento do sistema e avisos globais

---

## Implementação Técnica

O documento será criado em **dois formatos**:

1. **Markdown** (este arquivo): referência para manutenção e atualização
2. **Integração no sistema** (opcional, ver `PLANO_LOCK_UI.md`): Cards interativos na página de Treinamentos

### Arquivos envolvidos (apenas para integração futura no sistema)
- `frontend/src/areas/defensor/pages/Treinamentos.jsx` — Adicionar card do guia
- `frontend/src/areas/servidor/pages/FaqDuvidas.jsx` — Adicionar link para o manual

---

## Checklist de Revisão

- [ ] Conteúdo validado com o coordenador do mutirão
- [ ] Linguagem aprovada (sem jargão técnico)
- [ ] Versão impressa testada em A4
- [ ] Distribuída para todas as unidades participantes

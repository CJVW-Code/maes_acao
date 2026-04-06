# DIAGNÓSTICO DETALHADO DE ALINHAMENTO GEOLÓGICO: ESTRATÉGIA V2.0 vs CÓDIGO (BASE MÃES EM AÇÃO)

Este documento aprofunda detalhadamente o estado atual do software assistente "Mães em Ação" em contraponto às exigências técnicas, de produto e regulatórias exaradas no **Documento de Estratégia do Sistema v2.0**. 

---

## 1. INFRAESTRUTURA E MODELO ASSÍNCRONO (NÓ CRÍTICO)

A premissa número um do documento é que o pico do evento pode sobrecarregar a rede em minutos. O Assistente base processava ~17 casos. O mutirão prevê **5.000+**. 

### 🟢 O que está alinhado:
- **Resiliência Arquitetural de Frontend:** Carga alinhada com as SPA estáticas no Vercel (Free), reduzindo peso da API serverless e viabilizando escalonamento rápido.
- **Preparação de Fallback (Desenvolvimento):** Geração nativa e buffers já conseguem tratar geração Prisma offline.

### 🔴 O que NÃO está alinhado (Falta / Urgente):
- **O Pipeline QStash (Rate Limiting de Vida ou Morte):** Segundo a estratégia, é EXAUSTIVAMENTE PROIBITIVO carregar o OCR ou a LLama Groq numa thread HTTP síncrona. O Railway que hospedará a aplicação tem um limite de 30s de timeout. 
  - **Status atual:** Estamos processando/simulando as inteligências em background nativo (`setImmediate` local), o que derreterá sob uso massivo em contêineres. 
  - **Ação:** Refatorar o roteamento para delegar obrigatoriamente a fila ao **QStash** (endpoint assíncrono), recebendo e orquestrando requests separadas (`/api/jobs`) de forma fragmentada.
- **Transição Gemini para GPT-4o-mini:** O projeto atual no seu *core AI* carrega resquícios robustos do Google Gemini. A estratégia v2.0 requer OCR via OpenAI GPT-4o-mini (Multimodal rápido) priorizado, limitando o LLM Groq 70B somente para mineração da seção "DOS FATOS".

---

## 2. NORMALIZAÇÃO DE BANCO E LOCKING (CONTROLE DE ACESSO CONCORRENTE)

O balcão de triagem operará em 52 sedes. Dois servidores nunca devem poder tentar manipular o mesmo caso sem serem alertados.

### 🟢 O que está alinhado:
- **Separação Prisma vs Supabase:** Mantivemos o `defensoresController.js` sob Prisma para manipulação trivial, enquanto os "Casos" e transações de carga rodam direto pelo driver do Supabase SDK — tal como aprovado como excelente pela documentação estratégica.
- **Tipagem Unificada (Schema):** Todas as colunas dos ENUMs, a migração do legado monolítico de 40 colunas para fatias isoladas (`casos`, `casos_partes`, `casos_juridico`) e status modernos (`aguardando_protocolo`, etc.) já figuram no backend perfeitamente.

### 🔴 O que NÃO está alinhado (Falta / Urgente):
- **Locking de Sessão Nível 1 e Nível 2 (Inexistente Efetivamente):** A estratégia v2.0 decreta: 
  - *Nível 1 (Servidor assume o caso)*.
  - *Nível 2 (Defensor bloqueia o Protocolo)*. 
  - **Status atual:** Faltam as submissões de **Remote Procedure Calls (RPCs)** rigorosas no terminal SQL do banco (*`lock_caso_servidor` e `lock_caso_defensor`*, descritos nos docs) e sua aderência às rotas explícitas do express (`lockController.js`).
  - **Falta na UI:** Ausência de interceptadores visuais na tela que mostrem um Card "Bloqueado pelo usuário X em horário Y (Erro 423)".

---

## 3. SEGREGAÇÃO DOS MODELOS JURÍDICOS (RITOS E TEMPLATES)

Os mutirões prevêem separações literais de embasamento jurídico por modelos como Penhora e Prisão Civil. 

### 🟢 O que está alinhado:
- **Arquitetura 100% "Dumb" nos templates (.docx)**: A diretriz diz para zerarmos lógica if/else dentro do modelo de Word. Totalmente alcançado! O `dicionarioAcoes.js` faz override dos ritos localmente, padronizando os subconjuntos de variáveis (ex: Capitalizando aspas e tags).
- **Adequação Limpa ao Cível Familia:** Campos defasados como "Dados Processuais", senhas e "Whatsapps" supérfluos foram excluídos nas views. A UI é responsiva orientada via "drop-boxes".
- **Identidade e Tematização Regional:** As variáveis de Comarca (Cidades), Varas de destino (`unidade_id`) reagem integralmente às regras do escopo. Foi aplicado perfeitamente o visual Roxo/Violeta ao layout.

### 🟡 O que está Parcialmente alinhado:
- **Modelos Residuais:** Autos apartados ou as ações de "Guarda" podem precisar de mapeamentos tardios previstos na entrega, mas o motor reator do framework FrontEnd (`familia.js`) já está programado para abstrair e engolir esses extras sem grandes gargalos.

---

## 4. O DROPPOINT DE LOTE (SCANNER UPLOAD)

### 🔴 O que NÃO está alinhado (Falta / Urgente):
- **Fila e UX Isolados do Scanner**: De acordo com a estratégia, os assistentes precisarão atuar como "fábricas". Recebe o lote físico → Escaneia. 
  - **Falta:** Ter a Dropzone nativa implementada na rota de recebimento (`/api/scanner/`) no servidor Express e em uma página isolada, programada unicamente para engolir os bytes dos PDFs, renomear, salvar na pasta e cuspir o *200 OK*, avisando a UI para focar na próxima pessoa via tela separada de filas.

---

## 5. SEGURANÇA E DATA RETENTION (LGPD)

### 🟡 O que está Parcialmente alinhado:
- **Signed URLs temporárias**: Exigência magna que todos os URLs sejam expirados numa hora, visados no Storage de sa-east-1 (Sp-Supabase). O backend de geração de peça cumpre parcialmente essa camada, mas será vital rodar a revisão global no roteamento para garantir que NENHUMA string de arquivo chegue ao Prisma ou a interface como "Link público".
- **Logs imaculados**: Falta homologar se todos os traceadores do Express realmente interceptam lixos JSON de CPF sem cuspir na stdout que vai para o Railway Monitor.

---

## RESUMO E DIRETRIZ PRIORITÁRIA DE ENGENHARIA

Nós superamos todo o estágio preliminar de **Confiabilidade de Telas + Dinâmica de ORMs e Templates Locais**. 
A missão primordial que sobra agora foca puramente em **Redes Isoladas e Resiliência Concorrente**:

**Ordem Tática para Atacar:**
1. ✅ Implantar **Lock Controller + RPC no DataBase**, fazendo cards de travamento de UI funcionarem com o Código HTTP 423.
2. ✅ Escrever endpoint de **Scanner Dedicado (`/api/scanner`)** separando o Upload da Triagem.
3. ✅ Converter o processamento pesado de Groq/Documentos via **Polling QStash**. Sem isso o Mutirão travará sob Timeout na Vercel e Railway.

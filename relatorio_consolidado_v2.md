# Relatório de Análise de Arquitetura e Plano Estratégico — Mães em Ação v2.0

Este documento consolida a auditoria técnica da base de código herdada do "Def Sul Bahia" contrastando-a com as necessidades críticas do Mutirão Estadual "Mães em Ação" (Estratégia v2.0).

---

## 1. Avaliação da Arquitetura Atual

A base atual possui uma arquitetura incrivelmente bem pensada para lidar com os gargalos operacionais e sistêmicos de um mutirão estadual físico (5.000+ casos, 50+ comarcas em 5 dias).

**Pontos Fortes Validados:**

- **Desacoplamento Triagem x Scanner:** Permite fluidez no balcão de atendimento, impedindo que gargalos no upload travem os guichês de cadastro.
- **Processamento em Background (QStash):** A decisão de mover OCR (GPT-4o-mini) e Redação (Groq Llama 3.3) para webhooks assíncronos previne falhas catastróficas de timeout (limite de 30s do Railway).
- **Graceful Degradation:** O backend sabe lidar com indisponibilidades da infraestrutura primária (Supabase Storage) acionando fallback para armazenamento local sem retornar erro ao usuário.
- **Escalabilidade (Locking & Unidades):** A implementação das tabelas `unidades` e o travamento atômico (Session Locking Nível 1 e 2) impede concorrência destrutiva, essencial quando há dezenas de defensores atuando simultaneamente.

---

## 2. Limpeza de "Código Fantasma" (Resquícios Def Sul v1)

O sistema atual carrega funcionalidades que não fazem sentido na dinâmica de balcão do mutirão, gerando poluição na UI, complexidade desnecessária no código e risco de bugs.

### O que deve ser podado:

1. **Portal do Cidadão e Autoatendimento:**
   - **Remover:** Componentes de recuperação de acesso (`PainelRecepcao.jsx`) e a lógica/status que envolvem "reuniões agendadas" ou "portal".
   - **Limpar:** `Dashboard.jsx`, eliminando exibição de status obsoletos como `reuniao_agendada`.
   - **Motivo:** O Mutirão é 100% presencial. Não há autoatendimento.
   
2. **Campos Familiares Obsoletos (Guardados na Auditoria):**
   - _Obs: Embora devam ser removidos do fluxo futuro, por decisão atual, os dados do "Def Sul" permanecerão silenciados, ocultando-se apenas da UI via refatoração por configuração._

### O que deve permanecer e ser expandido (Exceções Estratégicas):

1. **Sistema de Compartilhamento (Colaboração):**
   - Mantido para permitir revisões conjuntas ou repasse de demandas complexas no mutirão, atuando em paralelo com a nova regra de "Vínculo Automático de Irmãos".
   
2. **Vínculo Automático de Irmãos (Clonagem Segura 1:1):**
   - Possibilitar a reutilização de dados do representante (Mãe) para novos protocolos independentes. Para não arriscar a normalização bruta em pleno evento de pico, adotou-se o modelo de "Clonagem dos dados do Representante na Triagem".

---

## 3. Fluxos Operacionais e Gaps Identificados (v2.0)

A modelagem no banco prevê 5 tabelas (`casos`, `casos_partes`, `casos_juridico`, `casos_ia` e `documentos`) para facilitar a geração de métricas oficiais exigidas pela DPE-BA.

### Gaps Técnicos a Serem Sanados:

1. **Retenção de Dados dos Filhos (`exequentes`):** 
   - No `casosController.js` (inserção de novo caso Prisma), o JSON `lista_filhos` não está sendo roteado devidamente para a coluna JSONB `exequentes` na tabela `casos_partes`. Sem isso, as estatísticas de quantas crianças form atendidas no mutirão se perdem.
   
2. **A Execução de Alimentos Múltipla (Penhora e Prisão):**
   - O guia de estratégia processual exige **Geração Dupla** se a inadimplência for superior ou igual a 3 meses. 
   - Atualmente, o pipeline assíncrono (`documentGenerationService.js` / QStash) não está programado para verificar a variável de débito do assistido e disparar a subida de múltiplos templates. A UI de `PainelDocumentos` precisará se adequar a exibir ambas as peças.

---

## 4. Refatoração do Frontend (Baseado em Configuração)

A visibilidade e obrigatoriedade de campos no formulário (`TriagemCaso.jsx`) ainda dependem de lógicas hardcoded no frontend. O formulário deve atuar meramente como consumidor do dicionário de `familia.js`.

### Flags de Controle a Serem Adotadas:
- `exigeDadosProcessoOriginal`
- `ocultarDadosRequerido`
- `isCpfRepresentanteOpcional`
- `labelAutor` (Mãe, Assistida, etc.)

---

## 5. Próximos Passos Estratégicos

Os próximos passos estão devidamente escalonados no plano técnico (`implementation_planracto.md`). Resumidamente:

1. **Sanar Gap Backend (Exequentes):** Gravar a `lista_filhos` em `casos_partes`.
2. **Feature: Geração Dupla:** Implementar a lógica de meses de inadimplência gerando Penhora e Prisão combinadas.
3. **Limpeza Funcional:** Erradicar `PainelRecepcao.jsx` e status mortos do frontend.
4. **Vínculo de Irmãos:** Aplicar a clonagem na `BuscaCentral`.
5. **Refatoração UI Form:** Abstrair o core do formulário para obedecer apenas o config file (`familia.js`).

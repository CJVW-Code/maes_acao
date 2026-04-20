# Base de Conhecimento — Mães em Ação

Esta pasta centraliza toda a documentação estratégica, técnica e histórica do projeto **Mães em Ação**. A estrutura está organizada em subcategorias para facilitar a navegação e a manutenção do contexto.

> **Última atualização:** 2026-04-13 · Versão 2.1

---

## 📂 Estrutura de Pastas

### [01-Referencia](./01-Referencia/)

Documentação do estado **atual** e regras fundamentais do sistema. Início obrigatório para qualquer IA ou desenvolvedor.

- **[ARCHITECTURE.md](./01-Referencia/ARCHITECTURE.md)** `v2.1`: Visão técnica completa — stack, módulos, fluxo operacional, Docker, deploy.
- **[BUSINESS_RULES.md](./01-Referencia/BUSINESS_RULES.md)** `v2.0`: Regras de negócio canônicas — tipos de ação, validações, permissões, locking.
- **[DATABASE_MODEL.md](./01-Referencia/DATABASE_MODEL.md)** `v2.1`: Schema de dados com todas as tabelas, incluindo `assistencia_casos` e `notificacoes`.
- **[routes.md](./01-Referencia/routes.md)**: Referência completa da API (Scanner, Locking, Colaboração).
- **[tags.md](./01-Referencia/tags.md)**: Mapeamento de tags para templates DOCX.
- **[schema_maes_em_acao_v1.0.sql](./01-Referencia/schema_maes_em_acao_v1.0.sql)**: Definição SQL base do banco de dados.

### [02-Estrategia](./02-Estrategia/)

Planos de evolução, diagnósticos e estratégias de adaptação.

- **[diagnostico_estrategia_v2_detalhado.md](./02-Estrategia/diagnostico_estrategia_v2_detalhado.md)**: Alinhamento entre o código e a estratégia v2.0.
- **[plano_adaptacao_execucao_alimentos.md](./02-Estrategia/plano_adaptacao_execucao_alimentos.md)**: Estratégia para o fluxo de execução de alimentos.
- **[plano.md](./02-Estrategia/plano.md)**: Planos gerais de desenvolvimento (inclui modularização TriagemCaso, BuscaCentral).
- **[plano_testes_carga_confiabilidade.md](./02-Estrategia/plano_testes_carga_confiabilidade.md)**: Plano operacional de carga, soak e resiliência para o mutirão.

### [03-Guias](./03-Guias/)

Recursos práticos para desenvolvimento e integração com IA.

- **[guia_dev_maes_em_acao_v1.0.md](./03-Guias/guia_dev_maes_em_acao_v1.0.md)**: Guia completo de desenvolvimento, stack e padrões.
- **[CADASTRO_NOVA_ACAO.md](./03-Guias/CADASTRO_NOVA_ACAO.md)**: Como adicionar novos tipos de petição/ações ao sistema.
- **[TROUBLESHOOTING.md](./03-Guias/TROUBLESHOOTING.md)** `v2.1`: Erros comuns e soluções — inclui BigInt, directUrl, Invalid Date.
- **[PLAYBOOK_CAMPOS_E_TAGS.md](./03-Guias/PLAYBOOK_CAMPOS_E_TAGS.md)**: Referência rápida de campos do formulário e tags DOCX.
- **[system_prompt_maes_em_acao.md](./03-Guias/system_prompt_maes_em_acao.md)**: Prompts e diretrizes para assistentes de IA (o que você está lendo agora 🤖).

### [04-Historico](./04-Historico/)

Registros de auditoria, relatórios passados e walkthroughs.

- **[walkthrough.md](./04-Historico/walkthrough.md)** `v2.1`: Histórico completo dos 9 commits git com detalhamento por fase.
- **[relatorio_modularizacao.md](./04-Historico/relatorio_modularizacao.md)** `v2.1`: Progresso completo da refatoração (Fases 1-6).
- **[status_e_gaps_2026-04-13.md](./04-Historico/status_e_gaps_2026-04-13.md)** `NOVO`: Estado atual do sistema + gaps técnicos identificados + próximos passos.
- **[auditoria_campos_triagem_execucao_2026-04-01.md](./04-Historico/auditoria_campos_triagem_execucao_2026-04-01.md)**: Auditoria pontual de campos do formulário.

---

## 🗺️ Guia de Leitura por Contexto

| Situação | Documentos Prioritários |
|:---------|:------------------------|
| **Início rápido / Onboarding** | `ARCHITECTURE.md` → `guia_dev_maes_em_acao_v1.0.md` |
| **Entender regras de negócio** | `BUSINESS_RULES.md` |
| **Schema do banco** | `DATABASE_MODEL.md` → `schema_maes_em_acao_v1.0.sql` |
| **Adicionar nova ação** | `CADASTRO_NOVA_ACAO.md` → `tags.md` |
| **Depurar um erro** | `TROUBLESHOOTING.md` |
| **Entender o que foi feito** | `walkthrough.md` → `relatorio_modularizacao.md` |
| **O que fazer a seguir** | `status_e_gaps_2026-04-13.md` |

---

> **Dica para IAs:** Ao carregar contexto sobre este projeto, priorize a pasta `01-Referencia` para entender as regras vigentes e a pasta `03-Guias` para padrões de implementação. Consulte `04-Historico/status_e_gaps_2026-04-13.md` para entender o que está pendente.

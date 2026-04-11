# Base de Conhecimento — Mães em Ação

Esta pasta centraliza toda a documentação estratégica, técnica e histórica do projeto **Mães em Ação**. A estrutura está organizada em subcategorias para facilitar a navegação e a manutenção do contexto.

## 📂 Estrutura de Pastas

### [01-Referencia](./01-Referencia/)

Documentação do estado atual e regras fundamentais do sistema.

- **[ARCHITECTURE.md](./01-Referencia/ARCHITECTURE.md)**: Visão técnica, módulos e fluxo operacional.
- **[BUSINESS_RULES.md](./01-Referencia/BUSINESS_RULES.md)**: Regras de negócio, Session Locking e validações.
- **[DATABASE_MODEL.md](./01-Referencia/DATABASE_MODEL.md)**: Detalhamento do esquema de dados e relações.
- **[routes.md](./01-Referencia/routes.md)**: Referência completa da API (Scanner, Locking).
- **[tags.md](./01-Referencia/tags.md)**: Mapeamento de tags para templates DOCX.
- **[schema_maes_em_acao_v1.0.sql](./01-Referencia/schema_maes_em_acao_v1.0.sql)**: Definição SQL do banco de dados.
- **[schema_maes_em_acao_estrategia_v2.0.docx.pdf](./01-Referencia/schema_maes_em_acao_estrategia_v2.0.docx.pdf)**: Definição SQL do banco de dados.

### [02-Estrategia](./02-Estrategia/)

Planos de evolução, diagnósticos e estratégias de adaptação.

- **[diagnostico_estrategia_v2_detalhado.md](./02-Estrategia/diagnostico_estrategia_v2_detalhado.md)**: Alinhamento entre o código e a estratégia v2.0.
- **[plano_adaptacao_execucao_alimentos.md](./02-Estrategia/plano_adaptacao_execucao_alimentos.md)**: Estratégia para o fluxo de execução de alimentos.
- **[plano.md](./02-Estrategia/plano.md)**: Planos gerais de desenvolvimento.

### [03-Guias](./03-Guias/)

Recursos práticos para desenvolvimento e integração com IA.

- **[guia_dev_maes_em_acao_v1.0.md](./03-Guias/guia_dev_maes_em_acao_v1.0.md)**: Guia completo de desenvolvimento e stack.
- **[CADASTRO_NOVA_ACAO.md](./03-Guias/CADASTRO_NOVA_ACAO.md)**: Como adicionar novos tipos de petição/ações.
- **[TROUBLESHOOTING.md](./03-Guias/TROUBLESHOOTING.md)**: Erros comuns e como resolvê-los em campo.
- **[system_prompt_maes_em_acao.md](./03-Guias/system_prompt_maes_em_acao.md)**: Prompts e diretrizes para assistentes de IA.

### [04-Historico](./04-Historico/)

Registros de auditoria, relatórios passados e walkthroughs.

- **[walkthrough.md](./04-Historico/walkthrough.md)**: Passo a passo de implementações concluídas (Docker, Prisma, etc).
- **[relatorio_modularizacao.md](./04-Historico/relatorio_modularizacao.md)**: Detalhes sobre a modularização do sistema.
- **[auditoria_campos_triagem_execucao_2026-04-01.md](./04-Historico/auditoria_campos_triagem_execucao_2026-04-01.md)**: Auditoria pontual de campos.

---

> **Dica para IAs:** Ao carregar contexto sobre este projeto, priorize a pasta `01-Referencia` para entender as regras vigentes e a pasta `03-Guias` para padrões de implementação.

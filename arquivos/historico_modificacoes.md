# Histórico de Modificações - Chat Af0d7cf5

Este documento resume todas as alterações técnicas realizadas no projeto **Assistente Def Sul Bahia** durante esta sessão de desenvolvimento, focada na otimização da **Execução de Alimentos** e melhoria da experiência do usuário (UX).

## 1. Otimização do Fluxo "Execução de Alimentos"
Para tornar a triagem de cobrança de pensão mais ágil e objetiva, as seguintes mudanças foram feitas:

- **Bypass de Inteligência Artificial**: Configurado para que o sistema não tente gerar o "Relato dos Fatos" via IA para esta ação específica, visto que a petição é baseada em documentos e números objetivos.
  - Arquivos: `backend/src/config/dicionarioAcoes.js`, `backend/src/controllers/casosController.js`.
- **Simplificação da Interface**:
  - Removidos campos de **WhatsApp** redundantes (usa-se o telefone principal).
  - Removido o passo de **Dados Processuais** (Solar) da triagem.
  - Ocultados os blocos de **Vínculos, Guarda e Situação Financeira** na triagem de execução.
  - Ocultada a seção de **Relato de Fatos e Gravação de Áudio** no passo de documentos.
  - Arquivos: `frontend/src/config/formularios/acoes/familia.js`, `frontend/src/areas/servidor/pages/TriagemCaso.jsx`, `frontend/src/areas/servidor/components/StepRelatoDocs.jsx`, `frontend/src/areas/servidor/components/secoes/SecaoCamposGeraisFamilia.jsx`.

## 2. Melhorias em Dados Pessoais e Jurídicos
- **Filiação Obrigatória**: Adicionados campos de nome da mãe e do pai para o Assistido, Representante e Requerido, conforme exigência legal para petição de execução.
  - Arquivos: `frontend/src/areas/servidor/components/StepDadosPessoais.jsx`, `frontend/src/areas/servidor/components/StepRequerido.jsx`.
- **Gestão de RG de Menores**: Removidos os campos de RG para crianças/adolescentes no modo representação, simplificando o preenchimento para as mães.
- **Dados da Decisão/Acordo**: Introduzidos campos para Tipo de Decisão (Sentença/Acordo), Mês Inicial e Mês Final do débito.
  - Arquivo: `frontend/src/areas/servidor/components/secoes/SecaoProcessoOriginal.jsx`.

## 3. Experiência do Usuário (UX) e Máscaras
- **Máscara de Data (Método 1)**: Implementada máscara de digitação rápida (`DD/MM/AAAA`) em todos os campos de data, substituindo o calendário nativo do navegador para maior velocidade.
- **Máscara de Mês/Ano**: Criada máscara específica para os períodos de débito (`MM/AAAA`).
  - Arquivos: `frontend/src/utils/formatters.js`, `frontend/src/areas/servidor/hooks/useFormHandlers.js`.
- **RG Autocomplete**: O seletor de Órgão Emissor de RG foi transformado em um campo de busca inteligente (`SearchableSelect`).
  - Arquivos: `frontend/src/components/ui/SearchableSelect.jsx`, `StepDadosPessoais.jsx`, `StepRequerido.jsx`.

## 4. Lógica de Submissão e Backend
- **Conversão de Datas**: O sistema agora converte automaticamente `DD/MM/AAAA` para `AAAA-MM-DD` antes de salvar no banco, mantendo a integridade dos dados.
- **Envio Posterior de Documentos**: Criada caixa de seleção "Entregarei depois" no passo de documentos.
  - Se marcada, exibe um alerta de confirmação e libera o envio do formulário sem anexos.
  - Arquivos: `frontend/src/areas/servidor/components/StepRelatoDocs.jsx`, `frontend/src/areas/servidor/services/submissionService.js`.
- **Mapeamento de Tags**: Atualizado o payload enviado para o gerador de DOCX para incluir todas as novas variáveis (Filiação, Datas de Débito, etc.).
  - Arquivo: `backend/src/controllers/casosController.js`.
- **Resiliência do Servidor (Correção de Erro 500)**: Foi resolvido um erro interno do servidor (500) que ocorria ao rodar o ambiente Docker local sem chaves do Supabase. O controller principal (`casosController.js`) foi reescrito para utilizar diretamente o **Prisma** (banco PostgreSQL local) no cadastro da triagem e no worker de background, caso a API do Supabase Storage esteja desligada/nula, evitando a queda (`Crash`) por `Cannot read properties of null (reading 'from')`.
- **Ajustes Finos de Validação Silenciosa**:
  - **CPF Opcional para Representação**: Crianças/Adolescentes não são mais bloqueados se não possuírem CPF.
  - **Relato Flexível**: Execuções não exigem relato; a validação agora respeita a flag `ocultarRelato` definida na configuração visual.
  - **Identificação de "Execução"**: A trava nativa para "Período do Débito" agora identifica corretamente a ação pela variável `acaoEspecifica`.
  - **Repasse do Objeto Erros da Submissão**: Os erros não identificados agora marcam em vermelho corretamente o próprio componente afetado.

## 5. Próximos Passos Recomendados
- [ ] Testar a geração completa da petição de execução com os novos campos e garantir envio total local.
- [ ] Validar o layout do `SearchableSelect` em dispositivos móveis.
- [ ] Confirmar se o defensor recebe o campo `periodo_debito` concatenado corretamente no sistema interno.

---
*Documento atualizado automaticamente pelo Assistente IA em 04/04/2026.*

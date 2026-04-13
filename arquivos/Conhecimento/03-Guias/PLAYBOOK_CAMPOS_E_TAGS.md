# Playbook de Criação de Campos e Tags (Mães em Ação)
Este documento estabelece as regras oficiais de arquitetura para adicionar novos campos no formulário do Mutirão (TriagemCaso.jsx) e refleti-los nos documentos finais (.docx) processados no backend.

## 1. Princípio "Form-First" (Não dependa da IA para regras de negócio)
A arquitetura `v2.1` erradicou componentes visuais baseados em resumos da Inteligência Artificial.
A IA (`geminiService.js`) atua agora apenas como um **formatador linguístico dos fatos**, não como validadora. Todos os dados críticos (Nomes, CPFs, Valores de Pensão, Meses de Inadimplência, Contas Bancárias) são enviados via FormData, transitam pelo Prisma e são formatados no Backend utilizando o Dicionário Local.

## 2. A Fonte da Verdade: `familia.js`
Nenhuma tela do front-end deve usar `if (acao === "***")` para habilitar componentes. Qualquer controle novo deve ser feito estritamente via "Flags" Declarativas no dicionário `/frontend/src/config/formularios/acoes/familia.js`.

### Exemplos Válidos de Flags implementadas e suportadas:
```javascript
export const ACOES_FAMILIA = {
  execucao_alimentos: {
    titulo: "Execução de Alimentos",
    // ...
    ocultarRelato: true, // Se true, esconde a tela inteira de narração em áudio/texto e tira a obrigatoriedade.
    isCpfRepresentanteOpcional: true, // Se true, o CPF passa de obrigatório (*) para opcional.
    exigeDadosProcessoOriginal: true, // Se true, força o preenchimento de campos de Inadimplência.
    ocultarDadosRequerido: false // Se true (como no Alvará), omite o painel "Dados da Outra Parte".
  }
}
```

## 3. Guia Rápido: Adicionando um Novo Campo

**Passo 1: Front-end**
Adicione seu `<input name="minha_nova_variavel" />` em algum componente de passo (StepDadosPessoais.jsx, StepRequerido.jsx). Certifique-se de vincular os hooks:
```javascript
<input 
  name="minha_nova_variavel" 
  value={formState.minha_nova_variavel}
  onChange={handleFieldChange} 
/>
```

**Passo 2: Supabase (Para Tabelas ou Relatórios)**
Se este dado precisar gerar relatórios, será necessário rodar um Prisma Push (após adicionar na `schema.prisma`). Se for um mero dado temporário usado para gerar o Arquivo de Word, não precisa alterar banco de dados (o Supabase já suporta `dados_formulario` em JSONB genérico que salva qualquer form field enviado).

**Passo 3: Backend para o Template DOCX**
Acesse `documentGenerationService.js` ou veja como `casosController.js` chama as tags. 
Os campos criados no React são expostos como TAGS do `.docx` diretamente de seu `{nome}` em letras maiúsculas. (ex.: O frontend envia `minha_nova_variavel`, você usa `MINHA_NOVA_VARIAVEL` na petição judicial do Word).
Se for complexo, você formatará antes da geração em `documentGenerationService.js`:
```javascript
const templateTags = {
  // ... outras tags
  MINHA_NOVA_VARIAVEL: formData.minha_nova_variavel || "Não informado",
}
```

## 4. Ocultação do Requerido e Alvarás
A propriedade `isAlvara` ou `ocultarDadosRequerido` em `familia.js` garante que o React Hook `useFormValidation.js` jamais lance alertas se a parte faltante (`executado_cpf`, `REQUERIDO_NOME`) for inexistente. Não mude a árvore do React para escapar de validações. Altere o Dicionário!

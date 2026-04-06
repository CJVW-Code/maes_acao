// Mapeamento de campos do formulário (camelCase) para campos da API (snake_case)
export const fieldMapping = {
  // Dados pessoais do assistido
  assistidoEhIncapaz: 'assistido_eh_incapaz',
  nome: 'nome',
  cpf: 'cpf',
  dataNascimentoAssistido: 'data_nascimento_assistido',
  assistidoNacionalidade: 'assistido_nacionalidade',
  assistidoEstadoCivil: 'assistido_estado_civil',
  assistidoOcupacao: 'assistido_ocupacao',
  assistidoEnderecoProfissional: 'assistido_endereco_profissional',
  enderecoAssistido: 'endereco_assistido',
  telefone: 'telefone',
  emailAssistido: 'email_assistido',

  // Dados do representante (quando há representação)
  representanteNome: 'representante_nome',
  representanteCpf: 'representante_cpf',
  representanteDataNascimento: 'representante_data_nascimento',
  representanteNacionalidade: 'representante_nacionalidade',
  representanteEstadoCivil: 'representante_estado_civil',
  representanteOcupacao: 'representante_ocupacao',
  representanteEnderecoResidencial: 'representante_endereco_residencial',
  representanteEnderecoProfissional: 'representante_endereco_profissional',
  representanteTelefone: 'representante_telefone',
  representanteEmail: 'representante_email',
  representanteRgNumero: 'representante_rg_numero',
  representanteRgOrgao: 'representante_rg_orgao',
  representanteNomeMae: 'representante_nome_mae',
  representanteNomePai: 'representante_nome_pai',

  // Dados da outra parte (requerido)
  nomeRequerido: 'nome_requerido',
  enderecoRequerido: 'endereco_requerido',
  telefoneRequerido: 'telefone_requerido',
  emailRequerido: 'email_requerido',
  cpfRequerido: 'cpf_requerido',
  requeridoRgNumero: 'requerido_rg_numero',
  requeridoRgOrgao: 'requerido_rg_orgao',
  requeridoNacionalidade: 'requerido_nacionalidade',
  requeridoEstadoCivil: 'requerido_estado_civil',
  requeridoOcupacao: 'requerido_ocupacao',
  requeridoEnderecoProfissional: 'requerido_endereco_profissional',
  requeridoDataNascimento: 'requerido_data_nascimento',
  requeridoNomeMae: 'requerido_nome_mae',
  requeridoNomePai: 'requerido_nome_pai',
  requeridoOutrosDetalhes: 'requerido_outros_detalhes',

  // Emprego Requerido
  requeridoTemEmpregoFormal: 'requerido_tem_emprego_formal',
  empregadorRequeridoNome: 'empregador_requerido_nome',
  empregadorRequeridoEndereco: 'empregador_requerido_endereco',
  empregadorEmail: 'empregador_email',

  // Dados bancários
  tipoContaDeposito: 'tipo_conta_deposito',
  bancoDeposito: 'banco_deposito',
  agenciaDeposito: 'agencia_deposito',
  contaDeposito: 'conta_deposito',
  chavePixDeposito: 'chave_pix_deposito',
  outrosDadosDeposito: 'outros_dados_deposito',

  // Execução e Título Judicial
  numeroProcessoOriginario: 'numero_processo_originario',
  cidadeOriginaria: 'cidade_originaria',
  varaOriginaria: 'vara_originaria',
  tipoDecisao: 'tipo_decisao',
  diaPagamentoFixado: 'dia_pagamento_fixado',
  dataInicioDebito: 'data_inicio_debito',
  dataFimDebito: 'data_fim_debito',
  valorTotalDebitoExecucao: 'valor_total_debito_execucao',
  valorMensalFixado: 'valor_mensal_fixado',
  percentualSalarioMinimo: 'percentual_salario_minimo',
  valorPensaoAtual: 'valor_pensao_atual',
  valorDivida: 'valor_divida',
  valorMulta: 'valor_multa',
  valorJuros: 'valor_juros',
  valorHonorarios: 'valor_honorarios',

  // Outros campos
  whatsappContato: 'whatsapp_contato',
  assistidoRgNumero: 'assistido_rg_numero',
  assistidoRgOrgao: 'assistido_rg_orgao',
  relato: 'relato',
  valorPretendido: 'valor_pretendido',
  valorPensao: 'valor_pensao',

  // Controle de fluxo
  enviarDocumentosDepois: 'enviar_documentos_depois',
  cidadeAssinatura: 'cidade_assinatura',
  vara: 'vara',
  rgExequente: 'rg_exequente',
  cpfExequente: 'cpf_exequente',
};

// Campos que devem conter apenas dígitos (para limpeza antes do envio)
export const digitsOnlyFields = new Set([
  'cpf',
  'telefone',
  'whatsappContato',
  'representanteCpf',
  'representanteTelefone',
  'telefoneRequerido',
  'cpfRequerido',
  'agenciaDeposito',
  'contaDeposito',
  'assistidoRgNumero',
  'requeridoRgNumero',
  'rgExequente',
  'cpfExequente'
]);

// Campos de data que precisam de conversão para ISO
export const dateFields = new Set([
  'dataNascimentoAssistido',
  'representanteDataNascimento',
  'requeridoDataNascimento',
  'dataInicioDebito',
  'dataFimDebito'
]);

// Campos que representam valores monetários
export const currencyFields = new Set([
  'valorPretendido',
  'valorPensao',
  'valorPensaoAtual',
  'valorDivida',
  'valorMulta',
  'valorJuros',
  'valorHonorarios',
  'valorTotalDebitoExecucao',
  'valorMensalFixado',
  'valorMensalPagamento'
]);
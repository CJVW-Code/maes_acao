// Mapeamento de campos do formulário (camelCase) para campos da API (snake_case)
export const fieldMapping = {
  // Dados pessoais do assistido
  nome: 'nome',
  cpf: 'cpf',
  dataNascimentoAssistido: 'data_nascimento_assistido',
  assistidoNacionalidade: 'assistido_nacionalidade',
  assistidoEstadoCivil: 'assistido_estado_civil',
  enderecoAssistido: 'endereco_assistido',
  telefone: 'telefone',
  emailAssistido: 'email_assistido',

  // Dados do representante (quando há representação)
  representanteNome: 'representante_nome',
  representanteCpf: 'representante_cpf',
  representanteTelefone: 'representante_telefone',
  representanteEmail: 'representante_email',

  // Dados da outra parte (requerido)
  nomeRequerido: 'nome_requerido',
  enderecoRequerido: 'endereco_requerido',
  telefoneRequerido: 'telefone_requerido',
  emailRequerido: 'email_requerido',
  cpfRequerido: 'cpf_requerido',
  requeridoRgNumero: 'requerido_rg_numero',
  requeridoRgOrgao: 'requerido_rg_orgao',
  requeridoDataNascimento: 'requerido_data_nascimento',
  requeridoNomeMae: 'requerido_nome_mae',
  requeridoNomePai: 'requerido_nome_pai',
  requeridoOutrosDetalhes: 'requerido_outros_detalhes',

  // Dados bancários
  tipoContaDeposito: 'tipo_conta_deposito',
  bancoDeposito: 'banco_deposito',
  agenciaDeposito: 'agencia_deposito',
  contaDeposito: 'conta_deposito',
  chavePixDeposito: 'chave_pix_deposito',
  outrosDadosDeposito: 'outros_dados_deposito',

  // Outros campos
  whatsappContato: 'whatsapp_contato',
  assistidoRgNumero: 'assistido_rg_numero',
  assistidoRgOrgao: 'assistido_rg_orgao',
  relato: 'relato',
  valorPretendido: 'valor_pretendido',
  valorPensao: 'valor_pensao',
  valorPensaoAtual: 'valor_pensao_atual',
  valorDivida: 'valor_divida',
  valorMulta: 'valor_multa',
  valorJuros: 'valor_juros',
  valorHonorarios: 'valor_honorarios'
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
  'requeridoRgNumero'
]);
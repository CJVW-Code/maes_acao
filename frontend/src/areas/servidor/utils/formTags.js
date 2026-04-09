// Dicionário Oficial de Tags (Frontend)
// Espelho exato do dicionário do backend - Sem Aliases

export const TAGS_OFICIAIS = [
  'VARA',
  'CIDADEASSINATURA',
  'tipo_decisao',
  'processoOrigemNumero',
  'varaOriginaria',
  'cidadeOriginaria',
  'data_atual',
  'defensoraNome',
  
  'REPRESENTANTE_NOME',
  'representante_ocupacao',
  'representante_rg',
  'emissor_rg_exequente',
  'representante_cpf',
  'nome_mae_representante',
  'nome_pai_representante',
  'requerente_endereco_residencial',
  'requerente_telefone',
  'requerente_email',
  'dados_bancarios_exequente',
  
  'REQUERIDO_NOME',
  'executado_ocupacao',
  'nome_mae_executado',
  'nome_pai_executado',
  'rg_executado',
  'emissor_rg_executado',
  'executado_cpf',
  'executado_endereco_residencial',
  'executado_telefone',
  'executado_email',
  'empregador_nome',
  
  'percentual_salario_minimo',
  'dia_pagamento',
  'periodo_meses_ano',
  'valor_debito',
  'valor_debito_extenso'
];

export const digitsOnlyFields = new Set([
  'representante_cpf',
  'requerente_telefone',
  'executado_cpf',
  'executado_telefone',
  'representante_rg',
  'rg_executado'
]);

export const currencyFields = new Set([
  'valor_debito'
]);

export const dateFields = new Set([
  // As datas podem usar a classe utilitária de formatação, ou apenas tratar as strings
]);

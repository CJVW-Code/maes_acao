// Dicionário Oficial de Tags (Sem Aliases)
// Estas constantes definem os campos exatos (Case-sensitive) que serão:
// 1. O state do React e o form data ("name" dos inputs)
// 2. Os nodes do Payload JSON recebidos pela API
// 3. As tags textuais substituíveis no .docx

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
  
  'NOME', // Nome do(s) filho(s)
  'nascimento', // Nascimento do(s) filho(s)
  'guarda',
  'situacao_financeira',
  'valor_pensao',
  'valor_pensao_atual',
  'valor_pretendido',
  'percentual_salario_minimo',
  'dia_pagamento',
  'periodo_meses_ano',
  'valor_debito',
  'valor_debito_extenso',
  'valor_multa',
  'valor_juros',
  'valor_honorarios',
  'data_inicio_debito',
  'data_fim_debito',
  'bens_partilha'
];

export const isValidTag = (tag) => TAGS_OFICIAIS.includes(tag);

// Função para retornar o dicionário caso o frontend precise mapear
export const getDicionarioTags = () => {
  const dicionario = {};
  TAGS_OFICIAIS.forEach(tag => {
    dicionario[tag] = tag;
  });
  return dicionario;
};

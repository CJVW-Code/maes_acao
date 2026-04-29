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
  'DATA_ATUAL',
  'defensoraNome',
  
  'REPRESENTANTE_NOME',
  'representante_nacionalidade',
  'representante_estado_civil',
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
  'executado_nacionalidade',
  'executado_estado_civil',
  'executado_ocupacao',
  'nome_mae_executado',
  'nome_pai_executado',
  'rg_executado',
  'emissor_rg_executado',
  'executado_cpf',
  'executado_endereco_residencial',
  'executado_endereco_profissional',
  'executado_telefone',
  'executado_email',
  'empregador_nome',
  
  'NOME', // Nome do(s) filho(s)
  'nacionalidade', // Dentro do loop
  'nascimento', // Nascimento do(s) filho(s)
  'cpf', // Dentro do loop
  'rg', // Dentro do loop
  'qualificacao_incapacidade', // Dentro do loop
  'separador', // Dentro do loop
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
  'valor_debito_penhora',
  'valor_debito_penhora_extenso',
  'valor_debito_prisao',
  'valor_debito_prisao_extenso',
  'valor_multa',
  'valor_juros',
  'valor_honorarios',
  'data_inicio_debito',
  'data_fim_debito',
  'bens_partilha',
  'dos_fatos',
  'termo_representacao',
  
  // --- NOVAS TAGS V2 (SNAKE_CASE) ---
  'vara',
  'comarca',
  'triagemNumero',
  'requerente_nome',
  'requerente_data_nascimento',
  'requerente_cpf',
  'dados_adicionais_requerente',
  'representante_nome',
  'representante_endereco_profissional',
  'representante_telefone',
  'requerido_nome',
  'requerido_cpf',
  'requerido_endereco_residencial',
  'dados_adicionais_requerido',
  'percentual_provisorio_salario_min',
  'percentual_despesas_extras',
  'dados_bancarios_requerente',
  'empregador_endereco_profissional',
  'percentual_definitivo_salario_min',
  'percentual_definitivo_extras',
  'cidade_data_assinatura',
  'relato_texto',
  'empregador_email',
  'HAS_GUARDA',
  'TIPO_ACAO',
  'tipoAcao'
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

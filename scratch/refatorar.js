import fs from 'fs';
import path from 'path';

const REPLACEMENTS = {
  // formState fields
  "formState.nome": "formState.REPRESENTANTE_NOME",
  'name="nome"': 'name="REPRESENTANTE_NOME"',
  "'nome'": "'REPRESENTANTE_NOME'",
  '"nome"': '"REPRESENTANTE_NOME"',
  
  "formState.cpf": "formState.representante_cpf",
  'name="cpf"': 'name="representante_cpf"',
  "'cpf'": "'representante_cpf'",
  '"cpf"': '"representante_cpf"',

  "formState.dataNascimentoAssistido": "formState.representante_data_nascimento",
  'name="dataNascimentoAssistido"': 'name="representante_data_nascimento"',
  "'dataNascimentoAssistido'": "'representante_data_nascimento'",

  "formState.assistidoNacionalidade": "formState.representante_nacionalidade",
  'name="assistidoNacionalidade"': 'name="representante_nacionalidade"',
  
  "formState.assistidoEstadoCivil": "formState.representante_estado_civil",
  'name="assistidoEstadoCivil"': 'name="representante_estado_civil"',

  "formState.assistidoOcupacao": "formState.representante_ocupacao",
  'name="assistidoOcupacao"': 'name="representante_ocupacao"',

  "formState.assistidoEnderecoProfissional": "formState.representante_endereco_profissional",
  'name="assistidoEnderecoProfissional"': 'name="representante_endereco_profissional"',

  "formState.assistidoRgNumero": "formState.representante_rg",
  'name="assistidoRgNumero"': 'name="representante_rg"',

  "formState.assistidoRgOrgao": "formState.emissor_rg_exequente",
  'name="assistidoRgOrgao"': 'name="emissor_rg_exequente"',

  "formState.enderecoAssistido": "formState.requerente_endereco_residencial",
  'name="enderecoAssistido"': 'name="requerente_endereco_residencial"',

  "formState.emailAssistido": "formState.requerente_email",
  'name="emailAssistido"': 'name="requerente_email"',

  "formState.telefone": "formState.requerente_telefone",
  'name="telefone"': 'name="requerente_telefone"',

  // Representante equivalents (mapped to same tag)
  "formState.representanteNome": "formState.REPRESENTANTE_NOME",
  'name="representanteNome"': 'name="REPRESENTANTE_NOME"',
  
  "formState.representanteCpf": "formState.representante_cpf",
  'name="representanteCpf"': 'name="representante_cpf"',

  "formState.representanteDataNascimento": "formState.representante_data_nascimento",
  'name="representanteDataNascimento"': 'name="representante_data_nascimento"',

  "formState.representanteNacionalidade": "formState.representante_nacionalidade",
  'name="representanteNacionalidade"': 'name="representante_nacionalidade"',

  "formState.representanteEstadoCivil": "formState.representante_estado_civil",
  'name="representanteEstadoCivil"': 'name="representante_estado_civil"',

  "formState.representanteTelefone": "formState.requerente_telefone",
  'name="representanteTelefone"': 'name="requerente_telefone"',

  "formState.representanteEmail": "formState.requerente_email",
  'name="representanteEmail"': 'name="requerente_email"',

  "formState.representanteOcupacao": "formState.representante_ocupacao",
  'name="representanteOcupacao"': 'name="representante_ocupacao"',

  "formState.representanteEnderecoResidencial": "formState.requerente_endereco_residencial",
  'name="representanteEnderecoResidencial"': 'name="requerente_endereco_residencial"',

  "formState.representanteEnderecoProfissional": "formState.representante_endereco_profissional",
  'name="representanteEnderecoProfissional"': 'name="representante_endereco_profissional"',

  "formState.representanteRgNumero": "formState.representante_rg",
  'name="representanteRgNumero"': 'name="representante_rg"',

  "formState.representanteRgOrgao": "formState.emissor_rg_exequente",
  'name="representanteRgOrgao"': 'name="emissor_rg_exequente"',

  "formState.representanteNomeMae": "formState.nome_mae_representante",
  'name="representanteNomeMae"': 'name="nome_mae_representante"',

  "formState.representanteNomePai": "formState.nome_pai_representante",
  'name="representanteNomePai"': 'name="nome_pai_representante"',

  // Requerido
  "formState.nomeRequerido": "formState.REQUERIDO_NOME",
  'name="nomeRequerido"': 'name="REQUERIDO_NOME"',

  "formState.enderecoRequerido": "formState.executado_endereco_residencial",
  'name="enderecoRequerido"': 'name="executado_endereco_residencial"',

  "formState.telefoneRequerido": "formState.executado_telefone",
  'name="telefoneRequerido"': 'name="executado_telefone"',

  "formState.emailRequerido": "formState.executado_email",
  'name="emailRequerido"': 'name="executado_email"',

  "formState.cpfRequerido": "formState.executado_cpf",
  'name="cpfRequerido"': 'name="executado_cpf"',

  "formState.requeridoRgNumero": "formState.rg_executado",
  'name="requeridoRgNumero"': 'name="rg_executado"',

  "formState.requeridoRgOrgao": "formState.emissor_rg_executado",
  'name="requeridoRgOrgao"': 'name="emissor_rg_executado"',

  "formState.requeridoNacionalidade": "formState.executado_nacionalidade",
  'name="requeridoNacionalidade"': 'name="executado_nacionalidade"',

  "formState.requeridoEstadoCivil": "formState.executado_estado_civil",
  'name="requeridoEstadoCivil"': 'name="executado_estado_civil"',

  "formState.requeridoOcupacao": "formState.executado_ocupacao",
  'name="requeridoOcupacao"': 'name="executado_ocupacao"',

  "formState.requeridoEnderecoProfissional": "formState.executado_endereco_profissional",
  'name="requeridoEnderecoProfissional"': 'name="executado_endereco_profissional"',

  "formState.requeridoDataNascimento": "formState.executado_data_nascimento",
  'name="requeridoDataNascimento"': 'name="executado_data_nascimento"',

  "formState.requeridoNomeMae": "formState.nome_mae_executado",
  'name="requeridoNomeMae"': 'name="nome_mae_executado"',

  "formState.requeridoNomePai": "formState.nome_pai_executado",
  'name="requeridoNomePai"': 'name="nome_pai_executado"',

  "formState.requeridoOutrosDetalhes": "formState.dados_adicionais_requerido",
  'name="requeridoOutrosDetalhes"': 'name="dados_adicionais_requerido"',

  // Emprego Requerido
  "formState.requeridoTemEmpregoFormal": "formState.requerido_tem_emprego_formal",
  'name="requeridoTemEmpregoFormal"': 'name="requerido_tem_emprego_formal"',

  "formState.empregadorRequeridoNome": "formState.empregador_nome",
  'name="empregadorRequeridoNome"': 'name="empregador_nome"',

  "formState.empregadorRequeridoEndereco": "formState.empregador_endereco",
  'name="empregadorRequeridoEndereco"': 'name="empregador_endereco"',

  "formState.empregadorEmail": "formState.empregador_email",
  'name="empregadorEmail"': 'name="empregador_email"',

  // Banco
  "formState.tipoContaDeposito": "formState.tipo_conta_deposito",
  'name="tipoContaDeposito"': 'name="tipo_conta_deposito"',

  "formState.bancoDeposito": "formState.banco_deposito",
  'name="bancoDeposito"': 'name="banco_deposito"',

  "formState.agenciaDeposito": "formState.agencia_deposito",
  'name="agenciaDeposito"': 'name="agencia_deposito"',

  "formState.contaDeposito": "formState.conta_deposito",
  'name="contaDeposito"': 'name="conta_deposito"',

  "formState.chavePixDeposito": "formState.chave_pix_deposito",
  'name="chavePixDeposito"': 'name="chave_pix_deposito"',

  "formState.outrosDadosDeposito": "formState.outros_dados_deposito",
  'name="outrosDadosDeposito"': 'name="outros_dados_deposito"',

  // Detalhes
  "formState.valorPretendido": "formState.valor_pretendido",
  'name="valorPretendido"': 'name="valor_pretendido"',

  "formState.valorPensao": "formState.valor_pensao",
  'name="valorPensao"': 'name="valor_pensao"',

  "formState.valorPensaoAtual": "formState.valor_pensao_atual",
  'name="valorPensaoAtual"': 'name="valor_pensao_atual"',

  "formState.valorDivida": "formState.valor_debito",
  'name="valorDivida"': 'name="valor_debito"',

  "formState.valorMulta": "formState.valor_multa",
  'name="valorMulta"': 'name="valor_multa"',

  "formState.valorJuros": "formState.valor_juros",
  'name="valorJuros"': 'name="valor_juros"',

  "formState.valorHonorarios": "formState.valor_honorarios",
  'name="valorHonorarios"': 'name="valor_honorarios"',

  "formState.dataInicioDebito": "formState.data_inicio_debito",
  'name="dataInicioDebito"': 'name="data_inicio_debito"',

  "formState.dataFimDebito": "formState.data_fim_debito",
  'name="dataFimDebito"': 'name="data_fim_debito"',

  // Localização
  "formState.vara": "formState.VARA",
  'name="vara"': 'name="VARA"',

  "formState.cidadeAssinatura": "formState.CIDADEASSINATURA",
  'name="cidadeAssinatura"': 'name="CIDADEASSINATURA"',

  // Origem
  "formState.numeroProcessoOriginario": "formState.processoOrigemNumero",
  'name="numeroProcessoOriginario"': 'name="processoOrigemNumero"',

  "formState.varaOriginaria": "formState.varaOriginaria",
  'name="varaOriginaria"': 'name="varaOriginaria"',

  "formState.tipoDecisao": "formState.tipo_decisao",
  'name="tipoDecisao"': 'name="tipo_decisao"',

  "formState.diaPagamentoFixado": "formState.dia_pagamento",
  'name="diaPagamentoFixado"': 'name="dia_pagamento"',

  "formState.valorTotalDebitoExecucao": "formState.valorTotalDebitoExecucao",
  'name="valorTotalDebitoExecucao"': 'name="valorTotalDebitoExecucao"',

  "formState.percentualSalarioMinimo": "formState.percentual_salario_minimo",
  'name="percentualSalarioMinimo"': 'name="percentual_salario_minimo"',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let originalContent = content;
  
  for (const [key, value] of Object.entries(REPLACEMENTS)) {
    // Escape special characters for regex
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKey, 'g');
    content = content.replace(regex, value);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

function traverseDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      processFile(fullPath);
    }
  }
}

traverseDir(path.resolve('./frontend/src/areas/servidor/components'));
traverseDir(path.resolve('./frontend/src/areas/servidor/pages'));
traverseDir(path.resolve('./frontend/src/areas/servidor/state'));
traverseDir(path.resolve('./frontend/src/areas/defensor'));

console.log("Renaming complete.");

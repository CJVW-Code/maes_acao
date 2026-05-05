// Estado inicial do formulário
export const initialState = {
  // Dados básicos da ação
  tipoAcao: "familia",
  acaoEspecifica: "",

  // Dados pessoais do assistido
  assistidoEhIncapaz: "nao", // "sim" ou "nao"
  // Dados pessoais do assistido (Criança ou Autor Adulto)
  NOME: "", // Nome do assistido principal (criança ou adulto)
  nascimento: "", // Data nascimento assistido principal
  cpf: "", // CPF do assistido principal
  nacionalidade: "Brasileira",

  // Dados do representante (Genitora em casos de incapaz) ou Autor Adulto (mesmo campo para template)
  REPRESENTANTE_NOME: "",
  representante_cpf: "",
  representante_data_nascimento: "",
  representante_nacionalidade: "Brasileira",
  representante_estado_civil: "solteiro(a)",
  representante_ocupacao: "",
  representante_endereco_profissional: "",
  representante_rg: "",
  emissor_rg_exequente: "",
  requerente_endereco_residencial: "",
  requerente_email: "",
  requerente_telefone: "",
  nome_mae_representante: "",
  nome_pai_representante: "",

  // Outros filhos (para casos de representação)
  outrosFilhos: [],

  // Dados da outra parte (requerido)
  REQUERIDO_NOME: "",
  executado_endereco_residencial: "",
  executado_telefone: "",
  executado_email: "",
  executado_cpf: "",
  rg_executado: "",
  emissor_rg_executado: "",
  executado_nacionalidade: "",
  executado_estado_civil: "",
  executado_ocupacao: "",
  executado_endereco_profissional: "",
  executado_data_nascimento: "",
  nome_mae_executado: "",
  nome_pai_executado: "",
  dados_adicionais_requerido: "",
  requeridoOutrosSelecionados: [],

  // Emprego do Requerido
  requerido_tem_emprego_formal: "",
  empregador_nome: "",
  empregador_endereco: "",
  empregador_email: "",

  // Dados bancários
  tipo_conta_deposito: "",
  banco_deposito: "",
  agencia_deposito: "",
  conta_deposito: "",
  chave_pix_deposito: "",
  outros_dados_deposito: "",

  // Detalhes do caso
  valor_pretendido: "",
  valor_pensao: "",
  valor_pensao_atual: "",
  valor_debito: "",
  valor_multa: "",
  valor_juros: "",
  valor_honorarios: "",
  data_inicio_debito: "",
  data_fim_debito: "",

  // Guarda e Convivência
  opcaoGuarda: "", // "nao" | "regularizar"
  descricaoGuarda: "",

  // Relato e documentos
  relato: "",
  prefersAudio: false,
  audioBlob: null,
  documentFiles: [],
  documentNames: {},
  documentosMarcados: [],
  enviarDocumentosDepois: false,

  // Localização e Juízo
  VARA: "",
  CIDADEASSINATURA: "",

  // Dados de Execução específicos
  processoOrigemNumero: "",
  cidadeOriginaria: "",
  varaOriginaria: "",
  tipo_decisao: "",
  dia_pagamento: "",
  percentual_salario_minimo: "",
  periodo_meses_ano: "",
  calculo_prisao_arquivo: null,
  calculo_penhora_arquivo: null,
};

// Reducer para gerenciar o estado do formulário
export const formReducer = (state, action) => {
  switch (action.type) {
    case "SET_ACAO":
      return {
        ...state,
        tipoAcao: action.tipoAcao,
        acaoEspecifica: "",
      };

    case "UPDATE_FIELD":
      return {
        ...state,
        [action.field]: action.value,
      };

    case "LOAD_RASCUNHO":
      return {
        ...state,
        ...action.payload,
      };

    case "RESET_FORM":
      return { ...initialState };

    case "ADD_FILHO":
      return {
        ...state,
        outrosFilhos: [
          ...state.outrosFilhos,
          {
            nome: "",
            cpf: "",
            dataNascimento: "",
            nacionalidade: "Brasileira",
            rgNumero: "",
            rgOrgao: "",
          },
        ],
      };

    case "REMOVE_FILHO":
      return {
        ...state,
        outrosFilhos: state.outrosFilhos.filter((_, index) => index !== action.index),
      };

    case "UPDATE_FILHO":
      return {
        ...state,
        outrosFilhos: state.outrosFilhos.map((filho, index) =>
          index === action.index ? { ...filho, [action.field]: action.value } : filho,
        ),
      };

    default:
      return state;
  }
};

// Estado inicial do formulário
export const initialState = {
  // Dados básicos da ação
  tipoAcao: "",
  acaoEspecifica: "",

  // Dados pessoais do assistido
  assistidoEhIncapaz: "nao", // "sim" ou "nao"
  nome: "",
  cpf: "",
  dataNascimentoAssistido: "",
  assistidoNacionalidade: "Brasileira",
  assistidoEstadoCivil: "solteiro(a)",
  assistidoOcupacao: "",
  assistidoEnderecoProfissional: "",
  assistidoRgNumero: "",
  assistidoRgOrgao: "",
  enderecoAssistido: "",
  emailAssistido: "",
  telefone: "",
  enviarDocumentosDepois: false,

  // Dados do representante (quando há representação)
  representanteNome: "",
  representanteCpf: "",
  representanteDataNascimento: "",
  representanteNacionalidade: "Brasileira",
  representanteEstadoCivil: "solteiro(a)",
  representanteTelefone: "",
  representanteEmail: "",

  // Outros filhos (para casos de representação)
  outrosFilhos: [],

  // Dados da outra parte (requerido)
  nomeRequerido: "",
  enderecoRequerido: "",
  telefoneRequerido: "",
  emailRequerido: "",
  cpfRequerido: "",
  requeridoRgNumero: "",
  requeridoRgOrgao: "",
  requeridoDataNascimento: "",
  requeridoNomeMae: "",
  requeridoNomePai: "",
  requeridoOutrosDetalhes: "",
  requeridoOutrosSelecionados: [],

  // Dados bancários
  tipoContaDeposito: "",
  bancoDeposito: "",
  agenciaDeposito: "",
  contaDeposito: "",
  chavePixDeposito: "",
  outrosDadosDeposito: "",

  // Detalhes do caso
  valorPretendido: "",
  valorPensao: "",
  valorPensaoAtual: "",
  valorDivida: "",
  valorMulta: "",
  valorJuros: "",
  valorHonorarios: "",
  dataInicioDebito: "",
  dataFimDebito: "",

  // Relato e documentos
  relato: "",
  prefersAudio: false,
  audioBlob: null,
  documentFiles: [],
  documentNames: {},
  documentosMarcados: [],

  // Localização
  cidadeAssinatura: "",
};

// Reducer para gerenciar o estado do formulário
export const formReducer = (state, action) => {
  switch (action.type) {
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
          index === action.index
            ? { ...filho, [action.field]: action.value }
            : filho
        ),
      };

    default:
      return state;
  }
};
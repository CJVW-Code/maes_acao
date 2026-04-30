import React, { useReducer, useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "motion/react";
import { Upload, AlertTriangle } from "lucide-react";

import { getConfigAcao } from "../../../config/formularios/index.js";
import { useLocation } from "react-router-dom";
import { useToast } from "../../../contexts/ToastContext.jsx";
import { useConfirm } from "../../../contexts/ConfirmContext.jsx";

// Components
import { StepTipoAcao } from "../components/StepTipoAcao.jsx";
import { StepDadosPessoais } from "../components/StepDadosPessoais.jsx";
import { StepRequerido } from "../components/StepRequerido.jsx";
import { StepDetalhesCaso } from "../components/StepDetalhesCaso.jsx";
import { StepRelatoDocs } from "../components/StepRelatoDocs.jsx";
import StepDadosProcessuais from "../components/StepDadosProcessuais.jsx";

// State and Hooks
import { initialState, formReducer } from "../state/formState.js";
import { useFormEffects } from "../hooks/useFormEffects.js";
import { useFormValidation } from "../hooks/useFormValidation.js";
import { useFormHandlers } from "../hooks/useFormHandlers.js";

export const FormularioSubmissao = () => {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const location = useLocation();
  const [formState, dispatch] = useReducer(formReducer, initialState);
  const [unidades, setUnidades] = useState([]);

  useEffect(() => {
    const fetchUnidades = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/unidades`);
        if (response.ok) {
          const data = await response.json();
          setUnidades(data.filter(u => u.ativo));
        }
      } catch (error) {
        console.error("Erro ao buscar unidades:", error);
      }
    };
    fetchUnidades();
  }, []);
  
  const today = new Date().toISOString().split("T")[0];
  const configAcao = getConfigAcao(formState.tipoAcao, formState.acaoEspecifica);
  const forcaRepresentacao = configAcao?.forcaRepresentacao || false;
  const isAlvara = configAcao?.isAlvara || false;

  const {
    formErrors,
    setFormErrors,
    loading,
    statusMessage,
    generatedCredentials,
    setGeneratedCredentials,
    handleSubmit,
  } = useFormValidation({
    formState,
    configAcao,
    forcaRepresentacao,
    today,
    toast,
    confirm,
  });

  useFormEffects({
    dispatch,
    formState,
    location,
    toast,
    forcaRepresentacao,
    isSubmitted: !!generatedCredentials,
  });

  const {
    isRecording,
    startRecording,
    stopRecording,
    removeAudioRecording,
    handleFieldChange,
    handleCpfChangeAndValidate,
    handlePhoneChange,
    handleDateChange,
    handleMonthYearChange,
    handleRgChange,
    toggleRequeridoDetalhe,
    handleCurrencyChange,
    handleDayInputChange,
    handleRestrictedAlphanumeric,
    handleFilesChange,
  } = useFormHandlers({ formState, dispatch, setFormErrors, toast });

  // Helper para validação HTML nativa
  const validar = (msg) => ({
    required: true,
    onInvalid: (e) =>
      e.target.setCustomValidity(msg || "Por favor, preencha este campo."),
    onInput: (e) => e.target.setCustomValidity(""),
  });

  // Lógica de Representação
  const isRepresentacao = formState.assistidoEhIncapaz === "sim";
  // Prioriza rótulo customizado da config (ex: "Filho(a) Exequente" para execução)
  const labelAutor = configAcao?.labelAutor ||
    (isRepresentacao
      ? "Dados da Criança/Adolescente (Assistido)"
      : "Seus Dados (Você é o autor da ação)");

  // Renderização da Tela de Sucesso
  if (generatedCredentials) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl mx-auto p-4 py-10 text-center"
      >
        <div className="glass-panel p-8 rounded-[2.5rem] shadow-2xl border border-white/20 overflow-hidden relative">
          {/* Decoração sutil */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
          
          <div className="relative z-10">
            <h3 className="text-3xl font-serif font-bold text-special mb-6">
              Atendimento Registrado!
            </h3>
            
            <div className="bg-white/80 dark:bg-black/40 backdrop-blur-md border border-white/30 dark:border-white/10 p-6 rounded-3xl mb-6 text-left space-y-4 shadow-inner">
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary mb-1">
                  {isRepresentacao ? "Identificação da Representante" : "Identificação do Autor"}
                </p>
                <p className="text-2xl font-mono text-primary-600 font-bold">
                  {formState.representante_cpf}
                </p>
              </div>
              
              <div className="pt-4 border-t border-primary/10">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-1">
                  Número do Protocolo
                </p>
                <p className="text-xl font-mono text-special font-bold bg-special/5 inline-block px-3 py-1 rounded-lg">
                  {generatedCredentials.protocolo}
                </p>
              </div>
            </div>

            <div className="bg-amber-100/80 dark:bg-amber-900/40 p-4 rounded-2xl border border-amber-200/50 text-amber-900 dark:text-amber-200 text-sm text-left flex gap-3 shadow-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
              <p className="leading-relaxed">
                <span className="font-bold">Atenção!</span> Tire um print desta tela. Você precisará {isRepresentacao ? "do CPF da representante" : "do seu CPF"} e do protocolo para consultar o andamento.
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-8">
              {isRepresentacao && (
                <button
                  onClick={() => {
                    const repFields = [
                      "REPRESENTANTE_NOME", "representante_cpf", "requerente_telefone",
                      "requerente_email", "requerente_endereco_residencial",
                      "representante_estado_civil", "representante_nacionalidade",
                      "representante_ocupacao", "representante_rg", "emissor_rg_exequente",
                      "representante_data_nascimento", "nome_mae_representante",
                      "nome_pai_representante", "representante_endereco_profissional"
                    ];
                    const repData = {};
                    repFields.forEach(f => { if (formState[f]) repData[f] = formState[f]; });
                    
                    dispatch({ 
                      type: "LOAD_RASCUNHO", 
                      payload: { ...initialState, ...repData, assistidoEhIncapaz: "sim" } 
                    });
                    setGeneratedCredentials(null);
                    setFormErrors({});
                    toast.info("Dados mantidos. Novo caso para a mesma representante.");
                  }}
                  className="btn btn-primary w-full py-4 text-base shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Novo Caso P/ Mesma Representante
                </button>
              )}

              <button
                onClick={() => {
                  localStorage.removeItem("rascunho_caso");
                  dispatch({ type: "RESET_FORM" });
                  setGeneratedCredentials(null);
                  setFormErrors({});
                }}
                className="btn btn-secondary w-full py-3"
              >
                Novo Atendimento do Zero
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Renderização do Formulário Padrão
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-3 sm:px-0"
    >
      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        <StepTipoAcao
          tipoAcao={formState.tipoAcao}
          acaoEspecifica={formState.acaoEspecifica}
          dispatch={dispatch}
          handleFieldChange={handleFieldChange}
          validar={validar}
        />

        {formState.acaoEspecifica && (
          <>
            <StepDadosPessoais
              assistidoEhIncapaz={formState.assistidoEhIncapaz}
              assistidoNome={formState.NOME}
              assistidoCpf={formState.cpf}
              assistidoNascimento={formState.nascimento}
              assistidoNacionalidade={formState.nacionalidade}
              representanteNome={formState.REPRESENTANTE_NOME}
              representanteCpf={formState.representante_cpf}
              representanteNascimento={formState.representante_data_nascimento}
              representanteNacionalidade={formState.representante_nacionalidade}
              representanteEstadoCivil={formState.representante_estado_civil}
              representanteOcupacao={formState.representante_ocupacao}
              representanteEnderecoProfissional={formState.representante_endereco_profissional}
              representanteRg={formState.representante_rg}
              representanteEmissorRg={formState.emissor_rg_exequente}
              requerenteEnderecoResidencial={formState.requerente_endereco_residencial}
              requerenteEmail={formState.requerente_email}
              requerenteTelefone={formState.requerente_telefone}
              nomeMaeRepresentante={formState.nome_mae_representante}
              nomePaiRepresentante={formState.nome_pai_representante}
              outrosFilhos={formState.outrosFilhos}
              dispatch={dispatch}
              handleFieldChange={handleFieldChange}
              handleCpfChangeAndValidate={handleCpfChangeAndValidate}
              handleRgChange={handleRgChange}
              handleDateChange={handleDateChange}
              handlePhoneChange={handlePhoneChange}
              validar={validar}
              formErrors={formErrors}
              setFormErrors={setFormErrors}
              forcaRepresentacao={forcaRepresentacao}
              isRepresentacao={isRepresentacao}
              labelAutor={labelAutor}
              configAcao={configAcao}
              handleRestrictedAlphanumeric={handleRestrictedAlphanumeric}
            />

            {!isAlvara && (
            <StepRequerido
              requeridoNome={formState.REQUERIDO_NOME}
              requeridoCpf={formState.executado_cpf}
              requeridoNomeMae={formState.nome_mae_executado}
              requeridoNomePai={formState.nome_pai_executado}
              requeridoEnderecoResidencial={formState.executado_endereco_residencial}
              requeridoTelefone={formState.executado_telefone}
              requeridoEmail={formState.executado_email}
              requeridoOcupacao={formState.executado_ocupacao}
              requeridoNacionalidade={formState.executado_nacionalidade}
              requeridoEstadoCivil={formState.executado_estado_civil}
              requeridoEnderecoProfissional={formState.executado_endereco_profissional}
              requeridoOutrosSelecionados={formState.requeridoOutrosSelecionados}
              requeridoRg={formState.rg_executado}
              requeridoEmissorRg={formState.emissor_rg_executado}
              formState={formState}
              handleFieldChange={handleFieldChange}
              handleCpfChangeAndValidate={handleCpfChangeAndValidate}
              handlePhoneChange={handlePhoneChange}
              handleRgChange={handleRgChange}
              handleDateChange={handleDateChange}
              toggleRequeridoDetalhe={toggleRequeridoDetalhe}
              formErrors={formErrors}
            />
            )}

            <StepDadosProcessuais 
               CIDADEASSINATURA={formState.CIDADEASSINATURA}
               handleFieldChange={handleFieldChange}
               unidades={unidades}
               formErrors={formErrors}
            />


            <StepDetalhesCaso
              formState={formState}
              handleFieldChange={handleFieldChange}
              handleCurrencyChange={handleCurrencyChange}
              handleDayInputChange={handleDayInputChange}
              handleMonthYearChange={handleMonthYearChange}
              handleRestrictedAlphanumeric={handleRestrictedAlphanumeric}
              validar={validar}
              configAcao={configAcao}
              formErrors={formErrors}
            />


            <StepRelatoDocs
              relato={formState.relato}
              prefersAudio={formState.prefersAudio}
              enviarDocumentosDepois={formState.enviarDocumentosDepois}
              acaoEspecifica={formState.acaoEspecifica}
              outrosFilhos={formState.outrosFilhos}
              representanteNome={formState.REPRESENTANTE_NOME}
              handleFieldChange={handleFieldChange}
              formErrors={formErrors}
              isRecording={isRecording}
              startRecording={startRecording}
              stopRecording={stopRecording}
              removeAudioRecording={removeAudioRecording}
              isRepresentacao={isRepresentacao}
              handleFilesChange={handleFilesChange}
              configAcao={configAcao}
            />

            <div className="pt-6 relative z-20">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-4 text-lg shadow-lg hover:shadow-xl transform-gpu translate-z-0 will-change-transform"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    Processando...
                  </span>
                ) : (
                  <>
                    <Upload size={20} /> Enviar Caso para a Defensoria
                  </>
                )}
              </button>
              {loading && (
                <p className="text-center text-sm text-muted mt-2 animate-pulse">
                  {statusMessage}
                </p>
              )}
            </div>
          </>
        )}
      </form>
    </motion.div>
  );
};

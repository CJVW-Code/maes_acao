import React, { useReducer } from "react";
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
  });

  const {
    isRecording,
    startRecording,
    stopRecording,
    removeAudioRecording,
    mostrarSugestoes,
    setMostrarSugestoes,
    sugestoesCidades,
    setSugestoesCidades,
    handleFieldChange,
    handleCidadeChange,
    handleSelecionaCidade,
    handleCpfChangeAndValidate,
    handlePhoneChange,
    handleDateChange,
    handleMonthYearChange,
    handleRgChange,
    toggleRequeridoDetalhe,
    handleDecimalFieldChange,
    handleCurrencyChange,
    handleDayInputChange,
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
  const labelAutor = isRepresentacao
    ? "Dados da Criança/Adolescente (Assistido)"
    : "Seus Dados (Você é o autor da ação)";

  // Renderização da Tela de Sucesso
  if (generatedCredentials) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card text-center p-8"
      >
        <h3 className="text-2xl font-bold text-muted mb-4">
          Cadastro Realizado!
        </h3>
        <div className="bg-surface border border-soft p-4 rounded-xl mb-4 text-left space-y-3">
          <div>
            <p className="text-xs text-muted uppercase font-bold">
              CPF (Identificação)
            </p>
            <p className="text-xl font-mono text-primary-600">
              {formState.cpf}
            </p>
          </div>
          <div className="pt-2 border-t border-soft/50">
            <p className="text-x text-muted">
              Protocolo do sistema:{" "}
              <span className="font-mono text-primary-600">
                {generatedCredentials.protocolo}
              </span>
            </p>
          </div>
        </div>
        <div className="bg-border/10 p-3 rounded border border-border/30 text-error text-sm text-left flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>
            Tire um print da tela! Você precisará do seu CPF para consultar o andamento deste protocolo (status atual).
          </p>
        </div>
        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={() => {
              dispatch({ type: "RESET_FORM" });
              setGeneratedCredentials(null);
              setFormErrors({});
            }}
            className="btn btn-secondary w-full"
          >
            Novo Atendimento do Zero
          </button>

          {isRepresentacao && (
            <button
              onClick={() => {
                const repFields = [
                  "representante_nome",
                  "representante_cpf",
                  "representante_telefone",
                  "representante_email",
                  "representante_endereco_residencial",
                  "representante_estado_civil",
                  "representante_nacionalidade",
                  "representante_ocupacao",
                  "representante_rg_numero",
                  "representante_rg_orgao",
                ];

                const repData = {};
                repFields.forEach((f) => {
                  repData[f] = formState[f];
                });

                dispatch({ type: "RESET_FORM" });

                Object.entries(repData).forEach(([key, value]) => {
                  if (value) {
                    dispatch({ type: "UPDATE_FIELD", field: key, value });
                  }
                });
                dispatch({
                  type: "UPDATE_FIELD",
                  field: "assistidoEhIncapaz",
                  value: "sim",
                });

                setGeneratedCredentials(null);
                setFormErrors({});
                toast.info("Dados da representante mantidos para o novo caso.");
              }}
              className="btn btn-primary w-full"
            >
              Novo Caso P/ Esta Representante
            </button>
          )}
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
          formState={formState}
          dispatch={dispatch}
          handleFieldChange={handleFieldChange}
          validar={validar}
        />

        {formState.acaoEspecifica && (
          <>
            <StepDadosPessoais
              formState={formState}
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
              today={today}
              labelAutor={labelAutor}
            />

            {!isAlvara && (
              <StepRequerido
                formState={formState}
                handleFieldChange={handleFieldChange}
                handleCpfChangeAndValidate={handleCpfChangeAndValidate}
                handlePhoneChange={handlePhoneChange}
                handleRgChange={handleRgChange}
                handleDateChange={handleDateChange}
                toggleRequeridoDetalhe={toggleRequeridoDetalhe}
                formErrors={formErrors}
                today={today}
              />
            )}

            <StepDadosProcessuais 
               formState={formState}
               handleCidadeChange={handleCidadeChange}
               mostrarSugestoes={mostrarSugestoes}
               sugestoesCidades={sugestoesCidades}
               handleSelecionaCidade={handleSelecionaCidade}
               setMostrarSugestoes={setMostrarSugestoes}
            />


            <StepDetalhesCaso
              formState={formState}
              handleFieldChange={handleFieldChange}
              handleCurrencyChange={handleCurrencyChange}
              handleDayInputChange={handleDayInputChange}
              handleMonthYearChange={handleMonthYearChange}
              validar={validar}
              configAcao={configAcao}
              formErrors={formErrors}
            />


            <StepRelatoDocs
              formState={formState}
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

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-4 text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
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

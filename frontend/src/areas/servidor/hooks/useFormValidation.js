import { useState } from "react";
import { processSubmission } from "../services/submissionService.js";
import { API_BASE } from "../../../utils/apiBase.js";
import {
  stripNonDigits,
  validateCpfAlgorithm,
  formatDateToBr,
  parseBrDateToIso,
  normalizeDecimalForSubmit,
} from "../../../utils/formatters.js";
import { currencyFields } from "../../../utils/formOptions.js";

export const useFormValidation = ({
  formState,
  configAcao,
  forcaRepresentacao,
  today,
  toast,
  confirm,
}) => {
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [generatedCredentials, setGeneratedCredentials] = useState(null);

  const isAlvara = configAcao?.isAlvara || false;

  const processSubmissionWrapper = async ({ isAlvaraContext = false } = {}) => {
    return processSubmission({
      isAlvaraContext,
      formState,
      setFormErrors,
      setLoading,
      setStatusMessage,
      setGeneratedCredentials,
      toast,
      configAcao,
      forcaRepresentacao,
      today,
      stripNonDigits,
      validateCpfAlgorithm,
      formatDateToBr,
      parseBrDateToIso,
      normalizeDecimalForSubmit,
      currencyFields,
      API_BASE,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isConfirmed = await confirm(
      "Você conferiu se as fotos dos documentos estão legíveis? O envio de documentos com baixa qualidade pode atrasar seu atendimento. Deseja continuar?",
      "Confirmar envio"
    );

    if (!isConfirmed) return;

    setTimeout(async () => {
      try {
        await processSubmissionWrapper({
          isAlvaraContext: isAlvara,
        });
      } catch (error) {
        console.error("Erro fatal no envio:", error);
        toast.error("Ocorreu um erro inesperado ao enviar. Tente novamente.");
        setLoading(false);
      }
    }, 100);
  };

  return {
    formErrors,
    setFormErrors,
    loading,
    setLoading,
    statusMessage,
    setStatusMessage,
    generatedCredentials,
    setGeneratedCredentials,
    handleSubmit,
  };
};

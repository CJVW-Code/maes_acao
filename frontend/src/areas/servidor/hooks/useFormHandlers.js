import { useState, useRef, useCallback } from "react";
import {
  stripNonDigits,
  formatCpf,
  formatPhone,
  formatRgNumber,
  formatCurrencyMask,
  formatDateMask,
  formatMonthYearMask,
  sanitizeDecimalInput,
  validateCpfAlgorithm,
  validateBrDate,
} from "../../../utils/formatters.js";
import {
  cidadesBahia,
  outrosDadosRequeridoFieldMap,
} from "../../../utils/formOptions.js";

export const useFormHandlers = ({ formState, dispatch, setFormErrors, toast }) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [sugestoesCidades, setSugestoesCidades] = useState([]);

  const clearFieldError = useCallback((field) => {
    setFormErrors((prev) => {
      const hasFieldError = Boolean(prev[field]);
      const shouldClearContato =
        (field === "executado_endereco_residencial" ||
          field === "executado_telefone" ||
          field === "executado_email") &&
        prev.requeridoContato;
      if (!hasFieldError && !shouldClearContato) {
        return prev;
      }
      const updated = { ...prev };
      if (hasFieldError) {
        delete updated[field];
      }
      if (shouldClearContato) {
        delete updated.requeridoContato;
      }
      return updated;
    });
  }, [setFormErrors]);

  const handleFieldChange = useCallback((e) => {
    const { name, value } = e.target;
    dispatch({ type: "UPDATE_FIELD", field: name, value });
    clearFieldError(name);
  }, [dispatch, clearFieldError]);

  const handleCidadeChange = useCallback((e) => {
    const { value } = e.target;
    dispatch({ type: "UPDATE_FIELD", field: "CIDADEASSINATURA", value });

    if (value.length > 0) {
      const filtered = cidadesBahia.filter((cidade) =>
        cidade.toLowerCase().includes(value.toLowerCase())
      );
      setSugestoesCidades(filtered);
      setMostrarSugestoes(true);
    } else {
      setMostrarSugestoes(false);
    }
  }, [dispatch]);

  const handleSelecionaCidade = useCallback((cidade) => {
    dispatch({
      type: "UPDATE_FIELD",
      field: "CIDADEASSINATURA",
      value: cidade,
    });
    setMostrarSugestoes(false);
  }, [dispatch]);

  const handleNumericInput = useCallback((e) => {
    const value = e.target.value;
    if (/^[0-9]*$/.test(value)) {
      handleFieldChange(e);
    }
  }, [handleFieldChange]);

  const handleMaskedChange = useCallback((formatter, field) => (event) => {
    const formattedValue = formatter(event.target.value);
    dispatch({ type: "UPDATE_FIELD", field, value: formattedValue });
    clearFieldError(field);
  }, [dispatch, clearFieldError]);

  const handleCpfChangeAndValidate = useCallback((field) => (e) => {
    const rawValue = e.target.value;
    const formattedValue = formatCpf(rawValue);
    dispatch({ type: "UPDATE_FIELD", field, value: formattedValue });

    const cleanCpf = stripNonDigits(rawValue);
    if (cleanCpf.length === 11) {
      if (!validateCpfAlgorithm(cleanCpf)) {
        setFormErrors((prev) => ({ ...prev, [field]: "O CPF informado é inválido." }));
      } else {
        setFormErrors((prev) => {
          const updated = { ...prev };
          if (updated[field] === "O CPF informado é inválido.") {
            delete updated[field];
          }
          return updated;
        });
      }
    } else {
      setFormErrors((prev) => {
        const updated = { ...prev };
        if (updated[field] === "O CPF informado é inválido.") {
          delete updated[field];
        }
        return updated;
      });
    }
  }, [dispatch, setFormErrors]);

  const handlePhoneChange = useCallback((field) => handleMaskedChange(formatPhone, field), [handleMaskedChange]);

  const handleDateChange = useCallback((field) => (e) => {
    const formattedValue = formatDateMask(e.target.value);
    dispatch({ type: "UPDATE_FIELD", field, value: formattedValue });

    if (formattedValue.length === 10) {
      if (!validateBrDate(formattedValue)) {
        setFormErrors((prev) => ({ ...prev, [field]: "Data inválida (Ex: 31/12/1990)." }));
      } else {
        setFormErrors((prev) => {
          const updated = { ...prev };
          delete updated[field];
          return updated;
        });
      }
    } else {
      // Limpa alertas enquanto o usuário ainda está digitando
      setFormErrors((prev) => {
        const updated = { ...prev };
        if (updated[field]) {
          delete updated[field];
        }
        return updated;
      });
    }
  }, [dispatch, setFormErrors]);

  const handleMonthYearChange = useCallback((field) => (event) => {
    const value = event.target.value;
    const formattedValue = formatMonthYearMask(value);
    
    dispatch({ type: "UPDATE_FIELD", field, value: formattedValue });
    clearFieldError(field);

    // Validação de intervalo de datas (Execução) em tempo real
    if (formattedValue.length === 7) { // MM/AAAA
      const isInicio = field === "data_inicio_debito";
      const isFim = field === "data_fim_debito";

      if (isInicio || isFim) {
        const outroField = isInicio ? "data_fim_debito" : "data_inicio_debito";
        const outroValor = formState[outroField];

        if (outroValor && outroValor.length === 7) {
          const [m1, a1] = (isInicio ? formattedValue : outroValor).split("/").map(Number);
          const [m2, a2] = (isFim ? formattedValue : outroValor).split("/").map(Number);
          
          const d1 = new Date(a1, m1 - 1);
          const d2 = new Date(a2, m2 - 1);

          if (d2 < d1) {
            setFormErrors(prev => ({ 
              ...prev, 
              data_fim_debito: "A data final não pode ser anterior à data inicial." 
            }));
          } else {
            setFormErrors(prev => {
              const updated = { ...prev };
              delete updated.data_fim_debito;
              return updated;
            });
          }
        }
      }
    }
  }, [dispatch, clearFieldError, formState, setFormErrors]);
  
  const handleRgChange = useCallback((field) => (event) => {
    dispatch({
      type: "UPDATE_FIELD",
      field,
      value: formatRgNumber(event.target.value),
    });
    clearFieldError(field);
  }, [dispatch, clearFieldError]);

  const toggleRequeridoDetalhe = useCallback((key) => {
    const selecionados = formState.requeridoOutrosSelecionados || [];
    const jaSelecionado = selecionados.includes(key);
    if (jaSelecionado) {
      const atualizados = selecionados.filter((item) => item !== key);
      dispatch({
        type: "UPDATE_FIELD",
        field: "requeridoOutrosSelecionados",
        value: atualizados,
      });
      (outrosDadosRequeridoFieldMap[key] || []).forEach((field) => {
        dispatch({ type: "UPDATE_FIELD", field, value: "" });
      });
    } else {
      dispatch({
        type: "UPDATE_FIELD",
        field: "requeridoOutrosSelecionados",
        value: [...selecionados, key],
      });
    }
  }, [dispatch, formState.requeridoOutrosSelecionados]);

  const handleDecimalFieldChange = useCallback((field, options = {}) => (event) => {
    dispatch({
      type: "UPDATE_FIELD",
      field,
      value: sanitizeDecimalInput(event.target.value, options),
    });
  }, [dispatch]);

  const handleCurrencyChange = useCallback((field) => (event) => {
    dispatch({
      type: "UPDATE_FIELD",
      field,
      value: formatCurrencyMask(event.target.value),
    });
    clearFieldError(field);
  }, [dispatch, clearFieldError]);

  const handleDayInputChange = useCallback((field) => (e) => {
    let value = parseInt(e.target.value, 10);
    if (isNaN(value) || value < 1) {
      value = "";
    } else if (value > 31) {
      value = 31;
    }
    dispatch({ type: "UPDATE_FIELD", field, value: String(value) });
  }, [dispatch]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) =>
        audioChunksRef.current.push(event.data);
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        dispatch({
          type: "UPDATE_FIELD",
          field: "audioBlob",
          value: audioBlob,
        });
        audioChunksRef.current = [];
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erro microfone:", err);
      toast.error("Não foi possível acessar o microfone.");
    }
  }, [dispatch, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }
  }, []);

  const removeAudioRecording = useCallback(() => {
    dispatch({ type: "UPDATE_FIELD", field: "audioBlob", value: null });
  }, [dispatch]);

  const handleFilesChange = useCallback((files, namesMap) => {
    dispatch({
      type: "UPDATE_FIELD",
      field: "documentFiles",
      value: files,
    });
    dispatch({
      type: "UPDATE_FIELD",
      field: "documentNames",
      value: namesMap,
    });
    dispatch({
      type: "UPDATE_FIELD",
      field: "documentosMarcados",
      value: Object.values(namesMap),
    });
  }, [dispatch]);

  return {
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
    handleNumericInput,
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
  };
};

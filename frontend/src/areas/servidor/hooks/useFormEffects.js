import { useEffect, useRef } from "react";
import { API_BASE } from "../../../utils/apiBase.js";

export const useFormEffects = ({
  dispatch,
  formState,
  location,
  toast,
  forcaRepresentacao,
}) => {
  // 1. Health check da API no carregamento inicial
  useEffect(() => {
    fetch(`${API_BASE}/health`).catch(() => {});
  }, []);

  // 2. Automatizar seleção de representação para ações que exigem (Fixação, Execução, etc)
  useEffect(() => {
    if (forcaRepresentacao) {
      if (formState.assistidoEhIncapaz !== "sim") {
        dispatch({
          type: "UPDATE_FIELD",
          field: "assistidoEhIncapaz",
          value: "sim",
        });
      }
    }
  }, [formState.acaoEspecifica, formState.assistidoEhIncapaz, forcaRepresentacao, dispatch]);

  const hasLoadedData = useRef(false);

  // 3. Recuperação de Rascunho
  useEffect(() => {
    if (hasLoadedData.current) return;

    const rascunho = localStorage.getItem("rascunho_caso");
    if (rascunho && !location.state?.action) {
      hasLoadedData.current = true;
      try {
        const parsed = JSON.parse(rascunho);
        dispatch({ type: "LOAD_RASCUNHO", payload: parsed });
        toast.info(
          "Recuperamos seus dados após recarregamento. Por favor, anexe os documentos e fotos novamente se necessário.",
          { autoClose: 6000 }
        );
      } catch (e) {
        console.error("Erro ao carregar rascunho:", e);
      }
    }
  }, [location.state?.action, toast, dispatch]);

  // 4. Lógica de Multi-Casos (Prefill de Dados da Representante)
  useEffect(() => {
    if (hasLoadedData.current) return;

    if (
      location.state?.action === "PREFILL_REPRESENTATIVE_DATA" &&
      location.state?.payload
    ) {
      hasLoadedData.current = true;
      const repData = location.state.payload;

      Object.entries(repData).forEach(([key, value]) => {
        if (value) {
          dispatch({ type: "UPDATE_FIELD", field: key, value });
        }
      });

      dispatch({ type: "UPDATE_FIELD", field: "assistidoEhIncapaz", value: "sim" });

      toast.info("Dados da representante reaproveitados para novo caso.");

      window.history.replaceState({}, document.title);
    }
  }, [location.state, toast, dispatch]);

  // 5. Auto-Save Debounced do Rascunho
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const rascunhoLimpo = { ...formState };
      delete rascunhoLimpo.documentFiles;
      delete rascunhoLimpo.audioBlob;
      localStorage.setItem("rascunho_caso", JSON.stringify(rascunhoLimpo));
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [formState]);
};

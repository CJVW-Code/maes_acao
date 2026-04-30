import { useEffect, useRef } from "react";
import { API_BASE } from "../../../utils/apiBase.js";
import { formatCpf, formatPhone } from "../../../utils/formatters.js";

export const useFormEffects = ({ dispatch, formState, location, toast, forcaRepresentacao, isSubmitted }) => {
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

  // 3. Estratégia de Persistência Híbrida (Rascunho + Prefill Remoto)
  useEffect(() => {
    if (hasLoadedData.current) return;
    hasLoadedData.current = true;

    const loadData = async () => {
      // ETAPA 1: Carregar Rascunho Local
      const rascunhoStr = localStorage.getItem("rascunho_caso");
      let currentDataOnLoad = { ...formState };
      let rascunhoFoiCarregado = false;

      if (rascunhoStr) {
        try {
          const parsed = JSON.parse(rascunhoStr);
          
          // Verificação de segurança: se viemos da busca, o rascunho deve ser da mesma pessoa
          const cpfDaBusca = location.state?.initialCpf ? String(location.state.initialCpf).replace(/\D/g, "") : null;
          const cpfDoRascunho = parsed.representante_cpf ? String(parsed.representante_cpf).replace(/\D/g, "") : null;
          
          if (!cpfDaBusca || cpfDaBusca === cpfDoRascunho) {
            currentDataOnLoad = { ...currentDataOnLoad, ...parsed };
            dispatch({ type: "LOAD_RASCUNHO", payload: parsed });
            toast.info("Rascunho recuperado.");
            rascunhoFoiCarregado = true;
          } else {
            console.log("[useFormEffects] Rascunho descartado por divergência de CPF.");
            localStorage.removeItem("rascunho_caso");
          }
        } catch (e) {
          console.error("Erro rascunho:", e);
        }
      }

      // ETAPA 2: Se houver dados da representante no state, carregar (Merge)
      const isPrefillAction = location.state?.action === "PREFILL_REPRESENTATIVE_DATA";
      const repDataFromState = location.state?.dados_representante;

      if (isPrefillAction && repDataFromState) {
        const fieldMap = {
          "nome_representante": "REPRESENTANTE_NOME",
          "cpf_representante": "representante_cpf",
          "rg_representante": "representante_rg",
          "emissor_rg_representante": "emissor_rg_exequente",
          "nacionalidade_representante": "representante_nacionalidade",
          "estado_civil_representante": "representante_estado_civil",
          "profissao_representante": "representante_ocupacao",
          "data_nascimento_representante": "representante_data_nascimento",
          "endereco_representante": "requerente_endereco_residencial",
          "telefone_representante": "requerente_telefone",
          "email_representante": "requerente_email",
          "nome_mae_representante": "nome_mae_representante",
          "nome_pai_representante": "nome_pai_representante",
          "CIDADEASSINATURA": "CIDADEASSINATURA"
        };

        let mergedCount = 0;
        Object.entries(fieldMap).forEach(([dbKey, formKey]) => {
          const valInState = repDataFromState[dbKey];
          const valNoState = currentDataOnLoad[formKey];
          const stringVal = String(valNoState || "").trim();

          if (valInState && (!valNoState || stringVal === "" || stringVal === "______")) {
            let val = valInState;
            if (formKey.toLowerCase().includes("cpf")) val = formatCpf(val);
            else if (formKey.toLowerCase().includes("telefone")) val = formatPhone(val);
            
            dispatch({ type: "UPDATE_FIELD", field: formKey, value: val });
            mergedCount++;
          }
        });

        if (mergedCount > 0) {
          toast.success(`${mergedCount} campos da representante recuperados do histórico.`);
          dispatch({ type: "UPDATE_FIELD", field: "assistidoEhIncapaz", value: "sim" });
        }
      }

      // ETAPA 3: Se não houver rascunho carregado nem prefill, mas houver CPF da busca
      if (location.state?.initialCpf && !rascunhoFoiCarregado && !location.state?.protocoloOrigem) {
        dispatch({ 
          type: "UPDATE_FIELD", 
          field: "representante_cpf", 
          value: formatCpf(location.state.initialCpf) 
        });
      }
    };

    loadData();
  }, [location.state, dispatch, toast, formState]);

  // 4. Auto-Save Debounced (Apenas se houver dados mínimos para salvar)
  useEffect(() => {
    if (isSubmitted) return;

    // Usamos um timer maior e evitamos rodar a lógica pesada em cada respiro
    const timeoutId = setTimeout(() => {
      const { documentFiles: _documentFiles, audioBlob: _audioBlob, ...rascunhoLimpo } = formState;

      // Só salva se tiver algo relevante e se o rascunho for diferente do atual (evita ciclos)
      if (rascunhoLimpo.acaoEspecifica || rascunhoLimpo.REPRESENTANTE_NOME) {
        const currentRascunho = localStorage.getItem("rascunho_caso");
        const stringified = JSON.stringify(rascunhoLimpo);

        if (currentRascunho !== stringified) {
          localStorage.setItem("rascunho_caso", stringified);
          console.log("[Auto-Save] Rascunho atualizado.");
        }
      }
    }, 3000); // 3 segundos de inatividade
    return () => clearTimeout(timeoutId);
  }, [formState, isSubmitted]); // Agora depende do estado todo, mas o timeout protege a UI
};

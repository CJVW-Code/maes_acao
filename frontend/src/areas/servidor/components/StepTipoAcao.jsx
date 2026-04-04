import React from "react";
import { Scale } from "lucide-react";
import { AREAS_DIREITO, getAcoesVisiveis } from "../../../config/formularios";

export const StepTipoAcao = ({
  formState,
  dispatch,
  handleFieldChange,
  validar,
}) => {
  let acoesVisiveis = [];
  try {
    acoesVisiveis = getAcoesVisiveis(formState.tipoAcao) || [];
  } catch (err) {
    console.error("[StepTipoAcao] Erro ao buscar ações:", err);
  }

  const areasEntries = Object.entries(AREAS_DIREITO || {});

  return (
    <section className="card space-y-4 border-l-4 border-l-blue-500">
      <div className="flex items-center gap-2 mb-2">
        <Scale className="text-blue-400" />
        <h2 className="heading-2">1. O que você precisa?</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="select-area-direito" className="label">Área do Direito</label>
          <select
            id="select-area-direito"
            value={formState.tipoAcao}
            onChange={(e) =>
              dispatch({ type: "SET_ACAO", tipoAcao: e.target.value })
            }
            className="input"
          >
            {areasEntries.map(([key, area]) => (
              <option key={key} value={key}>
                {area.titulo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="select-tipo-acao" className="label">
            Tipo de Ação (Selecione o mais próximo)
          </label>
          <select
            id="select-tipo-acao"
            value={formState.acaoEspecifica}
            onChange={handleFieldChange}
            name="acaoEspecifica"
            {...validar("Selecione o tipo de ação.")}
            className="input font-medium text-text"
          >
            <option value="">
              -- Selecione o Tipo de Ação --
            </option>
            {acoesVisiveis.map(([key, config]) => (
              <option key={key} value={key}>
                {config.titulo}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
};

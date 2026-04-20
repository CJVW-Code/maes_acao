import React from "react";
import { Scale } from "lucide-react";
import { AREAS_DIREITO, getAcoesVisiveis } from "../../../config/formularios";

export const StepTipoAcao = React.memo(({
  tipoAcao,
  acaoEspecifica,
  dispatch,
  handleFieldChange,
  validar,
}) => {
  let acoesVisiveis = [];
  try {
    acoesVisiveis = getAcoesVisiveis(tipoAcao) || [];
  } catch (err) {
    console.error("[StepTipoAcao] Erro ao buscar ações:", err);
  }

  const areasEntries = Object.entries(AREAS_DIREITO || {});

  return (
    <section className="form-section">
      <div className="flex items-center gap-3 mb-2 border-b border-soft pb-4">
        <Scale className="text-primary" size={24} />
        <h2 className="heading-2">1. O que você precisa?</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="select-area-direito" className="label">Área do Direito</label>
          <select
            id="select-area-direito"
            value={tipoAcao}
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
            value={acaoEspecifica}
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
});

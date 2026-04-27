import React from "react";
import { MapPin } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";

const StepDadosProcessuais = React.memo(
  ({
    CIDADEASSINATURA,
    handleFieldChange,
    unidades = [],
    formErrors = {}
  }) => {
    // Mapeia unidades para o formato do SearchableSelect e remove duplicatas por comarca
    const uniqueComarcas = new Set();
    const options = unidades
      .filter(u => {
        if (uniqueComarcas.has(u.comarca)) return false;
        uniqueComarcas.add(u.comarca);
        return true;
      })
      .map(u => ({
        value: u.comarca,
        label: u.regional ? `${u.comarca} (${u.regional})` : u.comarca
      }));

    return (
      <section className="form-section">
        <div className="flex items-center gap-3 mb-2 border-b border-soft pb-4">
          <MapPin className="text-primary" size={24} />
          <h2 className="heading-2">3. Onde este caso será protocolado?</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label text-sm font-semibold mb-2 block">
              Selecione a Unidade / Comarca *
            </label>
            <SearchableSelect
              name="CIDADEASSINATURA"
              placeholder="Pesquise pela cidade ou regional..."
              options={options}
              value={CIDADEASSINATURA}
              onChange={handleFieldChange}
              className={formErrors.CIDADEASSINATURA ? "border-error" : ""}
            />
            {formErrors.CIDADEASSINATURA && (
              <span className="text-xs text-error mt-1 ml-1">
                {formErrors.CIDADEASSINATURA}
              </span>
            )}
            <p className="text-[10px] text-muted mt-2 leading-relaxed">
              Dica: A petição será gerada com o nome da comarca selecionada acima.
            </p>
          </div>
        </div>
      </section>
    );
  },
);

export default StepDadosProcessuais;

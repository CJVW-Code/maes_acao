import React from "react";
import { Briefcase } from "lucide-react";
import { SecaoRenderer } from "./SecaoRenderer";
import { SecaoCamposGeraisFamilia } from "./secoes/SecaoCamposGeraisFamilia";

export const StepDetalhesCaso = React.memo(({
  formState,
  handleFieldChange,
  handleCurrencyChange,
  handleDayInputChange,
  handleMonthYearChange,
  handleRestrictedAlphanumeric,
  validar,
  configAcao,
  formErrors = {},
}) => {
  return (
    <section className="form-section">
      <div className="flex items-center gap-3 border-b border-soft pb-4">
        <Briefcase className="text-primary" size={24} />
        <h2 className="heading-2">4. Detalhes do Caso</h2>
      </div>

      {/* Seções dinâmicas configuradas no dicionário */}
      {configAcao?.secoes?.map((secao) => (
        <SecaoRenderer
          key={secao}
          tipo={secao}
          formState={formState}
          handleFieldChange={handleFieldChange}
          handleCurrencyChange={handleCurrencyChange}
          handleDayInputChange={handleDayInputChange}
          handleMonthYearChange={handleMonthYearChange}
          handleRestrictedAlphanumeric={handleRestrictedAlphanumeric}
          validar={validar}
          formErrors={formErrors}
        />
      ))}

      {/* Campos gerais de família — sempre renderiza, controlado por camposGerais */}
      <SecaoCamposGeraisFamilia
        formState={formState}
        handleFieldChange={handleFieldChange}
        camposGerais={configAcao?.camposGerais}
        formErrors={formErrors}
      />
    </section>
  );
});

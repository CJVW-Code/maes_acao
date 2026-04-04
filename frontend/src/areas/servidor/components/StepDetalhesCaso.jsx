import React from "react";
import { Briefcase } from "lucide-react";
import { SecaoRenderer } from "./SecaoRenderer";
import { SecaoCamposGeraisFamilia } from "./secoes/SecaoCamposGeraisFamilia";

export const StepDetalhesCaso = ({
  formState,
  handleFieldChange,
  handleCurrencyChange,
  handleDayInputChange,
  handleMonthYearChange,
  validar,
  configAcao,
  formErrors = {},
}) => {
  return (
    <section className="card space-y-6 border-l-4 border-l-green-500">
      <div className="flex items-center gap-2 border-b border-soft pb-2">
        <Briefcase className="text-green-400" />
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
          validar={validar}
          formErrors={formErrors}
        />
      ))}

      {/* Campos gerais de família — sempre renderiza, controlado por camposGerais */}
      <SecaoCamposGeraisFamilia
        formState={formState}
        handleFieldChange={handleFieldChange}
        camposGerais={configAcao?.camposGerais}
      />
    </section>
  );
};

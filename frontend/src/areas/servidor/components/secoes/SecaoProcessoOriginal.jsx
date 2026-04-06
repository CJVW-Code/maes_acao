import React from "react";

export const SecaoProcessoOriginal = ({
  formState,
  handleFieldChange,
  handleCurrencyChange,
  handleDayInputChange,
  handleMonthYearChange,
  validar = () => ({}),
  formErrors = {},
}) => {
  return (
    <div className="space-y-4 pt-4 border-t border-soft">
      <h4 className="font-semibold text-primary">
        Dados do Processo de Alimentos Original
      </h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="vara" className="label font-bold text-primary">
            Vara da Petição Atual (ex: 1ª Vara de Família) *
          </label>
          <input
            id="vara"
            type="text"
            placeholder="Ex: 1ª Vara de Família"
            name="vara"
            value={formState.vara}
            onChange={handleFieldChange}
            className="input border-primary/50"
            {...validar("Informe a vara para esta petição.")}
          />
        </div>
        <div>
          <label htmlFor="percentualSalarioMinimo" className="label font-bold text-primary">
            Percentual do Salário Mínimo (%) *
          </label>
          <div className="relative">
            <input
              id="percentualSalarioMinimo"
              type="text"
              placeholder="Ex: 30"
              name="percentualSalarioMinimo"
              value={formState.percentualSalarioMinimo}
              onChange={handleFieldChange}
              className="input border-primary/50 pr-10"
              {...validar("Informe o percentual fixado.")}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-bold">
              %
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="numeroProcessoOriginario" className="label">
            Número do Processo Original
          </label>
          <input
            id="numeroProcessoOriginario"
            type="text"
            placeholder="Número do Processo Original"
            name="numeroProcessoOriginario"
            value={formState.numeroProcessoOriginario}
            onChange={handleFieldChange}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="processoTituloNumero" className="label">
            Nº do Título (se houver)
          </label>
          <input
            id="processoTituloNumero"
            type="text"
            placeholder="Nº do Título (se houver)"
            name="processoTituloNumero"
            value={formState.processoTituloNumero}
            onChange={handleFieldChange}
            className="input"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="varaOriginaria" className="label">
            Vara onde tramitou
          </label>
          <input
            id="varaOriginaria"
            type="text"
            placeholder="Vara onde tramitou"
            name="varaOriginaria"
            value={formState.varaOriginaria}
            onChange={handleFieldChange}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="tipoDecisao" className="label">
            Tipo da Decisão
          </label>
          <input
            id="tipoDecisao"
            type="text"
            placeholder="Ex: Acordo, Sentença, Decisão..."
            name="tipoDecisao"
            value={formState.tipoDecisao}
            onChange={handleFieldChange}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="diaPagamentoFixado" className="label">
            Dia do Pagamento fixado (1-31)
          </label>
          <input
            id="diaPagamentoFixado"
            type="number"
            min="1"
            max="31"
            placeholder="Dia (1-31)"
            name="diaPagamentoFixado"
            value={formState.diaPagamentoFixado}
            onChange={handleDayInputChange("diaPagamentoFixado")}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="dataInicioDebito" className="label font-bold text-">
            Início do Débito (Mês/Ano) *
          </label>
          <input
            id="dataInicioDebito"
            type="text"
            inputMode="numeric"
            placeholder="MM/AAAA"
            name="dataInicioDebito"
            value={formState.dataInicioDebito || ""}
            onChange={handleMonthYearChange("dataInicioDebito")}
            className="input"
            {...validar("Informe o mês e ano inicial do débito (MM/AAAA).")}
          />
          {formErrors.dataInicioDebito && (
            <p className="text-xs text-error font-medium mt-1">
              {formErrors.dataInicioDebito}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="dataFimDebito" className="label font-bold text-">
            Fim do Débito (Mês/Ano) *
          </label>
          <input
            id="dataFimDebito"
            type="text"
            inputMode="numeric"
            placeholder="MM/AAAA"
            name="dataFimDebito"
            value={formState.dataFimDebito || ""}
            onChange={handleMonthYearChange("dataFimDebito")}
            className="input"
            {...validar("Informe o mês e ano final do débito (MM/AAAA).")}
          />
          {formErrors.dataFimDebito && (
            <p className="text-xs text-error font-medium mt-1">
              {formErrors.dataFimDebito}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="valorTotalDebitoExecucao" className="label">
            Valor Total do Débito
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold">
              R$
            </span>
            <input
              id="valorTotalDebitoExecucao"
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              name="valorTotalDebitoExecucao"
              value={formState.valorTotalDebitoExecucao}
              onChange={handleCurrencyChange("valorTotalDebitoExecucao")}
              className="input pl-12"
            />
          </div>
        </div>

      </div>
    </div>
  );
};



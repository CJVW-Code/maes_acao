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
  const isCustomDecision = !['', 'Sentença', 'Interlocutória', 'Acordo homologado'].includes(formState.tipoDecisao);
  const selectedDecision = isCustomDecision && formState.tipoDecisao ? 'Outros' : formState.tipoDecisao;

  return (
    <div className="space-y-4 pt-4 border-t border-soft">
      <h4 className="font-semibold text-primary">
        Dados do Processo de Alimentos Original
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="vara" className="label font-bold ">
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
          <label
            htmlFor="percentualSalarioMinimo"
            className="label font-bold text-"
          >
            Percentual do Salário Mínimo (%)
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
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-bold">
              %
            </span>
          </div>
        </div>
        <div>
          <label htmlFor="valorMensalFixado" className="label font-bold ">
            Ou Valor Mensal Fixo (R$)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold">
              R$
            </span>
            <input
              id="valorMensalFixado"
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              name="valorMensalFixado"
              value={formState.valorMensalFixado}
              onChange={handleCurrencyChange("valorMensalFixado")}
              className="input pl-12 border-primary/50"
            />
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
          <label htmlFor="cidadeOriginaria" className="label">
            Cidade onde tramitou (Cidade Originária)
          </label>
          <input
            id="cidadeOriginaria"
            type="text"
            placeholder="Ex: Salvador"
            name="cidadeOriginaria"
            value={formState.cidadeOriginaria || ""}
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
          <select
            id="tipoDecisao"
            name="tipoDecisao"
            value={selectedDecision}
            onChange={(e) => {
              // Quando o usuário seleciona algo
              if (e.target.value === 'Outros') {
                // Ao escolher outros, limpamos para que ele veja o input
                handleFieldChange({ target: { name: 'tipoDecisao', value: '' } });
              } else {
                handleFieldChange(e);
              }
            }}
            className="input mb-2"
          >
            <option value="">Selecione...</option>
            <option value="Sentença">Sentença</option>
            <option value="Interlocutória">Interlocutória</option>
            <option value="Acordo homologado">Acordo homologado</option>
            <option value="Outros">Outros</option>
          </select>
          
          {selectedDecision === 'Outros' && (
             <input
               id="tipoDecisaoCustom"
               type="text"
               placeholder="Escreva o tipo da decisão..."
               name="tipoDecisao"
               value={formState.tipoDecisao}
               onChange={handleFieldChange}
               className="input mt-2 border-primary/50 animate-fade-in"
               autoFocus
             />
          )}
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

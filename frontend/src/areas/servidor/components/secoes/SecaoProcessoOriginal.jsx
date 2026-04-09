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
  const isCustomDecision = !['', 'Sentença', 'Interlocutória', 'Acordo homologado'].includes(formState.tipo_decisao);
  const selectedDecision = isCustomDecision && formState.tipo_decisao ? 'Outros' : formState.tipo_decisao;

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
            name="VARA"
            value={formState.VARA}
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
              name="percentual_salario_minimo"
              value={formState.percentual_salario_minimo}
              onChange={handleFieldChange}
              className="input border-primary/50 pr-10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-bold">
              %
            </span>
          </div>
        </div>
        {/* Campo "Valor Mensal Fixo" removido conforme solicitação */}
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
            name="processoOrigemNumero"
            value={formState.processoOrigemNumero}
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
            name="tipo_decisao"
            value={['', 'Sentença', 'Interlocutória', 'Acordo homologado'].includes(formState.tipo_decisao) ? formState.tipo_decisao : 'Outros'}
            onChange={(e) => {
              if (e.target.value === 'Outros') {
                handleFieldChange({ target: { name: 'tipo_decisao', value: 'Outra decisão...' } });
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
          
          {!['', 'Sentença', 'Interlocutória', 'Acordo homologado'].includes(formState.tipo_decisao) && (
             <input
               id="tipo_decisao_custom"
               type="text"
               placeholder="Escreva o tipo da decisão..."
               name="tipo_decisao"
               value={formState.tipo_decisao === 'Outra decisão...' ? '' : formState.tipo_decisao}
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
            id="dia_pagamento"
            type="number"
            min="1"
            max="31"
            placeholder="Dia (1-31)"
            name="dia_pagamento"
            value={formState.dia_pagamento}
            onChange={handleDayInputChange("dia_pagamento")}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="dataInicioDebito" className="label font-bold text-">
            Início do Débito (Mês/Ano) *
          </label>
          <input
            id="data_inicio_debito"
            type="text"
            inputMode="numeric"
            placeholder="MM/AAAA"
            name="data_inicio_debito"
            value={formState.data_inicio_debito || ""}
            onChange={handleMonthYearChange("data_inicio_debito")}
            className="input"
            {...validar("Informe o mês e ano inicial do débito (MM/AAAA).")}
          />
          {formErrors.data_inicio_debito && (
            <p className="text-xs text-error font-medium mt-1">
              {formErrors.data_inicio_debito}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="dataFimDebito" className="label font-bold text-">
            Fim do Débito (Mês/Ano) *
          </label>
          <input
            id="data_fim_debito"
            type="text"
            inputMode="numeric"
            placeholder="MM/AAAA"
            name="data_fim_debito"
            value={formState.data_fim_debito || ""}
            onChange={handleMonthYearChange("data_fim_debito")}
            className="input"
            {...validar("Informe o mês e ano final do débito (MM/AAAA).")}
          />
          {formErrors.data_fim_debito && (
            <p className="text-xs text-error font-medium mt-1">
              {formErrors.data_fim_debito}
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
              id="valor_debito"
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              name="valor_debito"
              value={formState.valor_debito}
              onChange={handleCurrencyChange("valor_debito")}
              className="input pl-12"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

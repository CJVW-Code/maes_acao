// SecaoValoresPensao.jsx
// Renderiza: valor mensal da pensao + dados bancarios para deposito

import React from "react";

export const SecaoValoresPensao = ({
  formState,
  handleFieldChange,
  handleCurrencyChange,
  handleRestrictedAlphanumeric,
  validar,
  formErrors = {},
}) => {
  const isExecucaoAlimentos = formState?.acaoEspecifica === "execucao_alimentos";

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-primary">
        {isExecucaoAlimentos
          ? "Dados para Deposito (Execucao)"
          : "Valores e Pagamento (Pedido Principal)"}
      </h4>

      {formState?.acaoEspecifica === "fixacao_alimentos" && (
        <div className="mb-4">
          <label htmlFor="vara" className="label font-bold ">
            Vara da Petição Atual (ex: 1ª ) Apenas numero
          </label>
          <input
            id="vara"
            type="text"
            placeholder="Ex: 1ª Vara de Família"
            name="VARA"
            value={formState.VARA}
            onChange={handleFieldChange}
            className={`input ${formErrors.VARA ? "border-error ring-1 ring-error" : "border-primary/50"}`}
          />
          {formErrors.VARA && (
            <span className="text-xs text-error mt-1 ml-1">{formErrors.VARA}</span>
          )}
        </div>
      )}

      {!isExecucaoAlimentos && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="valor_pensao" className="label">
              Valor Mensal da Pensão *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold">
                R$
              </span>
              <input
                id="valor_pensao"
                type="text"
                inputMode="numeric"
                name="valor_pensao"
                value={formState.valor_pensao}
                onChange={handleCurrencyChange("valor_pensao")}
                placeholder="0,00 *"
                className={`input pl-12 ${formErrors.valor_pensao ? "border-error ring-1 ring-error" : ""}`}
                {...validar("Informe o valor da pensão.")}
              />
            </div>
            {formErrors.valor_pensao && (
              <span className="text-xs text-error mt-1 ml-1">{formErrors.valor_pensao}</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-soft p-4 bg-surface">
        <h4 className="font-semibold text-text">Dados para Deposito da Pensao</h4>
        <div>
          <label htmlFor="tipoContaDeposito" className="label">
            Tipo de Conta
          </label>
          <select
            id="tipoContaDeposito"
            name="tipo_conta_deposito"
            value={formState.tipo_conta_deposito}
            onChange={handleFieldChange}
            className="input"
          >
            <option value="">Tipo de Conta</option>
            <option value="corrente_poupanca">Conta Corrente / Poupanca</option>
            <option value="pix">PIX</option>
            <option value="outro">Outro / Nao sei</option>
          </select>
        </div>

        {formState.tipo_conta_deposito === "corrente_poupanca" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              name="banco_deposito"
              value={formState.banco_deposito}
              onChange={handleFieldChange}
              placeholder="Nome do Banco"
              className="input"
            />
            <input
              type="text"
              name="agencia_deposito"
              value={formState.agencia_deposito}
              onChange={handleRestrictedAlphanumeric}
              placeholder="Agencia"
              className="input"
            />
            <input
              type="text"
              name="conta_operacao"
              value={formState.conta_operacao || ""}
              onChange={handleRestrictedAlphanumeric}
              placeholder="Operação (opcional)"
              className="input"
            />
            <input
              type="text"
              name="conta_deposito"
              value={formState.conta_deposito}
              onChange={handleRestrictedAlphanumeric}
              placeholder="Conta com dígito"
              className="input"
            />
          </div>
        )}

        {formState.tipo_conta_deposito === "pix" && (
          <div>
            <label htmlFor="chavePixDeposito" className="label">
              Chave PIX
            </label>
            <input
              id="chavePixDeposito"
              type="text"
              name="chave_pix_deposito"
              value={formState.chave_pix_deposito}
              onChange={handleFieldChange}
              placeholder="CPF, e-mail, telefone, etc."
              className="input"
            />
          </div>
        )}

        {formState.tipo_conta_deposito === "outro" && (
          <div>
            <label htmlFor="outrosDadosDeposito" className="label">
              Descreva os dados que voce possui
            </label>
            <textarea
              id="outrosDadosDeposito"
              name="outros_dados_deposito"
              value={formState.outros_dados_deposito}
              onChange={handleFieldChange}
              rows="2"
              className="input"
              placeholder="Informe todos os dados para deposito que voce tiver"
            ></textarea>
          </div>
        )}
      </div>
    </div>
  );
};

// SecaoValoresPensao.jsx
// Renderiza: valor mensal da pensao + dados bancarios para deposito

import React from "react";

export const SecaoValoresPensao = ({
  formState,
  handleFieldChange,
  handleCurrencyChange,
  validar,
}) => {
  const isExecucaoAlimentos = formState?.acaoEspecifica === "execucao_alimentos";

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-primary">
        {isExecucaoAlimentos
          ? "Dados para Deposito (Execucao)"
          : "Valores e Pagamento (Pedido Principal)"}
      </h4>

      {!isExecucaoAlimentos && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="valorMensalPensao" className="label">
              Valor Mensal da Pensao e Despesas Extras
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold">
                R$
              </span>
              <input
                id="valorMensalPensao"
                type="text"
                inputMode="numeric"
                name="valorMensalPensao"
                value={formState.valorMensalPensao}
                onChange={handleCurrencyChange("valorMensalPensao")}
                placeholder="0,00"
                className="input pl-12"
                {...validar("Informe o valor da pensao.")}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-lg border border-soft p-4 bg-surface">
        <h4 className="font-semibold text-text">Dados para Deposito da Pensao</h4>
        <div>
          <label htmlFor="tipoContaDeposito" className="label">Tipo de Conta</label>
          <select
            id="tipoContaDeposito"
            name="tipoContaDeposito"
            value={formState.tipoContaDeposito}
            onChange={handleFieldChange}
            className="input"
          >
            <option value="">Tipo de Conta</option>
            <option value="corrente_poupanca">Conta Corrente / Poupanca</option>
            <option value="pix">PIX</option>
            <option value="outro">Outro / Nao sei</option>
          </select>
        </div>

        {formState.tipoContaDeposito === "corrente_poupanca" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              name="bancoDeposito"
              value={formState.bancoDeposito}
              onChange={handleFieldChange}
              placeholder="Nome do Banco"
              className="input"
            />
            <input
              type="text"
              name="agenciaDeposito"
              value={formState.agenciaDeposito}
              onChange={handleFieldChange}
              placeholder="Agencia"
              className="input"
            />
            <input
              type="text"
              name="contaDeposito"
              value={formState.contaDeposito}
              onChange={handleFieldChange}
              placeholder="Conta com digito"
              className="input"
            />
          </div>
        )}

        {formState.tipoContaDeposito === "pix" && (
          <div>
            <label htmlFor="chavePixDeposito" className="label">Chave PIX</label>
            <input
              id="chavePixDeposito"
              type="text"
              name="chavePixDeposito"
              value={formState.chavePixDeposito}
              onChange={handleFieldChange}
              placeholder="CPF, e-mail, telefone, etc."
              className="input"
            />
          </div>
        )}

        {formState.tipoContaDeposito === "outro" && (
          <div>
            <label htmlFor="outrosDadosDeposito" className="label">
              Descreva os dados que voce possui
            </label>
            <textarea
              id="outrosDadosDeposito"
              name="outrosDadosDeposito"
              value={formState.outrosDadosDeposito}
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

// SecaoDadosDivorcio.jsx
// Extraído de StepDetalhesCaso linhas 261-307
// Renderiza: regime de bens, retorno nome solteira, alimentos para ex-cônjuge

import React from "react";

export const SecaoDadosDivorcio = ({
  formState,
  handleFieldChange,
}) => {
  return (
    <div className="space-y-4 pt-4 border-t border-soft">
      <h4 className="font-semibold text-primary">Dados do Divórcio</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="regimeBens" className="label">Regime de Bens do Casamento</label>
          <input
            id="regimeBens"
            type="text"
            name="regimeBens"
            value={formState.regimeBens}
            onChange={handleFieldChange}
            placeholder="Ex: Comunhão Parcial de Bens"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="retornoNomeSolteira" className="label">
            Deseja voltar a usar o nome de solteira?
          </label>
          <select
            id="retornoNomeSolteira"
            name="retornoNomeSolteira"
            value={formState.retornoNomeSolteira}
            onChange={handleFieldChange}
            className="input"
          >
            <option value="">Voltar ao nome de solteira?</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="alimentosParaExConjuge" className="label">
          Haverá pedido de pensão para o(a) ex-cônjuge?
        </label>
        <input
          id="alimentosParaExConjuge"
          type="text"
          name="alimentosParaExConjuge"
          value={formState.alimentosParaExConjuge}
          onChange={handleFieldChange}
          placeholder="Ex: Sim, no valor de R$ 500"
          className="input"
        />
      </div>
    </div>
  );
};

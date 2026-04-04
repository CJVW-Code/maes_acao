// SecaoCamposGeraisFamilia.jsx
// Extraído de StepDetalhesCaso linhas 309-353
// Renderiza: guarda, bens a partilhar (condicional), situação financeira
// Controlado por camposGerais do dicionário de configuração.

import React from "react";

export const SecaoCamposGeraisFamilia = ({
  formState,
  handleFieldChange,
  camposGerais = {},
}) => {
  const { 
    mostrarBensPartilha = true,
    ocultarDetalhesGerais = false
  } = camposGerais;

  return (
    <div className="space-y-4 pt-4 border-t border-soft">
      {!ocultarDetalhesGerais && (
        <>
          <h4 className="font-semibold text-primary">Vínculos, Guarda...</h4>
          <div>
            <label htmlFor="descricaoGuarda" className="label">
              Como a guarda dos filhos é exercida hoje?
            </label>
            <textarea
              id="descricaoGuarda"
              name="descricaoGuarda"
              value={formState.descricaoGuarda}
              onChange={handleFieldChange}
              rows="2"
              placeholder="Ex: A guarda de fato é minha, e o pai visita aos fins de semana."
              className="input"
            ></textarea>
          </div>
        </>
      )}
      {mostrarBensPartilha && (
        <div>
          <label htmlFor="bensPartilha" className="label">
            Bens a Partilhar (Carros, Casas, Móveis)
          </label>
          <textarea
            id="bensPartilha"
            name="bensPartilha"
            value={formState.bensPartilha}
            onChange={handleFieldChange}
            rows="2"
            placeholder="Descreva os bens e se há acordo sobre a divisão"
            className="input"
          ></textarea>
        </div>
      )}
      {!ocultarDetalhesGerais && (
        <div>
          <label htmlFor="situacaoFinanceiraGenitora" className="label">
            Situação Financeira de quem cuida dos filhos
          </label>
          <textarea
            id="situacaoFinanceiraGenitora"
            name="situacaoFinanceiraGenitora"
            value={formState.situacaoFinanceiraGenitora}
            onChange={handleFieldChange}
            rows="2"
            placeholder="Descreva brevemente sua situação financeira (renda, ajuda de familiares, etc.)"
            className="input"
          ></textarea>
        </div>
      )}
    </div>
  );
};

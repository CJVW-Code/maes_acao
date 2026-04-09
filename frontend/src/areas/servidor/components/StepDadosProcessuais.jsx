import React from 'react';
import { DollarSign } from 'lucide-react';

const StepDadosProcessuais = ({
  formState,
  handleCidadeChange,
  mostrarSugestoes,
  sugestoesCidades,
  handleSelecionaCidade,
  setMostrarSugestoes
}) => {
  return (
    <section className="card space-y-4 border-l-4 border-l-purple-500">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="text-purple-400" />
        <h2 className="heading-2">Dados Processuais</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <label className="label">Cidade para assinatura</label>
          <input
            type="text"
            name="CIDADEASSINATURA"
            value={formState.CIDADEASSINATURA}
            onChange={handleCidadeChange}
            onBlur={() =>
              setTimeout(() => setMostrarSugestoes(false), 150)
            }
            placeholder="Ex: Teixeira de Freitas"
            className="input"
            autoComplete="off"
          />
          {mostrarSugestoes && sugestoesCidades.length > 0 && (
            <ul className="absolute z-10 w-full bg-surface border border-soft rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
              {sugestoesCidades.map((cidade) => (
                <li
                  key={cidade}
                  onMouseDown={() => handleSelecionaCidade(cidade)}
                  className="p-2 hover:bg-app cursor-pointer"
                >
                  {cidade}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};

export default StepDadosProcessuais;
// SecaoEmpregoRequerido.jsx
// Extraído de StepDetalhesCaso linhas 134-187
// Renderiza: emprego formal do requerido + campos condicionais de empregador

import React from "react";

export const SecaoEmpregoRequerido = ({ formState, handleFieldChange }) => {
  const mostrarEmpregador = formState.requerido_tem_emprego_formal === "sim";

  return (
    <div className="space-y-4 pt-4 border-t border-soft">
      <h4 className="font-semibold text-primary">Sobre o Emprego da Outra Parte (para ofício)</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="requeridoTemEmpregoFormal" className="label">
            A outra parte tem carteira assinada?
          </label>
          <select
            id="requeridoTemEmpregoFormal"
            name="requerido_tem_emprego_formal"
            value={formState.requerido_tem_emprego_formal}
            onChange={handleFieldChange}
            className="input"
          >
            <option value="">Tem carteira assinada?</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
            <option value="nao_sei">Não sei</option>
          </select>
        </div>
        {mostrarEmpregador && (
          <>
            <div>
              <label htmlFor="empregadorRequeridoNome" className="label">
                Nome da Empresa
              </label>
              <input
                id="empregadorRequeridoNome"
                type="text"
                placeholder="Nome da Empresa"
                name="empregador_nome"
                value={formState.empregador_nome}
                onChange={handleFieldChange}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="empregadorRequeridoEndereco" className="label">
                Endereço da Empresa
              </label>
              <input
                id="empregadorRequeridoEndereco"
                type="text"
                placeholder="Endereço da Empresa"
                name="empregador_endereco"
                value={formState.empregador_endereco}
                onChange={handleFieldChange}
                className="input"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="empregadorEmail" className="label">
                Email da Empresa
              </label>
              <input
                id="empregadorEmail"
                type="email"
                placeholder="Email da Empresa"
                name="empregador_email"
                value={formState.empregador_email}
                onChange={handleFieldChange}
                className="input"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

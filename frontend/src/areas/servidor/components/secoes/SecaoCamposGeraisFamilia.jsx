// SecaoCamposGeraisFamilia.jsx
// Renderiza: guarda e direito de convivência/visitas (toggle + textarea condicional)
// Controlado por camposGerais do dicionário de configuração.

import React from "react";

export const SecaoCamposGeraisFamilia = ({
  formState,
  handleFieldChange,
  camposGerais = {},
  formErrors = {},
}) => {
  const {
    ocultarDetalhesGerais = false,
  } = camposGerais;

  if (ocultarDetalhesGerais) return null;

  // Opção de guarda: "nao" | "regularizar" | undefined (não selecionado)
  const opcaoGuarda = formState.opcaoGuarda || "";
  const querRegularizar = opcaoGuarda === "regularizar";

  function handleOpcaoGuarda(valor) {
    // Dispara como se fosse um evento de campo normal
    handleFieldChange({ target: { name: "opcaoGuarda", value: valor } });
    // Se desmarcou "regularizar", limpa a descrição
    if (valor !== "regularizar") {
      handleFieldChange({ target: { name: "descricaoGuarda", value: "" } });
    }
  }

  return (
    <div className={`space-y-4 pt-4 border-t ${formErrors.opcaoGuarda ? "border-error bg-error/5 p-4 rounded-xl" : "border-soft"}`}>
      <h4 className={`font-semibold ${formErrors.opcaoGuarda ? "text-error" : "text-primary"}`}>
        Guarda da Criança e Direito de Convivência / Visitas *
      </h4>

      {/* Toggle de opção */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="radio"
            name="opcaoGuarda"
            value="nao"
            checked={opcaoGuarda === "nao"}
            onChange={() => handleOpcaoGuarda("nao")}
            className="accent-primary w-4 h-4"
          />
          <span className="label mb-0">Não desejo entrar com pedido de guarda</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="radio"
            name="opcaoGuarda"
            value="regularizar"
            checked={opcaoGuarda === "regularizar"}
            onChange={() => handleOpcaoGuarda("regularizar")}
            className="accent-primary w-4 h-4"
          />
          <span className="label mb-0">Quero regularizar a guarda e o direito de visitas</span>
        </label>
      </div>

      {formErrors.opcaoGuarda && (
        <span className="text-xs text-error font-medium block mt-1">
          {formErrors.opcaoGuarda}
        </span>
      )}

      {/* Textarea condicional */}
      {querRegularizar && (
        <div className="pt-2 animate-in fade-in slide-in-from-top-1">
          <label htmlFor="descricaoGuarda" className="label">
            Descreva como será a guarda e o direito de visitas *
          </label>
          <textarea
            id="descricaoGuarda"
            name="descricaoGuarda"
            value={formState.descricaoGuarda || ""}
            onChange={handleFieldChange}
            rows="4"
            placeholder="Ex: A guarda será compartilhada, a residência fixa da minha filha será na minha casa. O pai poderá visitar todos os finais de semana, buscando a criança na sexta-feira às 17 horas."
            className={`input ${formErrors.descricaoGuarda ? "border-error ring-1 ring-error" : ""}`}
          ></textarea>
          {formErrors.descricaoGuarda && (
            <span className="text-xs text-error mt-1 block">
              {formErrors.descricaoGuarda}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

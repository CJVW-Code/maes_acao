import React, { useState, useEffect } from "react";

export const EnderecoInput = ({
  label = "Endereço Residencial *",
  name,
  value,
  onChange,
  className = "",
  placeholder = "Ex: Rua, Número, Bairro, Cidade, CEP",
  error = "",
}) => {
  void placeholder;
  // Try to parse the value if it's already a JSON or formatted string
  const [address, setAddress] = useState({
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    cep: "",
  });

  // Sincroniza o estado interno com o valor vindo de fora (útil para pre-fill)
  useEffect(() => {
    if (value && typeof value === "string") {
      const newAddress = { rua: "", numero: "", complemento: "", bairro: "", cidade: "", cep: "" };
      const regexMap = {
        rua: /Rua: ([^,]*)/,
        numero: /Número: ([^,]*)/,
        complemento: /Complemento: ([^,]*)/,
        bairro: /Bairro: ([^,]*)/,
        cidade: /Cidade: ([^,]*)/,
        cep: /CEP: ([^,]*)/
      };

      Object.keys(regexMap).forEach(key => {
        const match = value.match(regexMap[key]);
        if (match) newAddress[key] = match[1].trim();
      });

      setAddress(newAddress);
    } else if (!value) {
      // Se o valor for limpo externamente, limpa aqui também
      setAddress({ rua: "", numero: "", complemento: "", bairro: "", cidade: "", cep: "" });
    }
  }, [value]);

  const handleChange = (e) => {
    const { name: fieldName, value: fieldValue } = e.target;
    
    let processedValue = fieldValue;

    // Restrição específica para CEP: apenas números e caracteres especiais (., -, /), sem letras
    if (fieldName === "cep") {
      if (!/^[0-9.\-/]*$/.test(fieldValue)) {
        return;
      }
      // Aplicar máscara básica de CEP (00000-000)
      const digits = fieldValue.replace(/\D/g, "").slice(0, 8);
      if (digits.length <= 5) {
        processedValue = digits;
      } else {
        processedValue = `${digits.slice(0, 5)}-${digits.slice(5)}`;
      }
    }

    // Using a functional state update to ensure the latest state
    setAddress((prev) => {
      const newAddress = { ...prev, [fieldName]: processedValue };
      
      // Combine into a single string
      const partes = [];
      if (newAddress.rua) partes.push(`Rua: ${newAddress.rua}`);
      if (newAddress.numero) partes.push(`Número: ${newAddress.numero}`);
      if (newAddress.complemento) partes.push(`Complemento: ${newAddress.complemento}`);
      if (newAddress.bairro) partes.push(`Bairro: ${newAddress.bairro}`);
      if (newAddress.cidade) partes.push(`Cidade: ${newAddress.cidade}`);
      if (newAddress.cep) partes.push(`CEP: ${newAddress.cep}`);
      
      const fullAddress = partes.join(", ");
      
      // Send to parent
      if (onChange) {
        onChange({
          target: {
            name,
            value: fullAddress
          }
        });
      }
      
      return newAddress;
    });
  };

  const isCepError = error && (error.toLowerCase().includes("cep") || error.toLowerCase().includes("inválido"));

  return (
    <div className={`p-4 rounded-lg border ${error ? "border-error ring-1 ring-error" : "border-soft"} bg-surface-alt space-y-4 ${className}`}>
      <label className="block text-sm font-semibold mb-2">{label}</label>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-3">
          <input
            type="text"
            name="rua"
            placeholder="Rua / Avenida *"
            value={address.rua}
            onChange={handleChange}
            className="input w-full"
          />
        </div>
        <div>
          <input
            type="text"
            name="numero"
            placeholder="Número *"
            value={address.numero}
            onChange={handleChange}
            className="input w-full"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          name="complemento"
          placeholder="Complemento (Apto, Bloco)"
          value={address.complemento}
          onChange={handleChange}
          className="input w-full"
        />
        <input
          type="text"
          name="bairro"
          placeholder="Bairro *"
          value={address.bairro}
          onChange={handleChange}
          className="input w-full"
        />
        <input
          type="text"
          name="cidade"
          placeholder="Cidade / Município *"
          value={address.cidade}
          onChange={handleChange}
          className="input w-full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          name="cep"
          placeholder="00000-000 *"
          value={address.cep}
          onChange={handleChange}
          className={`input w-full md:col-span-1 ${isCepError ? "bg-red-50 dark:bg-red-900/10 border-red-300" : ""}`}
        />
      </div>
    </div>
  );
};

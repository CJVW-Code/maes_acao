import React from "react";
import { SECAO_REGISTRY } from "../../../config/formularios/secaoRegistry";

export const SecaoRenderer = ({ tipo, ...props }) => {
  const Componente = SECAO_REGISTRY[tipo];

  if (!Componente) {
    if (import.meta.env.DEV) {
      console.warn(`[SecaoRenderer] Seção não encontrada no registry: "${tipo}"`);
    }
    return null;
  }

  return <Componente {...props} />;
};

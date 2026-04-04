import { authFetch } from "./apiBase";

// src/utils/fetcher.js
export const fetcher = async (url) => {
  const response = await authFetch(url);

  if (!response.ok) {
    let errorMsg = "Erro ao buscar dados da API";
    try {
      const errData = await response.json();
      if (errData.error || errData.message) {
        errorMsg = errData.error || errData.message;
      }
    } catch (e) {
      // Ignora erro de parse se não for JSON
    }
    throw new Error(errorMsg);
  }

  return response.json();
};

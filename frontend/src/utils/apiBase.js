export function getApiBase() {
  try {
    const envUrl =
      (typeof import.meta !== "undefined" &&
        import.meta &&
        import.meta.env &&
        import.meta.env.VITE_API_URL) ||
      "";
    if (envUrl) {
      return envUrl.replace(/\/$/, "");
    }
  } catch (_) {
    // ignore
  }

  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.origin
  ) {
    const origin = window.location.origin;
    if (/localhost|127\.0\.0\.1/.test(origin)) {
      return "http://localhost:8001/api";
    }
    return origin.replace(/\/$/, "");
  }

  return "http://localhost:8001/api";
}

export const API_BASE = getApiBase();

export const authFetch = async (endpoint, options = {}) => {
  // 1. Pega o token atual
  const token = localStorage.getItem("defensorToken");

  // 2. Prepara os headers padrão
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // 3. Injeta o Token se existir
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 4. Faz a requisição
  // Nota: endpoint não precisa incluir API_BASE se passar só o caminho (ex: '/casos')
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // 5. DETECTA SESSÃO EXPIRADA
  if (response.status === 401) {
    // Dispara o evento que o AuthContext vai escutar
    window.dispatchEvent(new Event("auth:session-expired"));
    throw new Error("Sessão expirada");
  }

  return response;
};

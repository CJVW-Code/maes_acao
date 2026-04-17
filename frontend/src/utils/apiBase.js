export function getApiBase() {
  // 1. A variável de ambiente é a fonte da verdade.
  let envUrl =
    (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) ||
    "";

  if (envUrl) {
    envUrl = envUrl.replace(/\/$/, "");
    if (!envUrl.endsWith("/api")) {
      envUrl = `${envUrl}/api`;
    }
    return envUrl;
  }

  // 2. Detecção de Desenvolvimento robusta
  const isLocalhost = 
    typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || 
     window.location.hostname === "127.0.0.1" ||
     window.location.hostname.startsWith("192.168."));
  
  const isDevMode =
    (typeof import.meta !== "undefined" && import.meta?.env?.DEV) || false;

  if (isLocalhost || isDevMode) {
    console.warn(
      `Modo de desenvolvimento detectado (Host: ${typeof window !== "undefined" ? window.location.hostname : 'N/A'}). Usando API: http://localhost:8000/api`,
    );
    return "http://localhost:8000/api";
  }

  // 3. Produção sem variável de ambiente
  console.error(
    "ERRO CRÍTICO: VITE_API_URL não definida em produção. As chamadas irão falhar.",
  );

  return "";
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
    // 1. Limpa imediatamente o storage para evitar loops
    localStorage.removeItem("defensorToken");
    localStorage.removeItem("defensorUser");

    // 2. Dispara o evento que o AuthContext vai escutar para redirecionar
    try {
      if (typeof window !== "undefined") {
        let event;
        try {
          event = new CustomEvent("auth:session-expired");
        } catch {
          event = document.createEvent("Event");
          event.initEvent("auth:session-expired", true, true);
        }
        window.dispatchEvent(event);
      }
    } catch (e) {
      console.warn("Falha crítica ao disparar evento de expiração:", e);
    }

    // 3. Lança erro padronizado
    throw new Error("Sessão expirada");
  }

  return response;
};

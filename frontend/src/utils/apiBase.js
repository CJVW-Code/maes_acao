export function getApiBase() {
  // 1. A variável de ambiente é a fonte da verdade.
  // Ela DEVE estar configurada em produção (Vercel).
  let envUrl =
    (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) ||
    "";

  if (envUrl) {
    // Normaliza a URL: remove barra no final primeiro
    envUrl = envUrl.replace(/\/$/, "");

    // Se a URL não terminar com /api, nós adicionamos para evitar erros de rota
    if (!envUrl.endsWith("/api")) {
      envUrl = `${envUrl}/api`;
    }

    return envUrl;
  }

  // 2. Se a variável não existe, verificamos se estamos em desenvolvimento.
  // O Vite injeta `import.meta.env.DEV` como `true` ao rodar `npm run dev`.
  const isDev =
    (typeof import.meta !== "undefined" && import.meta?.env?.DEV) || false;

  if (isDev) {
    console.warn(
      "Atenção: VITE_API_URL não definida. Usando fallback para desenvolvimento local: http://localhost:8000/api",
    );
    // O guia de desenvolvimento menciona a porta 8001 para Docker, mas o código original usa 8000. Mantendo 8000.
    return "http://localhost:8000/api";
  }

  // 3. Se chegou aqui em produção, é um erro de configuração.
  // Logamos um erro claro e retornamos a própria origem para que o erro 405 aconteça,
  // tornando o problema de configuração óbvio, como aconteceu com você.
  console.error(
    "ERRO CRÍTICO DE CONFIGURAÇÃO: A variável de ambiente VITE_API_URL não foi encontrada no ambiente de produção (Vercel). As chamadas à API irão falhar.",
  );

  // Fallback final, improvável de ser alcançado em um navegador.
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
    // Dispara o evento que o AuthContext vai escutar de forma ultra-resiliente
    try {
      if (typeof window !== "undefined") {
        // Tenta o método moderno primeiro
        let event;
        try {
          event = new CustomEvent("auth:session-expired");
        } catch (e) {
          // Fallback para navegadores/ambientes com restrição de constructor
          event = document.createEvent("Event");
          event.initEvent("auth:session-expired", true, true);
        }
        window.dispatchEvent(event);
      }
    } catch (e) {
      console.warn("Falha crítica ao disparar evento de expiração:", e);
    }
    throw new Error("Sessão expirada");
  }

  return response;
};

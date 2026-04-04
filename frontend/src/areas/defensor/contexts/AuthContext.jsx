import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from "react";
import { API_BASE } from "../../../utils/apiBase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("defensorToken"));
  const [loading, setLoading] = useState(true);
  const [notificacoes, setNotificacoes] = useState([]);
  const intervalRef = useRef(null);

  // Busca notificações — definida com useCallback para ser referência estável
  const fetchNotificacoes = useCallback(async (currentToken) => {
    if (!currentToken) return;
    try {
      const response = await fetch(`${API_BASE}/casos/notificacoes`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (response.status === 401) {
        logout();
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setNotificacoes(data);
      }
    } catch (error) {
      console.error("Erro ao buscar notificações", error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Inicia ou para o polling conforme disponibilidade do token
  useEffect(() => {
    if (token) {
      fetchNotificacoes(token);
      intervalRef.current = setInterval(() => fetchNotificacoes(token), 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, fetchNotificacoes]);

  useEffect(() => {
    const initAuth = async () => {
      const storedUser = localStorage.getItem("defensorUser");
      const storedToken = localStorage.getItem("defensorToken");

      if (storedToken && storedUser) {
        try {
          // PROTEÇÃO: Verifica se não é "undefined" texto
          if (storedUser !== "undefined" && storedUser !== "null") {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
          } else {
            // Se tiver lixo, limpa
            localStorage.removeItem("defensorUser");
            localStorage.removeItem("defensorToken");
          }
        } catch (e) {
          console.error("Erro crítico ao ler usuário:", e);
          // Se der erro no JSON, limpa tudo para não travar o app
          localStorage.removeItem("defensorUser");
          localStorage.removeItem("defensorToken");
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleSessionExpired = () => {
      console.warn("Sessão expirada. Fazendo logout...");
      logout();
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);

    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  const login = async (email, senha) => {
    try {
      const response = await fetch(`${API_BASE}/defensores/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro no login");
      }

      const data = await response.json();
      const userObj = data.defensor;

      localStorage.setItem("defensorToken", data.token);
      localStorage.setItem("defensorUser", JSON.stringify(userObj));

      setToken(data.token);
      setUser(userObj);

      return true;
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("defensorToken");
    localStorage.removeItem("defensorUser");
    setToken(null);
    setUser(null);
    setNotificacoes([]);
    // Redirecionamento seguro
    window.location.href = "/painel/login";
  };

  const marcarNotificacaoLida = async (id) => {
    try {
      await fetch(`${API_BASE}/casos/notificacoes/${id}/lida`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
      );
    } catch (error) {
      console.error("Erro ao marcar como lida", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        loading,
        notificacoes,
        marcarNotificacaoLida,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


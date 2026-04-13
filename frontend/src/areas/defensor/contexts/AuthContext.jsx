import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from "react";
import { API_BASE, authFetch } from "../../../utils/apiBase";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificacoes, setNotificacoes] = useState([]);
  const intervalRef = useRef(null);

  // Busca notificações
  const fetchNotificacoes = useCallback(async (currentToken) => {
    if (!currentToken) return;
    try {
      const response = await authFetch("/casos/notificacoes");
      // Resposta 401 já é gerada dentro do authFetch disparando o logout
      if (response.ok) {
        const data = await response.json();
        setNotificacoes(data);
      }
    } catch (error) {
      if (error.message !== "Sessão expirada") {
        console.error("Erro ao buscar notificações", error);
      }
    }
  }, []);

  // Inicializa estado do Auth a partir do LocalStorage
  useEffect(() => {
    const storedToken = localStorage.getItem("defensorToken");
    const storedUser = localStorage.getItem("defensorUser");

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Erro ao parsear usuário logado", e);
      }
    }
    setLoading(false);
  }, []);

  // Escuta evento global de sessão expirada
  useEffect(() => {
    const handleExpired = () => {
      console.warn("🔐 Sessão expirada detectada pelo context. Deslogando...");
      logout();
    };

    window.addEventListener("auth:session-expired", handleExpired);
    return () => {
      window.removeEventListener("auth:session-expired", handleExpired);
    };
  }, []);

  // Polling de Notificações
  useEffect(() => {
    if (token) {
      fetchNotificacoes(token);
      intervalRef.current = setInterval(() => fetchNotificacoes(token), 300000); // Pausado (5 min) para debug
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, fetchNotificacoes]);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE}/defensores/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha na autenticação.");
      }

      const { token: receivedToken, defensor } = await response.json();

      setToken(receivedToken);
      setUser(defensor);
      
      localStorage.setItem("defensorToken", receivedToken);
      localStorage.setItem("defensorUser", JSON.stringify(defensor));

      return true;
    } catch (error) {
      console.error("Erro no login:", error);
      throw error;
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("defensorToken");
    localStorage.removeItem("defensorUser");
    window.location.href = "/painel/login";
  };

  const marcarNotificacaoLida = async (id) => {
    try {
      await authFetch(`/casos/notificacoes/${id}/lida`, {
        method: "PATCH",
      });
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
      );
    } catch (error) {
      if (error.message !== "Sessão expirada") {
        console.error("Erro ao marcar como lida", error);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
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

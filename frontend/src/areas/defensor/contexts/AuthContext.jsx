/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from "react";
import { API_BASE, authFetch } from "../../../utils/apiBase";
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notificacoes, setNotificacoes] = useState([]);

  // Busca notificações
  const fetchNotificacoes = useCallback(async (currentToken) => {
    if (!currentToken) return;
    try {
      const response = await authFetch("/casos/notificacoes");
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
      try {
        const decoded = jwtDecode(storedToken);
        const agora = Date.now() / 1000;

        if (decoded.exp && decoded.exp < agora) {
          localStorage.removeItem("defensorToken");
          localStorage.removeItem("defensorUser");
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch {
        localStorage.removeItem("defensorToken");
        localStorage.removeItem("defensorUser");
      }
    }
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("defensorToken");
    localStorage.removeItem("defensorUser");
    
    if (window.location.pathname !== "/painel/login") {
      window.location.href = "/painel/login";
    }
  }, []);

  // Escuta evento global de sessão expirada
  useEffect(() => {
    const handleExpired = () => {
      logout();
    };
    window.addEventListener("auth:session-expired", handleExpired);
    return () => window.removeEventListener("auth:session-expired", handleExpired);
  }, [logout]);

  // Busca inicial de Notificações
  useEffect(() => {
    if (token) {
      fetchNotificacoes(token);
    }
  }, [token, fetchNotificacoes]);

  const login = async (email, password) => {
    const response = await fetch(`${API_BASE}/defensores/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha: password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(errorData.error || "Falha na autenticação.");
    }

    const { token: receivedToken, defensor } = await response.json();
    setToken(receivedToken);
    setUser(defensor);
    localStorage.setItem("defensorToken", receivedToken);
    localStorage.setItem("defensorUser", JSON.stringify(defensor));
    return true;
  };

  const marcarNotificacaoLida = async (id) => {
    try {
      await authFetch(`/casos/notificacoes/${id}/lida`, { method: "PATCH" });
      setNotificacoes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, lida: true } : n)),
      );
    } catch (error) {
      console.warn("Falha ao marcar notificação como lida", error);
    }
  };

  const permissions = useMemo(() => ({
    canManageTeam: (user?.cargo || "").toLowerCase() === "admin",
    canViewBi: ["admin", "gestor", "coordenador"].includes((user?.cargo || "").toLowerCase()),
    canEditConfig: ["admin", "gestor"].includes((user?.cargo || "").toLowerCase()),
    canDistribuir: ["admin", "gestor", "coordenador"].includes((user?.cargo || "").toLowerCase()),
  }), [user?.cargo]);

  const contextValue = useMemo(() => ({
    user,
    setUser,
    token,
    login,
    logout,
    loading,
    notificacoes,
    marcarNotificacaoLida,
    fetchNotificacoes,
    permissions,
  }), [user, token, loading, notificacoes, logout, fetchNotificacoes, permissions]);

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

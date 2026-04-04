import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export const ProtectedRoute = ({ redirectPath = "/painel/login" }) => {
  const { token } = useAuth();

  // Se não houver token, redireciona para a página de login
  if (!token) {
    return <Navigate to={redirectPath} />;
  }

  // Se houver token, renderiza a página solicitada (ex: Dashboard)
  return <Outlet />;
};
export default ProtectedRoute;

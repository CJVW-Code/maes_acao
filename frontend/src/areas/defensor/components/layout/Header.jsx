import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, LogOut, ChevronLeft } from "lucide-react";
import { ThemeToggle } from "../../../../components/ThemeToggle";
import { NotificacoesBell } from "./NotificacoesBell";

export const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const defensorName = user?.nome || "Defensor";
  const avatarLetter = defensorName.charAt(0)?.toUpperCase() || "D";

  return (
    <header className="sticky top-0 z-40 bg-surface/95 border-b border-soft backdrop-blur">
      <div className="container-app py-4 flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center ml-4 gap-4">
          <button
            onClick={() => navigate(-1)}
            className=" btn btn-secondary text-sm"
            title="Voltar"
          >
            <ChevronLeft size={24} />
            Voltar
          </button>
          <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary font-semibold flex items-center justify-center shadow-inner">
            {avatarLetter}
          </div>
          <div>
            <p className="text-xs uppercase text-muted tracking-[0.3em]">
              Painel do Defensor
            </p>
            <p className="text-lg font-semibold mt-1">
              {user?.cargo === "defensor" ? "Dr(a). " : ""}
              {defensorName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary text-sm"
          >
            <ExternalLink size={16} />
            Portal do Cidadão
          </Link>
          <NotificacoesBell />
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            className="btn btn-ghost border border-soft text-red-600 dark:text-red-400"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </div>
    </header>
  );
};

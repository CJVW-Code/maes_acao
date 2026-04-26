import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  FolderKanban,
  UserPlus,
  Archive,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut
} from "lucide-react";

export const Sidebar = ({ isExpanded, setIsExpanded }) => {
  const auth = useAuth();
  const { logout, user } = auth || {};

  if (!auth) return null;

  const userCargo = user?.cargo?.toLowerCase() || "estagiario";
  const isAdmin = userCargo === "admin";
  const isGestor = userCargo === "gestor";
  const isCoordenador = userCargo === "coordenador";
  
  const canSeeReports = isAdmin || isGestor;
  const canManageTeam = isAdmin || isGestor || isCoordenador;

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/painel", show: true },
    { icon: FolderKanban, label: "Casos e Triagem", path: "/painel/casos", show: true },
    { icon: Archive, label: "Arquivo Morto", path: "/painel/casos/arquivados", show: true },
    { icon: BarChart3, label: "Relatórios", path: "/painel/relatorios", show: canSeeReports },
    { icon: UserPlus, label: "Gerenciar Equipe", path: "/painel/equipe", show: canManageTeam },
  ].filter(item => item.show);

  const mobileLinkClass = ({ isActive }) =>
    `flex flex-col items-center gap-1 text-xs font-medium ${
      isActive ? "text-primary" : "text-muted"
    }`;

  const mobileIconClass = (isActive) =>
    `h-10 w-10 rounded-2xl flex items-center justify-center ${
      isActive ? "bg-primary/15 text-primary" : ""
    }`;

  return (
    <>
      {/* --- DESKTOP SIDEBAR --- */}
      <aside
        className={`hidden lg:flex flex-col bg-surface border-r border-soft h-screen sticky top-0 transition-all duration-300 ease-in-out shadow-[4px_0_24px_-4px_rgba(0,0,0,0.05)] ${
          isExpanded ? "w-64" : "w-20"
        } z-50`}
      >
        {/* Botão Flutuante de Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute -right-3 top-7 bg-primary hover:bg-primary-600 p-1.5 rounded-full text-white transition-colors z-20 shadow-md"
        >
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Topo: Brasão Dinâmico */}
        <div className="p-4 flex items-center gap-3 border-b border-soft h-24 relative group shrink-0">
          <div className="min-w-8 flex justify-center shrink-0">
             <img src="/logo.png" alt="Mães em Ação" className="h-8 w-auto object-contain" />
          </div>
          
          {/* Logo Title (hidden when collapsed) */}
          <span
            className={`font-bold text-lg whitespace-nowrap transition-all duration-300 text-main overflow-hidden ${
              isExpanded ? "opacity-100 translate-x-0 w-auto max-w-[200px]" : "opacity-0 -translate-x-4 w-0 max-w-0"
            }`}
          >
            Mães em Ação
          </span>
        </div>

        {/* Navegação e Animação em Cascata */}
        <nav className="grow p-3">
          <ul className="flex flex-col gap-2">
            {navItems.map((item, index) => (
              <li key={item.label} className="relative group">
                <NavLink
                  to={item.path}
                  end={item.path === "/painel"}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 px-3 py-3 rounded-lg transition-colors overflow-visible ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-main"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="min-w-6 flex justify-center shrink-0 z-10 transition-colors">
                        <item.icon size={22} className={isActive ? "text-white" : ""} />
                      </div>
                      
                      {/* O texto expandido normal */}
                      <span
                        className="whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden font-medium"
                        style={{
                          opacity: isExpanded ? 1 : 0,
                          maxWidth: isExpanded ? "200px" : "0px",
                          transform: isExpanded ? "translateX(0)" : "translateX(-10px)",
                          transitionDelay: isExpanded ? "0ms" : `${index * 50}ms`,
                        }}
                      >
                        {item.label}
                      </span>

                      {/* Tooltip Inteiro (Cobre o botão e expande como a Sidebar) */}
                      {!isExpanded && (
                        <div 
                          className={`absolute left-0 top-0 h-full w-64 flex items-center gap-3 px-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-all duration-200 border border-soft ${
                            isActive ? "bg-primary text-white border-primary" : "bg-surface text-main"
                          }`}
                        >
                          <div className="min-w-6 flex justify-center shrink-0">
                            <item.icon size={22} className={isActive ? "text-white" : "text-main"} />
                          </div>
                          <span className="whitespace-nowrap font-medium z-50">
                            {item.label}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* --- MOBILE NAVBAR (FUNDO DA TELA - DINÂMICO) --- */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/95 border-t border-soft backdrop-blur px-2 py-2 flex items-center justify-around z-40">
        {navItems.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === "/painel"} className={mobileLinkClass}>
            {({ isActive }) => (
              <>
                <div className={mobileIconClass(isActive)}>
                  <item.icon size={20} />
                </div>
                {item.label.split(" ")[0]} {/* Mostra só primeira palavra no mobile */}
              </>
            )}
          </NavLink>
        ))}

        {/* LOGOUT MOBILE */}
        <button
          onClick={logout}
          className="flex flex-col items-center gap-1 text-xs font-medium text-red-400"
        >
          <div className="h-10 w-10 rounded-2xl flex items-center justify-center hover:bg-red-500/10">
            <LogOut size={20} />
          </div>
          Sair
        </button>
      </nav>
    </>
  );
};

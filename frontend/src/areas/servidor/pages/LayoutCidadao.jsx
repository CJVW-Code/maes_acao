import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ThemeToggle } from "../../../components/ThemeToggle";
// eslint-disable-next-line no-unused-vars
import { motion } from "motion/react";

import { LogIn, ArrowLeft } from "lucide-react";
import { ConfirmModal } from "../../../components/ui/ConfirmModal";
import { ToastContainer } from "../../../components/ui/ToastContainer";
import { FaqDuvidas } from "./FaqDuvidas";

export const LayoutCidadao = () => {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen flex flex-col bg-app relative overflow-x-hidden">
      {/* Visual Identity Foundation */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Background Image (Key Visual) - Crisp and Deep */}
        <div
          className="absolute inset-0 z-[-1]"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(46, 16, 101, 0.75), rgba(46, 16, 101, 0.55)), url('/maesemacao/KV_Maes_em_Acao.jpg.jpeg')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Atmospheric Glows optimized: Using CSS radial-gradient instead of heavy blur-[150px] to fix 3GB RAM leak */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full z-[-1]" 
             style={{ background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0) 70%)' }} />
        <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full z-[-1]" 
             style={{ background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, rgba(236, 72, 153, 0) 70%)' }} />
      </div>

      <header className="sticky top-0 z-50 w-full flex items-center justify-between md:justify-between p-2 md:p-4 md:px-8 gap-4 bg-primary/5 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          {!isHome && (
            <button
              onClick={() => window.location.href = "/"}
              className="btn bg-white/5 backdrop-blur-md text-white border-white/10 hover:bg-white/10 py-1.5! px-3! text-xs! rounded-lg!"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              <span>Voltar</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white/5 backdrop-blur-md rounded-lg p-0.5 border border-white/10">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="grow container mx-auto md:py-8 space-y-12 px-4 sm:px-6">
        <header className="container p-4 md:p-6 text-center flex flex-col items-center justify-center space-y-6">
          {/* Badge DPE - Static for Stability */}
          <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm transform-gpu">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            <p className="font-bold text-white text-[10px] tracking-widest uppercase">
              Defensoria Pública do Estado da Bahia
            </p>
          </div>

          {/* Logo Principal with a CSS fallback shadow instead of heavy backdrop-blur */}
          <div className="relative group transition-transform hover:scale-105 duration-500 py-6 px-12">
            {/* Spotlight Pedestal without heavy backdrop-blur to prevent browser crashing */}
            <div className="absolute inset-0 bg-white/5 rounded-[3rem] border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)] scale-79 group-hover:scale-83 transition-transform duration-500" />

            <img
              src="/maesemacao/LOGO___Maes_em_Acao_v2.png"
              alt="Mães em Ação"
              className="relative z-10 h-32 sm:h-44 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
            />
          </div>
        </header>
        <Outlet /> {/* O conteúdo da página será renderizado aqui */}
        <FaqDuvidas />
      </main>

      <footer className="w-full text-center p-8 mt-12 bg-black/20 backdrop-blur-md border-t border-white/10">
        <div className="max-w-4xl mx-auto space-y-6">
          <p className="text-xs font-medium text-white/60 tracking-wider">
            &copy; {new Date().getFullYear()} DESENVOLVIDO PELA 14ª REGIONAL - TEIXEIRA DE FREITAS
          </p>
          <Link
            to="/painel"
            className="btn bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white px-6"
          >
            <LogIn size={14} className="mr-1" />
            Acesso Restrito
          </Link>
        </div>
      </footer>

      <ConfirmModal />
      <ToastContainer />
    </div>
  );
};

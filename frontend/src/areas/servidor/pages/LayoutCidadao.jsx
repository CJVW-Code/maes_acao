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
    <div className="min-h-screen flex flex-col bg-app relative">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Linhas horizontais sutis (Tema Claro e Escuro) */}
        <div
          className="absolute inset-0 opacity-50 dark:opacity-20"
          style={{
            backgroundImage: `repeating-linear-gradient(180deg, transparent, transparent 47px, var(--color-special) 47px, var(--color-special) 48px)`,
            backgroundSize: "100% 48px",
            opacity: 0.03,
          }}
        />

        {/* Parágrafo Gigante (§) */}
        <div className="absolute -left-8 top-[15%] font-serif font-bold text-special opacity-[0.03] dark:opacity-[0.05] select-none text-[320px] leading-none">
          §
        </div>

        {/* Balança da Justiça (SVG) */}
        <svg
          className="absolute -right-[60px] top-1/2 -translate-y-[55%] opacity-[0.035] dark:opacity-[0.05] text-special w-[520px] h-[520px]"
          viewBox="0 0 200 210"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="98" y="20" width="4" height="135" fill="currentColor" />
          <rect
            x="68"
            y="152"
            width="64"
            height="7"
            rx="3"
            fill="currentColor"
          />
          <rect
            x="82"
            y="158"
            width="36"
            height="12"
            rx="3"
            fill="currentColor"
          />
          <rect
            x="28"
            y="41"
            width="144"
            height="5"
            rx="2.5"
            fill="currentColor"
          />
          <line
            x1="38"
            y1="46"
            x2="32"
            y2="94"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="52"
            y1="46"
            x2="58"
            y2="94"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M16 94 Q45 107 64 94"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <line
            x1="148"
            y1="46"
            x2="142"
            y2="94"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="162"
            y1="46"
            x2="168"
            y2="94"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M136 94 Q155 107 184 94"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="100" cy="20" r="6" fill="currentColor" />
          <line
            x1="100"
            y1="14"
            x2="100"
            y2="8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <header className="sticky top-0 z-50 w-full flex items-center justify-between  md:justify-between p-2 md:p-4 md:px-8 gap-4 bg-app/70 backdrop-blur-lg border-b border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          {!isHome && (
            <Link
              to="/"
              className="btn btn-ghost py-1.5! px-3! text-sm! rounded-lg! border border-soft hover:border-primary/50 shadow-sm"
            >
              <ArrowLeft
                size={14}
                className="group-hover:-translate-x-0.5 transition-transform"
              />
              <span>Voltar</span>
            </Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>
      <main className="grow container mx-auto md:py-8 space-y-12 px-4 sm:px-6">
        <header className="container p-4 md:p-6 text-center flex flex-col items-center justify-center space-y-3">
          {/* Badge Verde DPE */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20"
          >
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            <p className="font-semibold text-primary text-xs tracking-wider uppercase">
              Defensoria Pública do Estado da Bahia
            </p>
          </motion.div>

          {/* Título Principal */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-5xl sm:text-5xl font-sans font-bold tracking-tight uppercase mt-2"
          >
            Mães em Ação - <span className="text-muted">BAHIA</span>
          </motion.h1>

          {/* Subtítulo */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-muted text-base sm:text-lg max-w-2xl mx-auto font-light leading-relaxed"
          >
            Plataforma Oficial de acesso à justiça, sem sair de casa.
            <br />
            <strong className="font-medium text-text">
              Inicie um novo pedido
            </strong>{" "}
            ou acompanhe a sua solicitação em poucos passos de forma simples,
            rápida e segura.
          </motion.p>

          {/* Pill Dourado 100% Gratuito (Da sua imagem editada) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="inline-flex items-center gap-2 mt-2 bg-[#f3efe7] dark:bg-[#c9a84c]/10 border border-[#c9a84c]/40 dark:border-[#c9a84c]/30 rounded-full px-4 py-1.5 text-xs sm:text-sm font-medium text-[#926c0d] dark:text-[#af8e34] shadow-sm"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            100% gratuito — garantido pelo Art. 5º da Constituição Federal
          </motion.div>
        </header>
        <Outlet /> {/* O conteúdo da página será renderizado aqui */}
        <FaqDuvidas />
      </main>
      <footer className="w-full text-center  p-4 mt-4 border-t bg-surface border-soft">
        <p className="text-sm text-muted">
          &copy; {new Date().getFullYear()} Desenvolvido pela 14ª Regional -
          Teixeira de Freitas
        </p>
        <Link to="/painel" className="btn">
          <LogIn size={12} />
          Acesso Restrito
        </Link>
      </footer>
      <ConfirmModal />
      <ToastContainer />
    </div>
  );
};

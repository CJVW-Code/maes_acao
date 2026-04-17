import React from "react";
import { Link } from "react-router-dom";
// eslint-disable-next-line no-unused-vars
import { motion } from "motion/react";
import { Home, AlertCircle, ArrowLeft } from "lucide-react";

/**
 * Pagina de Erro 404 - Seguindo o System Design "DPE Bahia"
 * Design focado em acessibilidade, clareza e estética premium.
 */
export const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-app relative overflow-hidden">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 bg-special/5 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full bg-surface border border-border shadow-soft rounded-3xl p-8 md:p-12 text-center relative z-10"
      >
        {/* Ícone Animado */}
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ 
            repeat: Infinity, 
            repeatType: "reverse", 
            duration: 2,
            ease: "easeInOut" 
          }}
          className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-8"
        >
          <AlertCircle className="w-12 h-12 text-primary" />
        </motion.div>

        <h1 className="heading-hero text-primary mb-2">404</h1>
        <h2 className="heading-1 mb-4">Página Não Encontrada</h2>
        
        <p className="text-muted mb-10 leading-relaxed">
          O link que você tentou acessar pode estar quebrado ou a página foi movida para um novo endereço.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/" className="btn btn-primary group">
            <Home className="w-4 h-4 transition-transform group-hover:scale-110" />
            Voltar ao Início
          </Link>
          
          <button 
            onClick={() => window.history.back()} 
            className="btn btn-ghost group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Voltar
          </button>
        </div>
      </motion.div>

      {/* Marca d'água ou rodapé sutil */}
      <div className="absolute bottom-8 left-0 right-0 text-center opacity-30">
        <span className="text-xs font-medium tracking-widest uppercase">
          Defensoria Pública do Estado da Bahia
        </span>
      </div>
    </div>
  );
};

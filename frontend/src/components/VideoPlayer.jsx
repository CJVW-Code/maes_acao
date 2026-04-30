import React, { useState } from "react";
import { Play, ExternalLink, Video, Download, AlertTriangle } from "lucide-react";
import { motion as Motion, AnimatePresence } from "motion/react";

/**
 * Componente VideoPlayer premium para exibir treinamentos via links externos (SharePoint/YouTube/etc)
 */
export const VideoPlayer = ({ url, fallbackUrl, title, description, className = "", extraActionUrl, extraActionLabel }) => {
  const [showVideo, setShowVideo] = useState(false);

  // Tenta converter link do SharePoint para versão embed se necessário
  const getEmbedUrl = (originalUrl) => {
    if (originalUrl.includes("sharepoint.com")) {
      if (originalUrl.includes("action=embedview")) return originalUrl;
      const separator = originalUrl.includes("?") ? "&" : "?";
      return `${originalUrl}${separator}action=embedview`;
    }
    return originalUrl;
  };

  return (
    <div className={`w-full ${className}`}>
      <Motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-surface to-soft/30 border border-soft p-1 shadow-2xl"
      >
        <div className="bg-surface/80 backdrop-blur-xl rounded-[2.2rem] p-6 sm:p-8 flex flex-col gap-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full" />
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg relative">
                  <Video size={32} strokeWidth={1.5} />
                </div>
              </div>
              
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-xl text-special">{title || "Tutorial do Sistema"}</h4>
                <p className="text-sm text-muted max-w-md">
                  {description || "Assista ao vídeo de treinamento abaixo para aprender a utilizar as funcionalidades do sistema."}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              {!showVideo && (
                <button 
                  onClick={() => setShowVideo(true)}
                  className="btn btn-primary px-8 py-4 rounded-2xl flex items-center gap-3 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
                >
                  <Play size={20} fill="currentColor" />
                  <span>Carregar Vídeo</span>
                </button>
              )}
              <a 
                href={fallbackUrl || url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-ghost border border-soft px-6 py-4 rounded-2xl flex items-center gap-2 hover:bg-soft/50 transition-colors text-sm"
              >
                <ExternalLink size={18} />
                <span className="hidden sm:inline">Ver no SharePoint</span>
              </a>

              {extraActionUrl && (
                <a 
                  href={extraActionUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn bg-highlight/10 text-highlight border border-highlight/20 px-6 py-4 rounded-2xl flex items-center gap-2 hover:bg-highlight/20 transition-all shadow-sm"
                >
                  <Download size={18} />
                  <span className="font-bold">{extraActionLabel || "Baixar Arquivo"}</span>
                </a>
              )}
            </div>
          </div>

          {/* Área do Vídeo Inline */}
          <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black/5 border border-soft shadow-inner">
            <AnimatePresence mode="wait">
              {!showVideo ? (
                <Motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-soft/20 to-transparent cursor-pointer group"
                  onClick={() => setShowVideo(true)}
                >
                  <div className="w-20 h-20 bg-white/80 dark:bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-primary shadow-xl group-hover:scale-110 transition-transform duration-500">
                    <Play size={32} fill="currentColor" className="ml-1" />
                  </div>
                  <p className="mt-4 text-sm font-bold text-muted uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                    Clique para iniciar o treinamento
                  </p>
                </Motion.div>
              ) : (
                <Motion.div 
                  key="video"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full h-full"
                >
                  <iframe 
                    src={getEmbedUrl(url)}
                    className="w-full h-full"
                    frameBorder="0"
                    scrolling="no"
                    allowFullScreen
                    title={title}
                  />
                </Motion.div>
              )}
            </AnimatePresence>
          </div>

          {showVideo && (
            <Motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start"
            >
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                <strong>Erro de conexão?</strong> Se o vídeo não carregar ou mostrar "A conexão foi recusada" (devido a bloqueios de segurança da rede da DPE), clique no botão <strong>"Ver no SharePoint"</strong> acima para assistir em uma nova guia. <br/>Se ainda assim não conseguir acessar, <strong>fale com o seu coordenador</strong> para solicitar acesso ao arquivo.
              </p>
            </Motion.div>
          )}
        </div>

        {/* Efeito de brilho no hover */}
        {!showVideo && (
          <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-shine" />
        )}
      </Motion.div>
    </div>
  );
};

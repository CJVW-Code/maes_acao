import React, { useState } from "react";
import { 
  Video, 
  BookOpen, 
  Download, 
  GraduationCap, 
  CheckCircle, 
  AlertTriangle, 
  Settings, 
  Puzzle, 
  Globe, 
  Package, 
  PlayCircle, 
  Rocket, 
  Info,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  RefreshCw,
  Search,
  FileSearch
} from "lucide-react";
import { motion as Motion, AnimatePresence } from "motion/react";
import { VideoPlayer } from "../../../components/VideoPlayer";

export const Treinamentos = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  const treinamentos = [
    {
      id: "solar-export",
      title: "Exportação para o SOLAR",
      description: "Aprenda o passo a passo completo para utilizar a extensão Mães em Ação e automatizar o cadastro de atendimentos no sistema SOLAR da Defensoria.",
      url: "https://defensoriaba-my.sharepoint.com/personal/janaina_santos_defensoria_ba_def_br/_layouts/15/embed.aspx?UniqueId=088f0e74-15a8-48b5-a755-74801b0ba5e3&embed=%7B%22ust%22%3Atrue%2C%22hv%22%3A%22CopyEmbedCode%22%7D&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create",
      fallbackUrl: "https://defensoriaba-my.sharepoint.com/:v:/g/personal/janaina_santos_defensoria_ba_def_br/IQB0Do8IqBW1SKdVdIAbC6XjAfz9bYHWHJvi38vd7796Unw?e=mHl9fM&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D",
      extraActionUrl: "/extensao maes acao defulsbahia solar.zip",
      extraActionLabel: "Baixar Extensão SOLAR",
      category: "Sistemas Externos"
    }
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-12 animate-fade-in">
      {/* Header da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-br from-primary/15 to-transparent p-10 rounded-[2.5rem] border border-primary/20 shadow-2xl shadow-primary/5">
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-primary">
            <div className="p-4 bg-primary/20 rounded-3xl shadow-inner">
              <GraduationCap size={40} />
            </div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Central de Treinamento</h1>
          </div>
          <p className="text-muted text-lg max-w-2xl font-medium opacity-80">
            Domine as ferramentas do mutirão com nossos guias visuais e vídeos passo a passo.
          </p>
        </div>
        
        <div className="flex flex-col items-center">
           <div className="flex -space-x-4">
              {[1,2,3].map(i => (
                <div key={i} className="w-14 h-14 rounded-full border-4 border-surface bg-soft flex items-center justify-center text-primary font-black shadow-lg">
                   {i}
                </div>
              ))}
              <div className="w-14 h-14 rounded-full border-4 border-surface bg-primary text-white flex items-center justify-center font-black shadow-lg animate-pulse">
                 +
              </div>
           </div>
           <p className="text-[10px] text-center mt-3 text-primary font-black uppercase tracking-[0.2em]">Módulos Ativos</p>
        </div>
      </div>

      {/* Grid de Treinamentos */}
      <div className="space-y-16">
        {treinamentos.map((video) => (
          <Motion.section 
            key={video.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-4">
              <span className="px-4 py-1.5 bg-highlight/10 text-highlight text-xs font-black rounded-full uppercase tracking-widest border border-highlight/20 shadow-sm">
                {video.category}
              </span>
              <div className="h-px grow bg-gradient-to-r from-soft to-transparent" />
            </div>

            {/* Player de Vídeo */}
            <VideoPlayer
              url={video.url}
              fallbackUrl={video.fallbackUrl}
              title={video.title}
              description={video.description}
              extraActionUrl={video.extraActionUrl}
              extraActionLabel={video.extraActionLabel}
            />

            {/* Tutorial Expansível */}
            <div className="bg-surface/50 backdrop-blur-md border border-soft rounded-[2.5rem] overflow-hidden shadow-xl">
              <button 
                onClick={() => setShowTutorial(!showTutorial)}
                className="w-full flex items-center justify-between p-8 hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-highlight/10 text-highlight rounded-2xl group-hover:scale-110 transition-transform">
                      <BookOpen size={24} />
                   </div>
                   <div className="text-left">
                      <h3 className="text-xl font-bold text-main">Guia de Instalação e Uso (Texto)</h3>
                      <p className="text-sm text-muted">Prefere ler? Confira o passo a passo detalhado aqui.</p>
                   </div>
                </div>
                {showTutorial ? <ChevronUp size={24} className="text-muted" /> : <ChevronDown size={24} className="text-muted" />}
              </button>

              <AnimatePresence>
                {showTutorial && (
                  <Motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-soft"
                  >
                    <div className="p-8 lg:p-12 space-y-12 overflow-hidden">
                      {/* Fluxo Resumido */}
                      <section className="space-y-6">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shadow-lg" style={{ backgroundColor: "#f59e0b", color: "#fff" }}>!</div>
                           <h4 className="text-2xl font-black text-main uppercase tracking-tight">Fluxo Resumido para Uso Diário</h4>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                          {[
                            { n: 1, t: "Baixar Extensão", d: "Salvar o ZIP no computador." },
                            { n: 2, t: "Extrair Extensão", d: "Usar 'Extrair Tudo' e localizar pasta." },
                            { n: 3, t: "Abrir Chrome", d: "chrome://extensions" },
                            { n: 4, t: "Modo Desenvolvedor", d: "Ativar chave no canto direito." },
                            { n: 5, t: "Carregar Pasta", d: "Pasta solar-assistido-extension-v8." },
                            { n: 6, t: "Abrir Caso", d: "Acesse o painel do Mães em Ação." },
                            { n: 7, t: "Baixar Tudo", d: "Clicar em Baixar Tudo (.zip)." },
                            { n: 8, t: "Extrair Caso", d: "atendimento.json + documentos." },
                            { n: 9, t: "Abrir SOLAR", d: "Manter aba logada e ativa." },
                            { n: 10, t: "Carregar na Extensão", d: "Selecionar JSON + documentos." },
                            { n: 11, t: "Executar Automação", d: "Iniciar preenchimento no SOLAR." },
                            { n: 12, t: "Juntar Documentos", d: "Anexar docs pessoais no cadastro." },
                            { n: 13, t: "Criar Atendimento", d: "Seguir para fluxo de atendimento." },
                            { n: 14, t: "Conferir Tudo", d: "Validar dados antes de salvar." },
                            { n: 15, t: "Registrar Saída", d: "Observar mensagens de sucesso/erro." },
                          ].map(step => (
                            <div key={step.n} className="bg-surface border border-soft p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative group">
                               <div className="w-8 h-8 bg-primary text-white rounded-xl flex items-center justify-center text-xs font-black mb-3 group-hover:scale-110 transition-transform">{step.n}</div>
                               <p className="text-sm font-bold text-main leading-tight mb-1">{step.t}</p>
                               <p className="text-[11px] text-muted font-medium leading-relaxed">{step.d}</p>
                               {step.n < 15 && (step.n % 5 !== 0) && <ArrowRight size={14} className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-primary/30 hidden lg:block" />}
                            </div>
                          ))}
                        </div>
                      </section>

                      {/* Seções Detalhadas */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* 1. Instalação */}
                        <div className="bg-surface border border-soft p-8 space-y-6 border-l-4 border-l-primary rounded-3xl shadow-sm">
                          <h4 className="text-xl font-bold text-primary flex items-center gap-3">
                            <Puzzle size={24} /> 1. Instalar a extensão no computador
                          </h4>
                          <ul className="space-y-4">
                             <li className="flex gap-3 text-sm">
                               <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                               <span>Baixe o ZIP e salve em uma pasta fácil de achar (Ex: Área de Trabalho).</span>
                             </li>
                             <li className="flex gap-3 text-sm">
                               <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                               <span>Clique com o botão direito e escolha <strong>"Extrair Tudo"</strong>.</span>
                             </li>
                             <li className="flex gap-3 text-sm font-bold text-main">
                               <Info size={18} className="text-primary shrink-0 mt-0.5" />
                               <span>A pasta correta é a <code className="bg-soft/50 px-1 rounded text-primary">solar-assistido-extension-v8</code> (contém o manifest.json).</span>
                             </li>
                          </ul>
                          <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl text-xs text-primary font-medium">
                            <strong>Atenção:</strong> o Chrome não carrega o ZIP fechado. É necessário carregar a pasta extraída da extensão.
                          </div>
                        </div>

                        {/* 2. Google Chrome */}
                        <div className="bg-surface border border-soft p-8 space-y-6 border-l-4 border-l-highlight rounded-3xl shadow-sm">
                          <h4 className="text-xl font-bold text-highlight flex items-center gap-3">
                            <Globe size={24} /> 2. Carregar no Google Chrome
                          </h4>
                          <ul className="space-y-4">
                             <li className="flex gap-3 text-sm">
                               <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                               <span>Acesse <code className="bg-soft/50 px-1 rounded">chrome://extensions</code> no navegador.</span>
                             </li>
                             <li className="flex gap-3 text-sm">
                               <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                               <span>Ative o <strong>Modo do desenvolvedor</strong> (canto superior direito).</span>
                             </li>
                             <li className="flex gap-3 text-sm">
                               <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                               <span>Use <strong>Carregar sem compactação</strong> e selecione a pasta da extensão.</span>
                             </li>
                             <li className="flex gap-3 text-sm">
                               <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                               <span>Fixe o ícone <strong>Mães em Ação - Solar</strong> na barra de ferramentas.</span>
                             </li>
                          </ul>
                        </div>

                        {/* 3. Download do Caso */}
                        <div className="bg-surface border border-soft p-8 space-y-6 border-l-4 border-l-blue-500 rounded-3xl shadow-sm">
                          <h4 className="text-xl font-bold text-blue-600 flex items-center gap-3">
                            <Package size={24} /> 3. Baixar os arquivos do caso
                          </h4>
                          <ul className="space-y-4">
                             <li className="flex gap-3 text-sm">
                               <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                               <span>No Mães em Ação, abra o caso e confira os dados principais da assistida.</span>
                             </li>
                             <li className="flex gap-3 text-sm">
                               <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                               <span>Clique no botão <strong>Baixar Tudo (.zip)</strong> na área de Documentos.</span>
                             </li>
                             <li className="flex gap-3 text-sm font-bold text-main">
                               <AlertTriangle size={18} className="text-primary shrink-0 mt-0.5" />
                               <span>Extraia o ZIP do caso. Você precisará do arquivo <code className="bg-soft/50 px-1 rounded">atendimento.json</code> e dos documentos.</span>
                             </li>
                          </ul>
                        </div>

                        {/* 4. No SOLAR */}
                        <div className="bg-surface border border-soft p-8 space-y-6 border-l-4 border-l-green-500 rounded-3xl shadow-sm">
                          <h4 className="text-xl font-bold text-green-600 flex items-center gap-3">
                            <Rocket size={24} /> 4. Execução no SOLAR
                          </h4>
                          <ul className="space-y-4">
                             <li className="flex gap-3 text-sm">
                               <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
                               <span>Mantenha a aba do SOLAR aberta e logada.</span>
                             </li>
                             <li className="flex gap-3 text-sm font-bold text-main">
                               <Info size={18} className="text-primary shrink-0 mt-0.5" />
                               <span>A extensão não substitui a conferência humana. Valide sempre os dados no SOLAR.</span>
                             </li>
                          </ul>
                          <div className="warning flex gap-3 items-start p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                            <AlertTriangle className="text-red-500 shrink-0" size={18} />
                            <span className="text-xs text-red-700 dark:text-red-400 font-medium">Garanta que o SOLAR está logado e pronto antes de iniciar a automação.</span>
                          </div>
                        </div>
                      </div>

                      {/* Tabela de Erros */}
                      <section className="space-y-6">
                        <h4 className="text-2xl font-black text-main flex items-center gap-3 uppercase tracking-tight">
                          <AlertTriangle size={32} className="text-red-500" /> Erros Comuns e Soluções
                        </h4>
                        <div className="overflow-x-auto rounded-3xl border border-soft bg-surface shadow-sm">
                          <table className="w-full text-sm">
                            <thead className="bg-soft/30 text-muted uppercase text-[10px] font-black tracking-widest border-b border-soft">
                              <tr>
                                <th className="px-6 py-5 text-left">Problema</th>
                                <th className="px-6 py-5 text-left">Causa Provável</th>
                                <th className="px-6 py-5 text-left">Solução Rápida</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-soft">
                              {[
                                { p: "A extensão não aparece", c: "Pasta errada selecionada.", s: "Carregue a pasta que contém o manifest.json." },
                                { p: "Erro ao carregar no Chrome", c: "O ZIP não foi extraído.", s: "Extraia o arquivo e use 'Carregar sem compactação'." },
                                { p: "Atendimento não carrega", c: "atendimento.json não selecionado.", s: "Selecione o JSON junto com os documentos." },
                                { p: "Automação não executa", c: "SOLAR deslogado ou aba inativa.", s: "Abra o SOLAR, faça login e deixe a aba ativa." },
                                { p: "Documentos não aparecem", c: "Arquivos não selecionados com o JSON.", s: "Refaça a seleção com todos os arquivos extraídos." },
                                { p: "Dados incompletos", c: "Caso baixado incorretamente.", s: "Confira o caso no Mães em Ação e baixe novamente." },
                              ].map((err, i) => (
                                <tr key={i} className="hover:bg-primary/5 transition-colors">
                                  <td className="px-6 py-5 font-bold text-main">{err.p}</td>
                                  <td className="px-6 py-5 text-muted">{err.c}</td>
                                  <td className="px-6 py-5 text-primary font-bold">{err.s}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      {/* Checklist Final */}
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-10 rounded-[2.5rem] shadow-xl shadow-primary/5">
                         <h4 className="text-xl font-black text-primary uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                            <CheckCircle size={28} />
                            Checklist de Conferência no SOLAR
                         </h4>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                              { label: "Dados Pessoais", d: "Nome, CPF, filiação." },
                              { label: "Endereço", d: "Rua, bairro, CEP." },
                              { label: "Documentos", d: "RG, CPF, Comprovante." },
                              { label: "Atendimento", d: "Tipo de ação e protocolo." }
                            ].map(item => (
                              <div key={item.label} className="space-y-1">
                                <div className="flex items-center gap-2 font-black text-main uppercase text-xs tracking-tight">
                                   <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
                                      <CheckCircle size={12} />
                                   </div>
                                   {item.label}
                                </div>
                                <p className="text-[11px] text-muted ml-7">{item.d}</p>
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  </Motion.div>
                )}
              </AnimatePresence>
            </div>
          </Motion.section>
        ))}
      </div>

      {/* Footer / FAQ rápido */}
      <div className="bg-surface border border-soft p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-10 shadow-lg">
        <div className="p-8 bg-highlight/10 rounded-[2rem] border border-highlight/20 shadow-inner">
          <BookOpen className="text-highlight" size={48} />
        </div>
        <div className="grow space-y-3 text-center md:text-left">
          <h3 className="text-2xl font-black text-main uppercase tracking-tighter">Dúvidas Frequentes?</h3>
          <p className="text-muted text-lg max-w-xl font-medium">
            Não encontrou o que precisava? Entre em contato com a coordenação do mutirão.
          </p>
        </div>
      </div>
    </div>
  );
};

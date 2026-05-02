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
  ChevronRight,
  ChevronDown,
  Zap,
  Sparkles,
  Layers,
  Monitor,
  MousePointer2,
  FileText,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { motion as Motion, AnimatePresence } from "motion/react";
import { VideoPlayer } from "../../../components/VideoPlayer";

/**
 * Página de Treinamentos - Versão Premium v3.2
 * Refinamento do header, remoção de badges e otimização do card de Fluxo de Trabalho.
 */
export const Treinamentos = () => {
  const [expandedPhase, setExpandedPhase] = useState(0);

  const treinamentos = [
    {
      id: "solar-export",
      title: "Automação SOLAR",
      subtitle: "Exportação Inteligente de Casos",
      description:
        "Domine a integração entre o Mães em Ação e o sistema SOLAR. Aprenda a utilizar nossa extensão para automatizar o cadastro de atendimentos, reduzindo o tempo de protocolo em até 80%.",
      url: "https://defensoriaba-my.sharepoint.com/personal/janaina_santos_defensoria_ba_def_br/_layouts/15/embed.aspx?UniqueId=088f0e74-15a8-48b5-a755-74801b0ba5e3&embed=%7B%22ust%22%3Atrue%2C%22hv%22%3A%22CopyEmbedCode%22%7D&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create",
      fallbackUrl:
        "https://defensoriaba-my.sharepoint.com/:v:/g/personal/janaina_santos_defensoria_ba_def_br/IQB0Do8IqBW1SKdVdIAbC6XjAbz9bYHWHJvi38vd7796Unw?e=mHl9fM&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D",
      extraActionUrl: "/extensao maes acao defulsbahia solar.zip",
      extraActionLabel: "Download da Extensão",
      category: "Produtividade",
      difficulty: "Intermediário",
      duration: "12 min",
    },
  ];

  const steps = [
    { n: 1, t: "Baixar Extensão", d: "Salvar o ZIP no computador.", phase: 0 },
    { n: 2, t: "Extrair Extensão", d: "Usar 'Extrair Tudo' e localizar pasta.", phase: 0 },
    { n: 3, t: "Abrir Chrome", d: "Acesse chrome://extensions.", phase: 0 },
    { n: 4, t: "Modo Desenvolvedor", d: "Ativar chave no canto direito.", phase: 0 },
    { n: 5, t: "Carregar Pasta", d: "Pasta solar-assistido-extension-v8.", phase: 0 },
    { n: 6, t: "Abrir Caso", d: "Acesse o painel do Mães em Ação.", phase: 1 },
    { n: 7, t: "Baixar Tudo", d: "Clicar em Baixar Tudo (.zip).", phase: 1 },
    { n: 8, t: "Abrir SOLAR", d: "Manter aba logada e ativa.", phase: 2 },
    { n: 9, t: "Carregar na Extensão", d: "Selecionar o ZIP baixado.", phase: 2 },
    { n: 10, t: "Executar Automação", d: "Iniciar preenchimento no SOLAR.", phase: 2 },
    { n: 11, t: "Juntar Documentos", d: "Anexar docs pessoais no cadastro.", phase: 3 },
    { n: 12, t: "Criar Atendimento", d: "Seguir para fluxo de atendimento.", phase: 3 },
    { n: 13, t: "Conferir Tudo", d: "Validar dados antes de salvar.", phase: 3 },
    { n: 14, t: "Registrar Saída", d: "Observar mensagens de sucesso/erro.", phase: 3 },
  ];

  const phases = [
    {
      name: "Instalação",
      icon: <Settings size={14} />,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      name: "Preparação",
      icon: <Package size={14} />,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      name: "Automação",
      icon: <Zap size={14} />,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      name: "Conclusão",
      icon: <Rocket size={14} />,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ];

  const erros = [
    { p: "Extensão não aparece", s: "Carregue a pasta que contém o manifest.json." },
    {
      p: "Erro ao carregar no Chrome",
      s: "Extraia o ZIP primeiro e use 'Carregar sem compactação'.",
    },
    {
      p: "Atendimento não carrega",
      s: "Certifique-se de selecionar o arquivo ZIP correto do caso.",
    },
    { p: "Automação não executa", s: "Abra o SOLAR, faça login e mantenha a aba ativa." },
    { p: "Documentos não aparecem", s: "Refaça a seleção usando o arquivo ZIP do caso." },
    { p: "Dados incompletos", s: "Confira o caso no Mães em Ação e baixe o ZIP novamente." },
  ];

  return (
    <div className="min-h-screen bg-surface/30 space-y-0 animate-fade-in pb-20">
      {/* Hero Section Simplificada */}
      <section className="relative overflow-hidden pt-12 pb-24 px-6 lg:px-12 border-b border-soft">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-primary/10 via-transparent to-transparent opacity-50" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-highlight/5 blur-[120px] rounded-full" />

        <div className="relative z-10 w-full">
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-main leading-[0.9]">
                Extensão <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-highlight">
                  Solar.
                </span>
              </h1>

              {/* Alerta de Escopo da Extensão - Redesenhado para melhor contraste */}
              <Motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 alert-critical-premium border p-6 rounded-[2.5rem] flex items-center gap-6 max-w-3xl"
              >
                <div className="w-14 h-14 bg-[#f59e0b] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <h4 className="text-[#92400e] dark:text-amber-400 font-black uppercase text-[10px] tracking-[0.2em] mb-1.5 opacity-80">
                    Aviso Crítico de Automação
                  </h4>
                  <p className="font-bold text-sm leading-relaxed">
                    A extensão automatiza apenas os{" "}
                    <span className="text-[#d97706] dark:text-amber-400 underline decoration-2 underline-offset-2">
                      documentos
                    </span>
                    ,{" "}
                    <span className="text-[#d97706] dark:text-amber-400 underline decoration-2 underline-offset-2">
                      dados da representante
                    </span>{" "}
                    e{" "}
                    <span className="text-[#d97706] dark:text-amber-400 underline decoration-2 underline-offset-2">
                      endereço
                    </span>
                    . Outros campos exigem inserção manual.
                  </p>
                </div>
              </Motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Conteúdo Principal */}
      {/* Área de Conteúdo Principal - Layout Cinematográfico */}
      <main className="w-full px-6 lg:px-12 -mt-12">
        {treinamentos.map((video) => (
          <div key={video.id} className="space-y-12">
            <div className="w-full max-w-7xl mx-auto">
              <Motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: "circOut" }}
                className="group relative"
              >
                <div className="absolute -inset-4 bg-primary/10 blur-[100px] opacity-0 group-hover:opacity-40 transition-opacity duration-700 rounded-[3rem]" />
                <VideoPlayer
                  url={video.url}
                  fallbackUrl={video.fallbackUrl}
                  title={video.title}
                  description={video.description}
                  extraActionUrl={video.extraActionUrl}
                  extraActionLabel={video.extraActionLabel}
                  className="rounded-[2.5rem] overflow-hidden shadow-2xl"
                />
              </Motion.div>
            </div>

            {/* 2. Fluxo de Trabalho Interativo (Timeline Horizontal) */}
            <div className="w-full max-w-7xl mx-auto space-y-12">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-soft/50">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20">
                    <Layers size={28} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-main uppercase tracking-tighter leading-none">
                      Guia de Execução
                    </h3>
                    <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mt-2">
                      Siga o passo a passo para automação
                    </p>
                  </div>
                </div>

                {/* Seletor de Fases Horizontal */}
                <div className="flex flex-wrap justify-center gap-2 bg-soft/30 p-2 rounded-[2rem] border border-soft">
                  {phases.map((phase, idx) => (
                    <button
                      key={idx}
                      onClick={() => setExpandedPhase(idx)}
                      className={`flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-500 font-black text-[11px] uppercase tracking-widest ${expandedPhase === idx ? "bg-surface text-primary shadow-lg border border-soft" : "text-muted hover:bg-surface/50"}`}
                    >
                      <span className={expandedPhase === idx ? phase.color : "text-muted"}>
                        {phase.icon}
                      </span>
                      {phase.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conteúdo da Fase Ativa */}
              <AnimatePresence mode="wait">
                <Motion.div
                  key={expandedPhase}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {steps
                    .filter((s) => s.phase === expandedPhase)
                    .map((step, i) => (
                      <div
                        key={i}
                        className="group bg-surface border border-soft p-8 rounded-[2.5rem] hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          {phases[expandedPhase].icon}
                        </div>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-10 h-10 rounded-2xl bg-soft/50 text-muted font-black text-sm flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500">
                            {step.n}
                          </div>
                          <h5 className="text-lg font-black text-main group-hover:text-primary transition-colors tracking-tight">
                            {step.t}
                          </h5>
                        </div>
                        <p className="text-sm text-muted font-medium leading-relaxed">{step.d}</p>
                      </div>
                    ))}
                </Motion.div>
              </AnimatePresence>

              {/* Checklist Integrado */}
              <div className="mt-16 pt-8 border-t border-soft/50">
                <div className="flex flex-wrap items-center justify-center gap-8">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={20} className="text-green-500" />
                    <span className="text-xs font-black text-main uppercase tracking-widest">
                      Checklist de Sucesso
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {["Dados Pessoais", "Documentos", "Endereço", "Protocolo"].map((check, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-[11px] font-bold text-muted bg-soft/30 px-4 py-2 rounded-full border border-soft"
                      >
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        {check}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Tabela de Erros (Full Width) */}
            <div className="w-full max-w-7xl mx-auto space-y-10 pb-32">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center border border-red-500/20">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h4 className="text-4xl font-black text-main uppercase tracking-tighter leading-none">
                    Erros e Soluções
                  </h4>
                  <p className="text-xs font-black text-red-500 uppercase tracking-[0.2em] mt-2">
                    Resolução técnica de problemas
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-[2.5rem] border border-soft bg-surface/20">
                <table className="w-full text-sm">
                  <thead className="bg-soft/30 text-muted uppercase text-[11px] font-black tracking-[0.2em] border-b border-soft">
                    <tr>
                      <th className="px-10 py-8 text-left">Problema Encontrado</th>
                      <th className="px-10 py-8 text-left">Solução Recomendada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-soft/50">
                    {erros.map((err, i) => (
                      <tr key={i} className="hover:bg-primary/5 transition-colors group">
                        <td className="px-10 py-8 font-black text-main group-hover:text-primary transition-colors text-lg">
                          {err.p}
                        </td>
                        <td className="px-10 py-8 text-muted font-medium italic text-base leading-relaxed">
                          {err.s}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default Treinamentos;

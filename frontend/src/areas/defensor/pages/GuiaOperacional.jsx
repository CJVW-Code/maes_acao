import React, { useState } from "react";
import {
  Search,
  FileText,
  ScanLine,
  Cpu,
  Scale,
  GraduationCap,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  Lock,
  Upload,
  Download,
  ArrowRight,
  Lightbulb,
  BookOpen,
  Zap,
} from "lucide-react";
import { motion as Motion, AnimatePresence } from "motion/react";

// ─── Mapeamento de Cores Explícito (Para evitar problemas de interpolação no Tailwind) ───
const colorMap = {
  primary: {
    bg: "bg-primary",
    text: "text-primary",
    border: "border-primary",
    bgSoft: "bg-primary/10",
    borderSoft: "border-primary/20",
    shadow: "shadow-primary/20",
  },
  special: {
    bg: "bg-special",
    text: "text-special",
    border: "border-special",
    bgSoft: "bg-special/10",
    borderSoft: "border-special/20",
    shadow: "shadow-special/20",
  },
  secondary: {
    bg: "bg-secondary",
    text: "text-secondary",
    border: "border-secondary",
    bgSoft: "bg-secondary/10",
    borderSoft: "border-secondary/20",
    shadow: "shadow-secondary/20",
  },
  laranja: {
    bg: "bg-laranja",
    text: "text-laranja",
    border: "border-laranja",
    bgSoft: "bg-laranja/10",
    borderSoft: "border-laranja/20",
    shadow: "shadow-laranja/20",
  },
  success: {
    bg: "bg-success",
    text: "text-success",
    border: "border-success",
    bgSoft: "bg-success/10",
    borderSoft: "border-success/20",
    shadow: "shadow-success/20",
  },
  error: {
    bg: "bg-error",
    text: "text-error",
    border: "border-error",
    bgSoft: "bg-error/10",
    borderSoft: "border-error/20",
    shadow: "shadow-error/20",
  },
};

// ─── Dados de cada etapa do fluxo ───────────────────────────────────────────
const etapasFluxo = [
  { n: 1, id: "triagem", icon: Search, label: "Triagem", colorKey: "primary" },
  { n: 2, id: "scanner", icon: ScanLine, label: "Scanner", colorKey: "special" },
  { n: 3, id: "ia", icon: Cpu, label: "IA", colorKey: "secondary" },
  { n: 4, id: "juridico", icon: Scale, label: "Jurídico", colorKey: "laranja" },
  { n: 5, id: "defensor", icon: GraduationCap, label: "Defensor", colorKey: "success" },
];

// ─── Seções detalhadas por papel ─────────────────────────────────────────────
const secoes = [
  {
    id: "triagem",
    etapa: 1,
    colorKey: "primary",
    icon: Search,
    titulo: "Servidor — Triagem",
    subtitulo: "Envia o caso pelo formulário e coleta os dados iniciais no Defsul",
    status_resultado: "",
    passos: [
      {
        tipo: "passo",
        texto: "Acessar o Portal do Cidadão, digita o CPF da assitida e clica em Nova Atendimento",
      },
      {
        tipo: "atenção",
        texto:
          "Sempre busque o CPF da assistida antes de criar um novo caso. O sistema detecta irmãos já cadastrados e pré-preenche os dados da representante automaticamente.",
      },
      { tipo: "passo", texto: "Selecionar o Tipo de Ação" },
      { tipo: "passo", texto: "Preencher dados pessoais da assistida e do requerido" },
      {
        tipo: "critico",
        texto:
          "O Tipo de Ação define o modelo da petição gerada pela IA. Uma seleção errada gera uma petição errada. Não pode ser alterado depois do envio.",
      },
      { tipo: "passo", texto: "Escrever o Relato (Execução não é necessário)" },
      {
        tipo: "info",
        texto:
          "O relato não precisa ser jurídico. Cubra: o que aconteceu, quando o requerido parou de pagar, etc...",
      },
      {
        tipo: "critico",
        texto:
          "Na etapa 3 Onde o caso será protocolado, SEMPRE selecione a sua unidade, caso preencha errado o caso irá para outra unidade, não ficará visível aos Defensores e Servidores da sua unidade.",
      },
      {
        tipo: "atenção",
        texto:
          "Se marcar 'Enviar documentos depois' o caso só será processado após o envio dos documentos (Isso será na Etapa 2).",
      },
      {
        tipo: "passo",
        texto:
          "Envia o caso → sistema gera o Protocolo automaticamente. A minuta é gerada após o upload dos documentos e o processamento em background.",
      },
    ],
    campos: [
      {
        campo: "CPF da Assistida",
        nivel: "critico",
        motivo: "Vincula ao histórico. CPF errado = caso duplicado",
      },
      {
        campo: "Tipo de Ação",
        nivel: "critico",
        motivo: "Define o modelo da petição. Irreversível após envio",
      },
      {
        campo: "Onde este caso será protocolado?",
        nivel: "critico",
        motivo:
          "Obrigatório. Define o fluxo do caso. Se errar, só com intervenção do Admin para corrigir o que pode atrasar o fluxo",
      },
      {
        campo: "Data da última parcela",
        nivel: "atenção",
        motivo: "Campo crítico para execuções de alimentos",
      },
      {
        campo: "Valor da dívida (Execução)",
        nivel: "atenção",
        motivo: "Determina se cabe rito de prisão (≥ 3 meses)",
      },
      {
        campo: "CPF do Requerido e/ou Criança/Adolescente",
        nivel: "info",
        motivo: "Preencher se disponível. Se não tiver, deixe em branco",
      },
    ],
  },
  {
    id: "scanner",
    etapa: 2,
    colorKey: "special",
    icon: ScanLine,
    titulo: "Servidor — Scanner / Balcão",
    subtitulo: "Esta etapa depende do fluxo de atendimento da sua unidade.",
    status_resultado: "",
    passos: [
      { tipo: "passo", texto: "Acessar o Portal do Cidadão." },
      { tipo: "passo", texto: "Digitar o CPF da representante." },
      { tipo: "passo", texto: "Clicar em Anexar." },
      { tipo: "passo", texto: "Clicar em 'Importar Documentos'." },
      { tipo: "passo", texto: "Selecionar todos os documentos." },
      { tipo: "passo", texto: "Selecionar os Identificadores (RG, CPF, etc)." },
      { tipo: "passo", texto: "Clicar em 'Confirmar e Enviar'." },
      {
        tipo: "info",
        texto:
          "O sistema comprime imagens acima de 1,5 MB automaticamente. Não se preocupe com o tamanho dos arquivos.",
      },
      { tipo: "passo", texto: "Clicar em Finalizar Upload" },
      {
        tipo: "atenção",
        texto:
          "Após finalizar, o caso será processado e disponibilzar a minuta. Não é necessário aguardar na tela.",
      },
    ],
    campos: [],
  },
  {
    id: "ia",
    etapa: 3,
    colorKey: "secondary",
    icon: Cpu,
    titulo: "Processamento (Automático)",
    subtitulo: "A IA gera o 'Dos Fatos' e o sistema gera a minuta pronta",
    status_resultado: "processando → pronto para analise",
    passos: [
      {
        tipo: "passo",
        texto: "O sistema processa os metadados e informações da qualificação.",
      },
      {
        tipo: "passo",
        texto:
          "Geração 'Dos Fatos': A IA gera a narrativa jurídica com base no relato coletado e se disponível guarda e o direito de visitas.",
      },
      {
        tipo: "passo",
        texto:
          "Montagem da Peça: O sistema gera o arquivo .docx com o template correto e campos preenchidos.",
      },
      {
        tipo: "atenção",
        texto: "Este processo leva cerca de 30 a 60 segundos após o upload dos documentos.",
      },
      {
        tipo: "info",
        texto:
          "Se houver falha, o status mudará para 'Erro Processamento' e o Admin poderá reiniciar manualmente.",
      },
    ],
    campos: [],
  },
  {
    id: "juridico",
    etapa: 4,
    colorKey: "laranja",
    icon: Scale,
    titulo: "Servidor — Analista",
    subtitulo:
      "Revisa a minuta gerada, analisa os documentos, cadastra no SOLAR/SIGAD e libera para o Protocolo",
    status_resultado: "→ liberado para protocolo",
    passos: [
      { tipo: "passo", texto: "Filtrar casos por status Pronto para Análise" },
      { tipo: "passo", texto: "Abri o caso" },
      {
        tipo: "critico",
        texto:
          "Ao abrir, o caso e todos os casos relacionado (da mesma mãe) fica travado no seu nome. Nenhum outro servidor consegue editar ou abrir o caso. O caso será liberado assim que voce mudar o status para 'liberado para protocolo'.",
      },
      {
        tipo: "info",
        texto: "Se necessário você pode compartilhar o caso com outra pessoa utilizando.",
      },
      {
        tipo: "info",
        texto:
          "Ao revisar o dos fatos gerado pela IA, confira se a IA não gerou informação que não consta nos dados fornecidos pela assistida",
      },
      { tipo: "passo", texto: "Na aba Minuta, revisar o DOS FATOS gerado pela IA" },
      {
        tipo: "info",
        texto:
          "Você pode baixar a minuta, editá-la e salvar, depois basta você anexar a versão atualizada no sistema e sinalizar em Feedback na aba Gestão.",
      },
      { tipo: "passo", texto: "Na aba 'Visão Geral', clicar em Baixar Tudo (.zip)" },
      {
        tipo: "info",
        texto:
          "O ZIP contém o atendimento.json e todos os documentos. Use a Extensão Mães em Ação no Chrome para automatizar parte do preenchimento no SOLAR.",
      },
      {
        tipo: "passo",
        texto: "Cadastrar o atendimento no SOLAR com a extensão.",
      },
      {
        tipo: "passo",
        texto:
          "Após fazer a análise e cadastrar no Sistema de atendimento usado pela sua unidade adicione essa e outras informações se necessário no campo Feedback/Anotações e mude o status para 'Liberado para Protocolo'.",
      },
    ],
    campos: [],
  },
  {
    id: "defensor",
    etapa: 5,
    colorKey: "success",
    icon: GraduationCap,
    titulo: "Defensor — Protocolo e Finalização",
    subtitulo: "Protocola o caso e finaliza o caso no Defsul",
    status_resultado: "liberado para protocolo → protocolado",
    passos: [
      { tipo: "passo", texto: "Filtrar casos por status Liberado para Protocolo" },
      { tipo: "passo", texto: "Assumir o caso (lock permanente — mesma regra do servidor)." },
      {
        tipo: "passo",
        texto: "Na aba Gestão & Finalização, Verificar o campo 'Anotações / Feedback'.",
      },
      {
        tipo: "info",
        texto: "É importante para saber o que foi feito pelo servidor.",
      },
      {
        tipo: "passo",
        texto: "Protocolar o caso.",
      },
      {
        tipo: "passo",
        texto: "Voltar ao Defsul e preencher: Número SOLAR/SIGAD + Número do Processo (TJ)",
      },
      { tipo: "passo", texto: "Anexar a Capa Processual (PDF gerada pelo sistema judicial)" },
      {
        tipo: "passo",
        texto:
          "Clicar em Concluir Caso → status muda para Protocolado, isso registra no sistema o seu trabalho e é extremamente importante.",
      },
      {
        tipo: "critico",
        texto:
          "Se o caso não for concluído, ele ficará como Liberado para Protocolo, como pendente e causará confusões aos coordenadores que fazem o monitoramento.",
      },
    ],
    campos: [
      {
        campo: "Entrega da Capa Processual",
        nivel: "critico",
        motivo:
          "O servidor digita o CPF da assistida no Portal do Cidadão, vai ser exibido o número do processo e a capa processual disponível para download.",
      },
    ],
  },
];

// ─── Paleta de nível de campo ─────────────────────────────────────────────────
const nivelCampo = {
  critico: { bg: "bg-error/10 dark:bg-error/20 border-error/30 text-error", icon: AlertTriangle },
  atenção: {
    bg: "bg-laranja/10 dark:bg-laranja/20 border-laranja/30 text-laranja",
    icon: AlertTriangle,
  },
  info: { bg: "bg-special/10 dark:bg-special/20 border-special/30 text-special", icon: Info },
};

// ─── Mapeamento de tipo de passo → visual ────────────────────────────────────
const tipoPasso = {
  passo: { bg: "bg-surface border border-soft", icon: CheckCircle, textClass: "text-success" },
  critico: {
    bg: "bg-error/10 dark:bg-error/20 border border-error/20",
    icon: AlertTriangle,
    textClass: "text-error",
  },
  atenção: {
    bg: "bg-laranja/10 dark:bg-laranja/20 border border-laranja/20",
    icon: AlertTriangle,
    textClass: "text-laranja",
  },
  info: {
    bg: "bg-special/10 dark:bg-special/20 border border-special/20",
    icon: Info,
    textClass: "text-special",
  },
};

// ─── Componente de Seção expansível ──────────────────────────────────────────
const SecaoRole = ({ secao, aberta, onToggle }) => {
  const Icon = secao.icon;
  const colors = colorMap[secao.colorKey];

  return (
    <Motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[1.5rem] overflow-hidden shadow-sm border transition-all duration-300 ${
        aberta ? `${colors.borderSoft} bg-surface shadow-lg` : "border-soft bg-surface/50"
      }`}
    >
      {/* Header clicável */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-6 hover:bg-surface transition-all group text-left"
        id={`secao-${secao.id}`}
      >
        <div className="flex items-center gap-5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 ${colors.bg}`}
          >
            <Icon size={24} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${colors.bgSoft} ${colors.text}`}
              >
                Etapa {secao.etapa}
              </span>
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest opacity-60">
                {secao.status_resultado}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-main leading-tight">{secao.titulo}</h2>
            <p className="text-sm text-muted font-medium mt-0.5">{secao.subtitulo}</p>
          </div>
        </div>
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
            aberta ? `${colors.bg} text-white` : `${colors.bgSoft} ${colors.text}`
          }`}
          style={{ transform: aberta ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <ChevronDown size={18} />
        </div>
      </button>

      {/* Conteúdo expansível */}
      <AnimatePresence>
        {aberta && (
          <Motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-8 pt-2 space-y-6 border-t border-soft/30">
              {/* Passos */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2 opacity-70">
                  <Zap size={12} /> Fluxo de execução
                </h3>
                <div className="space-y-3">
                  {secao.passos.map((passo, i) => {
                    const estilo = tipoPasso[passo.tipo];
                    const PIcon = estilo.icon;
                    return (
                      <div key={i} className={`flex gap-4 items-start p-4 rounded-xl ${estilo.bg}`}>
                        <PIcon size={18} className={`shrink-0 mt-0.5 ${estilo.textClass}`} />
                        <div className="text-sm leading-relaxed text-main font-medium">
                          {passo.tipo === "passo" && (
                            <span className="font-black text-muted/40 mr-2 font-mono text-[10px]">
                              {secao.passos.filter((p) => p.tipo === "passo").indexOf(passo) + 1}
                            </span>
                          )}
                          {passo.texto}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Campos críticos (se houver) */}
              {secao.campos.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2 opacity-70">
                    <AlertTriangle size={12} /> Pontos de atenção
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {secao.campos.map((c, i) => {
                      const n = nivelCampo[c.nivel];
                      const NIcon = n.icon;
                      return (
                        <div
                          key={i}
                          className={`flex gap-3 items-start p-4 rounded-xl border text-sm ${n.bg} border-soft/50`}
                        >
                          <NIcon size={16} className={`shrink-0 mt-0.5 ${n.text}`} />
                          <div>
                            <p className="font-bold leading-tight">{c.campo}</p>
                            <p className="text-[11px] opacity-70 mt-1 leading-relaxed font-medium">
                              {c.motivo}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────
export const GuiaOperacional = () => {
  const [etapaAtiva, setEtapaAtiva] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [activeTooltip, setActiveTooltip] = useState(null);

  const handleEtapaClick = (n) => {
    const idMap = {
      1: "triagem",
      2: "scanner",
      3: "ia",
      4: "juridico",
      5: "defensor",
    };
    const targetId = idMap[n];
    if (targetId) {
      setEtapaAtiva(n);
      setActiveRole(targetId);
      setTimeout(() => {
        const element = document.getElementById(`secao-${targetId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-20 animate-fade-in">
      {/* Hero Section - Estilo Antigo Restaurado */}
      <section className="pt-4 text-left">
        <div className="space-y-2">
          <div className="space-y-2">
            <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-main leading-[0.9]">
              Guia de <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-highlight">
                Operação.
              </span>
            </h1>
          </div>
        </div>
      </section>

      {/* ── Fluxo visual horizontal ──────────────────────────────────────── */}
      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2 opacity-60">
          <Zap size={14} />
          Workflow do Sistema — selecione uma etapa para detalhar
        </p>

        <div className="bg-surface/40 backdrop-blur-sm border border-soft rounded-[2.5rem] p-4 shadow-sm overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {etapasFluxo.map((e, i) => {
              const EIcon = e.icon;
              const ativa = etapaAtiva === e.n;
              const colors = colorMap[e.colorKey];

              return (
                <React.Fragment key={e.n}>
                  <button
                    onClick={() => handleEtapaClick(e.n)}
                    className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${
                      ativa ? `${colors.bg} ${colors.shadow} scale-[1.02]` : "hover:bg-surface/80"
                    }`}
                    id={`etapa-btn-${e.n}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        ativa ? "bg-white/20" : `${colors.bgSoft} ${colors.text}`
                      }`}
                    >
                      <EIcon size={20} className={ativa ? "text-white" : ""} />
                    </div>
                    <div className="text-left">
                      <div
                        className={`text-[9px] font-black uppercase tracking-widest ${ativa ? "text-white/60" : "text-muted opacity-50"}`}
                      >
                        0{e.n}
                      </div>
                      <div
                        className={`text-sm font-black whitespace-nowrap ${ativa ? "text-white" : "text-main"}`}
                      >
                        {e.label}
                      </div>
                    </div>
                  </button>

                  {i < etapasFluxo.length - 1 && (
                    <ArrowRight size={16} className="text-soft mx-1 opacity-40" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Status badges do fluxo */}
        <div className="flex flex-wrap gap-2">
          {[
            {
              label: "aguardando documentos",
              colorKey: "laranja",
              desc: "Pausado aguardando envio de documentos.",
            },
            {
              label: "documentacao completa",
              colorKey: "special",
              desc: "Documentos entregues e prontos para a IA.",
            },
            {
              label: "processando ia",
              colorKey: "secondary",
              desc: "IA gerando a minuta jurídica em background.",
            },
            {
              label: "pronto para análise",
              colorKey: "primary",
              desc: "Minuta pronta para revisão do servidor jurídico.",
            },
            {
              label: "liberado para protocolo",
              colorKey: "success",
              desc: "Aprovado e pronto para o sistema oficial.",
            },
          ].map((s, i) => (
            <div
              key={i}
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl border border-soft bg-surface/50 cursor-help group/status transition-all hover:bg-surface hover:shadow-sm"
              onMouseEnter={() => setActiveTooltip(i)}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <AnimatePresence>
                {activeTooltip === i && (
                  <Motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="tooltip-premium bottom-[calc(100%+12px)] left-0 w-56"
                  >
                    <p className="text-xs font-bold mb-1 uppercase tracking-tighter">{s.label}</p>
                    <p className="text-[10px] opacity-80 leading-relaxed font-medium">{s.desc}</p>
                  </Motion.div>
                )}
              </AnimatePresence>

              <div className={`w-1.5 h-1.5 rounded-full ${colorMap[s.colorKey].bg}`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-muted">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Seções por papel ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-2 opacity-60">
          <Lightbulb size={14} />
          Guia Passo a Passo — expanda para detalhes técnicos
        </p>
        <div className="space-y-4">
          {secoes.map((s) => (
            <SecaoRole
              key={s.id}
              secao={s}
              aberta={activeRole === s.id}
              onToggle={() => setActiveRole(activeRole === s.id ? null : s.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Regras de Ouro ───────────────────────────────────────────────── */}
      <div className="bg-surface border border-soft p-10 rounded-[3rem] shadow-sm space-y-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />

        <h3 className="text-2xl font-black text-main uppercase tracking-tight flex items-center gap-3">
          <Lock size={28} className="text-primary" />
          Regras de Ouro do Sistema
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Lock,
              titulo: "Lock Permanente",
              texto:
                "Ao assumir um caso, ele fica vinculado a você. Apenas seguindo o fluxo de atendimento o caso será destravado.",
            },
            {
              icon: Upload,
              titulo: "Capa Processual",
              texto: "Sempre anexe a capa do TJ e entregue a via impressa à assistida.",
            },
            {
              icon: Download,
              titulo: "Upload em Lote",
              texto:
                "Arraste todos os documentos de uma vez. O sistema comprime tudo automaticamente.",
            },
            {
              icon: Cpu,
              titulo: "IA em Background",
              texto:
                "A IA processa sozinha. Você pode sair da tela e voltar quando o status mudar.",
            },
            {
              icon: Search,
              titulo: "Busca Prévia",
              texto:
                "Sempre consulte o CPF antes. O sistema detecta vínculos familiares e agiliza o cadastro.",
            },
            {
              icon: AlertTriangle,
              titulo: "Tipo de Ação",
              texto:
                "Define o template jurídico. Escolha com cautela, pois não pode ser alterado após envio.",
            },
          ].map((r, i) => {
            const RIcon = r.icon;
            return (
              <div key={i} className="group p-2 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center transition-colors group-hover:bg-primary/10">
                    <RIcon size={20} className="text-primary" />
                  </div>
                  <p className="font-black text-sm text-main uppercase tracking-tight">
                    {r.titulo}
                  </p>
                </div>
                <p className="text-xs text-muted leading-relaxed font-medium opacity-80">
                  {r.texto}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="pt-10 border-t border-soft text-center">
        <p className="text-muted text-xs font-medium opacity-60">
          Suporte Técnico: Identifique o <strong>Protocolo</strong> e contate seu Coordenador de
          Unidade.
        </p>
      </footer>
    </div>
  );
};

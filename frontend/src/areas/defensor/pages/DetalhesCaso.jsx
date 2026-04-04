import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  ChevronLeft,
  Download,
  Mic,
  Eye,
  Upload,
  CheckCircle,
  FileText,
  Scale,
  Trash2,
  HelpCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
  Save,
  Video,
  Calendar,
  Bell,
  Pencil,
  X,
  Check,
  AlertTriangle,
  History,
  Copy,
  Archive,
  ArchiveRestore,
  LayoutDashboard,
  User,
} from "lucide-react";
import { API_BASE } from "../../../utils/apiBase";
import { useToast } from "../../../contexts/ToastContext";
import { useConfirm } from "../../../contexts/ConfirmContext";
import { TimelineAuditoria } from "../components/TimelineAuditoria";
import useSWR from "swr";
import { authFetch } from "../../../utils/apiBase"; // Ajuste o caminho conforme o arquivo
//compenetes detalhes
import { InfoAssistido } from "../components/detalhes/InfoAssistido";
import { PainelAgendamento } from "../components/detalhes/PainelAgendamento";
import { PainelDocumentos } from "../components/detalhes/PainelDocumentos";
import { PainelCasosRelacionados } from "../components/detalhes/PainelCasosRelacionados";
const fetcher = async (url) => {
  const response = await authFetch(url);
  if (!response.ok) throw new Error("Erro ao buscar dados.");
  return response.json();
};

const manualStatusOptions = [
  { value: "em_analise", label: "Em análise" },
  { value: "aguardando_docs", label: "Pendentes de documentos" },
  {
    value: "reuniao_presencial_agendada",
    label: "Reunião Presencial Agendada",
  },
  { value: "reuniao_online_agendada", label: "Reunião Online Agendada" },
];

const statusBadges = {
  recebido: "bg-slate-100 text-slate-700 border-slate-200",
  em_analise: "bg-special/10 text-special border-special/20",
  documentos_entregues: "bg-highlight/15 text-highlight border-highlight/30",
  reuniao_agendada: "bg-purple-100 text-purple-800 border-purple-200",
  reuniao_online_agendada: "bg-blue-100 text-blue-800 border-blue-200",
  reuniao_presencial_agendada:
    "bg-purple-100 text-purple-800 border-purple-200",
  reagendamento_solicitado: "bg-error/10 text-error border-error/20",
  aguardando_docs: "bg-orange-100 text-orange-800 border-orange-200",
  processando: "bg-indigo-100 text-indigo-800 border-indigo-200",
  processado: "bg-green-100 text-green-800 border-green-200",
  encaminhado_solar: "bg-teal-100 text-teal-800 border-teal-200",
  finalizado: "bg-gray-100 text-gray-800 border-gray-200",
  erro: "bg-red-100 text-red-800 border-red-200",
};

const statusDescriptions = {
  recebido:
    "O caso foi submetido e está na fila para processamento automático.",
  processando:
    "O sistema está extraindo informações dos documentos e gerando a minuta inicial.",
  processado:
    "O processamento automático foi concluído. A minuta está pronta para revisão.",
  em_analise:
    "O caso está sendo analisado manualmente por um defensor ou estagiário.",
  aguardando_docs:
    "O processo está pausado, aguardando o envio de documentos adicionais pelo cidadão.",
  documentos_entregues:
    "O cidadão enviou novos documentos. Verifique os anexos.",
  reuniao_agendada:
    "O atendimento com o defensor foi agendado. Aguarde a data prevista.",
  reuniao_online_agendada:
    "O atendimento online foi agendado. Configure o link e a data abaixo.",
  reuniao_presencial_agendada:
    "O atendimento presencial foi agendado. Informe o local e data abaixo.",
  reagendamento_solicitado:
    "O cidadão informou que não pode comparecer. Verifique o motivo em 'Anotações/Feedback'.",
  encaminhado_solar:
    "O caso foi finalizado e encaminhado para o sistema Solar da defensoria.",
  finalizado: "O caso foi concluído.",
  erro: "Ocorreu um erro crítico durante o processamento automático. Verifique os logs do sistema.",
};


const CollapsibleText = ({
  text,
  maxLength = 350,
  isPre = false,
  defaultCollapsed = true,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  if (!text || text.length === 0) {
    return <p className="text-sm text-muted">Nenhuma informação fornecida.</p>;
  }

  const textToShow =
    isCollapsed && text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;

  const Wrapper = ({ children }) =>
    isPre ? (
      <pre className="text-sm whitespace-pre-wrap font-sans p-4 bg-surface border border-soft rounded-lg">
        {children}
      </pre>
    ) : (
      <p className="text-muted whitespace-pre-wrap">{children}</p>
    );

  return (
    <div>
      <Wrapper>{textToShow}</Wrapper>
      {text.length > maxLength && (
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="btn btn-ghost btn-sm mt-2"
        >
          {isCollapsed ? "Ler mais" : "Ler menos"}
        </button>
      )}
    </div>
  );
};

export const DetalhesCaso = () => {
  const { id } = useParams();
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showFullPetition, setShowFullPetition] = useState(false);
  const [numSolar, setNumSolar] = useState("");
  const [numProcesso, setNumProcesso] = useState("");
  const [arquivoCapa, setArquivoCapa] = useState(null);
  const [enviandoFinalizacao, setEnviandoFinalizacao] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackInitialized, setFeedbackInitialized] = useState(false);
  const [isGeneratingTermo, setIsGeneratingTermo] = useState(false);
  const [isRegeneratingMinuta, setIsRegeneratingMinuta] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [dataAgendamento, setDataAgendamento] = useState("");
  const [linkAgendamento, setLinkAgendamento] = useState("");
  const [isAgendando, setIsAgendando] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [pendenciaTexto, setPendenciaTexto] = useState("");
  const [editingFile, setEditingFile] = useState({ url: null, name: "" });
  const [isRenaming, setIsRenaming] = useState(false);
  const [showStatusHelp, setShowStatusHelp] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [activeTab, setActiveTab] = useState("visao_geral");

  // 1. O SWR substitui o estado do caso, o fetchDetalhes, e o polling!
  const {
    data: caso,
    error,
    isLoading,
    mutate,
  } = useSWR(
    token && id && id !== "arquivados" && id !== "undefined"
      ? `/casos/${id}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 600000,
      // Polling Automático: Se for 'processando', atualiza a cada 5s. Senão, para (0).
      refreshInterval: (data) => (data?.status === "processando" ? 5000 : 0),
      onError: (err) => {
        // Se der erro 401, o SWR chama o logout!
        if (err.message.includes("401") || err.status === 401) {
          logout();
        }
      },
    },
  );

  // 2. Preenchimento de datas e formulários após o caso carregar
  useEffect(() => {
    if (caso) {
      if (caso.agendamento_data) {
        const date = new Date(caso.agendamento_data);
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = new Date(date.getTime() - offset)
          .toISOString()
          .slice(0, 16);
        setDataAgendamento(localISOTime);
      }
      setLinkAgendamento(caso.agendamento_link || "");

      if (!feedbackInitialized) {
        setFeedback(caso.feedback || "");
        setPendenciaTexto(caso.descricao_pendencia || "");
        setNumSolar(caso.numero_solar || "");
        setFeedbackInitialized(true);
      }
    }
  }, [caso, feedbackInitialized]);

  // 3. Ajuste sutil no seu salvarPendencia
const handleSalvarPendencia = async () => {
  if (!pendenciaTexto || !pendenciaTexto.trim()) return toast.warning("...");

  setIsUpdating(true);
  try {
    const response = await fetch(`${API_BASE}/casos/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: "aguardando_docs",
        descricao_pendencia: pendenciaTexto,
      }),
    });

    if (!response.ok) throw new Error("Falha ao atualizar.");

    mutate(); // CORRIGIDO
    toast.success("Descrição salva!");
  } catch (error) {
    toast.error(error.message);
  } finally {
    setIsUpdating(false);
  }
};

const handleStatusChange = async (novoStatus) => {
  if (!caso || !novoStatus || novoStatus === caso.status) return;

  setIsUpdating(true);
  try {
    const response = await fetch(`${API_BASE}/casos/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: novoStatus,
        descricao_pendencia:
          novoStatus === "aguardando_docs"
            ? pendenciaTexto
            : caso.descricao_pendencia,
      }),
    });

    if (!response.ok) {
      throw new Error("Falha ao atualizar o status.");
    }

    await response.json();
    mutate(); // CORRIGIDO
  } catch (error) {
    console.error(error);
    toast.error(error.message);
  } finally {
    setIsUpdating(false);
  }
};

const handleSalvarSolar = async () => {
  const solarLimpo = numSolar.replace(/\D/g, "");
  const valorParaSalvar = solarLimpo === "" ? null : solarLimpo;
  const valorAtual = caso.numero_solar || null;

  if (valorParaSalvar === valorAtual) return;

  try {
    const response = await fetch(`${API_BASE}/casos/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        numero_solar: valorParaSalvar,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "Erro ao salvar dados.");
    }

    mutate(); // CORRIGIDO
    toast.success("Número Solar salvo!");
  } catch (error) {
    console.error(error);
    toast.error(error.message);
  }
};

const handleCopySolar = () => {
  if (!numSolar) return;
  navigator.clipboard.writeText(numSolar);
  toast.success("Número Solar copiado!");
};

if (isLoading) {
  return (
    <div className="card text-center text-muted">Carregando detalhes...</div>
  );
}

if (!caso) {
  return (
    <div className="card border-l-4 border-l-red-500 text-red-600">
      Caso não encontrado.
    </div>
  );
}

const statusKey = (caso.status || "recebido").toLowerCase();
const badgeClass = statusBadges[statusKey] || "";

// A função renderDataField que estava aqui pode ser apagada se você já levou para o InfoAssistido!
// Se ainda estiver usando aqui fora, pode deixar.

const handleGenerateFatos = async () => {
  setIsGenerating(true);
  try {
    const response = await fetch(`${API_BASE}/casos/${id}/gerar-fatos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Falha ao gerar a sessão dos fatos.");
    }

    await response.json();
    mutate(); // CORRIGIDO
    toast.success("Solicitação enviada. O sistema está processando...");
  } catch (error) {
    console.error(error);
    toast.error(error.message);
  } finally {
    setIsGenerating(false);
  }
};

const handleGenerateTermo = async () => {
  setIsGeneratingTermo(true);
  try {
    const response = await fetch(`${API_BASE}/casos/${id}/gerar-termo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Falha ao gerar o termo de declaração.");
    }

    await response.json();
    mutate(); // CORRIGIDO
    toast.success("Termo de declaração gerado com sucesso!");
  } catch (error) {
    console.error(error);
    toast.error(error.message);
  } finally {
    setIsGeneratingTermo(false);
  }
};

const handleRegenerateMinuta = async () => {
  if (
    !(await confirm(
      "Isso irá gerar um novo arquivo Word com os dados atuais. O arquivo anterior será substituído. Continuar?",
      "Regerar Minuta",
    ))
  )
    return;

  setIsRegeneratingMinuta(true);
  try {
    const response = await fetch(`${API_BASE}/casos/${id}/regerar-minuta`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error("Falha ao regerar minuta.");

    await response.json();
    mutate(); // CORRIGIDO
    toast.success("Minuta regerada com sucesso!");
  } catch (error) {
    toast.error(error.message);
  } finally {
    setIsRegeneratingMinuta(false);
  }
};

const handleSaveFeedback = async () => {
  setSavingFeedback(true);
  try {
    const response = await fetch(`${API_BASE}/casos/${id}/feedback`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ feedback }),
    });

    if (!response.ok) throw new Error("Falha ao salvar anotações.");

    mutate(); // Garantindo que o feedback atualizado vá pro cache
    toast.success("Anotações salvas com sucesso.");
  } catch (error) {
    console.error(error);
    toast.error(error.message);
  } finally {
    setSavingFeedback(false);
  }
};

const handleFinalizarCaso = async (e) => {
  e.preventDefault();
  if (!arquivoCapa || !numSolar || !numProcesso) {
    toast.warning("Por favor, preencha todos os campos e anexe a capa.");
    return;
  }

  setEnviandoFinalizacao(true);
  const formData = new FormData();
  formData.append("numero_solar", numSolar);
  formData.append("numero_processo", numProcesso);
  formData.append("capa", arquivoCapa);

  try {
    const response = await fetch(`${API_BASE}/casos/${id}/finalizar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) throw new Error("Erro ao finalizar caso.");

    toast.success("Caso finalizado e capa enviada com sucesso!");
    mutate(); // Em vez do reload agressivo da página, o SWR atualiza suavemente
  } catch (error) {
    console.error(error);
    toast.error("Erro ao finalizar: " + error.message);
  } finally {
    setEnviandoFinalizacao(false);
  }
};

const handleDeleteCaso = async () => {
  if (
    await confirm(
      `Tem certeza que deseja excluir permanentemente o caso ${caso.protocolo}?`,
      "Excluir Caso",
    )
  ) {
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/casos/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let errorMessage = "Falha ao excluir o caso.";
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.message || errorData.error || response.statusText;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      toast.success("Caso excluído com sucesso.");
      window.location.href = "/painel";
    } catch (error) {
      console.error("Erro ao excluir caso:", error);
      toast.error(error.message || "Não foi possível processar a exclusão.");
    } finally {
      setIsDeleting(false);
    }
  }
};

const handleAgendarReuniao = async () => {
  if (!dataAgendamento || !linkAgendamento) {
    toast.warning("Preencha a data e o link da reunião.");
    return;
  }

  setIsAgendando(true);
  try {
    const response = await fetch(`${API_BASE}/casos/${id}/agendar`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        agendamento_data: new Date(dataAgendamento).toISOString(),
        agendamento_link: linkAgendamento,
      }),
    });
    if (!response.ok) throw new Error("Erro ao salvar agendamento.");
    toast.success("Atendimento agendado com sucesso!");
    mutate(); // CORRIGIDO (Era fetchDetalhes)
  } catch (error) {
    toast.error(error.message);
  } finally {
    setIsAgendando(false);
  }
};

const handleReverterFinalizacao = async () => {
  if (
    !(await confirm(
      "Esta ação irá reabrir o caso, remover os números de Solar/Processo e excluir a capa processual anexada. Deseja continuar?",
      "Reverter Finalização?",
    ))
  ) {
    return;
  }

  setIsReverting(true);
  try {
    const response = await fetch(
      `${API_BASE}/casos/${id}/reverter-finalizacao`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Falha ao reverter a finalização.");
    }

    toast.success("Finalização revertida! O caso foi reaberto para edição.");
    mutate(); // CORRIGIDO (Era fetchDetalhes)
  } catch (error) {
    console.error("Erro ao reverter finalização:", error);
    toast.error(error.message);
  } finally {
    setIsReverting(false);
  }
};

const handleReprocessar = async () => {
  if (
    !(await confirm(
      "Isso irá reiniciar todo o processo de leitura de documentos (OCR) e geração de texto pela IA. Deseja continuar?",
      "Reprocessar Caso",
    ))
  ) {
    return;
  }

  setIsReprocessing(true);
  try {
    const response = await fetch(`${API_BASE}/casos/${id}/reprocessar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Erro ao solicitar reprocessamento.");

    toast.success("Processamento reiniciado! Aguarde alguns instantes.");
    mutate(); // CORRIGIDO (Era fetchDetalhes)
  } catch (error) {
    toast.error(error.message);
  } finally {
    setIsReprocessing(false);
  }
};

const handleArquivarClick = async () => {
  if (caso.arquivado) {
    if (
      await confirm(
        "Deseja mover este caso de volta para os Ativos?",
        "Restaurar Caso",
      )
    ) {
      await processarArquivamento(false, null);
    }
  } else {
    setArchiveReason("");
    setArchiveModalOpen(true);
  }
};

  const confirmArchive = async () => {
    if (archiveReason.trim().length < 5) {
      toast.error("Por favor, informe um motivo válido (mín. 5 caracteres).");
      return;
    }
    await processarArquivamento(true, archiveReason);
    setArchiveModalOpen(false);
  };

  const processarArquivamento = async (novoEstado, motivo) => {
    try {
      const response = await fetch(`${API_BASE}/casos/${id}/arquivar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ arquivado: novoEstado, motivo }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao alterar status.");
      }

      toast.success(novoEstado ? "Caso arquivado!" : "Caso restaurado!");
      navigate(novoEstado ? "/painel/casos/arquivados" : "/painel/casos");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveRename = async () => {
    if (!editingFile.url || !editingFile.name.trim()) return;
    setIsRenaming(true);
    try {
      const response = await fetch(
        `${API_BASE}/casos/${id}/documento/renomear`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileUrl: editingFile.url,
            newName: editingFile.name,
          }),
        },
      );
      if (!response.ok) throw new Error("Falha ao renomear arquivo.");
      toast.success("Arquivo renomeado com sucesso!");
      setEditingFile({ url: null, name: "" });
      mutate();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Link
            to="/painel"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-600"
          >
            <ChevronLeft size={18} />
            Voltar para o dashboard
          </Link>
          <h1 className="heading-1 mt-3">{caso.nome_assistido}</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
            <p className="text-muted text-sm">
              Protocolo {caso.protocolo} • {caso.tipo_acao}
            </p>
            <div className="flex items-center gap-2 bg-surface border border-soft rounded-md px-3 py-1.5 shadow-sm">
              <label
                htmlFor="numeroSolar"
                className="text-xs font-bold text-muted uppercase tracking-wider"
              >
                Solar:
              </label>
              <input
                type="text"
                id="numeroSolar"
                value={numSolar}
                onChange={(e) => {
                  // Permite apenas números enquanto digita
                  setNumSolar(e.target.value.replace(/\D/g, ""));
                }}
                onBlur={handleSalvarSolar}
                className="bg-transparent border-none outline-none text-sm font-mono w-32 text-primary font-bold placeholder:text-muted/50"
                placeholder="---"
                title="Número do Atendimento Solar"
              />
              <button
                onClick={handleCopySolar}
                className="text-muted hover:text-primary transition-colors"
                title="Copiar número"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* NOTIFICAÇÃO DE ARQUIVAMENTO */}
      {caso.arquivado && (
        <div className="alert flex items-start gap-3 mb-6 animate-fade-in">
          <Archive className="text-muted shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-bold">Caso Arquivado</h3>
            <p className="text-muted mt-1">
              <strong>Motivo:</strong>{" "}
              {caso.motivo_arquivamento || "Não informado."}
            </p>
          </div>
        </div>
      )}

      {/* NOTIFICAÇÃO DE DOCUMENTOS ENTREGUES */}
      {caso.status === "documentos_entregues" && (
        <div className="bg-highlight/10 border-l-4 border-highlight p-4 rounded-r shadow-sm flex items-start gap-3 animate-fade-in mb-6">
          <Bell className="text-highlight shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-bold text-highlight">
              Novos Documentos Recebidos!
            </h3>
            <p className="text-highlight/90 text-sm">
              O cidadão enviou os documentos complementares solicitados.
              Verifique os itens destacados abaixo na seção de anexos.
            </p>
          </div>
        </div>
      )}

      {/* --- NAVEGAÇÃO POR ABAS --- */}
      <div className="flex items-center gap-1 border-b border-soft mb-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("visao_geral")}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "visao_geral"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-primary hover:border-primary/30"
          }`}
        >
          <LayoutDashboard size={18} />
          Visão Geral & Documentos
        </button>
        <button
          onClick={() => setActiveTab("minuta")}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "minuta"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-primary hover:border-primary/30"
          }`}
        >
          <Scale size={18} />
          Minuta
        </button>
        <button
          onClick={() => setActiveTab("relacionados")}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "relacionados"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-primary hover:border-primary/30"
          }`}
        >
          <History size={18} />
          Casos Relacionados
        </button>
        <button
          onClick={() => setActiveTab("gestao")}
          className={`px-6 py-3 text-sm font-medium transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "gestao"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-primary hover:border-primary/30"
          }`}
        >
          <CheckCircle size={18} />
          Gestão & Finalização
        </button>
      </div>

      {/* --- CONTEÚDO DAS ABAS --- */}
      <div className="min-h-[500px]">
        
        {/* ABA: CASOS RELACIONADOS */}
        {activeTab === "relacionados" && (
          <div className="space-y-6 animate-fade-in">
             <div className="card space-y-4">
               <h2 className="heading-2 border-soft pb-2 border-b">
                 Casos Relacionados
               </h2>
               <p className="text-sm text-muted">
                 Abaixo estão outros protocolos vinculados ao mesmo CPF (geralmente representantes legais gerenciando múltiplos assistidos).
               </p>
               <PainelCasosRelacionados casoOriginal={caso} />
             </div>
          </div>
        )}

        {/* ABA 1: VISÃO GERAL */}
        {activeTab === "visao_geral" && (
          <div className="space-y-6 animate-fade-in">
            <InfoAssistido caso={caso} />
          {/* SEÇÃO DE FEEDBACK / ANOTAÇÕES */}
            <section className="card space-y-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="text-primary" />
                <h2 className="heading-2">Anotações / Feedback</h2>
              </div>
              <p className="text-sm text-muted">
                Espaço para observações internas sobre o caso ou ajustes
                necessários na minuta.
              </p>
              <textarea
                className="input min-h-[120px] resize-y font-sans"
                placeholder="Digite suas observações aqui..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveFeedback}
                  disabled={savingFeedback}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Save size={18} />
                  {savingFeedback ? "Salvando..." : "Salvar Anotações"}
                </button>
              </div>
            </section>
            {/* DOCUMENTOS (Movido para Visão Geral) */}
            <PainelDocumentos
              caso={caso}
              user={user}
              handleRegenerateMinuta={handleRegenerateMinuta}
              isRegeneratingMinuta={isRegeneratingMinuta}
              handleGenerateTermo={handleGenerateTermo}
              isGeneratingTermo={isGeneratingTermo}
              editingFile={editingFile}
              setEditingFile={setEditingFile}
              handleSaveRename={handleSaveRename}
              isRenaming={isRenaming}
            />
            <div className="card space-y-4">
              <div className="flex items-center gap-3">
                <FileText />
                <h2 className="heading-2">Relato do caso</h2>
              </div>
              <CollapsibleText
                className="text-primary"
                text={caso.relato_texto}
              />
            </div>
          </div>
        )}

        {/* ABA 2: MINUTA E REVISÃO */}
        {activeTab === "minuta" && (
          <div className="space-y-6 animate-fade-in">
            <section className="card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Scale className="text-primary" />
                  <h2 className="heading-2">Minuta da Petição</h2>
                </div>
                {/* Botão de gerar fatos (IA) movido para o cabeçalho */}
                {user?.cargo === "admin" && (
                  <button
                    onClick={handleGenerateFatos}
                    disabled={isGenerating || caso.status === "processando"}
                    className="btn btn-ghost btn-sm text-primary hover:bg-primary/10"
                    title="Regerar texto dos fatos com IA"
                  >
                    {isGenerating ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </button>
                )}
              </div>

              {/* Visualização DOCX via Microsoft Viewer */}
              {caso.url_documento_gerado ? (
                <div className="w-full h-[800px] rounded-xl border border-soft overflow-hidden bg-white">
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(caso.url_documento_gerado)}`}
                    className="w-full h-full"
                    frameBorder="0"
                    title="Visualização da Minuta"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="bg-white text-slate-900 p-8 rounded shadow-sm border border-soft font-serif whitespace-pre-wrap text-justify leading-relaxed min-h-[400px]">
                  {caso.peticao_completa_texto ||
                    caso.peticao_inicial_rascunho ||
                    "A minuta ainda não foi gerada. Aguarde o processamento."}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ABA 3: GESTÃO E FINALIZAÇÃO */}
        {activeTab === "gestao" && (
          <div className="space-y-6 animate-fade-in">
            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">Status atual</p>
                <div className="relative flex items-center gap-2 z-10">
                  <button
                    onClick={() => fetchDetalhes(true)}
                    className="text-muted hover:text-primary transition-colors p-1"
                    title="Atualizar status"
                  >
                    <RefreshCw
                      size={16}
                      className={
                        caso.status === "processando" ? "animate-spin" : ""
                      }
                    />
                  </button>
                  <span className={`badge capitalize ${badgeClass}`}>
                    {statusKey.replace(/_/g, " ")}
                  </span>
                  <button
                    onClick={() => setShowStatusHelp(!showStatusHelp)}
                    className="text-muted hover:text-primary transition-colors focus:outline-none"
                  >
                    <HelpCircle size={16} className="cursor-help" />
                  </button>
                  <div
                    className={`absolute bottom-full right-0 mb-2 w-72 origin-bottom transform-gpu transition-all duration-200 ease-in-out ${showStatusHelp ? "scale-100 opacity-100" : "scale-95 opacity-0 pointer-events-none"}`}
                    role="tooltip"
                  >
                    <div className="rounded-md border border-soft bg-surface p-3 text-sm shadow-lg">
                      <p className="font-bold capitalize">
                        {statusKey.replace(/_/g, " ")}
                      </p>
                      <p className="text-muted">
                        {statusDescriptions[statusKey] || "Sem descrição."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTÃO DE REPROCESSAMENTO (Aparece em caso de ERRO ou para ADMIN) */}
              {(statusKey === "erro" || user?.cargo === "admin") && (
                <button
                  onClick={handleReprocessar}
                  disabled={isReprocessing || caso.status === "processando"}
                  className="btn btn-ghost border border-red-200 bg-red-50 text-red-700 w-full flex items-center justify-center gap-2 hover:bg-red-100"
                >
                  <RefreshCw
                    size={16}
                    className={isReprocessing ? "animate-spin" : ""}
                  />
                  {isReprocessing
                    ? "Reiniciando..."
                    : "Reprocessar Caso (OCR + IA)"}
                </button>
              )}

              {/* ALERTA DE REAGENDAMENTO */}
              {statusKey === "reagendamento_solicitado" && (
                <div className="alert alert-error space-y-3 animate-fade-in mt-4">
                  <div className="flex items-center gap-2 text-error font-bold">
                    <AlertTriangle size={20} />
                    <h3>Solicitação de Reagendamento</h3>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-error/80 uppercase font-bold">
                        Motivo informado pelo cidadão
                      </p>
                      <p className="text-sm bg-surface/50 p-2 rounded border border-error/20">
                        {caso.motivo_reagendamento || "Não informado."}
                      </p>
                    </div>

                    {caso.data_sugerida_reagendamento && (
                      <div>
                        <p className="text-xs text-error/80 uppercase font-bold">
                          Sugestão de nova data
                        </p>
                        <p className="text-sm bg-surface/50 p-2 rounded border border-error/20">
                          {caso.data_sugerida_reagendamento}
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-error/90 italic">
                    Para reagendar, selecione "Reunião Online" ou "Presencial"
                    abaixo e defina a nova data.
                  </p>
                </div>
              )}

              {/* SEÇÃO DE AGENDAMENTO ONLINE/PRESENCIAL E HISTÓRICO DE AGENDAMENTOS */}
              <PainelAgendamento
                caso={caso}
                statusKey={statusKey}
                dataAgendamento={dataAgendamento}
                setDataAgendamento={setDataAgendamento}
                linkAgendamento={linkAgendamento}
                setLinkAgendamento={setLinkAgendamento}
                handleAgendarReuniao={handleAgendarReuniao}
                isAgendando={isAgendando}
              />

              {/* ÁREA DE PENDÊNCIA (Só aparece se selecionar aguardando_docs) */}
              {statusKey === "aguardando_docs" && (
                <div className="p-4 bg-bg border border-border rounded-lg space-y-2 animate-fade-in">
                  <label className="text-sm font-bold text">
                    Descreva os documentos pendentes:{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className="input w-full min-h-[100px] text-sm"
                    placeholder="Ex: - RG do cônjuge&#10;- Comprovante de residência atualizado"
                    value={pendenciaTexto}
                    onChange={(e) => setPendenciaTexto(e.target.value)}
                  />
                  <div className="flex justify-between items-center">
                    <p className="text-xs text">
                      Este texto aparecerá para o assistido na consulta.
                    </p>
                    <button
                      onClick={handleSalvarPendencia}
                      disabled={isUpdating}
                      className="btn btn-sm bg-orange-600 hover:bg-orange-700 text-white border-none"
                    >
                      {isUpdating ? "Salvando..." : "Salvar Descrição"}
                    </button>
                  </div>
                </div>
              )}

              <select
                className="input disabled:opacity-70 disabled:cursor-not-allowed border-2 border-primary/20 focus:border-primary focus:ring-4 focus:ring-primary/10 font-medium text-primary-900"
                onChange={(e) => handleStatusChange(e.target.value)}
                value={statusKey}
                // TRAVA: Desabilita se estiver atualizando OU se já estiver finalizado/encaminhado
                disabled={isUpdating || statusKey === "encaminhado_solar"}
              >
                {/* LÓGICA DE EXIBIÇÃO INTELIGENTE: */}

                {/* 1. Se o caso JÁ estiver finalizado, mostra essa opção extra apenas para leitura */}
                {statusKey === "encaminhado_solar" && (
                  <option value="encaminhado_solar">
                    ✅ Concluído / Encaminhado
                  </option>
                )}

                {/* 2. Opção atual (se automática/não listada nas manuais) */}
                {statusKey !== "encaminhado_solar" &&
                  !manualStatusOptions.find((o) => o.value === statusKey) && (
                    <option value={statusKey} disabled>
                      {statusKey.charAt(0).toUpperCase() +
                        statusKey.slice(1).replace(/_/g, " ")}{" "}
                      (Atual)
                    </option>
                  )}

                {/* 3. Opções manuais permitidas */}
                {manualStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Aviso visual extra */}
              {statusKey === "encaminhado_solar" && (
                <p className="text-xs text-green-600 mt-1">
                  * Caso finalizado via integração Solar.
                </p>
              )}

              {isUpdating && (
                <p className="text-xs text-muted">Atualizando status...</p>
              )}
            </div>
            {/* --- ZONA DE FINALIZAÇÃO DO ESTAGIÁRIO --- */}
            <div className="mt-8 pt-8 border-t border-soft">
              <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <CheckCircle className="text-green-500" />
                Finalização e Encaminhamento (Solar)
              </h2>

              {caso.status === "encaminhado_solar" ? (
                // SE JÁ ESTIVER FINALIZADO, MOSTRA OS DADOS
                <div className="bg-green-500/10 border border-green-500/30 p-6 rounded-xl space-y-6">
                  <div className="flex items-center justify-between gap-2 text-muted font-bold">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={20} /> CASO CONCLUÍDO E ENCAMINHADO
                    </div>
                    {user?.cargo === "admin" && (
                      <button
                        type="button"
                        onClick={handleReverterFinalizacao}
                        disabled={isReverting}
                        className="btn btn-danger btn-sm flex items-center gap-2"
                      >
                        <RefreshCw size={14} />
                        {isReverting ? "Revertendo..." : "Reverter"}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs text-muted uppercase font-bold">
                        Número
                      </label>
                      <p className="text-lg font-mono text-muted">
                        {caso.numero_solar}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-muted uppercase font-bold">
                        Número do Processo (TJ)
                      </label>
                      <p className="text-lg font-mono text-muted">
                        {caso.numero_processo}
                      </p>
                    </div>
                  </div>
                  {caso.url_capa_processual && (
                    <div>
                      <a
                        href={caso.url_capa_processual}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-2"
                      >
                        <FileText size={16} /> Ver Capa Processual Anexada
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                // SE NÃO ESTIVER FINALIZADO, MOSTRA O FORMULÁRIO
                <form
                  onSubmit={handleFinalizarCaso}
                  className="bg-surface border border-soft p-6 rounded-xl space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* INPUT NÚMERO PROCESSO */}
                    <div>
                      <label className="block text-sm font-medium text-muted mb-1">
                        Número do Processo (PJE/TJ)
                      </label>
                      <input
                        type="text"
                        value={numProcesso}
                        onChange={(e) => setNumProcesso(e.target.value)}
                        placeholder="Ex: 8000..."
                        className="w-full bg-app border border-soft rounded-lg p-3 text-muted focus:ring-2 focus:ring-primary outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* UPLOAD CAPA */}
                  <div>
                    <label className="block text-sm font-medium text-muted mb-1">
                      Anexar Capa Processual (PDF)
                    </label>
                    <div className="border-2 border-dashed border-soft rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer relative">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setArquivoCapa(e.target.files[0])}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        required
                      />
                      <Upload className="text-muted mb-2" size={24} />
                      {arquivoCapa ? (
                        <span className="text-primary font-medium">
                          {arquivoCapa.name}
                        </span>
                      ) : (
                        <span className="text-muted text-sm">
                          Clique ou arraste o PDF da capa aqui
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={enviandoFinalizacao}
                    className="btn btn-primary w-full py-3 mt-4 flex items-center justify-center gap-2"
                  >
                    {enviandoFinalizacao
                      ? "Processando..."
                      : "Concluir Caso e Enviar ao Cidadão"}
                  </button>
                </form>
              )}
            </div>

            {/* Botão de Arquivar (Movido para Gestão) */}
            <button
              onClick={handleArquivarClick}
              className={`btn w-full justify-center ${
                caso.arquivado
                  ? "btn-primary"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700 border-transparent"
              }`}
            >
              {caso.arquivado ? (
                <ArchiveRestore size={18} />
              ) : (
                <Archive size={18} />
              )}
              {caso.arquivado ? "Restaurar Caso" : "Arquivar Caso"}
            </button>
          </div>
        )}
        <div className="mt-8 pt-8 border-t border-soft">
          {/* Botão de Excluir Caso - Apenas para Admin */}
          {user?.cargo === "admin" && (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="heading-2 text-error">Excluir Caso</h2>
                <button
                  onClick={handleDeleteCaso}
                  disabled={isDeleting}
                  className="btn btn-danger w-fit flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  {isDeleting ? "Excluindo..." : ""}
                </button>
              </div>
              <p className="text-sm text-muted">
                Esta ação não pode ser desfeita. Todos os dados do caso serão
                removidos permanentemente.
              </p>
              <TimelineAuditoria registroId={caso.id} />
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE MOTIVO DE ARQUIVAMENTO */}
      {archiveModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-surface border border-soft p-6 rounded-2xl shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <Archive size={24} />
              <h3 className="text-xl font-bold text-main">Arquivar Caso</h3>
            </div>

            <p className="text-muted text-sm">
              O caso será movido para o "Arquivo Morto" e sairá da lista
              principal. Justifique esta ação:
            </p>

            <textarea
              className="input min-h-[100px] resize-none"
              placeholder="Ex: Dados inconsistentes, assistido desistiu, duplicidade..."
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              autoFocus
            />

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setArchiveModalOpen(false)}
                className="btn btn-ghost flex-1 border border-soft"
              >
                Cancelar
              </button>
              <button
                onClick={confirmArchive}
                className="btn btn-secondary flex-1 bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
              >
                Confirmar Arquivamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};;

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  ChevronLeft,
  Download,
  Mic,
  Lock,
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
  Bell,
  AlertTriangle,
  History,
  Copy,
  Archive,
  ArchiveRestore,
  LayoutDashboard,
  User,
  Users,
  Eye,
  Paperclip,
  Search,
  UserPlus,
  Wand2,
} from "lucide-react";
import { ModalDistribuicao } from "../components/casos/ModalDistribuicao";
import { API_BASE } from "../../../utils/apiBase";
import { formatTipoAcaoLabel } from "../../../utils/caseUtils";
import { useToast } from "../../../contexts/ToastContext";
import { useConfirm } from "../../../contexts/ConfirmContext";
import { TimelineAuditoria } from "../components/TimelineAuditoria";
import useSWR from "swr";
import { authFetch } from "../../../utils/apiBase";
import { formatCurrencyMask, numeroParaExtenso } from "../../../utils/formatters";
//compenetes detalhes
import { InfoAssistido } from "../components/detalhes/InfoAssistido";
import { PainelDocumentos } from "../components/detalhes/PainelDocumentos";
import { PainelCasosRelacionados } from "../components/detalhes/PainelCasosRelacionados";
const fetcher = async (url) => {
  try {
    const response = await authFetch(url);

    if (!response.ok) {
      let errorInfo = "Erro ao buscar dados.";
      let extraData = {};
      try {
        const body = await response.json();
        errorInfo = body.error || body.message || errorInfo;
        extraData = body;
      } catch {
        /* corpo vazio */
      }

      const error = new Error(errorInfo);
      error.status = response.status;
      error.info = extraData;
      throw error;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
};

const manualStatusOptions = [
  { value: "aguardando_documentos", label: "Aguardando Documentos" },
  { value: "documentacao_completa", label: "Documentação Completa" },
  { value: "pronto_para_analise", label: "Pronto para Análise" },
  { value: "em_atendimento", label: "Em Atendimento" },
  { value: "liberado_para_protocolo", label: "Liberado para Protocolo" },
  { value: "em_protocolo", label: "Em Protocolo" },
];

const archiveReasonOptions = [
  { value: "duplicidade", label: "Duplicidade" },
  { value: "desistencia", label: "Desistencia" },
  { value: "dados_inconsistentes", label: "Dados inconsistentes" },
  { value: "fora_do_escopo", label: "Fora do escopo" },
  { value: "outro", label: "Outro" },
];

const getArchiveReasonLabel = (value) =>
  archiveReasonOptions.find((option) => option.value === value)?.label || value || "Nao informado.";

const statusBadges = {
  aguardando_documentos: "bg-amber-100 text-amber-800 border-amber-200",
  documentacao_completa: "bg-highlight/15 text-highlight border-highlight/30",
  processando_ia: "bg-indigo-100 text-indigo-800 border-indigo-200",
  pronto_para_analise: "bg-green-100 text-green-800 border-green-200",
  em_atendimento: "bg-blue-100 text-blue-800 border-blue-200",
  liberado_para_protocolo: "bg-purple-100 text-purple-800 border-purple-200",
  em_protocolo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  protocolado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  erro_processamento: "bg-red-100 text-red-800 border-red-200",
};

const statusDescriptions = {
  aguardando_documentos:
    "O processo está pausado, aguardando o envio de documentos adicionais pelo cidadão.",
  documentacao_completa: "O cidadão enviou todos os documentos necessários ou complementares.",
  processando_ia: "O sistema está extraindo informações dos documentos e gerando a minuta inicial.",
  pronto_para_analise:
    "O processamento automático foi concluído. A minuta está pronta para revisão.",
  em_atendimento: "O caso está sendo analisado pessoalmente ou em reunião com o assistido.",
  liberado_para_protocolo: "O caso foi conferido e está pronto para ser protocolado.",
  em_protocolo: "O defensor está realizando o protocolo do processo no sistema do tribunal.",
  protocolado: "O protocolo foi realizado com sucesso e o número do processo foi gerado.",
  erro_processamento:
    "Ocorreu um erro crítico durante o processamento automático. Verifique os logs.",
};

const CollapsibleText = ({ text, maxLength = 350, isPre = false, defaultCollapsed = true }) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  if (!text || text.length === 0) {
    return <p className="text-sm text-muted">Nenhuma informação fornecida.</p>;
  }

  const textToShow =
    isCollapsed && text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

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
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="btn btn-ghost btn-sm mt-2">
          {isCollapsed ? "Ler mais" : "Ler menos"}
        </button>
      )}
    </div>
  );
};

export const DetalhesCaso = () => {
  const { id } = useParams();
  const { token, user, permissions } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [numSolar, setNumSolar] = useState("");
  const [numProcesso, setNumProcesso] = useState("");
  const [arquivoCapa, setArquivoCapa] = useState(null);
  const [enviandoFinalizacao, setEnviandoFinalizacao] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackInitialized, setFeedbackInitialized] = useState(false);
  const [isGeneratingTermo, setIsGeneratingTermo] = useState(false);
  const [isRegeneratingMinuta, setIsRegeneratingMinuta] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [pendenciaTexto, setPendenciaTexto] = useState("");
  const [editingFile, setEditingFile] = useState({ url: null, name: "" });
  const [isRenaming, setIsRenaming] = useState(false);
  const [showStatusHelp, setShowStatusHelp] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiveObservation, setArchiveObservation] = useState("");
  const [activeTab, setActiveTab] = useState("visao_geral");
  const [memoriaCalculo, setMemoriaCalculo] = useState("");
  const [isSavingJuridico, setIsSavingJuridico] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [colegas, setColegas] = useState([]);
  const [isLoadingColegas, setIsLoadingColegas] = useState(false);
  const [selectedColegaId, setSelectedColegaId] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [minutaPreview, setMinutaPreview] = useState("penhora");
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [isUploadingMinuta, setIsUploadingMinuta] = useState(false);
  const [buscaColega, setBuscaColega] = useState("");
  const [autosType, setAutosType] = useState(null); // 'apartados' ou 'proprios_autos'
  const [autosSubtype, setAutosSubtype] = useState(null); // 'provisorio' ou 'definitivo'
  const [isDistribuirOpen, setIsDistribuirOpen] = useState(false);

  // Novos campos financeiros para rito cumulado
  const [debitoPenhoraValor, setDebitoPenhoraValor] = useState("");
  const [debitoPenhoraExtenso, setDebitoPenhoraExtenso] = useState("");
  const [debitoPrisaoValor, setDebitoPrisaoValor] = useState("");
  const [debitoPrisaoExtenso, setDebitoPrisaoExtenso] = useState("");

  // Novos campos para Fixação e Dados Bancários (Persistência)
  const [contaBanco, setContaBanco] = useState("");
  const [contaAgencia, setContaAgencia] = useState("");
  const [contaOperacao, setContaOperacao] = useState("");
  const [contaNumero, setContaNumero] = useState("");
  const [vencimentoDia, setVencimentoDia] = useState("");
  const [descricaoGuarda, setDescricaoGuarda] = useState("");
  const [bensPartilha, setBensPartilha] = useState("");
  const [situacaoFinanceiraGenitora, setSituacaoFinanceiraGenitora] = useState("");

  // 1. O SWR substitui o estado do caso, o fetchDetalhes, e o polling!
  const {
    data: caso,
    error,
    isLoading,
    mutate,
  } = useSWR(
    token && id && id !== "arquivados" && id !== "undefined" ? `/casos/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 600000,
      // Polling Automático: Se for 'processando' ou 'documentacao_completa', atualiza a cada 5s.
      refreshInterval: (data) =>
        data?.status === "processando_ia" || data?.status === "documentacao_completa" ? 5000 : 0,

      onError: (err) => {
        // Se der erro 401 ou sessão expirada, o context deve assumir
        if (err.message === "Sessão expirada" || err.status === 401) {
          console.warn("Sessão expirada detectada em DetalhesCaso SWR");
          // O logout será disparado pelo apiBase + AuthContext
        }
      },
    },
  );

  const isColaborador =
    caso &&
    user &&
    String(caso.servidor_id) !== String(user.id) &&
    String(caso.defensor_id) !== String(user.id) &&
    user.cargo !== "admin";

  const isFixacao = useMemo(
    () => caso?.tipo_acao === "fixacao_alimentos" || caso?.tipo_acao === "alimentos_gravidicos",
    [caso?.tipo_acao],
  );



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
          status: "aguardando_documentos",
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
            novoStatus === "aguardando_documentos" ? pendenciaTexto : caso.descricao_pendencia,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao atualizar o status.");
      }

      await response.json();
      toast.success("Status atualizado com sucesso!");
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


  const statusKey = (caso?.status || "recebido").toLowerCase();
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

  const handleGenerateTermo = useCallback(async () => {
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
  }, [id, token, mutate, toast]);

  const handleRegenerateMinuta = useCallback(async (soloCumulado = false) => {
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
        body: JSON.stringify({ solo_cumulado: soloCumulado }),
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
  }, [confirm, id, token, mutate, toast]);

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
            errorMessage = errorData.message || errorData.error || response.statusText;
          } catch {
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

  const handleUnlock = async () => {
    if (!(await confirm("Deseja liberar este caso para outros usuários?", "Liberar Caso?"))) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`${API_BASE}/casos/${id}/unlock`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Caso liberado!");
        navigate("/painel");
      } else {
        throw new Error("Falha ao liberar.");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenShare = async () => {
    setIsShareModalOpen(true);
    setIsLoadingColegas(true);
    setBuscaColega("");
    try {
      const res = await fetch(`${API_BASE}/defensores/colegas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setColegas(await res.json());
    } catch {
      toast.error("Erro ao carregar colegas.");
    } finally {
      setIsLoadingColegas(false);
    }
  };

  const handleUploadMinuta = async (file, documentKey) => {
    if (!file || !documentKey) return;

    const formData = new FormData();
    formData.append("minuta", file);
    formData.append("documentKey", documentKey);

    setIsUploadingMinuta(true);
    try {
      const response = await fetch(`${API_BASE}/casos/${id}/upload-minuta`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Falha ao substituir minuta.");
      }

      toast.success("Minuta substituída com sucesso!");
      mutate();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUploadingMinuta(false);
    }
  };

  const handleConfirmShare = async () => {
    if (!selectedColegaId) return toast.warning("Selecione um colega.");
    setIsSharing(true);
    try {
      const res = await fetch(`${API_BASE}/casos/${id}/solicitar-assistencia`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ destinatario_id: selectedColegaId }),
      });
      if (res.ok) {
        toast.success("Solicitação de ajuda enviada!");
        setIsShareModalOpen(false);
      } else {
        throw new Error("Falha ao enviar.");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveJuridico = async () => {
    setIsSavingJuridico(true);
    try {
      const res = await fetch(`${API_BASE}/casos/${id}/juridico`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          memoria_calculo: memoriaCalculo,
          debito_penhora_valor: debitoPenhoraValor,
          debito_penhora_extenso: debitoPenhoraExtenso,
          debito_prisao_valor: debitoPrisaoValor,
          debito_prisao_extenso: debitoPrisaoExtenso,
          // Dados Bancários
          conta_banco: contaBanco,
          conta_agencia: contaAgencia,
          conta_operacao: contaOperacao,
          conta_numero: contaNumero,
          // Dados Fixação
          vencimento_dia: vencimentoDia,
          descricao_guarda: descricaoGuarda,
          bens_partilha: bensPartilha,
          situacao_financeira_genitora: situacaoFinanceiraGenitora,
        }),
      });
      if (res.ok) {
        toast.success("Dados jurídicos salvos!");
        mutate();
      }
    } catch {
      toast.error("Erro ao salvar dados jurídicos.");
    } finally {
      setIsSavingJuridico(false);
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
      const response = await fetch(`${API_BASE}/casos/${id}/reverter-finalizacao`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
      if (await confirm("Deseja mover este caso de volta para os Ativos?", "Restaurar Caso")) {
        await processarArquivamento(false, null);
      }
    } else {
      setArchiveReason("");
      setArchiveObservation("");
      setArchiveModalOpen(true);
    }
  };

  const processarArquivamento = async (novoEstado, motivo, observacao = "") => {
    try {
      const response = await fetch(`${API_BASE}/casos/${id}/arquivar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          arquivado: novoEstado,
          motivo_codigo: motivo,
          observacao_arquivamento: observacao,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao alterar status.");
      }

      toast.success(novoEstado ? "Caso arquivado!" : "Caso restaurado!");
      navigate(novoEstado ? "/painel/casos/arquivados" : "/painel/casos");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSaveRename = async () => {
    if (!editingFile.url || !editingFile.name.trim()) return;
    setIsRenaming(true);
    try {
      const response = await fetch(`${API_BASE}/casos/${id}/documento/renomear`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileUrl: editingFile.url,
          newName: editingFile.name,
        }),
      });
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

  // ── Upload de documentos pelo painel do defensor ──────────────────────────
  const handleUploadDocumentos = async (files) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("documentos", file));

    setIsUploadingDocs(true);
    try {
      const response = await fetch(`${API_BASE}/casos/${id}/upload-complementar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao enviar documentos.");
      }

      toast.success(`${files.length} arquivo(s) enviado(s) com sucesso!`);
      mutate(); // Revalida os dados do SWR automaticamente
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsUploadingDocs(false);
    }
  };

  const todosDocumentosGerados = useMemo(() => {
    if (!caso) return [];

    const docs = [];
    
    // CASO FIXAÇÃO: Petição Inicial e Termo sempre presentes
    if (isFixacao) {
      // 1. Petição Inicial (Prioriza url_peticao que sincronizamos no backend)
      docs.push({
        key: "url_peticao",
        label: "Petição Inicial",
        url: caso.url_peticao || caso.url_documento_gerado,
        isMissing: !caso.url_peticao && !caso.url_documento_gerado,
        grupo: "provisorio",
        previewClass: "border-primary bg-primary/10",
        defaultClass: "border-border bg-surface hover:border-primary",
        textClass: "text-primary",
        downloadHoverClass: "hover:text-primary",
        handler: () => handleRegenerateMinuta(false),
        loading: isRegeneratingMinuta
      });

      // 2. Termo de Declaração
      docs.push({
        key: "url_termo_declaracao",
        label: "Termo de Declaração",
        url: caso.url_termo_declaracao,
        isMissing: !caso.url_termo_declaracao,
        grupo: "auxiliar",
        previewClass: "border-highlight bg-highlight/10",
        defaultClass: "border-border bg-surface hover:border-highlight",
        textClass: "text-highlight",
        downloadHoverClass: "hover:text-highlight",
        handler: handleGenerateTermo,
        loading: isGeneratingTermo
      });

      return docs;
    }

    // OUTROS CASOS: Lógica condicional por URL existente
    if (caso.url_peticao_execucao_cumulado || caso.url_peticao_cumulado) {
      docs.push({
        key: "url_peticao_execucao_cumulado",
        label: "Execucao - Rito Cumulado",
        url: caso.url_peticao_execucao_cumulado || caso.url_peticao_cumulado,
        grupo: "provisorio",
        previewClass: "border-success bg-success/10",
        defaultClass: "border-border bg-surface hover:border-success",
        textClass: "text-success",
        downloadHoverClass: "hover:text-success",
        handler: () => handleRegenerateMinuta(true),
        loading: isRegeneratingMinuta
      });
    }
    if (
      caso.url_peticao_execucao_penhora ||
      caso.url_peticao_penhora ||
      (!caso.url_peticao_execucao_prisao &&
        !caso.url_peticao_prisao &&
        !caso.url_peticao_execucao_cumulado &&
        !caso.url_peticao_cumulado &&
        caso.url_documento_gerado)
    ) {
      docs.push({
        key: "url_peticao_execucao_penhora",
        label: caso.url_peticao_prisao ? "Rito da Penhora" : "Petição Inicial",
        url:
          caso.url_peticao_execucao_penhora ||
          caso.url_peticao_penhora ||
          caso.url_documento_gerado,
        grupo: "provisorio",
        previewClass: "border-primary bg-primary/10",
        defaultClass: "border-border bg-surface hover:border-primary",
        textClass: "text-primary",
        downloadHoverClass: "hover:text-primary",
        handler: () => handleRegenerateMinuta(false),
        loading: isRegeneratingMinuta
      });
    }
    if (caso.url_peticao_execucao_prisao || caso.url_peticao_prisao) {
      docs.push({
        key: "url_peticao_execucao_prisao",
        label: "Rito da Prisão (3+ meses)",
        url: caso.url_peticao_execucao_prisao || caso.url_peticao_prisao,
        grupo: "provisorio",
        previewClass: "border-error bg-error/10",
        defaultClass: "border-border bg-surface hover:border-error",
        textClass: "text-error",
        downloadHoverClass: "hover:text-error",
        handler: () => handleRegenerateMinuta(false),
        loading: isRegeneratingMinuta
      });
    }
    if (caso.url_peticao_cumprimento_cumulado) {
      docs.push({
        key: "url_peticao_cumprimento_cumulado",
        label: "Cumprimento - Rito Cumulado",
        url: caso.url_peticao_cumprimento_cumulado,
        grupo: "definitivo",
        previewClass: "border-success bg-success/10",
        defaultClass: "border-border bg-surface hover:border-success",
        textClass: "text-success",
        downloadHoverClass: "hover:text-success",
        handler: () => handleRegenerateMinuta(true),
        loading: isRegeneratingMinuta
      });
    }
    if (caso.url_peticao_cumprimento_penhora) {
      docs.push({
        key: "url_peticao_cumprimento_penhora",
        label: "Cumprimento - Rito da Penhora",
        url: caso.url_peticao_cumprimento_penhora,
        grupo: "definitivo",
        previewClass: "border-primary bg-primary/10",
        defaultClass: "border-border bg-surface hover:border-primary",
        textClass: "text-primary",
        downloadHoverClass: "hover:text-primary",
        handler: () => handleRegenerateMinuta(false),
        loading: isRegeneratingMinuta
      });
    }
    if (caso.url_peticao_cumprimento_prisao) {
      docs.push({
        key: "url_peticao_cumprimento_prisao",
        label: "Cumprimento - Rito da Prisao",
        url: caso.url_peticao_cumprimento_prisao,
        grupo: "definitivo",
        previewClass: "border-error bg-error/10",
        defaultClass: "border-border bg-surface hover:border-error",
        textClass: "text-error",
        downloadHoverClass: "hover:text-error",
        handler: () => handleRegenerateMinuta(false),
        loading: isRegeneratingMinuta
      });
    }
    if (caso.url_termo_declaracao || isFixacao) {
      docs.push({
        key: "url_termo_declaracao",
        label: "Termo de Declaração",
        url: caso.url_termo_declaracao,
        isMissing: !caso.url_termo_declaracao,
        grupo: "auxiliar",
        previewClass: "border-highlight bg-highlight/10",
        defaultClass: "border-border bg-surface hover:border-highlight",
        textClass: "text-highlight",
        downloadHoverClass: "hover:text-highlight",
        handler: handleGenerateTermo,
        loading: isGeneratingTermo
      });
    }
    return docs;
  }, [caso, isFixacao, handleRegenerateMinuta, handleGenerateTermo, isRegeneratingMinuta, isGeneratingTermo]);

  const exibirPainelCumulado = useMemo(
    () =>
      todosDocumentosGerados.some(
        (doc) =>
          doc.key === "url_peticao_execucao_cumulado" ||
          doc.key === "url_peticao_cumprimento_cumulado",
      ),
    [todosDocumentosGerados],
  );

  const podeExibirDocumentos =
    isFixacao || autosType === "proprios_autos" || (autosType === "apartados" && Boolean(autosSubtype));
  const documentosNoFluxo = useMemo(() => {
    if (!podeExibirDocumentos) return [];

    // Se for "Nos próprios autos", atualmente não temos modelos específicos (mostramos a mensagem no render)
    if (autosType === "proprios_autos") return [];

    return todosDocumentosGerados.filter((doc) => {
      if (doc.grupo === "auxiliar") return true;
      if (isFixacao) return doc.grupo === "provisorio";
      if (autosType === "apartados" && autosSubtype === "provisorio") {
        return doc.grupo === "provisorio";
      }
      if (autosType === "apartados" && autosSubtype === "definitivo") {
        return doc.grupo === "definitivo";
      }
      return false;
    });
  }, [podeExibirDocumentos, todosDocumentosGerados, isFixacao, autosType, autosSubtype]);

  const documentoPreviewSelecionado =
    documentosNoFluxo.find((doc) => doc.key === minutaPreview) || documentosNoFluxo[0] || null;
  const previewUrl = documentoPreviewSelecionado?.url || null;
  useEffect(() => {
    if (!documentosNoFluxo.length) return;
    if (!documentosNoFluxo.some((doc) => doc.key === minutaPreview)) {
      setMinutaPreview(documentosNoFluxo[0].key);
    }
  }, [documentosNoFluxo, minutaPreview]);

  // 2. Preenchimento de datas e formulários após o caso carregar
  useEffect(() => {
    if (caso) {
      if (!feedbackInitialized) {
        setFeedback(caso.feedback || "");
        setPendenciaTexto(caso.descricao_pendencia || "");
        setNumSolar(caso.numero_solar || "");
        setMemoriaCalculo(caso.juridico?.memoria_calculo || "");
        setDebitoPenhoraValor(caso.juridico?.debito_penhora_valor || "");
        setDebitoPenhoraExtenso(caso.juridico?.debito_penhora_extenso || "");
        setDebitoPrisaoValor(caso.juridico?.debito_prisao_valor || "");
        setDebitoPrisaoExtenso(caso.juridico?.debito_prisao_extenso || "");

        // Inicialização dos novos campos
        setContaBanco(caso.juridico?.conta_banco || "");
        setContaAgencia(caso.juridico?.conta_agencia || "");
        setContaOperacao(caso.juridico?.conta_operacao || "");
        setContaNumero(caso.juridico?.conta_numero || "");
        setVencimentoDia(caso.juridico?.vencimento_dia || "");
        setDescricaoGuarda(caso.juridico?.descricao_guarda || "");
        setBensPartilha(caso.juridico?.bens_partilha || "");
        setSituacaoFinanceiraGenitora(caso.juridico?.situacao_financeira_genitora || "");

        setFeedbackInitialized(true);
      }
    }
  }, [caso, feedbackInitialized]);

  if (isLoading) {
    return <div className="card text-center text-muted">Carregando detalhes...</div>;
  }

  if (!caso) {
    // Lógica específica para 423 Locked
    if (error?.status === 423) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fade-in">
          <div className="bg-amber-100 p-6 rounded-full">
            <AlertTriangle size={64} className="text-amber-600" />
          </div>
          <div className="text-center space-y-2 max-w-md">
            <h2 className="heading-1 text-amber-900">Caso em Atendimento</h2>
            <p className="text-amber-800">
              {error.info?.message || "Este caso já está vinculado a outro defensor(a) no momento."}
            </p>
            <div className="mt-4 p-4 bg-white border border-amber-200 rounded-lg shadow-sm">
              <span className="text-xs uppercase font-bold text-amber-600 tracking-widest">
                Responsável Atual
              </span>
              <p className="text-lg font-medium text-amber-900">
                {error.info?.holder || "Não identificado"}
              </p>
            </div>
          </div>
          <button onClick={() => navigate("/painel")} className="btn btn-primary">
            Voltar para Lista de Casos
          </button>
        </div>
      );
    }

    if (error?.status === 401 || error?.message === "Sessão expirada") {
      return null; // O context vai redirecionar
    }

    return (
      <div className="card border-l-4 border-l-red-500 text-red-600">
        {error?.info?.error || error?.message || "Caso não encontrado ou erro de permissão."}
      </div>
    );
  }

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
              Protocolo {caso.protocolo} • {formatTipoAcaoLabel(caso.tipo_acao)}
            </p>
            <div className="flex items-center gap-2 bg-surface border border-soft rounded-md px-3 py-1.5 shadow-sm">
              <label
                htmlFor="numeroSolar"
                className="text-xs font-bold text-muted uppercase tracking-wider"
              >
                {caso.unidade?.sistema ? caso.unidade.sistema.toUpperCase() : "SOLAR"}:
              </label>
              <input
                type="text"
                id="numeroSolar"
                value={numSolar}
                onChange={(e) => {
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

          {caso.assistencia_casos && caso.assistencia_casos.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-indigo-700/70 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                Colaboradores envolvidos:
              </span>
              {Array.from(
                new Map(
                  caso.assistencia_casos.map((a) => [
                    a.remetente_id === user?.id ? a.destinatario_id : a.remetente_id,
                    a,
                  ]),
                ).values(),
              ).map((a, i) => {
                const isMine = a.remetente_id === user?.id;
                const targetName = isMine ? a.destinatario?.nome : a.remetente?.nome;
                if (!targetName) return null;

                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-100 rounded-full text-xs text-indigo-900 shadow-sm transition-all hover:border-indigo-300 hover:shadow"
                    title={
                      isMine
                        ? `Aguardando ${targetName} aceitar`
                        : `${targetName} compartilhou com você`
                    }
                  >
                    <div className="bg-indigo-100 w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-indigo-700">
                      {targetName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{targetName.split(" ")[0]}</span>
                    {a.status === "pendente" && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-400 ml-1"
                        title="Pendente"
                      ></span>
                    )}
                    {a.status === "aceito" && (
                      <span
                        className="w-2 h-2 rounded-full bg-green-500 ml-1"
                        title="Aceito"
                      ></span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col md:items-end gap-2">
          <button
            onClick={handleOpenShare}
            className="btn btn-ghost border border-soft flex items-center gap-2 text-sm shadow-sm"
            title="Dar acesso a outro defensor/servidor para ajudar"
          >
            <User size={18} className="text-primary" />
            Compartilhar Caso
          </button>
        </div>
      </div>

      {/* NOTIFICAÇÃO DE ARQUIVAMENTO */}
      {caso.arquivado && (
        <div className="alert flex items-start gap-3 mb-6 animate-fade-in">
          <Archive className="text-muted shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-bold">Caso Arquivado</h3>
            <p className="text-muted mt-1">
              <strong>Motivo:</strong> {getArchiveReasonLabel(caso.motivo_arquivamento)}
            </p>
            {caso.observacao_arquivamento && (
              <p className="text-muted mt-1">
                <strong>Observacao:</strong> {caso.observacao_arquivamento}
              </p>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICAÇÃO DE DOCUMENTOS ENTREGUES */}
      {caso.status === "documentacao_completa" && (
        <div className="bg-highlight/10 border-l-4 border-highlight p-4 rounded-r shadow-sm flex items-start gap-3 animate-fade-in mb-6">
          <Bell className="text-highlight shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-bold text-highlight">Novos Documentos Recebidos!</h3>
            <p className="text-highlight/90 text-sm">
              O cidadão enviou os documentos complementares solicitados. Verifique os itens
              destacados abaixo na seção de anexos.
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
        {!isColaborador && (
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
        )}
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
        {activeTab === "relacionados" && !isColaborador && (
          <div className="space-y-6 animate-fade-in">
            <div className="card space-y-4">
              <h2 className="heading-2 border-soft pb-2 border-b">Casos Relacionados</h2>
              <p className="text-sm text-muted">
                Abaixo estão outros protocolos vinculados ao mesmo CPF (geralmente representantes
                legais gerenciando múltiplos assistidos).
              </p>
              <PainelCasosRelacionados casoOriginal={caso} />
            </div>
          </div>
        )}

        {/* ABA 1: VISÃO GERAL */}
        {activeTab === "visao_geral" && (
          <div className="space-y-6 animate-fade-in">
            <InfoAssistido caso={caso} />



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
              handleUploadDocumentos={handleUploadDocumentos}
              isUploadingDocs={isUploadingDocs}
            />
            <div className="card space-y-4">
              <div className="flex items-center gap-3">
                <FileText />
                <h2 className="heading-2">Relato do caso</h2>
              </div>
              <CollapsibleText className="text-primary" text={caso.relato_texto} />
            </div>
          </div>
        )}

        {/* ABA 2: MINUTA E REVISÃO */}
        {activeTab === "minuta" && (
          <div className="space-y-6 animate-fade-in">
            {/* SELETOR DE FLUXO - AUTOS APARTADOS vs NOS PROPRIOS AUTOS */}
            {!isFixacao && (
              <div className="card space-y-4">
              <h3 className="heading-3 border-b border-border pb-2">Tipo de Petição</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setAutosType("apartados");
                    setAutosSubtype(null);
                  }}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    autosType === "apartados"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:border-primary"
                  }`}
                >
                  <div className="font-bold text-primary">AUTOS APARTADOS</div>
                  <p className="text-xs text-muted mt-1"></p>
                </button>
                <button
                  onClick={() => {
                    setAutosType("proprios_autos");
                    setAutosSubtype("definitivo");
                  }}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    autosType === "proprios_autos"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:border-primary"
                  }`}
                >
                  <div className="font-bold text-primary">NOS PROPRIOS AUTOS</div>
                  <p className="text-xs text-muted mt-1">Petição nos mesmos autos</p>
                </button>
              </div>

              {/* Subopções para AUTOS APARTADOS */}
              {autosType === "apartados" && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <p className="text-sm font-medium text-muted">Selecione o tipo:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={() => setAutosSubtype("provisorio")}
                      className={`p-3 border rounded-lg transition-all text-sm ${
                        autosSubtype === "provisorio"
                          ? "border-secondary bg-secondary/10 text-main font-bold"
                          : "border-border bg-surface hover:border-secondary/50"
                      }`}
                    >
                      PROVISÓRIO
                    </button>
                    <button
                      onClick={() => setAutosSubtype("definitivo")}
                      className={`p-3 border rounded-lg transition-all text-sm ${
                        autosSubtype === "definitivo"
                          ? "border-success bg-success/10 text-main font-bold"
                          : "border-border bg-surface hover:border-success/50"
                      }`}
                    >
                      DEFINITIVO
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

            {/* LAYOUT PRINCIPAL - QUANDO TIPO FOI SELECIONADO */}
            {podeExibirDocumentos && (
              <>
                {/* Informações Financeiras (Cumulado) */}
                {exibirPainelCumulado && (
                  <div className="card space-y-4 border-l-4 border-l-secondary mb-6 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <Scale className="text-secondary" />
                      <h2 className="heading-2 font-bold">Informações Financeiras (Cumulado)</h2>
                    </div>

                    <div className="space-y-4 p-4 bg-secondary/5 rounded-xl border border-secondary/10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Penhora */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                            Débito Rito Penhora
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input
                              type="text"
                              placeholder="R$ 0,00"
                              className="input font-mono"
                              value={debitoPenhoraValor}
                              onChange={(e) => {
                                const val = formatCurrencyMask(e.target.value);
                                setDebitoPenhoraValor(val);
                                setDebitoPenhoraExtenso(numeroParaExtenso(val));
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Valor por extenso..."
                              className="input md:col-span-2 text-xs"
                              value={debitoPenhoraExtenso}
                              onChange={(e) => setDebitoPenhoraExtenso(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Prisão */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-secondary uppercase tracking-wider">
                            Débito Rito Prisão
                          </label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input
                              type="text"
                              placeholder="R$ 0,00"
                              className="input font-mono"
                              value={debitoPrisaoValor}
                              onChange={(e) => {
                                const val = formatCurrencyMask(e.target.value);
                                setDebitoPrisaoValor(val);
                                setDebitoPrisaoExtenso(numeroParaExtenso(val));
                              }}
                            />
                            <input
                              type="text"
                              placeholder="Valor por extenso..."
                              className="input md:col-span-2 text-xs"
                              value={debitoPrisaoExtenso}
                              onChange={(e) => setDebitoPrisaoExtenso(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-secondary/20 mt-2">
                        <div className="flex justify-between items-center bg-secondary/10 p-3 rounded-lg">
                          <span className="text-sm font-bold text-secondary">
                            VALOR TOTAL DA CAUSA:
                          </span>
                          <span className="text-lg font-mono font-black text-secondary">
                            {formatCurrencyMask(
                              (
                                (parseFloat(
                                  debitoPenhoraValor.replace(/\./g, "").replace(",", ".") || 0,
                                ) +
                                  parseFloat(
                                    debitoPrisaoValor.replace(/\./g, "").replace(",", ".") || 0,
                                  )) *
                                100
                              ).toFixed(0),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 mt-4 border-t border-border">
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleSaveJuridico}
                          disabled={isSavingJuridico}
                          className="btn btn-primary flex items-center gap-2"
                        >
                          <Save size={18} />
                          {isSavingJuridico ? "Salvando..." : "Salvar Dados Jurídicos"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRegenerateMinuta(true)}
                          disabled={isRegeneratingMinuta || isSavingJuridico}
                          className="btn-regenerate"
                        >
                          <RefreshCw
                            size={18}
                            className={isRegeneratingMinuta ? "animate-spin" : ""}
                          />
                          {isRegeneratingMinuta ? "Regerando..." : "Regerar Minuta com Novos Dados"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col lg:flex-row gap-6">
                  {/* SIDEBAR LATERA - GESTÃO E DOWNLOADS DAS MINUTAS */}
                  <div className="lg:w-1/3 flex flex-col gap-4">
                    <div className="card space-y-4">
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <h3 className="heading-3">📂 Arquivos Gerados</h3>
                        {user?.cargo === "admin" && (
                          <button
                            onClick={handleGenerateFatos}
                            disabled={isGenerating || caso.status === "processando"}
                            className="text-primary hover:bg-primary/10 p-1 rounded transition-colors"
                            title="Regenerar texto dos fatos com IA"
                          >
                            <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
                          </button>
                        )}
                      </div>

                      <p className="text-sm text-muted">
                        Selecione um arquivo para pré-visualizar ao lado, ou clique no ícone de
                        download.
                      </p>

                      <div className="space-y-3">
                        {documentosNoFluxo.map((doc) => (
                          <div
                            key={doc.key}
                            className={`flex items-center justify-between p-3 border rounded-lg transition-colors cursor-pointer ${minutaPreview === doc.key ? doc.previewClass : doc.defaultClass}`}
                          >
                            <div
                              className="flex-1 flex flex-col"
                              onClick={() => setMinutaPreview(doc.key)}
                            >
                              <button className={`text-left font-bold text-sm ${doc.textClass}`}>
                                {doc.label}
                              </button>
                              <span className="text-[10px] text-muted opacity-60">
                                Versão gerada pelo sistema
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {doc.isMissing ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    doc.handler?.();
                                  }}
                                  disabled={doc.loading}
                                  className="btn btn-ghost btn-sm text-highlight p-1 hover:bg-highlight/10"
                                  title="Gerar Documento com IA"
                                >
                                  {doc.loading ? (
                                    <Loader2 size={18} className="animate-spin" />
                                  ) : (
                                    <Wand2 size={20} />
                                  )}
                                </button>
                              ) : (
                                <div className="flex items-center">
                                  <a
                                    href={doc.url}
                                    download
                                    className="p-2 text-success hover:scale-110 transition-transform"
                                    title="Fazer Download"
                                  >
                                    <Download size={20} />
                                  </a>

                                  {doc.handler && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        doc.handler();
                                      }}
                                      disabled={doc.loading}
                                      className="p-2 text-highlight hover:scale-110 transition-transform"
                                      title="Regerar Documento (Substituir atual)"
                                    >
                                      {doc.loading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                      ) : (
                                        <RefreshCw size={18} />
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}

                              <label
                                className="p-2 text-primary hover:scale-110 transition-transform cursor-pointer"
                                title="Substituir por versão local (Word/PDF)"
                              >
                                {isUploadingMinuta ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : (
                                  <Upload size={20} />
                                )}
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".docx,.pdf"
                                  onChange={(e) => handleUploadMinuta(e.target.files[0], doc.key)}
                                />
                              </label>
                            </div>
                          </div>
                        ))}

                        {!documentosNoFluxo.length && (
                          <div className="text-sm font-medium text-muted p-4 border border-dashed border-border rounded-lg text-center">
                            Nenhum documento gerado ainda.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ÁREA PRINCIPAL - PRÉ-VISUALIZAÇÃO (IFRAME) */}
                  <div className="lg:w-2/3">
                    <div className="card h-full p-0 overflow-hidden border-2 border-border">
                      {/* Header do Preview */}
                      <div className="bg-app p-3 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2 text-muted font-medium text-sm">
                          <Eye size={16} />
                          👁️ Pré-visualização:{" "}
                          <span className="text-primary uppercase tracking-wider">
                            {documentoPreviewSelecionado?.label || minutaPreview}
                          </span>
                        </div>
                      </div>

                      {/* Visualização DOCX via Microsoft Viewer */}
                      {previewUrl ? (
                        <div className="w-full h-[800px] bg-white">
                          <iframe
                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                            className="w-full h-full"
                            frameBorder="0"
                            title="Visualizacao da Minuta"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="bg-white text-slate-900 p-8 rounded shadow-sm border border-border font-serif whitespace-pre-wrap text-justify leading-relaxed min-h-[400px] flex items-center justify-center text-muted italic">
                          {documentoPreviewSelecionado?.isMissing ? (
                            <div className="text-center space-y-2">
                              <Wand2 size={48} className="mx-auto opacity-20 mb-4" />
                              <p className="text-lg font-bold">Documento não gerado</p>
                              <p className="text-sm not-italic">Utilize o botão de geração na barra lateral.</p>
                            </div>
                          ) : (
                            caso.peticao_completa_texto ||
                            caso.peticao_inicial_rascunho ||
                            "A minuta ainda não foi gerada. Aguarde o processamento."
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {autosType === "proprios_autos" && (
              <div className="card border-2 border-dashed border-primary/30 text-center p-8 bg-primary/5">
                <AlertTriangle className="mx-auto text-primary mb-3" size={32} />
                <h3 className="text-lg font-bold text-primary">Modelos em Desenvolvimento</h3>
                <p className="text-muted text-sm mt-2">
                  Atualmente, os modelos para peticionamento <b>Nos Próprios Autos</b> ainda estão
                  sendo integrados ao sistema.
                  <br />
                  Por favor, utilize as minutas de <b>Autos Apartados</b> como base se necessário.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: GESTÃO E FINALIZAÇÃO */}
        {activeTab === "gestao" && (
          <div className="space-y-6 animate-fade-in">
            {/* SEÇÃO DE FEEDBACK / ANOTAÇÕES (movida da Visão Geral) */}
            <section className="card space-y-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="text-primary" />
                <h2 className="heading-2">Anotações / Feedback</h2>
              </div>
              <p className="text-sm text-muted">
                Espaço para observações internas sobre o caso ou ajustes necessários na minuta.
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

            <div className="card space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">Status atual</p>
                <div className="relative flex items-center gap-2 z-10">
                  <button
                    onClick={() => mutate()}
                    className="text-muted hover:text-primary transition-colors p-1"
                    title="Atualizar status"
                  >
                    <RefreshCw
                      size={16}
                      className={caso.status === "processando" ? "animate-spin" : ""}
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
                      <p className="font-bold capitalize">{statusKey.replace(/_/g, " ")}</p>
                      <p className="text-muted">
                        {statusDescriptions[statusKey] || "Sem descrição."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTÃO DE REPROCESSAMENTO (Apenas para ADMIN) */}
              {user?.cargo === "admin" && (
                <button
                  onClick={handleReprocessar}
                  disabled={isReprocessing || caso.status === "processando_ia"}
                  className="btn btn-ghost border border-red-200 bg-red-50 text-red-700 w-full flex items-center justify-center gap-2 hover:bg-red-100"
                >
                  <RefreshCw size={16} className={isReprocessing ? "animate-spin" : ""} />
                  {isReprocessing ? "Reiniciando..." : "Reprocessar Caso (IA + Documentos)"}
                </button>
              )}

              {/* ÁREA DE PENDÊNCIA (Só aparece se selecionar aguardando_documentos) */}
              {statusKey === "aguardando_documentos" && (
                <div className="p-4 bg-bg border border-border rounded-lg space-y-2 animate-fade-in">
                  <label className="text-sm font-bold text">
                    Descreva os documentos pendentes: <span className="text-red-500">*</span>
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
                disabled={isUpdating || statusKey === "protocolado"}
              >
                {/* LÓGICA DE EXIBIÇÃO INTELIGENTE: */}

                {/* 1. Se o caso JÁ estiver finalizado, mostra essa opção extra apenas para leitura */}
                {statusKey === "protocolado" && (
                  <option value="protocolado">✅ Concluído / Protocolado</option>
                )}

                {/* 2. Opção atual (se automática/não listada nas manuais) */}
                {statusKey !== "protocolado" &&
                  !manualStatusOptions.find((o) => o.value === statusKey) && (
                    <option value={statusKey} disabled>
                      {statusKey.charAt(0).toUpperCase() + statusKey.slice(1).replace(/_/g, " ")}{" "}
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
              {statusKey === "protocolado" && (
                <p className="text-xs text-green-600 mt-1">
                  * Caso finalizado via integração Solar.
                </p>
              )}

              {isUpdating && <p className="text-xs text-muted">Atualizando status...</p>}
            </div>

            {/* --- SEÇÃO: CÁLCULO E DADOS JURÍDICOS --- */}
            {/* --- ZONA DE FINALIZAÇÃO DO ESTAGIÁRIO --- */}
            <div className="space-y-6 mb-8">
              <div className="card space-y-4 border-l-4 border-l-primary">
                <div className="flex items-center gap-3">
                  <Mic className="text-primary" />
                  <h2 className="heading-2">Memória de Cálculo</h2>
                </div>
                <textarea
                  className="input min-h-[200px] font-mono text-sm bg-bg/30"
                  placeholder="Ex: Ref jan/24 a mar/24 + multa 10%... "
                  value={memoriaCalculo}
                  onChange={(e) => setMemoriaCalculo(e.target.value)}
                />
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveJuridico}
                    disabled={isSavingJuridico}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Save size={18} />
                    {isSavingJuridico ? "Salvando..." : "Salvar Dados Jurídicos"}
                  </button>
                </div>
              </div>
            </div>
            {/* Oculta o fluxo de finalização para servidor e estagiario */}
            {user?.cargo !== "servidor" && user?.cargo !== "estagiario" && (
              <div className="mt-8 pt-8 border-t border-soft">
                <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <CheckCircle className="text-green-500" />
                  Finalização e Encaminhamento (Solar)
                </h2>

                {caso.status === "protocolado" ? (
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
                        <label className="text-xs text-muted uppercase font-bold">Número</label>
                        <p className="text-lg font-mono text-muted">{caso.numero_solar}</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted uppercase font-bold">
                          Número do Processo (TJ)
                        </label>
                        <p className="text-lg font-mono text-muted">{caso.numero_processo}</p>
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
                      {/* INPUT NÚMERO SOLAR */}
                      <div>
                        <label className="block text-sm font-medium text-muted mb-1">
                          Número SOLAR/SIGAD
                        </label>
                        <input
                          type="text"
                          value={numSolar}
                          onChange={(e) => setNumSolar(e.target.value)}
                          placeholder="Ex: 1234..."
                          className="w-full bg-app border border-soft rounded-lg p-3 text-muted focus:ring-2 focus:ring-primary outline-none"
                          required
                        />
                      </div>

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
                          <span className="text-primary font-medium">{arquivoCapa.name}</span>
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
                      {enviandoFinalizacao ? "Processando..." : "Concluir Caso e Enviar ao Cidadão"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {permissions.canDistribuir && (
              <button
                onClick={() => setIsDistribuirOpen(true)}
                className="btn btn-primary w-full py-3 mb-4 flex items-center justify-center gap-2"
              >
                <UserPlus size={18} />
                Distribuir Caso
              </button>
            )}

            {/* Botão de Arquivar (Movido para Gestão) */}
            <button
              onClick={handleArquivarClick}
              className={`btn w-full justify-center ${
                caso.arquivado
                  ? "btn-primary"
                  : "bg-slate-200 hover:bg-slate-300 text-slate-700 border-transparent"
              }`}
            >
              {caso.arquivado ? <ArchiveRestore size={18} /> : <Archive size={18} />}
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
                  onClick={handleUnlock}
                  disabled={isUpdating}
                  className="btn btn-ghost border border-soft flex items-center gap-2 text-red-600 hover:bg-red-50"
                  title="Libera o caso para outros usuários"
                >
                  <Lock size={18} />
                  Liberar Caso
                </button>

                <button
                  onClick={handleDeleteCaso}
                  disabled={isDeleting}
                  className="btn btn-ghost border border-soft flex items-center gap-2 text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={18} />
                  {isDeleting ? "Excluindo..." : "Excluir"}
                </button>
              </div>
              <p className="text-sm text-muted">
                Esta ação não pode ser desfeita. Todos os dados do caso serão removidos
                permanentemente.
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
              O caso será movido para o "Arquivo Morto" e sairá da lista principal. Justifique esta
              ação:
            </p>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-main">Motivo padronizado</span>
              <select
                className="input"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                autoFocus
              >
                <option value="">Selecione um motivo</option>
                {archiveReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-bold text-main">Observacao detalhada (opcional)</span>
              <textarea
                className="input min-h-[100px] resize-none"
                placeholder="Detalhe o contexto apenas se for necessario. Evite dados pessoais."
                value={archiveObservation}
                onChange={(e) => setArchiveObservation(e.target.value)}
              />
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setArchiveModalOpen(false)}
                className="btn btn-ghost flex-1 border border-soft"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!archiveReason) {
                    toast.error("Selecione um motivo de arquivamento.");
                    return;
                  }
                  setArchiveModalOpen(false);
                  await processarArquivamento(true, archiveReason, archiveObservation.trim());
                }}
                className="btn btn-primary flex-1"
              >
                Confirmar Arquivamento
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE COMPARTILHAMENTO */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-surface border border-soft p-6 rounded-2xl shadow-xl max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-primary">
              <User size={24} />
              <h3 className="text-xl font-bold text-main">Compartilhar Acesso</h3>
            </div>

            <p className="text-muted text-sm">
              Selecione um colega para dar acesso e permissão de edição neste caso. Ele receberá uma
              notificação para aceitar.
            </p>

            {isLoadingColegas ? (
              <div className="flex justify-center p-4">
                <Loader2 className="animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="text"
                    className="input pl-10 py-2 text-sm"
                    placeholder="Filtrar por nome..."
                    value={buscaColega}
                    onChange={(e) => setBuscaColega(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                  {colegas
                    .filter((c) => c.nome.toLowerCase().includes(buscaColega.toLowerCase()))
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedColegaId(c.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
                          selectedColegaId === c.id
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
                            : "border-border bg-surface hover:border-primary/50 hover:bg-primary/5"
                        }`}
                      >
                        <div
                          className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs ${
                            selectedColegaId === c.id
                              ? "bg-primary text-white"
                              : "bg-bg text-primary border border-border"
                          }`}
                        >
                          {c.nome.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-bold text-sm truncate ${selectedColegaId === c.id ? "text-primary" : "text-main"}`}
                          >
                            {c.nome.split(" (")[0]}
                          </p>
                          <p className="text-[10px] text-muted uppercase tracking-wider truncate">
                            {c.nome.split(" (")[1]?.replace(")", "") || ""}
                          </p>
                        </div>
                        {selectedColegaId === c.id && (
                          <CheckCircle size={16} className="text-primary" />
                        )}
                      </button>
                    ))}

                  {colegas.length > 0 &&
                    colegas.filter((c) => c.nome.toLowerCase().includes(buscaColega.toLowerCase()))
                      .length === 0 && (
                      <div className="text-center p-8 text-muted italic text-sm">
                        Nenhum colega encontrado.
                      </div>
                    )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="btn btn-ghost flex-1 border border-soft"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmShare}
                disabled={isSharing || !selectedColegaId}
                className="btn btn-primary flex-1"
              >
                {isSharing ? "Enviando..." : "Enviar Convite"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalDistribuicao
        caso={caso}
        isOpen={isDistribuirOpen}
        onClose={() => setIsDistribuirOpen(false)}
        onRefresh={() => mutate()}
      />
    </div>
  );
};

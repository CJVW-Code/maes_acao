import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  Search,
  Hash,
  KeyRound,
  CheckCircle,
  FileText,
  Clock,
  Video,
  HelpCircle,
  AlertTriangle,
  Upload,
  X,
  CalendarX,
} from "lucide-react";
import { API_BASE } from "../../../utils/apiBase";
import { useToast } from "../../../contexts/ToastContext";
import { DocumentUpload } from "../../../components/DocumentUpload";

export const ConsultaStatus = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [cpf, setCpf] = useState("");
  const [caso, setCaso] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Barreira visual consultar casos
  const [mostrarConsulta, setMostrarConsulta] = useState(false);

  // Estados para Upload Complementar
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Estados para Reagendamento
  const [isReagendando, setIsReagendando] = useState(false);
  const [motivoReagendamento, setMotivoReagendamento] = useState("");
  const [dataSugerida, setDataSugerida] = useState("");
  const [enviandoReagendamento, setEnviandoReagendamento] = useState(false);

  // Auto-consulta se CPF na URL
  useEffect(() => {
    const cpfFromUrl = searchParams.get("representante_cpf");
    if (cpfFromUrl) {
      setCpf(cpfFromUrl);
      consultarPorCpf(cpfFromUrl);
    }
  }, [searchParams]);

  const consultarPorCpf = async (cpfParam) => {
    setLoading(true);
    setCaso(null);
    setError(null);

    const cpfLimpo = cpfParam.replace(/\D/g, "");
    try {
      const response = await fetch(`${API_BASE}/status/cpf/${cpfLimpo}`);
      if (response.status === 404) {
        setError("Nenhum caso encontrado para este CPF.");
        return;
      }
      if (!response.ok) {
        throw new Error("Erro na consulta");
      }
      const data = await response.json();
      // Garantir que pegamos o objeto do caso, mesmo se a API retornar um array (multi-casos)
      const casoData = Array.isArray(data) ? data[0] : data;
      setCaso(casoData);
    } catch (err) {
      setError(err.message || "Erro ao consultar CPF.");
    } finally {
      setLoading(false);
    }
  };

  const handleConsulta = async (e) => {
    e.preventDefault();
    consultarPorCpf(cpf);
  };
  const handleFileSelect = (e) => {
    const newFiles = Array.from(e.target.files);
    // Filtra duplicatas baseadas no nome do arquivo
    const uniqueFiles = newFiles.filter(
      (newFile) =>
        !files.some((existing) => existing.file.name === newFile.name),
    );
    const mappedFiles = uniqueFiles.map((file) => ({
      file,
      customName: file.name,
    }));
    setFiles([...files, ...mappedFiles]);
  };

  const handleNameChange = (index, newName) => {
    const newFiles = [...files];
    newFiles[index].customName = newName;
    setFiles(newFiles);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUploadComplementar = async () => {
    if (files.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    const namesMap = {};

    // IMPORTANTE: Enviar campos de texto PRIMEIRO para garantir leitura correta no backend
    formData.append("representante_cpf", cpf.replace(/\D/g, ""));

    files.forEach((item) => {
      namesMap[item.file.name] = item.customName;
    });
    formData.append("nomes_arquivos", JSON.stringify(namesMap));

    // Envia os arquivos por último
    files.forEach((item) => {
      formData.append("documentos", item.file);
    });

    try {
      // Tenta usar ID ou Protocolo (fallback para evitar ID 0)
      const identificador = caso.id || caso.protocolo || 0;

      const response = await fetch(
        `${API_BASE}/casos/${identificador}/upload-complementar?cpf=${cpf.replace(/\D/g, "")}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) throw new Error("Erro ao enviar.");

      toast.success("Documentos enviados! O defensor será notificado.");
      setFiles([]);
      // Recarrega status
      consultarPorCpf(cpf);
    } catch (err) {
      toast.error("Falha ao enviar documentos.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto bg-app p-6 sm:p-8 rounded-2xl border border-soft"
    >
      {!caso && !loading && (
        <form onSubmit={handleConsulta} className="space-y-4">
          <div className="relative">
            <Hash
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              size={20}
            />
            <input
              type="text"
              placeholder="CPF do Solicitante"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 bg-app rounded-lg border border-soft focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-muted"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Search className="inline mr-2" />
            {loading ? "Consultando..." : "Consultar Status"}
          </button>
        </form>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted">Consultando...</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {caso && (
        <>
          {/* CARD DE AGENDAMENTO ONLINE */}
          {(caso.status === "reuniao online" ||
            (caso.status === "reuniao agendada" && caso.agendamento_link)) && (
            <div className="bg-surface/20 border border-border/50 rounded-xl p-6 mt-6 mb-4 ">
              <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                <Video size={20} /> Atendimento Online Agendado
              </h3>
              {caso.agendamento_data && (
                <p className="text-muted mt-2">
                  Data:{" "}
                  <strong className="text-lg">
                    {caso.agendamento_data_formatada ||
                      new Date(caso.agendamento_data).toLocaleString("pt-BR")}
                  </strong>
                </p>
              )}
              <a
                href={caso.agendamento_link}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary w-full mt-4 flex justify-center items-center gap-2"
              >
                ENTRAR NA REUNIÃO AGORA
              </a>

              {!isReagendando ? (
                <button
                  onClick={() => setIsReagendando(true)}
                  className="w-full mt-3 text-sm text-muted hover:text-red-500 underline flex items-center justify-center gap-1"
                >
                  <CalendarX size={14} /> Não posso comparecer neste dia/horário
                </button>
              ) : (
                <div className="mt-4 bg-surface p-4 rounded border border-soft animate-fade-in">
                  <label className="text-sm font-bold text-muted mb-2 block">
                    Motivo do reagendamento:
                  </label>
                  <textarea
                    className="w-full p-2 border border-soft rounded bg-app text-sm mb-2"
                    rows="2"
                    placeholder="Ex: Tenho médico neste horário..."
                    value={motivoReagendamento}
                    onChange={(e) => setMotivoReagendamento(e.target.value)}
                  />

                  <label className="text-sm font-bold text-muted mb-2 block">
                    Sugestão de nova data/horário (Opcional):
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border border-soft rounded bg-app text-sm mb-4"
                    placeholder="Ex: Próxima terça à tarde ou Quarta pela manhã"
                    value={dataSugerida}
                    onChange={(e) => setDataSugerida(e.target.value)}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={handleSolicitarReagendamento}
                      disabled={enviandoReagendamento}
                      className="btn btn-primary btn-sm flex-1"
                    >
                      {enviandoReagendamento
                        ? "Enviando..."
                        : "Enviar Solicitação"}
                    </button>
                    <button
                      onClick={() => setIsReagendando(false)}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CARD DE AGENDAMENTO PRESENCIAL */}
          {caso.status === "reuniao presencial" && (
            <div className="bg-surface/20 border border-border/50 rounded-xl p-6 mt-6 mb-4 ">
              <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                <Clock size={20} /> Atendimento Presencial Agendado
              </h3>
              {caso.agendamento_data && (
                <p className="text-muted mt-2">
                  Data:{" "}
                  <strong className="text-lg">
                    {caso.agendamento_data_formatada ||
                      new Date(caso.agendamento_data).toLocaleString("pt-BR")}
                  </strong>
                </p>
              )}
              {caso.agendamento_link && (
                <div className="mt-4 p-4 bg-surface rounded border border-soft">
                  <p className="text-sm font-bold text-muted uppercase">
                    Local / Instruções
                  </p>
                  <p className="text-text whitespace-pre-wrap">
                    {caso.agendamento_link}
                  </p>
                </div>
              )}

              {!isReagendando ? (
                <button
                  onClick={() => setIsReagendando(true)}
                  className="w-full mt-3 text-sm text-muted hover:text-red-500 underline flex items-center justify-center gap-1"
                >
                  <CalendarX size={14} /> Não posso comparecer neste dia/horário
                </button>
              ) : (
                <div className="mt-4 bg-surface p-4 rounded border border-soft animate-fade-in">
                  <label className="text-sm font-bold text-muted mb-2 block">
                    Motivo do reagendamento:
                  </label>
                  <textarea
                    className="w-full p-2 border border-soft rounded bg-app text-sm mb-2"
                    rows="2"
                    placeholder="Ex: Trabalho neste horário..."
                    value={motivoReagendamento}
                    onChange={(e) => setMotivoReagendamento(e.target.value)}
                  />

                  <label className="text-sm font-bold text-muted mb-2 block">
                    Sugestão de nova data/horário (Opcional):
                  </label>
                  <input
                    type="text"
                    className="w-full p-2 border border-soft rounded bg-app text-sm mb-4"
                    placeholder="Ex: Preferência por atendimento matutino"
                    value={dataSugerida}
                    onChange={(e) => setDataSugerida(e.target.value)}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={handleSolicitarReagendamento}
                      disabled={enviandoReagendamento}
                      className="btn btn-primary btn-sm flex-1"
                    >
                      {enviandoReagendamento
                        ? "Enviando..."
                        : "Enviar Solicitação"}
                    </button>
                    <button
                      onClick={() => setIsReagendando(false)}
                      className="btn btn-ghost btn-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {caso.status === "finalizado" || 
          caso.status === "protocolado" || 
          caso.status === "encaminhado_solar" ? (
            // --- TELA DE CASO CONCLUÍDO ---
            <div className="bg-border/10 border border-border/30 rounded-xl p-6 mt-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-primary/50 text-muted p-2 rounded-full">
                  <CheckCircle size={24} />
                </div>
                <h3 className="text-xl font-bold text-muted">
                  Atendimento Concluído!
                </h3>
              </div>

              <p className="text-muted mb-6">
                Seu caso já foi analisado pela Defensoria e o processo foi
                gerado. Abaixo estão os dados do seu processo judicial.
              </p>

              {/* EXIBIÇÃO DOS NÚMEROS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-surface border border-soft p-4 rounded-lg">
                  <label className="text-xs text-muted uppercase font-bold tracking-wider">
                    Número do Processo
                  </label>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-2xl font-mono text-primary select-all">
                      {caso.numero_processo || "Número indisponível"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigator.clipboard.writeText(caso.numero_processo)
                      }
                      className="text-primary hover:text-primary text-sm"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="bg-surface border border-soft p-4 rounded-lg">
                  <label className="text-xs text-muted uppercase font-bold tracking-wider">
                    Atendimento Solar
                  </label>
                  <div className="mt-1">
                    <span className="text-xl font-mono text-primary select-all">
                      {caso.numero_solar || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* BOTÕES DE DOWNLOAD */}
              <div className="space-y-3">
                {caso.url_capa_processual && (
                  <a
                    href={caso.url_capa_processual}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost border border-soft w-full flex items-center justify-center gap-2 py-3 hover:bg-surface"
                  >
                    <FileText size={20} />
                    Baixar Capa do Processo
                  </a>
                )}
              </div>
            </div>
          ) : caso.status === "documentos pendentes" ||
            caso.status === "aguardando_documentos" ? (
            // --- TELA DE PENDÊNCIA DE DOCUMENTOS ---
            <div className="space-y-6 mt-6">
              <div className="bg-bg border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3 text">
                  <AlertTriangle size={24} />
                  <h3 className="text-lg font-bold">
                    Ação Necessária: Documentos Pendentes
                  </h3>
                </div>
                <div className="bg-bg p-4 rounded border border-border text-sm whitespace-pre-wrap font-medium text">
                  {caso.descricao_pendencia ||
                    "O defensor solicitou documentos adicionais. Por favor, anexe abaixo."}
                </div>
              </div>

              {/* ÁREA DE UPLOAD AVANÇADO */}
              <div className="bg-surface border border-soft rounded-xl p-6">
                <h4 className="font-semibold mb-4">
                  Enviar Documentos Solicitados
                </h4>

                <DocumentUpload
                  nomes={{
                    assistido: caso.nome_assistido || "",
                    responsavel: caso.nome_representante || caso.nome_assistido || "",
                    crianca: caso.nome_assistido || "",
                  }}
                  isRepresentacao={!!caso.nome_representante}
                  outrosFilhos={[]}
                  onFilesChange={(allFiles, namesMap) => {
                    const mapped = allFiles.map((f) => ({
                      file: f,
                      customName: namesMap[f.name] || f.name,
                    }));
                    setFiles(mapped);
                  }}
                />

                {files.length > 0 && (
                  <button
                    onClick={handleUploadComplementar}
                    disabled={uploading}
                    className="btn btn-primary w-full mt-6"
                  >
                    {uploading ? "Enviando..." : `Enviar ${files.length} Documento(s)`}
                  </button>
                )}
              </div>
            </div>
          ) : (
            // --- TELA DE STATUS NORMAL (EM ANÁLISE) ---
            <div className="bg-surface border border-soft rounded-xl p-6 mt-6">
              <h3 className="text-lg font-semibold text-primary mb-2">
                Status Atual
              </h3>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 text border border-yellow-500/30">
                <Clock size={16} />
                <span className="font-medium capitalize">
                  {caso.status?.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-muted mt-4">
                {caso.descricao ||
                  "Estamos analisando suas informações. Por favor, aguarde e verifique novamente em breve."}
              </p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

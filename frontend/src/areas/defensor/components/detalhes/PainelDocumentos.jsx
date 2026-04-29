import React, { useRef, useState } from "react";
import {
  Mic,
  FileText,
  Pencil,
  Check,
  X,
  Paperclip,
  UploadCloud,
  Plus,
  Download,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { authFetch } from "../../../../utils/apiBase";

export const PainelDocumentos = ({
  caso,
  user,
  editingFile,
  setEditingFile,
  handleSaveRename,
  isRenaming,
  handleUploadDocumentos,
  isUploadingDocs,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [filasEnvio, setFilasEnvio] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [isDownloadingDoc, setIsDownloadingDoc] = useState(null); // url do doc sendo baixado
  const inputRef = useRef(null);

  const podeEscrever = user?.cargo !== "visualizador";

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(pdf|jpg|jpeg|png)$/i.test(f.name),
    );
    setFilasEnvio((prev) => [...prev, ...dropped]);
  };

  const handleFileInput = (e) => {
    const selected = Array.from(e.target.files).filter((f) =>
      /\.(pdf|jpg|jpeg|png)$/i.test(f.name),
    );
    setFilasEnvio((prev) => [...prev, ...selected]);
    e.target.value = "";
  };

  const removeFile = (index) => {
    setFilasEnvio((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEnviar = async () => {
    if (filasEnvio.length === 0) return;
    await handleUploadDocumentos(filasEnvio);
    setFilasEnvio([]);
    setUploadOpen(false);
  };

  const executarDownloadComTicket = async (urlDownload, caminhoArquivo = null) => {
    const isZip = urlDownload.includes("download-zip");
    if (isZip) setIsGeneratingZip(true);
    else setIsDownloadingDoc(caminhoArquivo);

    try {
      const response = await authFetch(`/casos/${caso.id}/gerar-ticket-download`, {
        method: "POST",
        body: JSON.stringify({ caminho_arquivo: caminhoArquivo }),
      });

      if (!response.ok) throw new Error("Falha ao gerar ticket");

      const { ticket } = await response.json();

      // Abre o download em uma nova janela/tab para evitar interromper o estado do app
      const finalUrl = `${urlDownload}${urlDownload.includes("?") ? "&" : "?"}ticket=${ticket}`;
      window.location.assign(finalUrl);
    } catch (err) {
      alert("Não foi possível iniciar o download. Tente novamente.");
      console.error("[Download] Falha:", err);
    } finally {
      if (isZip) setIsGeneratingZip(false);
      else setIsDownloadingDoc(null);
    }
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="heading-2">Documentos e anexos</h2>
        <div className="flex items-center gap-2">
          {caso.documentos_detalhes?.length > 0 && (
            <button
              onClick={() => {
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001/api";
                executarDownloadComTicket(`${API_URL}/casos/${caso.id}/download-zip`);
              }}
              disabled={isGeneratingZip}
              className="btn btn-xs btn-download gap-1"
              title="Baixar todos os documentos em um arquivo ZIP"
            >
              {isGeneratingZip ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download size={12} />
                  Baixar Tudo (.zip)
                </>
              )}
            </button>
          )}
          <div className="group relative">
            <HelpCircle size={16} className="text-muted cursor-help" />
            <div className="tooltip-premium right-0 bottom-full mb-2 w-64 opacity-0 group-hover:opacity-100">
              <p className="font-bold mb-1 text-primary-600 dark:text-primary">💡 Dica de Download</p>
              <p>
                Ao baixar arquivos compactados (.zip), você pode extraí-los clicando com o botão
                direito e selecionando "Extrair Tudo" no Windows ou dando dois cliques no macOS. O
                suporte é nativo do sistema operacional.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {/* Áudio do Relato */}
        {caso.url_audio && (
          <a
            href={caso.url_audio}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary w-full justify-start"
          >
            <Mic size={18} />
            Ouvir áudio do relato
          </a>
        )}

        {/* Lista de Documentos Anexos com Etiquetas */}
        {caso.documentos_detalhes?.length > 0 ? (
          caso.documentos_detalhes.map((doc) => {
            const { url, tipo, nome_original } = doc;
            const isComplementar = url.includes("complementar_");

            // Mapeamento de Labels para etiquetas
            const tipoLabels = {
              identidade: { label: "RG/ID", color: "bg-blue-100 text-blue-700 border-blue-200" },
              cpf: { label: "CPF", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
              residencia: {
                label: "Residência",
                color: "bg-orange-100 text-orange-700 border-orange-200",
              },
              certidao: {
                label: "Certidão",
                color: "bg-purple-100 text-purple-700 border-purple-200",
              },
              renda: { label: "Renda", color: "bg-green-100 text-green-700 border-green-200" },
              outros: { label: "Outros", color: "bg-slate-100 text-slate-600 border-slate-200" },
            };

            const tag = tipoLabels[tipo] || tipoLabels.outros;
            const displayName = nome_original || url.split("/").pop().split("?")[0];
            const isEditing = editingFile.url === url;

            if (isEditing) {
              return (
                <div
                  key={url}
                  className="flex items-center gap-2 w-full p-1 bg-surface border border-primary/30 rounded-lg animate-fade-in"
                >
                  <input
                    type="text"
                    value={editingFile.name}
                    onChange={(e) => setEditingFile({ ...editingFile, name: e.target.value })}
                    className="input input-sm flex-1 h-8 text-sm"
                    autoFocus
                    placeholder="Novo nome do arquivo..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename();
                      if (e.key === "Escape") setEditingFile({ url: null, name: "" });
                    }}
                  />
                  <button
                    onClick={handleSaveRename}
                    disabled={isRenaming}
                    className="btn btn-primary btn-xs h-8 px-3 flex items-center gap-1"
                    title="Salvar"
                  >
                    <Check size={14} /> Salvar
                  </button>
                  <button
                    onClick={() => setEditingFile({ url: null, name: "" })}
                    className="btn btn-ghost btn-xs h-8 px-3 flex items-center gap-1"
                    title="Cancelar"
                  >
                    <X size={14} /> Cancelar
                  </button>
                </div>
              );
            }

            return (
              <div key={url} className="group flex items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn btn-ghost border w-full justify-start text-left break-all flex-wrap h-auto py-2.5 ${
                    isComplementar
                      ? "border-highlight/90 bg-highlight/30 hover:bg-highlight/50"
                      : "border-soft"
                  }`}
                >
                  <FileText
                    size={18}
                    className={`shrink-0 ${isComplementar ? "text-highlight" : "text-muted"}`}
                  />

                  <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${tag.color}`}
                      >
                        {tag.label}
                      </span>
                      {isComplementar && (
                        <span className="text-[10px] uppercase font-bold bg-highlight text px-2 py-0.5 rounded-md">
                          Novo (Scanner)
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-sm mt-1 truncate ${
                        isComplementar ? "font-medium text" : "text-main"
                      }`}
                    >
                      {displayName}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001/api";
                      executarDownloadComTicket(
                        `${API_URL}/casos/${caso.id}/documento/download?path=${encodeURIComponent(url)}`,
                        url,
                      );
                    }}
                    disabled={isDownloadingDoc === url}
                    className="p-1.5 hover:bg-black/5 rounded-md transition-colors ml-auto group/dl"
                    title="Baixar arquivo"
                  >
                    {isDownloadingDoc === url ? (
                      <Loader2 size={14} className="animate-spin text-primary" />
                    ) : (
                      <Download
                        size={14}
                        className="opacity-40 group-hover:opacity-100 group-hover/dl:text-primary transition-opacity"
                      />
                    )}
                  </button>
                </a>
                {podeEscrever && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setEditingFile({ url, name: displayName });
                    }}
                    className="btn btn-ghost btn-sm btn-square opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-primary"
                    title="Renomear arquivo"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted italic">Nenhum documento anexado a este caso.</p>
        )}

        {/* ── UPLOAD PELO PAINEL ────────────────────────────────────────── */}
        {podeEscrever && (
          <div className="mt-4 pt-4 border-t border-soft">
            {!uploadOpen ? (
              <button
                onClick={() => setUploadOpen(true)}
                className="btn btn-ghost border border-dashed border-primary/40 text-primary w-full justify-center gap-2 hover:bg-primary/5 hover:border-primary transition-all"
              >
                <Paperclip size={16} />
                Adicionar Documentos ao Caso
              </button>
            ) : (
              <div className="space-y-3 animate-fade-in">
                {/* Cabeçalho da seção */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-primary flex items-center gap-2">
                    <Paperclip size={15} />
                    Anexar Documentos
                  </span>
                  <button
                    onClick={() => {
                      setUploadOpen(false);
                      setFilasEnvio([]);
                    }}
                    className="text-muted hover:text-main transition-colors"
                    title="Fechar"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-2 py-8 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? "border-primary bg-primary/10 scale-[1.01]"
                      : "border-soft hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  <UploadCloud
                    size={32}
                    className={`transition-colors ${isDragging ? "text-primary" : "text-muted"}`}
                  />
                  <p className="text-sm text-center text-muted">
                    <span className="font-semibold text-primary">Clique para selecionar</span> ou
                    arraste os arquivos aqui
                  </p>
                  <p className="text-xs text-muted">PDF, JPG ou PNG</p>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                </div>

                {/* Lista de arquivos pendentes */}
                {filasEnvio.length > 0 && (
                  <div className="space-y-1.5">
                    {filasEnvio.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 bg-surface border border-soft rounded-lg text-sm"
                      >
                        <FileText size={14} className="shrink-0 text-primary" />
                        <span className="flex-1 truncate text-main">{file.name}</span>
                        <span className="text-xs text-muted shrink-0">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                        <button
                          onClick={() => removeFile(i)}
                          className="text-muted hover:text-error transition-colors"
                          title="Remover"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Botões de ação */}
                <div className="flex gap-2">
                  <button
                    onClick={handleEnviar}
                    disabled={isUploadingDocs || filasEnvio.length === 0}
                    className="btn-upload flex-1 justify-center gap-2 disabled:opacity-60"
                  >
                    {isUploadingDocs ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <UploadCloud size={16} />
                        Enviar{filasEnvio.length > 0 && ` (${filasEnvio.length})`}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => inputRef.current?.click()}
                    disabled={isUploadingDocs}
                    className="btn btn-ghost border border-soft gap-2"
                    title="Adicionar mais arquivos"
                  >
                    <Plus size={16} />
                    Mais
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../../../utils/apiBase";
import {
  Upload,
  FileText,
  CheckCircle,
  ArrowLeft,
  Loader2,
  X,
  Badge,
  IdCard,
  House,
  ScrollText,
  Wallet,
  Paperclip,
  Gavel,
  Calculator,
} from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";

export const ScannerBalcao = () => {
  const { protocolo } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [files, setFiles] = useState([]); // [{ file, tipo }]
  const [uploading, setUploading] = useState(false);

  const documentTypes = [
    { id: "identidade", label: "RG/ID", icon: IdCard },
    { id: "cpf", label: "CPF", icon: Badge },
    { id: "residencia", label: "Residência", icon: House },
    { id: "certidao", label: "Certidão", icon: ScrollText },
    { id: "renda", label: "Renda", icon: Wallet },
    { id: "sentenca", label: "Decisão", icon: Gavel },
    { id: "calculo", label: "Cálculos", icon: Calculator },
    { id: "copia_sentenca", label: "Tít. Executivo", icon: Gavel },
    { id: "outros", label: "Outros", icon: Paperclip },
  ];

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files).map((file) => ({
      file,
      tipo: "outros",
    }));
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const setFileType = (index, tipo) => {
    setFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, tipo } : item)),
    );
  };

  const handleRemove = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("protocolo", protocolo);
    files.forEach((item) => {
      formData.append("documentos", item.file);
      formData.append("tipos", item.tipo);
    });

    try {
      const response = await fetch(`${API_BASE}/scanner/upload`, {
        method: "POST",
        headers: {
          "x-api-key": import.meta.env.VITE_API_KEY_BALCAO || "",
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro no upload");
      }

      toast.success("Documentos enviados e etiquetados com sucesso!");
      setFiles([]);
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[linear-gradient(180deg,rgba(23,6,54,0.88),rgba(46,16,101,0.82))] shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(192,132,252,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.14),transparent_28%)]" />

        <div className="relative space-y-8 p-5 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => navigate(-1)}
              className="group inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white/88 transition-all hover:border-primary/50 hover:bg-white/12 hover:text-white"
            >
              <div className="rounded-full bg-white/10 p-2 text-white/90 transition-transform group-hover:scale-110">
                <ArrowLeft size={20} />
              </div>
              Voltar
            </button>

            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/65">
                Sessão Ativa
              </p>
              <p className="mt-1 inline-flex rounded-full border border-primary/35 bg-white/10 px-3 py-1 text-sm font-mono font-bold text-white shadow-[0_0_20px_rgba(139,92,246,0.18)]">
                {protocolo}
              </p>
            </div>
          </div>

          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/80">
              Digitalização Assistida
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              Mesa do{" "}
              <span className="bg-gradient-to-r from-white via-primary/80 to-orange-200 bg-clip-text text-transparent">
                Scanner
              </span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/78 md:text-lg">
              Digitalize e categorize os documentos da assistida. Cada etiqueta
              ajuda o jurídico a processar o caso mais rápido.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-8">
            <section className="relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/35 via-fuchsia-400/20 to-orange-300/20 blur-lg opacity-80" />
              <label className="group relative block rounded-3xl border-2 border-dashed border-white/18 bg-black/16 p-8 text-center backdrop-blur-md transition-all hover:border-primary/55 hover:bg-white/10 cursor-pointer md:p-12">
                <input
                  type="file"
                  multiple
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                />

                <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-[0_10px_30px_rgba(139,92,246,0.22)] transition-transform duration-300 group-hover:scale-110">
                  <Upload size={40} />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-white">
                  Importar Documentos
                </h3>
                <p className="mx-auto max-w-md text-white/72">
                  Arraste fotos ou PDFs aqui, ou clique para abrir o explorador
                  de arquivos.
                </p>
              </label>
            </section>

            {files.length > 0 && (
              <section className="space-y-6 animate-slide-up">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h2 className="flex items-center gap-3 text-xl font-bold text-white">
                    <div className="rounded-lg border border-primary/30 bg-primary/18 p-2 text-primary">
                      <FileText size={20} />
                    </div>
                    Fila de Processamento ({files.length})
                  </h2>
                  <p className="text-xs font-medium italic text-white/60">
                    Selecione o tipo de cada arquivo antes de enviar
                  </p>
                </div>

                <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto pr-2 custom-scrollbar md:grid-cols-2">
                  {files.map((item, i) => (
                    <div
                      key={i}
                      className={`rounded-2xl border p-5 transition-all duration-300 ${
                        item.tipo !== "outros"
                          ? "border-primary/35 bg-white/14 shadow-lg shadow-primary/10"
                          : "border-white/12 bg-white/8 hover:border-primary/28 hover:bg-white/12"
                      }`}
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          {item.file.type.startsWith("image/") ? (
                            <img
                              src={URL.createObjectURL(item.file)}
                              alt="preview"
                              className={`h-10 w-10 shrink-0 rounded-xl object-cover ${
                                item.tipo !== "outros"
                                  ? "ring-2 ring-primary shadow-md shadow-primary/20"
                                  : "ring-1 ring-white/10"
                              }`}
                            />
                          ) : (
                            <div
                              className={`h-10 w-10 flex items-center justify-center shrink-0 rounded-xl ${
                                item.tipo !== "outros"
                                  ? "bg-primary text-white shadow-md shadow-primary/20"
                                  : "bg-white/10 text-white/72"
                              }`}
                            >
                              <FileText size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p
                              className="truncate text-sm font-bold leading-tight text-white"
                              title={item.file.name}
                            >
                              {item.file.name}
                            </p>
                            <p className="text-[10px] font-medium text-white/58">
                              {(item.file.size / 1024).toFixed(0)} KB •{" "}
                              {item.file.type.split("/")[1]?.toUpperCase() ||
                                "FILE"}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemove(i)}
                          className="rounded-lg p-1.5 text-white/55 transition-colors hover:bg-red-500/12 hover:text-red-200"
                          title="Remover arquivo"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {documentTypes.map((type) => {
                          const Icon = type.icon;

                          return (
                            <button
                              key={type.id}
                              onClick={() => setFileType(i, type.id)}
                              className={`flex flex-col items-center justify-center rounded-xl border p-2 text-[10px] font-bold transition-all ${
                                item.tipo === type.id
                                  ? "scale-105 border-primary bg-primary text-white shadow-md shadow-primary/25"
                                  : "border-white/10 bg-black/10 text-white/75 hover:border-primary/35 hover:bg-white/10"
                              }`}
                            >
                              <Icon size={16} className="mb-1" />
                              <span className="truncate w-full text-center">{type.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-6">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="group relative w-full overflow-hidden rounded-2xl p-px transition-all hover:scale-[1.01] active:scale-[0.99] disabled:scale-100 disabled:opacity-70"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-fuchsia-500 to-indigo-500" />
                    <div className="relative flex items-center justify-center gap-3 bg-[linear-gradient(180deg,rgba(139,92,246,0.92),rgba(124,58,237,0.92))] px-8 py-5 text-xl font-bold text-white transition-all group-hover:bg-transparent">
                      {uploading ? (
                        <Loader2 className="animate-spin" size={24} />
                      ) : (
                        <CheckCircle size={24} />
                      )}
                      {uploading
                        ? "Enviando Documentos..."
                        : "Confirmar e Enviar para Jurídico"}
                    </div>
                  </button>

                  <p className="mt-4 text-center text-xs font-medium text-white/58">
                    Os documentos serão vinculados instantaneamente ao protocolo
                    da assistida.
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

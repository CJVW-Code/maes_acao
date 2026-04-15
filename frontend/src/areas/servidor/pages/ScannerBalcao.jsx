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
} from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";

export const ScannerBalcao = () => {
  const { protocolo } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [files, setFiles] = useState([]); // [{ file, tipo }]
  const [uploading, setUploading] = useState(false);

  const documentTypes = [
    { id: "identidade", label: "RG/ID", icon: "🪪" },
    { id: "cpf", label: "CPF", icon: "📑" },
    { id: "residencia", label: "Residência", icon: "🏠" },
    { id: "certidao", label: "Certidão", icon: "📜" },
    { id: "renda", label: "Renda", icon: "💰" },
    { id: "outros", label: "Outros", icon: "📎" },
  ];

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files).map((f) => ({
      file: f,
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
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center gap-2 text-muted hover:text-primary transition-all font-medium"
        >
          <div className="bg-surface border border-soft p-2 rounded-lg group-hover:scale-110 transition-transform shadow-sm">
            <ArrowLeft size={20} />
          </div>
          Voltar
        </button>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted font-bold">Sessão Ativa</p>
          <p className="text-sm font-mono font-bold text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/20">
            {protocolo}
          </p>
        </div>
      </div>

      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-main">
          Mesa do <span className="text-gradient">Scanner</span>
        </h1>
        <p className="text-muted text-lg max-w-2xl">
          Digitalize e categorize os documentos da assistida. Cada etiqueta ajuda o jurídico a processar o caso mais rápido.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {/* Dropzone Area */}
        <section className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-indigo-500 rounded-2xl blur opacity-10"></div>
          <div className="relative border-2 border-dashed border-primary/30 bg-surface/50 backdrop-blur-sm rounded-2xl p-12 text-center hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group">
            <input
              type="file"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              accept="image/*,.pdf"
            />
            <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
              <Upload size={40} />
            </div>
            <h3 className="text-2xl font-bold text-main mb-2">Importar Documentos</h3>
            <p className="text-muted max-w-md mx-auto">
              Arraste fotos ou PDFs aqui, ou clique para abrir o explorador de arquivos.
            </p>
          </div>
        </section>

        {files.length > 0 && (
          <section className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between border-b border-soft pb-4">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <div className="bg-primary/10 text-primary p-2 rounded-lg">
                  <FileText size={20} />
                </div>
                Fila de Processamento ({files.length})
              </h2>
              <p className="text-xs text-muted italic font-medium">Selecione o tipo de cada arquivo antes de enviar</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {files.map((item, i) => (
                <div
                  key={i}
                  className={`p-5 rounded-2xl border transition-all duration-300 ${
                    item.tipo !== "outros" 
                      ? "bg-surface border-primary/20 shadow-lg shadow-primary/5" 
                      : "bg-surface/50 border-soft hover:border-primary/20"
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${item.tipo !== 'outros' ? 'bg-primary text-white' : 'bg-soft text-muted'}`}>
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-main truncate leading-tight" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <p className="text-[10px] text-muted font-medium">
                          {(item.file.size / 1024).toFixed(0)} KB • {item.file.type.split('/')[1]?.toUpperCase() || 'FILE'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(i)}
                      className="text-muted hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Remover arquivo"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {documentTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setFileType(i, type.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl text-[10px] font-bold transition-all border ${
                          item.tipo === type.id
                            ? "bg-primary border-primary text-white shadow-md transform scale-105"
                            : "bg-app/50 border-soft text-muted hover:border-primary/30 hover:bg-primary/5"
                        }`}
                      >
                        <span className="text-lg mb-1">{type.icon}</span>
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-soft">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="group relative w-full overflow-hidden rounded-2xl p-px transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:scale-100"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-indigo-600"></div>
                <div className="relative flex items-center justify-center gap-3 bg-primary hover:bg-transparent py-5 px-8 text-xl font-bold text-white transition-all">
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
              <p className="text-center text-xs text-muted mt-4 font-medium">
                Os documentos serão vinculados instantaneamente ao protocolo da assistida.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

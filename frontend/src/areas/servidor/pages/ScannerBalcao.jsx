import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../../../utils/apiBase";
import {
  Upload,
  FileText,
  CheckCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";

export const ScannerBalcao = () => {
  const { protocolo } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const handleRemove = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("protocolo", protocolo);
    files.forEach((f) => formData.append("documentos", f));

    try {
      const response = await fetch(`${API_BASE}/scanner/upload`, {
        method: "POST",
        headers: {
          // A mágica que permite enviar sem estar logado
          "x-api-key": import.meta.env.VITE_API_KEY_BALCAO || "",
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro no upload");
      }

      toast.success("Documentos enviados para processamento com sucesso!");
      setFiles([]);
      setTimeout(() => navigate("/"), 2000); // Volta para a Busca Central
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="btn btn-ghost border border-soft text-muted"
      >
        <ArrowLeft size={18} className="mr-2" /> Voltar
      </button>

      <div className="card space-y-4 text-center">
        <h2 className="heading-2 text-primary">Mesa do Scanner</h2>
        <p className="text-muted text-lg">
          Atendimento / Protocolo:{" "}
          <span className="font-mono font-bold text-primary-600 tracking-wider">
            {protocolo}
          </span>
        </p>

        <div className="border-2 border-dashed border-primary/50 bg-primary/5 rounded-xl p-10 mt-4 relative hover:bg-primary/10 transition-colors">
          <input
            type="file"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
            accept="image/*,.pdf"
          />
          <Upload size={48} className="mx-auto text-primary mb-4" />
          <p className="font-bold text-lg">
            Clique ou arraste todos os arquivos aqui
          </p>
          <p className="text-muted text-sm mt-2">
            Você pode selecionar múltiplos PDFs ou Fotos de uma vez.
          </p>
        </div>

        {files.length > 0 && (
          <div className="bg-surface border border-soft rounded-lg p-4 text-left animate-fade-in">
            <h3 className="font-bold mb-3">
              {files.length} arquivo(s) selecionado(s):
            </h3>
            <ul className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-2">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm bg-app p-2 rounded border border-soft"
                >
                  <span className="flex items-center gap-2 truncate text-muted font-medium">
                    <FileText size={16} className="text-primary shrink-0" />{" "}
                    {f.name}
                  </span>
                  <button
                    onClick={() => handleRemove(i)}
                    className="text-red-500 hover:text-red-700 ml-2 p-1 font-bold"
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn btn-primary w-full py-4 text-lg shadow-lg"
            >
              {uploading ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                <CheckCircle className="mr-2" />
              )}
              {uploading
                ? "Enviando para a Inteligência Artificial..."
                : "Finalizar Upload e Liberar Atendida"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

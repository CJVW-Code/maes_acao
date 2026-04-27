import React, { useState } from "react";
import { authFetch } from "../../../../utils/apiBase";
import { useToast } from "../../../../contexts/ToastContext";
import { UserPlus, X, Search, Check } from "lucide-react";

export const ModalDistribuicao = ({ caso, isOpen, onClose, onRefresh }) => {
  const [busca, setBusca] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const [defensores, setDefensores] = useState([]);
 
  React.useEffect(() => {
    if (isOpen) {
      authFetch("/defensores")
        .then(r => r.json())
        .then(data => setDefensores(data))
        .catch(() => setDefensores([]));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const defensoresFiltrados = defensores.filter(
    (d) =>
      d.nome.toLowerCase().includes(busca.toLowerCase()) ||
      d.email.toLowerCase().includes(busca.toLowerCase()),
  );

  const handleDistribuir = async (usuarioId) => {
    setSubmitting(true);
    try {
      const response = await authFetch(`/casos/${caso.id}/distribuir`, {
        method: "POST",
        body: JSON.stringify({ usuario_id: usuarioId }),
      });

      if (response.ok) {
        addToast("Caso distribuído com sucesso!", "success");
        onRefresh?.();
        onClose();
      } else {
        const err = await response.json();
        addToast(err.error || err.message || "Erro ao distribuir.", "error");
      }
    } catch {
      addToast("Erro de conexão.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-primary/5">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <UserPlus className="text-primary" size={20} /> Distribuir Atendimento
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Caso: {caso.nome_assistido} (#{caso.id})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar defensor ou servidor..."
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {defensoresFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-400">Nenhum profissional encontrado.</div>
            ) : (
              defensoresFiltrados.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleDistribuir(d.id)}
                  disabled={submitting}
                  className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all group"
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {d.nome.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 group-hover:text-primary transition-colors">
                        {d.nome}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(typeof d.cargo === "string" ? d.cargo : d.cargo?.nome) || "Profissional"} • {d.unidade_nome || d.unidade?.nome || "Sem Unidade"}
                      </p>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Check className="text-primary" size={20} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-all"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

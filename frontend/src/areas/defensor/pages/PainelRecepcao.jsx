import React, { useState } from "react";
import { Search, RotateCcw, CheckCircle } from "lucide-react";
import { API_BASE } from "../../../utils/apiBase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { useConfirm } from "../../../contexts/ConfirmContext";

export const PainelRecepcao = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [cpfBusca, setCpfBusca] = useState("");
  const [casosEncontrados, setCasosEncontrados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [novaChaveInfo, setNovaChaveInfo] = useState(null);

  const handleBuscar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setCasosEncontrados([]);
    setNovaChaveInfo(null);

    try {
      const cpfLimpo = cpfBusca.replace(/\D/g, "");
      const response = await fetch(
        // Alterado para evitar conflito com rota /casos/:id no backend
        `${API_BASE}/casos?cpf=${cpfLimpo}&exact=true`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();
      setCasosEncontrados(data);
      if (data.length === 0) toast.info("Nenhum caso encontrado para este CPF.");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao buscar.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetarChave = async (casoId) => {
    if (
      !(await confirm(
        "A chave antiga deixará de funcionar imediatamente.",
        "Resetar Chave de Acesso?"
      ))
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE}/casos/${casoId}/resetar-chave`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setNovaChaveInfo(data.novaChave);
      } else {
        toast.error("Erro: " + data.error);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao conectar ao servidor.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="heading-1">Recepção: Recuperação de Acesso</h1>

      {/* ÁREA DE BUSCA */}
      <div className="card p-8">
        <form onSubmit={handleBuscar} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm text-muted uppercase font-bold mb-2 block">
              CPF do Assistido ou Representante
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={cpfBusca}
                onChange={(e) => setCpfBusca(e.target.value)}
                placeholder="Digite apenas números"
                className="input pl-10"
                autoFocus
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary h-12 px-8"
          >
            {loading ? "Buscando..." : "Buscar Caso"}
          </button>
        </form>
      </div>

      {/* RESULTADOS DA BUSCA */}
      {casosEncontrados.length > 0 && (
        <div className="space-y-4">
          <h2 className="heading-2 text-muted">
            Casos Encontrados ({casosEncontrados.length})
          </h2>
          {casosEncontrados.map((caso) => (
            <div
              key={caso.id}
              className="bg-surface border border-soft p-6 rounded-xl flex items-center justify-between"
            >
              <div>
                <h3 className="text-xl font-bold text-muted">
                  {caso.nome_assistido}
                </h3>
                <p className="text-muted">
                  Protocolo:{" "}
                  <span className="text-primary font-mono">
                    {caso.protocolo}
                  </span>
                </p>
                <p className="text-sm text-muted mt-1">Status: {caso.status}</p>
              </div>

              <button
                onClick={() => handleResetarChave(caso.id)}
                className="btn btn-secondary border-error/30 hover:bg-error/10 text-error gap-2"
              >
                <RotateCcw size={18} />
                Resetar Chave
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL NOVA CHAVE */}
      {novaChaveInfo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-surface border border-primary p-8 rounded-2xl max-w-lg w-full text-center space-y-6 shadow-2xl shadow-primary/20">
            <div className="mx-auto bg-green-500/20 p-4 rounded-full w-fit text-green-400">
              <CheckCircle size={48} />
            </div>

            <h2 className="text-2xl font-bold text-white">
              Chave Resetada com Sucesso!
            </h2>
            <p className="text-muted">
              Entregue a nova chave abaixo para o assistido. <br />{" "}
              <strong className="text-red-400">
                Ela não poderá ser vista novamente.
              </strong>
            </p>

            <div className="bg-app p-6 rounded-xl border border-soft">
              <p className="text-xs text-muted uppercase font-bold mb-2">
                NOVA CHAVE DE ACESSO
              </p>
              <div className="text-4xl font-mono font-bold text-primary tracking-widest select-all">
                {novaChaveInfo}
              </div>
            </div>

            <button
              onClick={() => setNovaChaveInfo(null)}
              className="btn btn-primary w-full py-4"
            >
              Fechar e Limpar Tela
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

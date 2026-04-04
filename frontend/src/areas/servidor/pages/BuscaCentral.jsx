import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FilePlus, Search, ArrowRight, Check, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { API_BASE } from "../../../utils/apiBase";

export const HomeCidadao = () => {
  const navigate = useNavigate();
  const [cpfInput, setCpfInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [caseFound, setCaseFound] = useState(null);
  const [noCase, setNoCase] = useState(false);

  // Função para limpar CPF
  const cleanCpf = (cpf) => cpf.replace(/\D/g, "");

  // Função para formatar CPF
  const formatCpf = (value) => {
    const cleaned = cleanCpf(value);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
  };

  // Função para consultar API
  const consultarCpf = useCallback(async (cpf) => {
    const cleanedCpf = cleanCpf(cpf);
    if (cleanedCpf.length !== 11) return;

    setLoading(true);
    setError(null);
    setCaseFound(null);
    setNoCase(false);

    try {
      const response = await fetch(`${API_BASE}/status/cpf/${cleanedCpf}`);
      if (response.status === 404) {
        setNoCase(true);
        setTimeout(() => navigate("/novo-pedido"), 2000); // Auto-redirecionar após 2s
        return;
      }
      if (!response.ok) {
        throw new Error("Erro na consulta");
      }
      const data = await response.json();
      setCaseFound(data);
    } catch (err) {
      setError("Erro ao consultar CPF. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Debounce effect
  useEffect(() => {
    const cleaned = cleanCpf(cpfInput);
    if (cleaned.length === 11) {
      const timeoutId = setTimeout(() => {
        consultarCpf(cpfInput);
      }, 800);
      return () => clearTimeout(timeoutId);
    } else {
      setLoading(false);
      setError(null);
      setCaseFound(null);
      setNoCase(false);
    }
  }, [cpfInput, consultarCpf]);

  const handleCpfChange = (e) => {
    const value = e.target.value;
    setCpfInput(formatCpf(value));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 w-full">
      <div className="">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-surface border-2 border-soft rounded-2xl p-8 sm:p-10 shadow-sm hover:border-special/40 hover:shadow-lg relative overflow-hidden flex flex-col group hover:-translate-y-2 transition-all duration-300"
        >
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary mb-4">
            Busca Central
          </p>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-special mb-4 leading-tight">
            Insira o CPF abaixo
          </h2>
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col sm:flex-row gap-3 w-full items-stretch">
              <input
                type="text"
                placeholder="CPF"
                value={cpfInput}
                onChange={handleCpfChange}
                className="input flex-1 min-w-0"
                maxLength={14}
              />
              {loading && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="animate-spin" size={18} />
                </div>
              )}
            </div>

            {/* Renderização Condicional */}
            {error && (
              <div className="bg-error/10 border border-error text-error p-4 rounded-lg">
                {error}
              </div>
            )}

            {noCase && (
              <div className="bg-highlight/10 border border-highlight text-highlight p-4 rounded-lg">
                Nenhum caso encontrado para este CPF. Redirecionando para novo pedido...
              </div>
            )}

            {caseFound && caseFound.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-highlight/10 p-4 rounded-lg border border-highlight/20">
                  <div>
                    <h3 className="font-bold text-lg text-highlight">Próximo Passo</h3>
                    <p className="text-sm text-muted">Você pode gerenciar os casos existentes ou iniciar um novo para esta mesma representante.</p>
                  </div>
                  <button 
                    onClick={() => {
                      // Pega os dados da representante do primeiro caso (se existir)
                      const repData = caseFound[0]?.dados_representante || {};
                      navigate("/novo-pedido", { 
                        state: { 
                           action: 'PREFILL_REPRESENTATIVE_DATA', 
                           payload: repData 
                        } 
                      });
                    }}
                    className="btn btn-primary whitespace-nowrap"
                  >
                    Novo Caso (Mesma Rep.)
                  </button>
                </div>
                
                <h3 className="font-bold text-xl mt-2">Casos Encontrados ({caseFound.length})</h3>
                {caseFound.map((caso) => (
                  <motion.div
                    key={caso.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-surface border border-soft rounded-lg p-4 snap-start"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg mb-2">Processo / Caso</h3>
                        <p><strong>Nome do Assistido:</strong> {caso.nome_assistido}</p>
                        {caso.nome_representante && (
                          <p><strong>Nome da Representante:</strong> {caso.nome_representante}</p>
                        )}
                        <p><strong>Status:</strong> <span className="badge">{caso.status}</span></p>
                        <p className="text-sm text-muted mt-2">{caso.descricao}</p>
                      </div>
                      <div className="text-right">
                        {caso.status === "documentos pendentes" ? (
                          <Link to={`/consultar?cpf=${cleanCpf(cpfInput)}`} className="btn btn-primary mt-2">
                            Anexar Documentos
                          </Link>
                        ) : (
                          <Link to={`/consultar?cpf=${cleanCpf(cpfInput)}`} className="btn btn-secondary mt-2">
                            Ver Detalhes
                          </Link>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

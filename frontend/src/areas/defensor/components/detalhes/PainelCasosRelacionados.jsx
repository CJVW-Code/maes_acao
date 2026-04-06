import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ArrowRight } from "lucide-react";
import { API_BASE } from "../../../../utils/apiBase";

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
  default: "bg-slate-100 text-slate-700 border-slate-200",
};

export const PainelCasosRelacionados = ({ casoOriginal }) => {
  const [casos, setCasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRelacionados = async () => {
      // Usar CPF da representante se existir, senao do assistido
      const cpfBusca = casoOriginal?.casos_partes?.cpf_representante 
                   || casoOriginal?.dados_formulario?.representante_cpf 
                   || casoOriginal?.cpf_assistido
                   || casoOriginal?.dados_formulario?.cpf;

      if (!cpfBusca) {
        setLoading(false);
        return;
      }

      try {
        const cleanCpf = cpfBusca.replace(/\D/g, "");
        const res = await fetch(`${API_BASE}/casos`); 
        // A API já converte a lista para o defender sem auth? wait, we can just use the /status/cpf API which is mixed.
        // Wait, since this is defender view, we should use the same token... no, /status/cpf/:cpf is public. Let's use it.
        const response = await fetch(`${API_BASE}/status/cpf/${cleanCpf}`);
        
        if (!response.ok) {
           if (response.status === 404) {
             setCasos([]);
             return;
           }
           throw new Error("Erro buscar relacionados");
        }
        const data = await response.json();
        // Filtra o próprio caso (casoOriginal.id), pois estamos na visualizacao dos relacionados
        const filtered = (Array.isArray(data) ? data : [data]).filter(c => String(c.id) !== String(casoOriginal.id));
        setCasos(filtered);
      } catch (err) {
        setError("Erro ao carregar casos relacionados.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRelacionados();
  }, [casoOriginal]);

  if (loading) {
     return <div className="p-4 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></div>;
  }
  
  if (error) {
     return <div className="text-error bg-error/10 p-4 border border-error/20 rounded">{error}</div>;
  }
  
  if (casos.length === 0) {
     return <div className="p-4 text-muted">Nenhum outro caso localizado para esta representação (CPF).</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {casos.map(c => {
        // Tenta usar o status retornado que é do cidadao, mas o status interno seria melhor. Vamos usar o badge generico.
        const statusKey = (c.status || "default").toLowerCase();
        
        return (
          <div key={c.id} className="bg-surface border border-soft rounded-xl p-4 shadow-sm hover:shadow transition-shadow">
             <div className="flex justify-between items-start mb-2">
                <span className={`badge capitalize ${statusBadges[statusKey] || statusBadges.default}`}>
                   {statusKey.replace(/_/g, " ")}
                </span>
             </div>
             <p className="font-bold text-lg">{c.nome_assistido}</p>
             <p className="text-sm text-muted">{c.numero_processo ? `Processo: ${c.numero_processo}` : "Processo não gerado"}</p>
             <Link 
               to={`/painel/casos/${c.id}`} 
               className="mt-4 flex items-center justify-between group text-sm font-bold text-primary hover:text-primary-600"
             >
               <span>Abrir caso relacionado</span>
               <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
             </Link>
          </div>
        )
      })}
    </div>
  );
};

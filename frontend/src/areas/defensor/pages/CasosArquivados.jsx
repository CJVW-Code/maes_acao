import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import { Eye, Search, Archive, ArchiveRestore } from "lucide-react";
import { API_BASE } from "../../../utils/apiBase";
import { useToast } from "../../../contexts/ToastContext";
import { useConfirm } from "../../../contexts/ConfirmContext";
import useSWR from "swr";
import { authFetch } from "../../../utils/apiBase"; // Ajuste o caminho conforme o arquivo

const fetcher = async (url) => {
  const response = await authFetch(url);
  if (!response.ok) throw new Error("Erro ao buscar dados.");
  return response.json();
};

const statusStyles = {
  recebido: "bg-slate-100 text-slate-700 border-slate-200",
  em_analise: "bg-sky-100 text-sky-800 border-sky-200",
  aguardando_docs: "bg-purple-100 text-purple-800 border-purple-200",
  reuniao_agendada: "bg-purple-100 text-purple-800 border-purple-200",
  reuniao_online_agendada: "bg-blue-100 text-blue-800 border-blue-200",
  encaminhado_solar: "bg-emerald-100 text-emerald-800 border-emerald-200",
  default: "bg-slate-100 text-slate-700 border-slate-200",
};

const normalizeStatus = (value) => (value || "recebido").toLowerCase();

export const CasosArquivados = () => {
  const [busca, setBusca] = useState("");
  const { token } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // A Mágica do SWR
  const {
    data: casos = [],
    error,
    isLoading,
    mutate,
  } = useSWR(token ? [`/casos?arquivado=true`, token] : null, ([url]) => fetcher(url), {
    revalidateOnFocus: false,
    dedupingInterval: 600000,
  });

  // Tratamentos visuais (adicione logo abaixo do useSWR)
  if (isLoading)
    return (
      <div className="p-8 text-center text-muted">Carregando arquivos...</div>
    );
  if (error)
    return (
      <div className="p-8 text-center text-red-500">
        Erro ao carregar os casos arquivados.
      </div>
    );

  const handleRestaurar = async (casoId) => {
    if (
      await confirm(
        "Deseja mover este caso de volta para os Ativos?",
        "Restaurar Caso",
      )
    ) {
      try {
        const response = await fetch(`${API_BASE}/casos/${casoId}/arquivar`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ arquivado: false }),
        });
        if (!response.ok) throw new Error("Erro ao restaurar.");
        toast.success("Caso restaurado com sucesso!");
        mutate(casos.filter((c) => c.id !== casoId), false);
      } catch (err) {
        toast.error("Erro ao restaurar caso.");
      }
    }
  };

  // Filtro de busca
  const casosFiltrados = casos.filter((caso) => {
    const termo = busca.toLowerCase();
    return (
      caso.nome_assistido?.toLowerCase().includes(termo) ||
      caso.protocolo?.toLowerCase().includes(termo) ||
      caso.cpf_assistido?.includes(termo) ||
      (caso.numero_solar && String(caso.numero_solar).includes(termo))
    );
  });

  return (
    <div className="space-y-8 pb-24">
      <section className="card space-y-2 border-l-4 border-l-amber-500">
        <div className="flex items-center gap-2 text-amber-500 mb-2">
          <Archive size={24} />
          <p className="text-sm uppercase tracking-[0.3em] font-bold">
            Arquivo Morto
          </p>
        </div>
        <h1 className="heading-1">Casos Arquivados</h1>
        <p className="text-muted">
          Histórico de casos que foram arquivados por inconsistência de dados ou
          finalização.
        </p>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-soft px-6 py-4">
          <div className="flex-1">
            <h2 className="heading-2">Registros no Arquivo</h2>
            <p className="text-sm text-muted">
              {casos.length} casos encontrados.
            </p>
          </div>

          {/* CAMPO DE BUSCA */}
          <div className="relative w-full md:w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar no arquivo..."
              className="input pl-10 py-2 text-sm"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {casosFiltrados.length === 0 ? (
          <div className="text-center p-8 text-muted">
            {casos.length === 0
              ? "Nenhum caso arquivado."
              : "Nenhum resultado para a busca."}
          </div>
        ) : (
          <>
            {/* VISÃO DESKTOP (TABELA) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table text-sm w-full">
                <thead className="">
                  <tr className="text-muted uppercase text-xs tracking-wide">
                    <th className="px-4 py-3">Protocolo</th>
                    <th className="px-4 py-3">Nome do cidadão</th>
                    <th className="px-4 py-3">Data de abertura</th>
                    <th className="px-4 py-3">Status Original</th>
                    <th className="px-4 py-3">Motivo</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {casosFiltrados.map((caso) => {
                    const statusKey = normalizeStatus(caso.status);
                    const badgeStyle =
                      statusStyles[statusKey] || statusStyles.default;
                    return (
                      <tr
                        key={caso.id}
                        className="border-t border-soft hover:bg-app transition opacity-75 hover:opacity-100"
                      >
                        <td className="p-4 font-mono text-xs text-muted">
                          <div>{caso.protocolo}</div>
                        </td>
                        <td className="p-4 font-medium">
                          {caso.nome_assistido}
                        </td>
                        <td className="p-4 text-muted">
                          {new Date(caso.created_at).toLocaleDateString(
                            "pt-BR",
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`badge capitalize ${badgeStyle}`}>
                            {statusKey.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-muted max-w-[200px]">
                          <p
                            className="truncate"
                            title={caso.motivo_arquivamento}
                          >
                            {caso.motivo_arquivamento || "-"}
                          </p>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-3">
                          <Link
                            to={`/painel/casos/${caso.id}`}
                            className="inline-flex items-center gap-2 text-primary hover:text-primary-600 font-medium"
                            title="Ver detalhes"
                          >
                            <Eye size={18} />
                            Consultar
                          </Link>
                          <button
                            onClick={() => handleRestaurar(caso.id)}
                            className="inline-flex items-center gap-2 text-success hover:text-success/80 font-medium"
                            title="Restaurar para ativos"
                          >
                            <ArchiveRestore size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISÃO MOBILE (CARDS) */}
            <div className="md:hidden divide-y divide-soft">
              {casosFiltrados.map((caso) => {
                const statusKey = normalizeStatus(caso.status);
                const badgeStyle =
                  statusStyles[statusKey] || statusStyles.default;
                return (
                  <div key={caso.id} className="p-4 space-y-3 bg-surface">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-xs text-muted block mb-1">
                          {caso.protocolo}
                        </span>
                        <h3 className="font-medium text-base">
                          {caso.nome_assistido}
                        </h3>
                        <p className="text-xs text-muted mt-1">
                          {new Date(caso.created_at).toLocaleDateString(
                            "pt-BR",
                          )}
                        </p>
                      </div>
                      <span
                        className={`badge text-xs capitalize ${badgeStyle}`}
                      >
                        {statusKey.replace("_", " ")}
                      </span>
                    </div>

                    <div className="bg-app p-3 rounded border border-soft text-sm">
                      <p className="text-xs text-muted uppercase font-bold mb-1">
                        Motivo do Arquivamento
                      </p>
                      <p className="text-muted line-clamp-2">
                        {caso.motivo_arquivamento || "Não informado."}
                      </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Link
                        to={`/painel/casos/${caso.id}`}
                        className="btn btn-secondary flex-1 justify-center text-sm"
                      >
                        <Eye size={16} className="mr-2" />
                        Detalhes
                      </Link>
                      <button
                        onClick={() => handleRestaurar(caso.id)}
                        className="btn btn-ghost border border-success/30 text-success flex-1 justify-center text-sm hover:bg-success/10"
                      >
                        <ArchiveRestore size={16} className="mr-2" />
                        Restaurar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

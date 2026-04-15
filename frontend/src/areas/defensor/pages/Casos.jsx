// Arquivo: frontend-defensor/src/components/Casos.jsx

import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";
import { Eye, Search, Lock, User } from "lucide-react";
import useSWR from "swr";

// 1. Trazemos seu authFetch de volta
import { authFetch } from "../../../utils/apiBase";

// 2. Criamos o fetcher do SWR usando a sua função oficial
const fetcher = async (url) => {
  try {
    const response = await authFetch(url);
    if (!response.ok) {
      const error = new Error("Falha ao buscar os casos.");
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
};
const statusStyles = {
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

const normalizeStatus = (value) => (value || "recebido").toLowerCase();

export const Casos = () => {
  const [busca, setBusca] = useState("");
  const { token, user } = useAuth();

  // 3. A mágica do SWR corrigida:
  // Passamos apenas a rota '/casos', pois o authFetch já completa a URL base internamente
  const {
    data: casos,
    error,
    isLoading,
  } = useSWR(token ? ['/casos', token] : null, ([url]) => fetcher(url), {
    revalidateOnFocus: false,
    dedupingInterval: 600000,
  });

  // Filtro de busca (Se casos ainda for undefined, usamos um array vazio [])
  const casosFiltrados = (casos || []).filter((caso) => {
    const termo = busca.toLowerCase();
    return (
      caso.nome_assistido?.toLowerCase().includes(termo) ||
      caso.protocolo?.toLowerCase().includes(termo) ||
      caso.cpf_assistido?.includes(termo) ||
      (caso.numero_solar && String(caso.numero_solar).includes(termo))
    );
  });

  if (isLoading) {
    return (
      <div className="card text-center text-muted">
        Carregando listagem de casos...
      </div>
    );
  }

  if (error) {
    if (error.message === "Sessão expirada" || error.status === 401) {
      return null; // O context vai redirecionar
    }
    return (
      <div className="card border-l-4 border-l-red-500 text-red-600">
        {error.message || "Falha ao buscar os casos."}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      <section className="card space-y-2 border-l-4 border-l-primary/70">
        <p className="text-sm text-muted uppercase tracking-[0.3em]">
          Protocolo digital
        </p>
        <h1 className="heading-1">Todos os casos recebidos</h1>
        <p className="text-muted">
          Consulte rapidamente o status dos atendimentos resgatados da triagem
          cidadão e avance as tratativas.
        </p>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-soft px-6 py-4">
          <div className="flex-1">
            <h2 className="heading-2">Listagem oficial</h2>
            <p className="text-sm text-muted">
              {casos?.length || 0} registros importados do Assistente Mães em Ação.
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
              placeholder="Buscar nome, CPF, protocolo ou Solar..."
              className="input pl-10 py-2 text-sm"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        {casosFiltrados.length === 0 ? (
          <div className="text-center p-8 text-muted">
            {casos?.length === 0
              ? "Nenhum caso encontrado."
              : "Nenhum resultado para a busca."}
          </div>
        ) : (
          <>
            {/* VISÃO DESKTOP (TABELA) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table text-sm">
                <thead className="">
                  <tr className="text-muted uppercase text-xs tracking-wide">
                    <th className="px-4 py-3">Protocolo</th>
                    <th className="px-4 py-3">Nome do cidadão</th>
                    <th className="px-4 py-3">Data de abertura</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-4 py-3">Status</th>
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
                        className="border-t border-soft hover:bg-app transition"
                      >
                        <td className="p-4 font-mono text-xs text-muted">
                          <div>{caso.protocolo}</div>
                          {caso.numero_solar && (
                            <div className="text-primary font-semibold mt-1">
                              Solar: {caso.numero_solar}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{caso.nome_assistido}</div>
                          {caso.nome_representante && (
                            <div className="text-sm text-primary-600 mt-1 font-semibold">
                              Representante: {caso.nome_representante}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-muted">
                          {new Date(caso.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-4">
                          {caso.defensor || caso.servidor ? (
                            <div className="flex items-center gap-2 text-xs">
                              <div className={`p-1 rounded-full ${
                                (user && (caso.defensor_id === user.id || caso.servidor_id === user.id)) 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-amber-100 text-amber-700"
                              }`}>
                                { (user && (caso.defensor_id === user.id || caso.servidor_id === user.id)) ? <User size={12} /> : <Lock size={12} /> }
                              </div>
                              <span className="font-medium whitespace-nowrap">
                                { (user && (caso.defensor_id === user.id || caso.servidor_id === user.id)) 
                                  ? "Meu Atendimento" 
                                  : (caso.defensor?.nome || caso.servidor?.nome) }
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted italic">Disponível</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border ${badgeStyle}`}
                          >
                            {statusKey.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            to={`/painel/casos/${caso.id}`}
                            className="inline-flex items-center gap-2 text-primary hover:text-primary-600 font-medium"
                            title="Ver detalhes"
                          >
                            <Eye size={18} />
                            Ver detalhes
                          </Link>
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
                        <h3 className="font-medium text-base leading-tight">
                          {caso.nome_assistido}
                        </h3>
                        {caso.nome_representante && (
                          <p className="text-xs text-primary-600 font-bold mt-1">
                            Representante: {caso.nome_representante}
                          </p>
                        )}
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

                    {caso.numero_solar && (
                      <div className="bg-app p-2 rounded border border-soft text-xs">
                        <span className="font-semibold text-primary">
                          Solar:
                        </span>{" "}
                        {caso.numero_solar}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <Link
                        to={`/painel/casos/${caso.id}`}
                        className="btn btn-secondary flex-1 justify-center text-sm"
                      >
                        <Eye size={16} className="mr-2" />
                        Ver detalhes
                      </Link>
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

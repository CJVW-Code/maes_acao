import React, { useState, useEffect } from "react";
import { 
  Users, UserPlus, Building2, Search, Edit, Trash2, X, Save, MapPin, 
  KeyRound, Lock, Building, ChevronRight, UserCog, Plus
} from "lucide-react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../../utils/apiBase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { useConfirm } from "../../../contexts/ConfirmContext";
import { cidadesBahia, regionalOptions } from "../../../utils/formOptions";

const PESO_CARGO = {
  admin: 3,
  gestor: 2,
  coordenador: 1,
  defensor: 0,
  servidor: 0,
  estagiario: 0,
  recepcao: 0,
  visualizador: 0,
};

export const GerenciarEquipe = () => {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // --- ESTADO DAS ABAS ---
  const [abaAtiva, setAbaAtiva] = useState("equipe"); // "equipe" | "unidades"

  // --- ESTADOS DE EQUIPE ---
  const [usuarios, setUsuarios] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", cargo: "", unidade_id: "" });
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [novaSenhaManual, setNovaSenhaManual] = useState("");

  // --- ESTADOS DE UNIDADES ---
  const [editingUnidade, setEditingUnidade] = useState(null);
  const [novaUnidade, setNovaUnidade] = useState(false);
  const [unidadeForm, setUnidadeForm] = useState({ nome: "", comarca: "", sistema: "solar", regional: "" });
  const [loadingUnidade, setLoadingUnidade] = useState(false);

  // --- FILTRO DE UNIDADE, CARGO E BUSCA NA EQUIPE ---
  const [filtroUnidade, setFiltroUnidade] = useState("");
  const [filtroCargo, setFiltroCargo] = useState("");
  const [termoPesquisa, setTermoPesquisa] = useState("");

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [equipRes, unidRes] = await Promise.all([
          fetch(`${API_BASE}/defensores`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/unidades`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (equipRes.ok) setUsuarios(await equipRes.json());
        if (unidRes.ok) setUnidades(await unidRes.json());
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
    if (token) fetchData();
  }, [token]);

  // ========== FUNÇÕES DE EQUIPE ==========

  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditForm({
      nome: user.nome,
      email: user.email,
      cargo: user.cargo,
      unidade_id: user.unidade_id || "",
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoadingUpdate(true);
    try {
      const response = await fetch(`${API_BASE}/defensores/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      if (!response.ok) throw new Error("Falha ao atualizar");

      const unidadeObj = unidades.find((u) => u.id === editForm.unidade_id);
      setUsuarios(
        usuarios.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                ...editForm,
                unidade_nome: unidadeObj?.nome || "Sem unidade",
              }
            : u,
        ),
      );
      setEditingUser(null);
      toast.success("Dados do usuário atualizados com sucesso!");
    } catch {
      toast.error("Erro ao atualizar usuário.");
    } finally {
      setLoadingUpdate(false);
    }
  };

  const confirmResetPassword = async (e) => {
    e.preventDefault();
    if (!novaSenhaManual) return;
    try {
      const response = await fetch(
        `${API_BASE}/defensores/${userToReset.id}/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ novaSenha: novaSenhaManual }),
        },
      );
      if (!response.ok) throw new Error("Erro ao resetar");
      toast.success(`Senha de ${userToReset.nome} alterada com sucesso!`);
      setUserToReset(null);
      setNovaSenhaManual("");
    } catch {
      toast.error("Erro ao resetar senha.");
    }
  };

  const handleDeleteUser = async (user) => {
    if (await confirm(`Tem certeza que deseja remover ${user.nome}?`, "Excluir Usuário")) {
      try {
        const response = await fetch(`${API_BASE}/defensores/${user.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Erro ao excluir");
        setUsuarios(usuarios.filter((u) => u.id !== user.id));
        toast.success("Usuário excluído com sucesso.");
      } catch {
        toast.error("Erro ao excluir usuário.");
      }
    }
  };

  // ========== FUNÇÕES DE UNIDADES ==========

  const abrirFormUnidade = (unidade = null) => {
    if (unidade) {
      setEditingUnidade(unidade);
      setUnidadeForm({ nome: unidade.nome, comarca: unidade.comarca, sistema: unidade.sistema || "solar", regional: unidade.regional || "" });
      setNovaUnidade(false);
    } else {
      setEditingUnidade(null);
      setUnidadeForm({ nome: "", comarca: "", sistema: "solar", regional: "" });
      setNovaUnidade(true);
    }
  };

  const fecharFormUnidade = () => {
    setEditingUnidade(null);
    setNovaUnidade(false);
    setUnidadeForm({ nome: "", comarca: "", sistema: "solar", regional: "" });
  };

  const handleSalvarUnidade = async (e) => {
    e.preventDefault();
    setLoadingUnidade(true);

    try {
      const isEdit = !!editingUnidade;
      const url = isEdit ? `${API_BASE}/unidades/${editingUnidade.id}` : `${API_BASE}/unidades`;
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(unidadeForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao salvar");
      }

      const savedUnidade = await response.json();

      if (isEdit) {
        setUnidades(unidades.map((u) => (u.id === savedUnidade.id ? { ...u, ...savedUnidade } : u)));
        toast.success("Unidade atualizada!");
      } else {
        setUnidades([...unidades, { ...savedUnidade, total_membros: 0, total_casos: 0 }]);
        toast.success("Unidade criada com sucesso!");
      }
      fecharFormUnidade();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingUnidade(false);
    }
  };

  const handleDeletarUnidade = async (unidade) => {
    if (await confirm(`Tem certeza que deseja remover "${unidade.nome}"?`, "Excluir Unidade")) {
      try {
        const response = await fetch(`${API_BASE}/unidades/${unidade.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Erro ao excluir");
        }
        setUnidades(unidades.filter((u) => u.id !== unidade.id));
        toast.success("Unidade removida com sucesso.");
      } catch (error) {
        toast.error(error.message);
      }
    }
  };

  // --- DADOS FILTRADOS ---
  const usuariosFiltrados = usuarios.filter((u) => {
    const matchUnidade = !filtroUnidade || u.unidade_nome?.toLowerCase().includes(filtroUnidade.toLowerCase());
    const matchCargo = !filtroCargo || u.cargo === filtroCargo;
    const matchBusca = !termoPesquisa || u.nome.toLowerCase().includes(termoPesquisa.toLowerCase());
    return matchUnidade && matchCargo && matchBusca;
  });

  const cargoBadge = (cargo) => {
    const map = {
      admin: "bg-red-100 text-red-800",
      gestor: "bg-indigo-100 text-indigo-800",
      coordenador: "bg-purple-100 text-purple-800",
      defensor: "bg-blue-100 text-blue-800",
      servidor: "bg-highlight/15 text-highlight",
      estagiario: "bg-green-100 text-green-800",
      visualizador: "bg-slate-100 text-slate-800",
    };
    return map[cargo] || "bg-blue-100 text-blue-800";
  };

  // ========== RENDER ==========
  return (
    <div className="space-y-6 pb-24">
      {/* CABEÇALHO */}
      <section className="card border-l-4 border-l-primary/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-sm text-muted uppercase tracking-[0.3em]">Administração</p>
          <h1 className="heading-1">Gerenciar Equipe</h1>
          <p className="text-muted">Gerencie unidades, defensores, estagiários e recepcionistas.</p>
        </div>
        {abaAtiva === "equipe" ? (
          <Link to="/painel/cadastro" className="btn btn-primary w-full md:w-auto">
            <UserPlus size={20} className="mr-2" /> Novo Usuário
          </Link>
        ) : (
          <button onClick={() => abrirFormUnidade()} className="btn btn-primary w-full md:w-auto">
            <Plus size={20} className="mr-2" /> Nova Unidade
          </button>
        )}
      </section>

      {/* ABAS */}
      <div className="flex border-b border-soft">
        <button
          onClick={() => setAbaAtiva("equipe")}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all border-b-2 ${
            abaAtiva === "equipe"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-text"
          }`}
        >
          <Users size={18} />
          Membros ({usuarios.length})
        </button>
        {(user?.cargo?.toLowerCase() === "admin" || user?.cargo?.toLowerCase() === "gestor") && (
          <button
            onClick={() => setAbaAtiva("unidades")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all border-b-2 ${
              abaAtiva === "unidades"
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            <Building2 size={18} />
            Unidades ({unidades.length})
          </button>
        )}
      </div>

      {/* ==================== ABA: EQUIPE ==================== */}
      {abaAtiva === "equipe" && (
        <section className="card p-0 overflow-hidden">
          {/* Filtro por unidade */}
          <div className="px-6 py-4 border-b border-soft bg-surface-alt flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <h2 className="heading-3 flex items-center gap-2">
              <Users size={18} /> Membros Cadastrados
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome..."
                  value={termoPesquisa}
                  onChange={(e) => setTermoPesquisa(e.target.value)}
                  className="input text-sm py-1.5 pl-10 w-full"
                />
              </div>

              <div className="relative flex-1 sm:w-48">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Unidade..."
                  list="unidades-datalist"
                  value={filtroUnidade}
                  onChange={(e) => setFiltroUnidade(e.target.value)}
                  className="input text-sm py-1.5 pl-10 w-full"
                />
                <datalist id="unidades-datalist">
                  <option value="">Todas Unidades</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.nome} />
                  ))}
                </datalist>
              </div>

              <select
                value={filtroCargo}
                onChange={(e) => setFiltroCargo(e.target.value)}
                className="input text-sm py-1.5 w-full sm:w-40"
              >
                <option value="">Todos Cargos</option>
                <option value="estagiario">Estagiário</option>
                <option value="servidor">Servidor</option>
                <option value="defensor">Defensor</option>
                <option value="coordenador">Coordenador</option>
                <option value="gestor">Gestor</option>
                <option value="admin">Administrador</option>
                <option value="visualizador">Visualizador</option>
              </select>
            </div>
          </div>

          {/* TABELA DESKTOP */}
          <div className="hidden md:block overflow-x-auto">
            <table className="table w-full text-sm text-left">
              <thead className="bg-surface-alt text-muted uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Cargo</th>
                  <th className="px-6 py-3">Unidade</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {usuariosFiltrados.map((u) => (
                  <tr key={u.id} className="hover:bg-app/50">
                    <td className="px-6 py-4 font-medium">{u.nome}</td>
                    <td className="px-6 py-4 text-muted">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${cargoBadge(u.cargo)}`}>{u.cargo.toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted flex items-center gap-1">
                        <MapPin size={14} />
                        {u.unidade_nome || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-3">
                      {/* Só mostra ações se o alvo for estritamente inferior (<) ou se eu for Admin */}
                      {(user?.cargo?.toLowerCase() === "admin" || PESO_CARGO[user?.cargo?.toLowerCase()] > PESO_CARGO[u.cargo?.toLowerCase()]) ? (
                        <>
                          <button onClick={() => handleEditClick(u)} className="text-blue-400 hover:text-blue-600" title="Editar">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => { setUserToReset(u); setNovaSenhaManual(""); }} className="text-amber-400 hover:text-amber-600" title="Resetar Senha">
                            <KeyRound size={16} />
                          </button>
                          <button onClick={() => handleDeleteUser(u)} className="text-red-400 hover:text-red-600" title="Excluir Usuário">
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted italic">Acesso restrito</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CARDS MOBILE */}
          <div className="md:hidden divide-y divide-soft">
            {usuariosFiltrados.map((u) => (
              <div key={u.id} className="p-4 space-y-3 bg-surface">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-base">{u.nome}</h3>
                    <p className="text-sm text-muted break-all">{u.email}</p>
                    <p className="text-xs text-muted flex items-center gap-1 mt-1">
                      <MapPin size={12} /> {u.unidade_nome || "Sem unidade"}
                    </p>
                  </div>
                  <span className={`badge text-xs ${cargoBadge(u.cargo)}`}>{u.cargo.toUpperCase()}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-soft/50">
                  {(user?.cargo?.toLowerCase() === "admin" || PESO_CARGO[user?.cargo?.toLowerCase()] > PESO_CARGO[u.cargo?.toLowerCase()]) ? (
                    <>
                      <button onClick={() => handleEditClick(u)} className="btn btn-ghost flex-1 justify-center text-sm text-blue-600 hover:bg-blue-50 h-10 px-2">
                        <Edit size={16} className="mr-2" /> Editar
                      </button>
                      <button onClick={() => { setUserToReset(u); setNovaSenhaManual(""); }} className="btn btn-ghost flex-1 justify-center text-sm text-amber-600 hover:bg-amber-50 h-10 px-2">
                        <KeyRound size={16} className="mr-2" /> Senha
                      </button>
                      <button onClick={() => handleDeleteUser(u)} className="btn btn-ghost flex-1 justify-center text-sm text-red-600 hover:bg-red-50 h-10 px-2">
                        <Trash2 size={16} className="mr-2" /> Excluir
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-muted text-center w-full py-2">Sem permissão de gerenciamento</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ==================== ABA: UNIDADES ==================== */}
      {abaAtiva === "unidades" && (
        <section className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-soft bg-surface-alt">
            <h2 className="heading-3 flex items-center gap-2">
              <Building2 size={18} /> Unidades Cadastradas
            </h2>
          </div>

          {unidades.length === 0 ? (
            <div className="p-12 text-center text-muted">
              <Building2 size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-semibold mb-2">Nenhuma unidade cadastrada</p>
              <p className="text-sm">Clique em "Nova Unidade" para começar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {unidades.map((u) => (
                <div key={u.id} className="bg-surface border border-soft rounded-xl p-5 space-y-3 hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{u.nome}</h3>
                      <p className="text-sm text-muted flex items-center gap-1 mt-1">
                        <MapPin size={14} /> {u.comarca}
                      </p>
                      <p className="text-[10px] text-primary/70 font-bold uppercase tracking-wider mt-1">
                        {u.regional || "Sem Regional"}
                      </p>
                    </div>
                    <span className={`badge text-xs ${u.ativo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {u.ativo ? "ATIVA" : "INATIVA"}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-muted">
                    <span><strong>{u.total_membros || 0}</strong> membros</span>
                    <span><strong>{u.total_casos || 0}</strong> casos</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-soft/50">
                    <button onClick={() => abrirFormUnidade(u)} className="btn btn-ghost flex-1 text-sm text-blue-600 hover:bg-blue-50 h-9 justify-center">
                      <Edit size={14} className="mr-1" /> Editar
                    </button>
                    <button onClick={() => handleDeletarUnidade(u)} className="btn btn-ghost flex-1 text-sm text-red-600 hover:bg-red-50 h-9 justify-center">
                      <Trash2 size={14} className="mr-1" /> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ==================== MODAIS ==================== */}

      {/* MODAL DE EDIÇÃO DE USUÁRIO */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-surface border border-soft p-8 rounded-2xl max-w-md w-full space-y-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="heading-2">Editar Usuário</h2>
              <button onClick={() => setEditingUser(null)} className="text-muted hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="label">Nome Completo</label>
                <input
                  type="text" required value={editForm.nome}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email" required value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Cargo</label>
                <select value={editForm.cargo} onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })} className="input">
                  <option value="estagiario">Estagiário</option>
                  <option value="servidor">Servidor / Balcão</option>
                  <option value="defensor">Defensor</option>
                  
                  {/* Filtro por hierarquia no Editar */}
                  {PESO_CARGO[user?.cargo?.toLowerCase()] > 1 && (
                    <option value="coordenador">Coordenador</option>
                  )}
                  {PESO_CARGO[user?.cargo?.toLowerCase()] > 2 && (
                    <option value="gestor">Defensor Geral (Gestor)</option>
                  )}
                  {user?.cargo?.toLowerCase() === "admin" && (
                    <option value="admin">Administrador</option>
                  )}
                  <option value="visualizador">Visualizador</option>
                </select>
              </div>
              <div>
                <label className="label">Unidade</label>
                <select
                  value={editForm.unidade_id}
                  onChange={(e) => setEditForm({ ...editForm, unidade_id: e.target.value })}
                  className="input"
                >
                  <option value="">Sem unidade</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome} — {u.comarca}</option>
                  ))}
                </select>
              </div>

              <button type="submit" disabled={loadingUpdate} className="btn btn-primary w-full flex items-center justify-center gap-2">
                <Save size={18} />
                {loadingUpdate ? "Salvando..." : "Salvar Alterações"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RESET DE SENHA */}
      {userToReset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-surface border border-primary p-8 rounded-2xl max-w-md w-full text-center space-y-6 shadow-2xl shadow-primary/20">
            <div className="mx-auto bg-amber-500/20 p-4 rounded-full w-fit text-amber-400">
              <Lock size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white">Definir Nova Senha</h2>
            <p className="text-muted">
              Digite a nova senha para o usuário <strong>{userToReset.nome}</strong>.
            </p>
            <form onSubmit={confirmResetPassword} className="space-y-4">
              <input
                type="text"
                placeholder="Digite a nova senha aqui"
                className="input text-center font-mono text-lg"
                value={novaSenhaManual}
                onChange={(e) => setNovaSenhaManual(e.target.value)}
                required
                autoFocus
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setUserToReset(null)} className="btn btn-ghost flex-1 border border-soft">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Salvar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO/EDIÇÃO DE UNIDADE */}
      {(novaUnidade || editingUnidade) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-surface border border-soft p-8 rounded-2xl max-w-md w-full space-y-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="heading-2">
                {editingUnidade ? "Editar Unidade" : "Nova Unidade"}
              </h2>
              <button onClick={fecharFormUnidade} className="text-muted hover:text-white">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSalvarUnidade} className="space-y-4">
              <div>
                <label className="label">Nome da Unidade</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Defensoria Teixeira de Freitas"
                  value={unidadeForm.nome}
                  onChange={(e) => setUnidadeForm({ ...unidadeForm, nome: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Comarca (Cidade)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Teixeira de Freitas"
                  list="cidades-list"
                  value={unidadeForm.comarca}
                  onChange={(e) => setUnidadeForm({ ...unidadeForm, comarca: e.target.value })}
                  className="input"
                />
                <datalist id="cidades-list">
                  {cidadesBahia.map((cidade) => (
                    <option key={cidade} value={cidade} />
                  ))}
                </datalist>
                <p className="text-xs text-muted mt-1">
                  Os casos da mesma cidade serão vinculados automaticamente a esta unidade.
                </p>
              </div>
              <div>
                <label className="label">Sistema Judicial</label>
                <select
                  value={unidadeForm.sistema}
                  onChange={(e) => setUnidadeForm({ ...unidadeForm, sistema: e.target.value })}
                  className="input"
                >
                  <option value="solar">Solar</option>
                  <option value="sigad">SIGAD</option>
                </select>
              </div>
              <div>
                <label className="label">Regional</label>
                <select
                  value={unidadeForm.regional}
                  onChange={(e) => setUnidadeForm({ ...unidadeForm, regional: e.target.value })}
                  className="input"
                >
                  {regionalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loadingUnidade}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {loadingUnidade ? "Salvando..." : editingUnidade ? "Salvar Alterações" : "Criar Unidade"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

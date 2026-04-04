import React, { useState, useEffect } from "react";
import {
  UserPlus,
  Shield,
  Users,
  Trash2,
  Edit,
  X,
  Save,
  CheckCircle,
  AlertTriangle,
  KeyRound,
  Copy,
  Lock,
  AlertOctagon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../../utils/apiBase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import { useConfirm } from "../../../contexts/ConfirmContext";

export const GerenciarEquipe = () => {
  const { token } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [usuarios, setUsuarios] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ nome: "", email: "", cargo: "" });
  const [loadingUpdate, setLoadingUpdate] = useState(false);

  // Estados dos Modais
  const [userToReset, setUserToReset] = useState(null);
  const [novaSenhaManual, setNovaSenhaManual] = useState("");

  // Carregar dados reais do Supabase
  useEffect(() => {
    const fetchEquipe = async () => {
      try {
        const response = await fetch(`${API_BASE}/defensores`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUsuarios(data);
        }
      } catch (error) {
        console.error("Erro ao carregar equipe:", error);
      }
    };
    if (token) fetchEquipe();
  }, [token]);

  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditForm({ nome: user.nome, email: user.email, cargo: user.cargo });
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

      // Atualiza lista local
      setUsuarios(
        usuarios.map((u) =>
          u.id === editingUser.id ? { ...u, ...editForm } : u,
        ),
      );

      // Fechar modal e limpar
      setEditingUser(null);
      toast.success("Dados do usuário atualizados com sucesso!");
    } catch (error) {
      toast.error("Erro ao atualizar usuário.");
    } finally {
      setLoadingUpdate(false);
    }
  };

  // --- FUNÇÃO DE RESETAR SENHA ---
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
    } catch (error) {
      toast.error("Erro ao resetar senha.");
    }
  };

  // --- FUNÇÃO DE EXCLUIR USUÁRIO ---
  const handleDeleteUser = async (user) => {
    if (
      await confirm(
        `Tem certeza que deseja remover ${user.nome}?`,
        "Excluir Usuário",
      )
    ) {
      try {
        const response = await fetch(`${API_BASE}/defensores/${user.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Erro ao excluir");

        setUsuarios(usuarios.filter((u) => u.id !== user.id));
        toast.success("Usuário excluído com sucesso.");
      } catch (error) {
        toast.error("Erro ao excluir usuário.");
      }
    }
  };

  return (
    <div className="space-y-8 pb-24">
      <section className="card border-l-4 border-l-primary/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <p className="text-sm text-muted uppercase tracking-[0.3em]">
            Administração
          </p>
          <h1 className="heading-1">Gerenciar Equipe</h1>
          <p className="text-muted">
            Cadastre defensores, estagiários e recepcionistas.
          </p>
        </div>
        <Link
          to="/painel/cadastro"
          className="btn btn-primary w-full md:w-auto"
        >
          <UserPlus size={20} className="mr-2" /> Novo Usuário
        </Link>
      </section>

      <section className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-soft bg-surface-alt">
          <h2 className="heading-3 flex items-center gap-2">
            <Users size={18} /> Membros Cadastrados
          </h2>
        </div>

        {/* VISÃO DESKTOP (TABELA) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="table w-full text-sm text-left">
            <thead className="bg-surface-alt text-muted uppercase text-xs">
              <tr>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Cargo</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-soft">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-app/50">
                  <td className="px-6 py-4 font-medium">{u.nome}</td>
                  <td className="px-6 py-4 text-muted">{u.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`badge ${
                        u.cargo === "admin"
                          ? "bg-red-100 text-red-800"
                          : u.cargo === "recepcao"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {u.cargo.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex justify-end gap-3">
                    <button
                      onClick={() => handleEditClick(u)}
                      className="text-blue-400 hover:text-blue-600"
                      title="Editar"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setUserToReset(u);
                        setNovaSenhaManual("");
                      }}
                      className="text-amber-400 hover:text-amber-600"
                      title="Resetar Senha"
                    >
                      <KeyRound size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u)}
                      className="text-red-400 hover:text-red-600"
                      title="Excluir Usuário"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* VISÃO MOBILE (CARDS) */}
        <div className="md:hidden divide-y divide-soft">
          {usuarios.map((u) => (
            <div key={u.id} className="p-4 space-y-3 bg-surface">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-base">{u.nome}</h3>
                  <p className="text-sm text-muted break-all">{u.email}</p>
                </div>
                <span
                  className={`badge text-xs ${
                    u.cargo === "admin"
                      ? "bg-red-100 text-red-800"
                      : u.cargo === "recepcao"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {u.cargo.toUpperCase()}
                </span>
              </div>

              <div className="flex gap-2 pt-2 border-t border-soft/50">
                <button
                  onClick={() => handleEditClick(u)}
                  className="btn btn-ghost flex-1 justify-center text-sm text-blue-600 hover:bg-blue-50 h-10 px-2"
                >
                  <Edit size={16} className="mr-2" />
                  Editar
                </button>
                <button
                  onClick={() => {
                    setUserToReset(u);
                    setNovaSenhaManual("");
                  }}
                  className="btn btn-ghost flex-1 justify-center text-sm text-amber-600 hover:bg-amber-50 h-10 px-2"
                >
                  <KeyRound size={16} className="mr-2" />
                  Senha
                </button>
                <button
                  onClick={() => handleDeleteUser(u)}
                  className="btn btn-ghost flex-1 justify-center text-sm text-red-600 hover:bg-red-50 h-10 px-2"
                >
                  <Trash2 size={16} className="mr-2" />
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MODAL DE EDIÇÃO */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-surface border border-soft p-8 rounded-2xl max-w-md w-full space-y-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="heading-2">Editar Usuário</h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-muted hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="label">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={editForm.nome}
                  onChange={(e) =>
                    setEditForm({ ...editForm, nome: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Cargo</label>
                <select
                  value={editForm.cargo}
                  onChange={(e) =>
                    setEditForm({ ...editForm, cargo: e.target.value })
                  }
                  className="input"
                >
                  <option value="estagiario">Estagiário</option>
                  <option value="defensor">Defensor</option>
                  <option value="recepcao">Recepção</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loadingUpdate}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {loadingUpdate ? "Salvando..." : "Salvar Alterações"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RESET DE SENHA (MANUAL) */}
      {userToReset && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-surface border border-primary p-8 rounded-2xl max-w-md w-full text-center space-y-6 shadow-2xl shadow-primary/20">
            <div className="mx-auto bg-amber-500/20 p-4 rounded-full w-fit text-amber-400">
              <Lock size={48} />
            </div>

            <h2 className="text-2xl font-bold text-white">
              Definir Nova Senha
            </h2>
            <p className="text-muted">
              Digite a nova senha para o usuário{" "}
              <strong>{userToReset.nome}</strong>.
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
                <button
                  type="button"
                  onClick={() => setUserToReset(null)}
                  className="btn btn-ghost flex-1 border border-soft"
                >
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
    </div>
  );
};

// Arquivo: frontend-defensor/src/components/Cadastro.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Shield, Eye, EyeOff, Loader2, MapPin } from "lucide-react";
import { API_BASE } from "../../../utils/apiBase";
import { useAuth } from "../contexts/AuthContext";

export const Cadastro = () => {
  const { token, user } = useAuth();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [cargo, setCargo] = useState("estagiario");
  const [unidadeId, setUnidadeId] = useState("");
  const [unidades, setUnidades] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Carrega lista de unidades
  useEffect(() => {
    const fetchUnidades = async () => {
      try {
        const response = await fetch(`${API_BASE}/unidades`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          const activeUnits = data.filter(u => u.ativo);
          
          const userCargo = (user?.cargo || "").toLowerCase();
          
          if (userCargo === "coordenador" && user?.unidade_id) {
            // Encontra a unidade do coordenador para saber a regional
            const userUnit = activeUnits.find(u => u.id === user.unidade_id);
            if (userUnit?.regional) {
              setUnidades(activeUnits.filter(u => u.regional === userUnit.regional));
            } else {
              setUnidades(activeUnits.filter(u => u.id === user.unidade_id));
            }
          } else {
            setUnidades(activeUnits);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar unidades:", err);
      }
    };
    if (token) fetchUnidades();
  }, [token]);

  useEffect(() => {
    let timer;
    if (success) {
      timer = setTimeout(() => {
        navigate("/painel/equipe");
      }, 1500);
    }
    return () => clearTimeout(timer);
  }, [success, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!unidadeId) {
      setError("Selecione a unidade do novo membro.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/defensores/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ nome, email, senha, cargo, unidade_id: unidadeId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setSuccess("Membro cadastrado com sucesso!");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      <div className="grid gap-8 md:grid-cols-2 items-start">
        <div className="card bg-gradient-to-br from-surface to-surface-alt border-l-4 border-l-primary h-full">
          <div className="space-y-4">
            <Shield className="w-10 h-10" />
            <h1 className="heading-1">Novo Membro</h1>
            <p className="text-muted">
              Cadastre um novo defensor, servidor, estagiário, coordenador ou gestor para
              acessar o painel.
            </p>
            <div className="divider my-4"></div>
            <p className="text-sm text-muted">
              Preencha os dados abaixo para criar o acesso.
            </p>
          </div>
        </div>

        <div className="card space-y-6">
          <div className="flex items-center gap-3">
            <UserPlus className="text-primary" />
            <div>
              <p className="text-xs uppercase text-muted tracking-[0.3em]">
                Novo acesso
              </p>
              <h2 className="heading-2">Dados do Usuário</h2>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">
                Nome completo
              </label>
              <input
                type="text"
                placeholder="Digite o nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">
                Email institucional
              </label>
              <input
                type="email"
                placeholder="seu.nome@defensoria.ba.def.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Crie uma senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">
                Cargo / Permissão
              </label>
              <select
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="input"
              >
                <option value="estagiario">Estagiário</option>
                <option value="servidor">Servidor / Balcão</option>
                <option value="defensor">Defensor</option>
                <option value="coordenador">Coordenador</option>
                <option value="gestor">Defensor Geral (Gestor)</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            {/* SELETOR DE UNIDADE */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted flex items-center gap-1">
                <MapPin size={14} /> Unidade *
              </label>
              <select
                value={unidadeId}
                onChange={(e) => setUnidadeId(e.target.value)}
                className="input border-primary/50"
                required
              >
                <option value="">Selecione a unidade</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} — {u.comarca} {u.regional ? `(${u.regional})` : ""}
                  </option>
                ))}
              </select>
              {unidades.length === 0 && (
                <p className="text-xs text-error">
                  Nenhuma unidade cadastrada. Cadastre uma unidade antes de criar um membro.
                </p>
              )}
            </div>

            {error && <p className="alert alert-error">{error}</p>}
            {success && <p className="alert alert-success">{success}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate("/painel/equipe")}
                className="btn btn-ghost flex-1 border border-soft"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary flex-1 text-base flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <UserPlus size={18} />
                )}
                {loading ? "Salvando..." : "Cadastrar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

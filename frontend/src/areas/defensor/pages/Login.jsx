import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Shield, LogIn, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "../../../components/ThemeToggle";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, senha);
      navigate("/painel");
    } catch (err) {
      setError(err.message || "Não foi possível acessar o painel.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center px-4 py-10 relative">
      <div className="absolute top-4 left-4">
        <button onClick={() => navigate("/")} className=" btn btn-ghost">
          <ArrowLeft size={18} />
          Voltar para o início
        </button>
      </div>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-5xl grid gap-8 md:grid-cols-2 items-center">
        <div className="hidden md:flex card bg-gradient-to-br to-green-700 h-full">
          <div className="space-y-4">
            <Shield className="w-10 h-10" />
            <h1 className="heading-1  ">Painel do Defensor</h1>
            <p className="">
              Acesse o painel exclusivo para acompanhar casos submetidos via
              Assistente Def Sul, solicitar documentos e gerar minutas com o
              mesmo visual do nosso novo portal.
            </p>
            <p className="text-sm">Suporte: suporte@defsul.app</p>
          </div>
        </div>

        <div className="card space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="text-primary" />
            <div>
              <p className="text-xs uppercase text-muted tracking-[0.3em]">
                Acesso seguro
              </p>
              <h2 className="heading-2">Entrar no painel</h2>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                disabled={loading}
                className="input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  disabled={loading}
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
            {error && <p className="alert alert-error">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full text-base"
            >
              <LogIn size={18} />
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

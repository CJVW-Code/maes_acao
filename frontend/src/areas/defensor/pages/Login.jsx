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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(46, 16, 101, 0.7), rgba(46, 16, 101, 0.5)), url('/maesemacao/KV_Maes_em_Acao.jpg.jpeg')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={() => navigate("/")}
          className="btn bg-white/10 backdrop-blur-md text-white border-white/20 hover:bg-white/20"
        >
          <ArrowLeft size={18} />
          Voltar para o início
        </button>
      </div>
      <div className="absolute top-6 right-6 z-20">
        <div className="bg-white/10 backdrop-blur-md p-1 rounded-xl border border-white/20">
          <ThemeToggle />
        </div>
      </div>

      <div className="w-full max-w-md z-10">
        <div className="glass-panel p-1 rounded-[2.5rem]">
          <div className="bg-surface dark:bg-surface/90 rounded-[2.3rem] p-8 sm:p-10 space-y-8 shadow-inner">
            <div className="flex flex-col items-center text-center gap-6">
              <img
                src="/maesemacao/LOGO___Maes_em_Acao_v2_COR.png"
                alt="Mães em Ação"
                className="h-24 object-contain"
              />
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] uppercase tracking-[0.2em] font-bold text-primary">
                  <Shield size={12} />
                  Acesso Restrito
                </div>
                <h2 className="text-3xl font-serif font-bold text-text">
                  Portal do Defensor
                </h2>
                <p className="text-sm text-muted max-w-[280px] mx-auto">
                  Entre com suas credenciais institucionais para gerenciar os
                  atendimentos.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text/60 uppercase tracking-wider ml-1">
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
                <label className="text-xs font-bold text-text/60 uppercase tracking-wider ml-1">
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    disabled={loading}
                    className="input pr-12"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-medium animate-shake">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-4 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Shield className="animate-pulse" /> Autenticando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn size={20} /> Entrar no Painel
                  </span>
                )}
              </button>
            </form>

            <p className="text-center text-[10px] text-muted uppercase tracking-widest pt-4">
              &copy; {new Date().getFullYear()} DPE-BA
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

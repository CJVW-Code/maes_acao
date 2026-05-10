import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../utils/apiBase";
import { useToast } from "../../../contexts/ToastContext";
import { Save, Plus, Trash2, Clock, Globe } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export const ConfiguracoesSistema = () => {
  const [configs, setConfigs] = useState({
    bi_horarios: "[]",
    bi_timezone: "America/Bahia",
    bi_bloqueado: "false",
  });
  const [overrides, setOverrides] = useState([]);
  const [novaLiberacao, setNovaLiberacao] = useState({ horas: 1, motivo: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.cargo?.toLowerCase() === "admin";

  const fetchConfigs = useCallback(async () => {
    try {
      const response = await authFetch("/config");
      if (response.ok) {
        const data = await response.json();
        // Converte array [{chave, valor}] para objeto {chave: valor}
        const configMap = data.reduce((acc, curr) => ({ ...acc, [curr.chave]: curr.valor }), {});

        setConfigs({
          bi_horarios: configMap.bi_horarios || "[]",
          bi_timezone: configMap.bi_timezone || "America/Bahia",
          bi_bloqueado: configMap.bi_bloqueado || "false",
        });
      }
    } catch {
      toast.error("Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchOverrides = useCallback(async () => {
    try {
      const response = await authFetch("/bi/overrides");
      if (response.ok) {
        const data = await response.json();
        setOverrides(data);
      }
    } catch {
      // Silently fail or log
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
    fetchOverrides();
  }, [fetchConfigs, fetchOverrides]);


  const handleLiberarAgora = async () => {
    if (!novaLiberacao.motivo.trim()) {
      toast.error("Informe o motivo da liberação.");
      return;
    }

    setSaving(true);
    try {
      const response = await authFetch("/bi/overrides", {
        method: "POST",
        body: JSON.stringify({
          horas: novaLiberacao.horas,
          motivo: novaLiberacao.motivo,
        }),
      });

      if (response.ok) {
        toast.success(`BI liberado por ${novaLiberacao.horas} hora(s)!`);
        setNovaLiberacao({ horas: 1, motivo: "" });
        fetchOverrides();
      }
    } catch {
      toast.error("Erro ao liberar acesso.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverride = async (id) => {
    try {
      const response = await authFetch(`/bi/overrides/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success("Registro de horário removido.");
        fetchOverrides();
      }
    } catch {
      toast.error("Erro ao remover registro.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await authFetch("/config", {
        method: "PUT",
        body: JSON.stringify({
          configs: {
            ...configs,
          },
        }),
      });

      if (response.ok) {
        toast.success("Configurações salvas com sucesso!");
      } else {
        const err = await response.json();
        toast.error(err.message || "Erro ao salvar.");
      }
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-primary">Carregando configurações...</div>;


  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-main flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Clock size={24} />
            </div>
            Configurações do Sistema
          </h1>
          <p className="text-muted mt-2">
            Gerencie horários de acesso ao BI e preferências globais.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-app p-2 rounded-3xl border border-soft shadow-sm">
          <div className="flex flex-col px-4">
            <span className="text-[10px] font-bold uppercase text-muted tracking-widest">
              Status Atual
            </span>
            <span className="text-sm font-bold text-main">
              {overrides.length > 0 ? "Acesso Liberado" : "Acesso Restrito"}
            </span>
          </div>
          <div className="w-px h-8 bg-soft" />
          <div className="px-4 flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full animate-pulse ${overrides.length > 0 ? "bg-success" : "bg-error"}`}
            />
            <span className="text-xs font-bold text-muted uppercase">Monitoramento Ativo</span>
          </div>
        </div>
      </header>

      <div className="grid gap-8">
        {/* Seção BI */}
        <section className="bg-surface rounded-3xl p-6 shadow-sm border border-soft">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-main flex items-center gap-2">
                Governança do BI
              </h2>
              <p className="text-sm text-muted">Bloqueio manual e janelas de acesso.</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Bloqueio Manual */}
            <div className="flex items-center justify-between p-5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${configs.bi_bloqueado === "true" ? "bg-amber-500 text-white" : "bg-surface text-amber-500 border border-amber-500/30"}`}
                >
                  <Save size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-main">Bloqueio Manual Global</h3>
                  <p className="text-xs text-muted">
                    Quando ativo, ignora todos os horários e bloqueia o BI para todos exceto o
                    Admin.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={configs.bi_bloqueado === "true"}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setConfigs({ ...configs, bi_bloqueado: e.target.checked ? "true" : "false" })
                  }
                />
                <div className="w-14 h-7 bg-muted/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Nova Liberação Temporária (Customizada) */}
            {isAdmin && (
              <div className="p-5 bg-app/40 rounded-2xl border border-soft space-y-4">
                <h3 className="text-xs font-bold text-main uppercase tracking-widest flex items-center gap-2">
                  <Plus size={14} className="text-primary" /> Criar Janela de Liberação Personalizada
                </h3>

                <div className="grid gap-4 md:grid-cols-12 items-end">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted px-1">Duração</label>
                    <select
                      value={novaLiberacao.horas}
                      onChange={(e) =>
                        setNovaLiberacao({ ...novaLiberacao, horas: Number(e.target.value) })
                      }
                      className="w-full bg-surface border border-soft rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {[1, 2, 4, 6, 8, 12, 24].map((h) => (
                        <option key={h} value={h}>
                          {h} {h === 1 ? "hora" : "horas"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-6 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted px-1">
                      Motivo da Liberação
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Auditoria emergencial, Plantão..."
                      value={novaLiberacao.motivo}
                      onChange={(e) =>
                        setNovaLiberacao({ ...novaLiberacao, motivo: e.target.value })
                      }
                      className="w-full bg-surface border border-soft rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <button
                      onClick={handleLiberarAgora}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all shadow-md shadow-primary/10 disabled:opacity-50"
                    >
                      {saving ? "Processando..." : "Confirmar Liberação"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Registro de Horários (Liberados) */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                <Clock size={14} /> Janelas Ativas no Momento
              </h3>

              <div className="grid gap-3">
                {overrides.length === 0 ? (
                  <div className="p-8 text-center bg-app/20 rounded-2xl border border-dashed border-soft">
                    <p className="text-xs text-muted italic">
                      Nenhuma janela de liberação temporária ativa no momento.
                    </p>
                  </div>
                ) : (
                  overrides.map((ov) => (
                    <div
                      key={ov.id}
                      className="flex items-center justify-between p-4 bg-surface rounded-2xl border border-soft shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
                          <Clock size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-main">{ov.usuario}</span>
                            <span className="text-[10px] text-muted">• {ov.motivo}</span>
                          </div>
                          <p className="text-[10px] font-bold text-success uppercase tracking-wider mt-0.5">
                            Expira em: {new Date(ov.fim).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveOverride(ov.id)}
                        disabled={!isAdmin}
                        className="p-2 text-muted hover:text-error hover:bg-error/10 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Remover liberação"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </section>

        {/* Seção Timezone */}
        <section className="bg-surface rounded-3xl p-6 shadow-sm border border-soft">
          <h2 className="text-xl font-semibold text-main flex items-center gap-2 mb-4">
            <Globe className="text-primary" size={20} /> Fuso Horário
          </h2>
          <select
            value={configs.bi_timezone}
            disabled={!isAdmin}
            onChange={(e) => setConfigs({ ...configs, bi_timezone: e.target.value })}
            className="w-full bg-app/50 border border-soft text-main rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
          >
            <option value="America/Bahia">Bahia (UTC-3)</option>
            <option value="America/Sao_Paulo">São Paulo (UTC-3)</option>
            <option value="UTC">UTC</option>
          </select>
          <p className="text-xs text-muted mt-2">
            Utilizado para validar as janelas de horário e dias configurados acima.
          </p>
        </section>

        {/* Botão Salvar */}
        {isAdmin && (
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all cursor-pointer"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : (
                <>
                  <Save size={20} /> Salvar Configurações
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../utils/apiBase";
import { useToast } from "../../../contexts/ToastContext";
import { Save, Plus, Trash2, Clock, Globe } from "lucide-react";

export const ConfiguracoesSistema = () => {
  const [configs, setConfigs] = useState({
    bi_horarios: "[]",
    bi_timezone: "America/Bahia",
    bi_bloqueado: "false",
  });
  const [horarios, setHorarios] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

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
        setHorarios(JSON.parse(configMap.bi_horarios || "[]"));
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

  const handleAddHorario = () => {
    setHorarios([...horarios, { dia: "todos", inicio: "08:00", fim: "18:00" }]);
  };

  const handleRemoveHorario = (index) => {
    setHorarios(horarios.filter((_, i) => i !== index));
  };

  const handleUpdateHorario = (index, field, value) => {
    const newHorarios = [...horarios];
    newHorarios[index][field] = value;
    setHorarios(newHorarios);
  };

  const handleLiberarAgora = async () => {
    setSaving(true);
    try {
      const response = await authFetch("/bi/overrides", {
        method: "POST",
        body: JSON.stringify({
          horas: 1,
          motivo: "Liberação manual via Painel de Configurações"
        }),
      });

      if (response.ok) {
        toast.success("BI liberado por 1 hora!");
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
        method: "DELETE"
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
            bi_horarios: JSON.stringify(horarios),
          }
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

  const diasSemana = [
    { value: "todos", label: "Todos os dias" },
    { value: "segunda", label: "Segunda-feira" },
    { value: "terca", label: "Terça-feira" },
    { value: "quarta", label: "Quarta-feira" },
    { value: "quinta", label: "Quinta-feira" },
    { value: "sexta", label: "Sexta-feira" },
    { value: "sabado", label: "Sábado" },
    { value: "domingo", label: "Domingo" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Clock size={24} />
            </div>
            Configurações do Sistema
          </h1>
          <p className="text-gray-500 mt-2">
            Gerencie horários de acesso ao BI e preferências globais.
          </p>
        </div>
        
        <button
          onClick={handleLiberarAgora}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Plus size={20} /> Liberar BI Agora (1h)
        </button>
      </header>

      <div className="grid gap-8">
        {/* Seção BI */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                Governança do BI
              </h2>
              <p className="text-sm text-gray-500">
                Bloqueio manual e janelas de acesso.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Bloqueio Manual */}
            <div className="flex items-center justify-between p-5 bg-amber-50 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${configs.bi_bloqueado === "true" ? "bg-amber-500 text-white" : "bg-white text-amber-500 border border-amber-200"}`}>
                  <Save size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-amber-900">Bloqueio Manual Global</h3>
                  <p className="text-xs text-amber-700">Quando ativo, ignora todos os horários e bloqueia o BI para todos exceto Admins.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={configs.bi_bloqueado === "true"}
                  onChange={(e) => setConfigs({ ...configs, bi_bloqueado: e.target.checked ? "true" : "false" })}
                />
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Registro de Horários (Overrides) */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Clock size={14} /> Registro de Horários (Liberados)
              </h3>
              
              <div className="grid gap-3">
                {overrides.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Nenhum registro de liberação temporária ativo.</p>
                ) : (
                  overrides.map(ov => (
                    <div key={ov.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-800">{ov.usuario}</span>
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase">Ativo</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Válido até: {new Date(ov.fim).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <button 
                        onClick={() => handleRemoveOverride(ov.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Remover liberação"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Janelas de Horário */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Janelas de Horário Padrão</h3>
                <button
                  onClick={handleAddHorario}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus size={14} /> Adicionar Janela
                </button>
              </div>

              <div className="space-y-3">
                {horarios.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
                    Acesso livre 24/7 (sem restrições).
                  </div>
                ) : (
                  horarios.map((h, index) => (
                    <div 
                      key={index} 
                      className="flex flex-col md:flex-row items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <select
                        value={h.dia || "todos"}
                        onChange={(e) => handleUpdateHorario(index, "dia", e.target.value)}
                        className="w-full md:w-40 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                      >
                        {diasSemana.map(d => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="time"
                          value={h.inicio}
                          onChange={(e) => handleUpdateHorario(index, "inicio", e.target.value)}
                          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                        />
                        <span className="text-gray-400 text-xs">até</span>
                        <input
                          type="time"
                          value={h.fim}
                          onChange={(e) => handleUpdateHorario(index, "fim", e.target.value)}
                          className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveHorario(index)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Seção Timezone */}
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Globe className="text-primary" size={20} /> Fuso Horário
          </h2>
          <select
            value={configs.bi_timezone}
            onChange={(e) => setConfigs({ ...configs, bi_timezone: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          >
            <option value="America/Bahia">Bahia (UTC-3)</option>
            <option value="America/Sao_Paulo">São Paulo (UTC-3)</option>
            <option value="UTC">UTC</option>
          </select>
          <p className="text-xs text-gray-400 mt-2">
            Utilizado para validar as janelas de horário e dias configurados acima.
          </p>
        </section>

        {/* Botão Salvar */}
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
      </div>
    </div>
  );
};

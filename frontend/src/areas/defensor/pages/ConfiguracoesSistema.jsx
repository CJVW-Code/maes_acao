import React, { useState, useEffect, useCallback } from "react";
import { authFetch } from "../../../utils/apiBase";
import { useToast } from "../../../contexts/ToastContext";
import { Save, Plus, Trash2, Clock, Globe } from "lucide-react";

export const ConfiguracoesSistema = () => {
  const [configs, setConfigs] = useState({
    bi_horarios: "[]",
    bi_timezone: "America/Bahia",
  });
  const [horarios, setHorarios] = useState([]);
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
        });
        setHorarios(JSON.parse(configMap.bi_horarios || "[]"));
      }
    } catch {
      toast.error("Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

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
    const umaHoraDepois = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    setSaving(true);
    try {
      const response = await authFetch("/config", {
        method: "PUT",
        body: JSON.stringify({
          configs: {
            bi_liberado_ate: umaHoraDepois
          }
        }),
      });

      if (response.ok) {
        toast.success("BI liberado por 1 hora!");
      }
    } catch {
      toast.error("Erro ao liberar acesso.");
    } finally {
      setSaving(false);
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
                Restrição de Horário (BI)
              </h2>
              <p className="text-sm text-gray-500">
                Defina janelas em que os relatórios estarão acessíveis.
              </p>
            </div>
            <button
              onClick={handleAddHorario}
              className="flex items-center gap-2 px-4 py-2 bg-primary/5 text-primary hover:bg-primary/10 rounded-xl transition-colors font-medium"
            >
              <Plus size={18} /> Adicionar Janela
            </button>
          </div>

          <div className="space-y-4">
            {horarios.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
                Nenhum horário configurado. O acesso será livre 24/7.
              </div>
            ) : (
              horarios.map((h, index) => (
                <div 
                  key={index} 
                  className="flex flex-col md:flex-row items-center gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-200 group hover:border-primary/30 transition-all"
                >
                  <div className="w-full md:w-48 space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dia</label>
                    <select
                      value={h.dia || "todos"}
                      onChange={(e) => handleUpdateHorario(index, "dia", e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    >
                      {diasSemana.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4 w-full">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Início</label>
                      <input
                        type="time"
                        value={h.inicio}
                        onChange={(e) => handleUpdateHorario(index, "inicio", e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fim</label>
                      <input
                        type="time"
                        value={h.fim}
                        onChange={(e) => handleUpdateHorario(index, "fim", e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemoveHorario(index);
                      toast.info("Horário removido da lista. Salve para persistir.");
                    }}
                    className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    title="Remover horário"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))
            )}
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

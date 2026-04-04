import { supabase } from "../config/supabase.js";

export const obterHistoricoCaso = async (req, res) => {
  try {
    const { id } = req.params;
    const { entidade } = req.query;

    const { data, error } = await supabase
      .from("logs_auditoria")
      .select(
        `
        *,
        defensores ( nome )
      `,
      )
      .eq("registro_id", String(id))
      .eq("entidade", entidade || "casos")
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro Supabase:", error.message);
      return res.status(500).json([]); // Retorna lista vazia em caso de erro
    }

    // [CORREÇÃO AQUI] Se data for null ou undefined, retorna []
    return res.json(data || []);
  } catch (error) {
    console.error("Erro Controller:", error.message);
    return res.status(500).json([]); // Sempre retorna um array para o frontend não quebrar
  }
};
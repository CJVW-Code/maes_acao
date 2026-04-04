import { supabase } from "../config/supabase.js";

export const pingSupabase = async (_req, res) => {
  try {
    const start = Date.now();
    const { error } = await supabase.from("defensores").select("id", { count: "exact", head: true }).limit(1);
    const ms = Date.now() - start;
    if (error) {
      return res.status(500).json({ ok: false, ms, error });
    }
    return res.json({ ok: true, ms });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err?.message, cause: err?.cause });
  }
};


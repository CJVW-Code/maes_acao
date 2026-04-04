import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabaseLocal = null;

if (supabaseUrl && supabaseKey && /^https:\/\/.+\.supabase\.co$/.test(supabaseUrl)) {
  supabaseLocal = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn(
    "[Supabase] Aviso: SUPABASE_URL ou SUPABASE_SERVICE_KEY ausentes. Recursos que dependem do Supabase (Storage, etc) irão falhar."
  );
}

export const supabase = supabaseLocal;

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// ─── Flag global: indica se o Supabase REAL está disponível ───
export const isSupabaseConfigured =
  !!(supabaseUrl && supabaseKey && /^https:\/\/.+\.supabase\.co$/.test(supabaseUrl));

// ─── Proxy No-Op ──────────────────────────────────────────────
// Quando o Supabase não está configurado, exportamos um objeto-proxy
// que nunca é null. Ele implementa a mesma API encadeável do Supabase,
// mas retorna sempre { data: null, error: { code, message } }.
// Isso ELIMINA todo crash "Cannot read properties of null (reading 'from')".

const DISABLED_ERROR = Object.freeze({
  code: "SUPABASE_DISABLED",
  message: "Supabase not configured. Use Prisma fallback.",
});

const DISABLED_RESULT = Object.freeze({ data: null, error: DISABLED_ERROR });

/** Builder encadeável (select/eq/single/update/delete/order/or/insert) */
class NullQueryBuilder {
  select()       { return this; }
  eq()           { return this; }
  neq()          { return this; }
  in()           { return this; }
  is()           { return this; }
  order()        { return this; }
  limit()        { return this; }
  range()        { return this; }
  or()           { return this; }
  filter()       { return this; }
  match()        { return this; }
  single()       { return Promise.resolve(DISABLED_RESULT); }
  maybeSingle()  { return Promise.resolve(DISABLED_RESULT); }
  insert()       { return Promise.resolve(DISABLED_RESULT); }
  upsert()       { return Promise.resolve(DISABLED_RESULT); }
  update()       { return this; }           // update().eq()... precisa de chaining
  delete()       { return this; }           // delete().eq()...

  // Faz o builder ser "thenable": `await supabase.from(...).update(...).eq(...)`
  // resolve sem precisar de .single()
  then(resolve)  { resolve(DISABLED_RESULT); }
}

/** Proxy de StorageBucket (upload/download/createSignedUrl/remove) */
class NullStorageBucket {
  async upload()          { return DISABLED_RESULT; }
  async download()        { return DISABLED_RESULT; }
  async createSignedUrl() { return { data: null, error: DISABLED_ERROR }; }
  async remove()          { return { data: null, error: null }; }     // remove pode ser no-op
  async list()            { return { data: [], error: null }; }
  getPublicUrl()          { return { data: { publicUrl: null } }; }
}

class NullStorage {
  from() { return new NullStorageBucket(); }
}

class NullSupabase {
  from()        { return new NullQueryBuilder(); }
  get storage() { return new NullStorage(); }
}

// ─── Exportação ───────────────────────────────────────────────
let supabaseClient;

if (isSupabaseConfigured) {
  supabaseClient = createClient(supabaseUrl, supabaseKey);
  console.log("[Supabase] ✅ Cliente real inicializado.");
} else {
  supabaseClient = new NullSupabase();
  console.warn(
    "[Supabase] ⚠️  SUPABASE_URL ou SUPABASE_SERVICE_KEY ausentes. " +
    "Usando proxy no-op — operações de banco usarão Prisma; Storage ficará indisponível."
  );
}

export const supabase = supabaseClient;

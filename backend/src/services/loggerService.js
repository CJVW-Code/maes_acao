import { supabase } from "../config/supabase.js"; 

export async function registrarLog(
  usuarioId,
  acao,
  entidade,
  registroId,
  detalhes = {},
) {
  try {
    const { error } = await supabase.from("logs_auditoria").insert([
      {
        usuario_id: usuarioId,
        acao: acao,
        entidade: entidade,
        registro_id: registroId !== undefined && registroId !== null ? String(registroId) : null,
        detalhes: detalhes,
        criado_em: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("❌ Falha ao inserir log no Supabase:", error.message);
    } else {
      console.log(`✅ Log registrado: ${acao}`);
    }
  } catch (err) {
    console.error("⚠️ Erro crítico no loggerService:", err);
  }
}

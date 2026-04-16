import { prisma } from "../config/prisma.js";

export async function registrarLog(
  usuarioId,
  acao,
  entidade,
  registroId,
  detalhes = {},
) {
  try {
    // Caso o registroId seja um protocolo (string), tentamos encontrar o caso_id (BigInt)
    let caso_id = null;
    if (entidade === 'casos' && registroId) {
      const caso = await prisma.casos.findFirst({
        where: { protocolo: String(registroId) },
        select: { id: true }
      });
      if (caso) caso_id = caso.id;
    }

    await prisma.logs_auditoria.create({
      data: {
        usuario_id: usuarioId || null,
        caso_id: caso_id,
        acao: acao,
        entidade: entidade,
        registro_id: registroId !== undefined && registroId !== null ? String(registroId) : null,
        detalhes: detalhes || {},
        criado_em: new Date(),
      },
    });

    console.log(`✅ Log registrado (Prisma): ${acao}`);
  } catch (err) {
    console.error("⚠️ Erro crítico no loggerService (Prisma):", err);
  }
}

import { prisma } from "../config/prisma.js";

export const pingSupabase = async (_req, res) => {
  try {
    const start = Date.now();
    // Testamos a conexão via Prisma, que é nosso padrão de banco agora
    await prisma.defensores.findFirst({ select: { id: true } });
    const ms = Date.now() - start;
    return res.json({ ok: true, ms, provider: "prisma" });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err?.message, provider: "prisma" });
  }
};


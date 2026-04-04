import { prisma } from "../config/prisma.js";

async function debug() {
  try {
    const defensor = await prisma.defensores.findUnique({
      where: { email: "weslleyc.dev@gmail.com" },
      include: { cargo: true },
    });

    if (defensor) {
      console.log("✅ Usuário encontrado:");
      console.log(`  ID: ${defensor.id}`);
      console.log(`  Nome: ${defensor.nome}`);
      console.log(`  Email: ${defensor.email}`);
      console.log(`  Ativo: ${defensor.ativo}`);
      console.log(`  Cargo: ${defensor.cargo.nome}`);
      console.log(`  Senha Hash: ${defensor.senha_hash.substring(0, 20)}...`);
    } else {
      console.log("❌ Usuário não encontrado");
    }
  } catch (e) {
    console.error("❌ Erro:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

debug();

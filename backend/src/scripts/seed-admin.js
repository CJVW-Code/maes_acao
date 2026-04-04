import { prisma } from "../config/prisma.js";
import { hashPassword } from "../services/securityService.js";

async function main() {
  try {
    console.log("🌱 Iniciando seed de Admin...");
    console.log("📊 Verificando conexão com banco...");

    // 1. Garante que os cargos existam
    const cargoAdmin = await prisma.cargos.findFirst({
      where: { nome: "admin" },
    });

    if (!cargoAdmin) {
      console.error(
        "❌ Erro: Cargo 'admin' não encontrado no banco. Verifique se o init.sql rodou corretamente.",
      );
      process.exit(1);
    }

    console.log(`✅ Cargo 'admin' encontrado (ID: ${cargoAdmin.id})`);

    // 2. Cria o usuário Admin padrão
    const email = "weslleyc.dev@gmail.com";
    const senha = "Batata202";
    const nome = "Administrador Geral";

    const existe = await prisma.defensores.findUnique({
      where: { email },
    });

    if (existe) {
      console.log(`ℹ️ Admin já existe no banco (ID: ${existe.id})`);
      console.log(`📧 Email: ${email}`);
      console.log(`🔓 Status Ativo: ${existe.ativo}`);
      
      if (!existe.ativo) {
        console.log("⚠️ Admin desativado! Reativando...");
        await prisma.defensores.update({
          where: { id: existe.id },
          data: { ativo: true },
        });
        console.log("✅ Admin reativado!");
      }
    } else {
      console.log("🔐 Gerando hash da senha...");
      const senha_hash = await hashPassword(senha);
      
      const novoAdmin = await prisma.defensores.create({
        data: {
          nome,
          email,
          senha_hash,
          cargo_id: cargoAdmin.id,
        },
      });
      
      console.log("✅ Admin criado com sucesso!");
      console.log(`🆔 ID: ${novoAdmin.id}`);
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Senha: ${senha}`);
    }

    console.log("🎉 Seed concluído!");
  } catch (e) {
    console.error("❌ Erro no seed:", e.message);
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

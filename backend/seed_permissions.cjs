const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Semeando permissoes básicas...");

  // Permissões
  const permissoesObj = [
    { chave: "atender_caso", descricao: "Pode atender e assumir casos" },
    { chave: "protocolar_caso", descricao: "Pode protocolar casos no SOLAR" },
    { chave: "gerenciar_equipe", descricao: "Pode ver e gerenciar outros membros" },
  ];

  for (const perm of permissoesObj) {
    await prisma.permissoes.upsert({
      where: { chave: perm.chave },
      update: {},
      create: perm,
    });
  }

  const permissoesDB = await prisma.permissoes.findMany();

  // Cargos
  const cargosPadrao = ["admin", "coordenador", "defensor", "servidor", "estagiario", "visualizador"];
  
  for (const cargoNome of cargosPadrao) {
    const cargo = await prisma.cargos.upsert({
      where: { nome: cargoNome },
      update: {},
      create: { nome: cargoNome, descricao: `Perfil de ${cargoNome}` },
    });

    // Vincular Permissões
    for (const perm of permissoesDB) {
      if ((cargoNome === "servidor" || cargoNome === "estagiario" || cargoNome === "visualizador") && perm.chave === "protocolar_caso") continue;
      if ((cargoNome === "defensor" || cargoNome === "coordenador" || cargoNome === "servidor" || cargoNome === "estagiario" || cargoNome === "visualizador") && perm.chave === "gerenciar_equipe") continue;
      if (cargoNome === "visualizador" && perm.chave === "atender_caso") continue;
      
      await prisma.cargo_permissoes.upsert({
        where: {
          cargo_id_permissao_id: { cargo_id: cargo.id, permissao_id: perm.id },
        },
        update: {},
        create: { cargo_id: cargo.id, permissao_id: perm.id },
      });
    }
  }

  console.log("Permissões e relacional cargo_permissoes atualizados com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

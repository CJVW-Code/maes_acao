import { prisma } from "./src/config/prisma.js";

async function main() {
  console.log("🌱 Semeando permissões básicas e configurações...");

  // 1. Permissões
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

  // 2. Cargos
  const cargosPadrao = ["admin", "gestor", "coordenador", "defensor", "servidor", "estagiario", "visualizador"];
  
  for (const cargoNome of cargosPadrao) {
    const cargo = await prisma.cargos.upsert({
      where: { nome: cargoNome },
      update: {},
      create: { nome: cargoNome, descricao: `Perfil de ${cargoNome}` },
    });

    // Vincular Permissões
    for (const perm of permissoesDB) {
      // Regras de vinculação
      if ((cargoNome === "servidor" || cargoNome === "estagiario" || cargoNome === "visualizador") && perm.chave === "protocolar_caso") continue;
      if ((cargoNome === "gestor" || cargoNome === "defensor" || cargoNome === "coordenador" || cargoNome === "servidor" || cargoNome === "estagiario" || cargoNome === "visualizador") && perm.chave === "gerenciar_equipe") continue;
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

  // 3. Configurações do Sistema (BI)
  console.log("📊 Semeando configurações do sistema...");
  
  await prisma.configuracoes_sistema.upsert({
    where: { chave: 'bi_horarios' },
    update: {},
    create: {
      chave: 'bi_horarios',
      valor: JSON.stringify([{ inicio: '07:00', fim: '09:00' }, { inicio: '17:00', fim: '23:59' }]),
      descricao: 'Janelas de horário permitidas para gerar relatórios de BI',
    },
  });

  await prisma.configuracoes_sistema.upsert({
    where: { chave: 'bi_timezone' },
    update: {},
    create: { 
      chave: 'bi_timezone', 
      valor: 'America/Bahia', 
      descricao: 'Timezone do BI' 
    },
  });

  console.log("✅ Permissões, cargos e configurações atualizados com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

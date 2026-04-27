import { PrismaClient } from '@prisma/client';
import { MAPEAMENTO_CIDADES } from '../config/mapeamentoRegionais.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de unidades (Limpando duplicatas)...');

  // Remove todas as unidades que não estão no mapeamento oficial
  const nomesOficiais = Object.keys(MAPEAMENTO_CIDADES);
  const deleted = await prisma.unidades.deleteMany({
    where: {
      nome: { notIn: nomesOficiais }
    }
  });
  console.log(`🗑️ Removidas ${deleted.count} unidades não oficiais ou duplicadas.`);

  let criadas = 0;
  let atualizadas = 0;

  for (const [cidade, regional] of Object.entries(MAPEAMENTO_CIDADES)) {
    const sistema = cidade.toLowerCase().includes('salvador') ? 'sigad' : 'solar';

    const existing = await prisma.unidades.findUnique({
      where: { comarca: cidade } // Usamos comarca como chave única se possível
    }).catch(() => null);

    // Se falhar findUnique (comarca não é unique no schema?), usamos findFirst
    const unit = existing || await prisma.unidades.findFirst({
      where: { nome: cidade }
    });

    if (unit) {
      await prisma.unidades.update({
        where: { id: unit.id },
        data: { regional, nome: cidade, comarca: cidade }
      });
      atualizadas++;
    } else {
      await prisma.unidades.create({
        data: {
          nome: cidade,
          comarca: cidade,
          regional: regional,
          sistema: sistema,
          ativo: true
        }
      });
      criadas++;
    }
  }

  console.log(`✨ Seed concluído!`);
  console.log(`✅ Criadas: ${criadas}`);
  console.log(`🔄 Atualizadas: ${atualizadas}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

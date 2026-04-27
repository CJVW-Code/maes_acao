import { PrismaClient } from '@prisma/client';
import { MAPEAMENTO_CIDADES } from '../config/mapeamentoRegionais.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de unidades (Limpando duplicatas)...');

  // Marcar como inativo as unidades que não estão no mapeamento oficial (Soft Delete)
  const nomesOficiais = Object.keys(MAPEAMENTO_CIDADES);
  const desativadas = await prisma.unidades.updateMany({
    where: {
      nome: { notIn: nomesOficiais }
    },
    data: { ativo: false }
  });
  console.log(`🗑️ Desativadas ${desativadas.count} unidades não oficiais ou duplicadas.`);

  let criadas = 0;
  let atualizadas = 0;

  for (const [cidade, regional] of Object.entries(MAPEAMENTO_CIDADES)) {
    const sistema = cidade.toLowerCase().includes('salvador') ? 'sigad' : 'solar';

    // Busca por nome ou comarca
    const unit = await prisma.unidades.findFirst({
      where: {
        OR: [
          { nome: cidade },
          { comarca: cidade }
        ]
      }
    });

    if (unit) {
      await prisma.unidades.update({
        where: { id: unit.id },
        data: {
          regional,
          ativo: true,
          // Atualiza comarca se estiver vazio, mas preserva nome se já existir um rótulo personalizado
          ...(unit.comarca ? {} : { comarca: cidade }),
        }
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

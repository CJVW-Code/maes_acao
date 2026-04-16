import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const casos = await prisma.casos.findMany({
    take: 50,
    orderBy: { created_at: 'desc' }
  });
  
  const exeCases = casos.filter(c => String(c.tipo_acao).toLowerCase().includes('exec'));
  
  console.log(JSON.stringify(exeCases.map(c => ({
    id: c.id.toString(),
    tipo_acao: c.tipo_acao,
    acaoEspecifica: c.dados_formulario?.acaoEspecifica
  })), null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());

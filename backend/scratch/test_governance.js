
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testBI() {
  console.log("--- Testando Governança de BI ---");

  // 1. Limpar configs de teste
  await prisma.configuracoes_sistema.deleteMany({
    where: { chave: { in: ['bi_bloqueado', 'bi_overrides'] } }
  });

  // 2. Testar Bloqueio Manual
  await prisma.configuracoes_sistema.create({
    data: { chave: 'bi_bloqueado', valor: 'true', descricao: 'Bloqueio manual para teste' }
  });
  console.log("✅ Config bi_bloqueado=true criada.");

  // 3. Testar Overrides
  const agora = new Date();
  const fim = new Date(agora.getTime() + 3600000); // +1h
  const override = {
    id: 'test-id',
    usuario: 'Sistema de Teste',
    inicio: agora.toISOString(),
    fim: fim.toISOString(),
    motivo: 'Teste Automatizado'
  };

  await prisma.configuracoes_sistema.create({
    data: { chave: 'bi_overrides', valor: JSON.stringify([override]), descricao: 'Overrides para teste' }
  });
  console.log("✅ Config bi_overrides criada com 1 override ativo.");

  // 4. Verificar se persiste
  const configs = await prisma.configuracoes_sistema.findMany();
  console.log("Configurações atuais:", configs.map(c => ({ chave: c.chave, valor: c.valor })));

  console.log("--- Teste de Distribuição ---");
  const caso = await prisma.casos.findFirst();
  if (caso) {
    console.log(`Caso encontrado para teste: ${caso.protocolo} (ID: ${caso.id})`);
  } else {
    console.log("Nenhum caso encontrado para testar distribuição.");
  }

  process.exit(0);
}

testBI().catch(err => {
  console.error(err);
  process.exit(1);
});

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a dev user for testing
  const user = await prisma.user.upsert({
    where: { email: 'dev@soundscape.local' },
    update: {},
    create: {
      email: 'dev@soundscape.local',
      displayName: 'Dev User',
    },
  });

  console.log(`Created dev user: ${user.id}`);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

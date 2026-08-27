import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testLogin(identifier: string, passwordAttempt: string) {
  console.log(`\nTesting login for: ${identifier}`);

  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [
        { email: identifier.toLowerCase() },
        { employeeCode: identifier.toUpperCase() },
      ],
    },
    include: {
      schedules: true,
    },
  });

  if (!user) {
    console.error(`❌ User '${identifier}' not found in Supabase!`);
    return;
  }

  const isValid = await bcrypt.compare(passwordAttempt, user.password);
  if (isValid) {
    console.log(`✅ Authentication SUCCESSFUL for ${user.name} (${user.role})`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Employee Code: ${user.employeeCode}`);
    console.log(`   Department: ${user.department}`);
    console.log(`   Schedules configured: ${user.schedules.length} days`);
  } else {
    console.error(`❌ Authentication FAILED: Password does not match.`);
  }
}

async function main() {
  await testLogin('manoj.tech@ecdial.com', 'Manoj@12345');
  await testLogin('TEC002', 'Manoj@12345');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

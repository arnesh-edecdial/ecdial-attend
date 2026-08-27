import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      employeeCode: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      department: true,
      isActive: true,
      createdAt: true,
    },
  });

  console.log(`Found ${users.length} users in database:`);
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch((err) => {
    console.error('Error fetching users:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

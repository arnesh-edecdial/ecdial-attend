
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedAdmin() {
  const hashedPassword = await bcrypt.hash('123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
      name: 'System Admin',
    },
    create: {
      email: 'admin@gmail.com',
      password: hashedPassword,
      name: 'System Admin',
      employeeCode: 'ADMIN001',
      role: 'ADMIN',
      department: 'Management',
      phone: '+91 98765 43210',
      isActive: true,
    },
  });
  console.log('Admin user upserted successfully:', user.email, user.role);
}

seedAdmin()
  .catch(console.error)
  .finally(() => prisma.());

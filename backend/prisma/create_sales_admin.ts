import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creating New Sales and Admin Users in Supabase Database...\n');

  const usersToCreate = [
    {
      name: 'Vikram Raj',
      email: 'vikram.sales@ecdial.com',
      employeeCode: 'SAL002',
      role: Role.SALES,
      phone: '+91 98765 00007',
      department: 'Commercial Sales & HVAC Projects',
      plainPassword: 'Sales@12345',
    },
    {
      name: 'Deepak Sharma',
      email: 'deepak.admin@ecdial.com',
      employeeCode: 'ADM002',
      role: Role.ADMIN,
      phone: '+91 98765 00008',
      department: 'Executive Management',
      plainPassword: 'Admin@12345',
    },
  ];

  const results = [];

  for (const u of usersToCreate) {
    const hashedPassword = await bcrypt.hash(u.plainPassword, 10);

    const user = await prisma.user.upsert({
      where: { email: u.email.toLowerCase() },
      update: {
        name: u.name,
        employeeCode: u.employeeCode,
        role: u.role,
        phone: u.phone,
        department: u.department,
        password: hashedPassword,
        isActive: true,
      },
      create: {
        name: u.name,
        email: u.email.toLowerCase(),
        employeeCode: u.employeeCode,
        role: u.role,
        phone: u.phone,
        department: u.department,
        password: hashedPassword,
        isActive: true,
      },
    });

    // Create 7-day schedule
    for (let day = 0; day <= 6; day++) {
      const isWorkingDay = day !== 0; // Sunday OFF
      await prisma.employeeSchedule.upsert({
        where: {
          employeeId_dayOfWeek: {
            employeeId: user.id,
            dayOfWeek: day,
          },
        },
        update: {
          startTime: '09:00',
          endTime: '18:00',
          isWorkingDay,
        },
        create: {
          employeeId: user.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00',
          isWorkingDay,
        },
      });
    }

    results.push({
      id: user.id,
      name: user.name,
      email: user.email,
      employeeCode: user.employeeCode,
      role: user.role,
      department: user.department,
      phone: user.phone,
      password: u.plainPassword,
      isActive: user.isActive,
    });

    console.log(`✅ Created/Updated ${u.role} user: ${u.name} (${u.email})`);
  }

  console.log('\n======================================================');
  console.log('🎉 NEW USERS SUCCESSFULLY COMMITTED TO SUPABASE DB:');
  console.log('======================================================');
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((e) => {
    console.error('❌ Error creating users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

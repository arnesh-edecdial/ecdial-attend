import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface CreateUserInput {
  name: string;
  email: string;
  employeeCode: string;
  password?: string;
  role?: Role;
  phone?: string;
  department?: string;
  isActive?: boolean;
  createDefaultSchedule?: boolean;
}

export async function createUser(input: CreateUserInput) {
  const {
    name,
    email,
    employeeCode,
    password = 'Password@123',
    role = Role.TECHNICIAN,
    phone,
    department,
    isActive = true,
    createDefaultSchedule = true,
  } = input;

  console.log(`\n========================================`);
  console.log(`Creating user: ${name} (${email})`);
  console.log(`Role: ${role} | Employee Code: ${employeeCode}`);
  console.log(`========================================\n`);

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if user already exists
  const existingByEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existingByEmail) {
    console.warn(`⚠️ User with email ${email} already exists. Updating details...`);
  }

  const existingByCode = await prisma.user.findUnique({ where: { employeeCode: employeeCode.toUpperCase() } });
  if (existingByCode && existingByCode.id !== existingByEmail?.id) {
    throw new Error(`Employee code ${employeeCode} is already in use by user ${existingByCode.email}`);
  }

  // Create or Update user in Supabase via Prisma
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      name,
      employeeCode: employeeCode.toUpperCase(),
      password: hashedPassword,
      role,
      phone: phone || null,
      department: department || null,
      isActive,
    },
    create: {
      name,
      email: email.toLowerCase(),
      employeeCode: employeeCode.toUpperCase(),
      password: hashedPassword,
      role,
      phone: phone || null,
      department: department || null,
      isActive,
    },
  });

  console.log(`✅ User successfully saved to Supabase!`);
  console.log(`User ID: ${user.id}`);

  // Create default weekly schedules if requested
  if (createDefaultSchedule) {
    console.log(`📅 Creating default weekly schedules (Mon-Sat 09:00-20:00, Sun off)...`);
    for (let day = 0; day <= 6; day++) {
      const isWorkingDay = day !== 0; // Sunday is off
      await prisma.employeeSchedule.upsert({
        where: {
          employeeId_dayOfWeek: {
            employeeId: user.id,
            dayOfWeek: day,
          },
        },
        update: {
          startTime: '09:00',
          endTime: '20:00',
          isWorkingDay,
        },
        create: {
          employeeId: user.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '20:00',
          isWorkingDay,
        },
      });
    }
    console.log(`✅ Default weekly schedules created successfully.`);
  }

  return user;
}

// CLI Execution handler
async function main() {
  // Parse command line arguments if provided
  // Usage: npx tsx prisma/create_user.ts --name="John Doe" --email="john@ecdial.com" --code="TEC002" --role="TECHNICIAN" --dept="HVAC" --phone="+91 98765 00004" --password="Password@123"
  const args = process.argv.slice(2);
  const getArg = (key: string): string | undefined => {
    const prefix = `--${key}=`;
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.substring(prefix.length).replace(/^['"]|['"]$/g, '') : undefined;
  };

  const name = getArg('name') || 'Manoj Kumar';
  const email = getArg('email') || 'manoj.tech@ecdial.com';
  const employeeCode = getArg('code') || 'TEC002';
  const roleStr = getArg('role')?.toUpperCase() || 'TECHNICIAN';
  const phone = getArg('phone') || '+91 98765 00005';
  const department = getArg('department') || getArg('dept') || 'HVAC Field Operations';
  const password = getArg('password') || 'Manoj@12345';

  const role = (Role as any)[roleStr] || Role.TECHNICIAN;

  const created = await createUser({
    name,
    email,
    employeeCode,
    role,
    phone,
    department,
    password,
    createDefaultSchedule: true,
  });

  console.log(`\n🎉 User Record Summary:`);
  console.log(JSON.stringify({
    id: created.id,
    name: created.name,
    email: created.email,
    employeeCode: created.employeeCode,
    role: created.role,
    department: created.department,
    phone: created.phone,
    isActive: created.isActive,
    plainPasswordForLogin: password,
  }, null, 2));
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error('❌ Error creating user:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

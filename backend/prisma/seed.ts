import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial production admin and system configuration...');

  const adminPasswordHash = await bcrypt.hash('Admin@12345', 10);
  const salesPasswordHash = await bcrypt.hash('Sales@12345', 10);
  const techPasswordHash = await bcrypt.hash('Tech@12345', 10);

  // 1. Initial Admin Account
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ecdial.com' },
    update: {},
    create: {
      id: 'usr-admin-1',
      employeeCode: 'ADM001',
      name: 'Arun Kumar',
      email: 'admin@ecdial.com',
      password: adminPasswordHash,
      role: 'ADMIN',
      phone: '+91 98765 00001',
      department: 'Management',
      isActive: true,
    },
  });

  // 2. Initial Sales Account
  await prisma.user.upsert({
    where: { email: 'sales@ecdial.com' },
    update: {},
    create: {
      id: 'usr-sales-1',
      employeeCode: 'SAL001',
      name: 'Priya Sharma',
      email: 'sales@ecdial.com',
      password: salesPasswordHash,
      role: 'SALES',
      phone: '+91 98765 00002',
      department: 'Sales & Marketing',
      isActive: true,
    },
  });

  // 3. Initial Technician Account
  await prisma.user.upsert({
    where: { email: 'tech@ecdial.com' },
    update: {},
    create: {
      id: 'usr-tech-1',
      employeeCode: 'TEC001',
      name: 'Ramesh Tech',
      email: 'tech@ecdial.com',
      password: techPasswordHash,
      role: 'TECHNICIAN',
      phone: '+91 98765 00003',
      department: 'HVAC Installation',
      isActive: true,
    },
  });

  // 4. Default Office Configuration
  const existingConfig = await prisma.officeConfig.findFirst();
  if (!existingConfig) {
    await prisma.officeConfig.create({
      data: {
        officeName: 'ECDIAL Headquarters',
        latitude: 11.0168,
        longitude: 76.9558,
        allowedRadiusMeters: 100.0,
        qrRotationSeconds: 30,
        isDefault: true,
      },
    });
  }

  // 5. Default Quotation Configuration
  const existingQuoteConfig = await prisma.quotationConfig.findFirst();
  if (!existingQuoteConfig) {
    await prisma.quotationConfig.create({
      data: {
        defaultCgstPercent: 9.0,
        defaultSgstPercent: 9.0,
        defaultTerms: '1. AC Price is inclusive of 18 % taxes.\n2. Civil and electrical scope for customer.\n3. Quotation valid for 10 days.',
        defaultPaymentMethod: '100% Machine with PO, 70% Lowside with PO, 25% on erection, 5% on final bill.',
        availableUnits: 'Nos,Mtr,Sqft,Kg,Set,Box,Piece,Hour,Service,Other',
      },
    });
  }

  console.log('Production database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

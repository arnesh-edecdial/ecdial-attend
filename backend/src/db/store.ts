import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// In-Memory fallback store for environments where MySQL service is booting or in standalone testing mode
export interface InMemoryDB {
  users: any[];
  schedules: any[];
  holidays: any[];
  officeConfig: any;
  attendances: any[];
  attendanceRequests: any[];
  auditLogs: any[];
  products: any[];
  quotations: any[];
  quotationItems: any[];
  quotationConfig: any;
}

export const inMemoryDB: InMemoryDB = {
  users: [],
  schedules: [],
  holidays: [],
  officeConfig: null,
  attendances: [],
  attendanceRequests: [],
  auditLogs: [],
  products: [],
  quotations: [],
  quotationItems: [],
  quotationConfig: null,
};

let isPrismaConnected = false;

export async function initDatabase() {
  try {
    await prisma.$connect();
    isPrismaConnected = true;
    console.log('[DB] Connected to MySQL via Prisma successfully.');
  } catch (err: any) {
    isPrismaConnected = false;
    console.log('[DB] MySQL connection not active, using embedded transactional store.');
  }
  seedInitialData();
}

export function isDbConnected() {
  return isPrismaConnected;
}

export function seedInitialData() {
  if (inMemoryDB.users.length > 0) return;

  // 1. Initial Users
  inMemoryDB.users = [
    {
      id: 'usr-admin-1',
      employeeCode: 'ADM001',
      name: 'Ecdial Admin',
      email: 'admin@ecdial.com',
      password: 'password123',
      role: 'ADMIN',
      phone: '+91 9876543210',
      department: 'Management',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'usr-tech-1',
      employeeCode: 'TECH01',
      name: 'Ramesh Kumar (Technician)',
      email: 'ramesh@ecdial.com',
      password: 'password123',
      role: 'TECHNICIAN',
      phone: '+91 9876543211',
      department: 'HVAC Services',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'usr-sales-1',
      employeeCode: 'SALES01',
      name: 'Priya Sharma (Sales)',
      email: 'priya@ecdial.com',
      password: 'password123',
      role: 'SALES',
      phone: '+91 9876543212',
      department: 'Sales & Marketing',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'usr-mgr-1',
      employeeCode: 'MGR001',
      name: 'Suresh Patel (Manager)',
      email: 'suresh@ecdial.com',
      password: 'password123',
      role: 'MANAGER',
      phone: '+91 9876543213',
      department: 'Operations',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'usr-acct-1',
      employeeCode: 'ACC001',
      name: 'Anita Verma (Accountant)',
      email: 'anita@ecdial.com',
      password: 'password123',
      role: 'ACCOUNTANT',
      phone: '+91 9876543214',
      department: 'Finance',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'usr-it-1',
      employeeCode: 'IT001',
      name: 'Vikas Rao (IT Admin)',
      email: 'vikas@ecdial.com',
      password: 'password123',
      role: 'IT_ADMIN',
      phone: '+91 9876543215',
      department: 'IT Infrastructure',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // 2. Schedules for all users (Mon-Sat 09:00-20:00, Sun OFF by default, customizable per user)
  for (const user of inMemoryDB.users) {
    for (let day = 0; day <= 6; day++) {
      inMemoryDB.schedules.push({
        id: `sch-${user.id}-${day}`,
        employeeId: user.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '20:00',
        isWorkingDay: day !== 0, // Sunday is OFF
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 3. Office Geo Config (ECDIAL Office)
  inMemoryDB.officeConfig = {
    id: 'off-main',
    officeName: 'ECDIAL Headquarters - Chennai',
    latitude: 13.0827,
    longitude: 80.2707,
    allowedRadiusMeters: 100.0,
    qrRotationSeconds: 30,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 4. Government Holidays
  inMemoryDB.holidays = [
    {
      id: 'hol-1',
      date: '2026-08-15',
      name: 'Independence Day',
      description: 'National Government Holiday',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'hol-2',
      date: '2026-10-02',
      name: 'Gandhi Jayanti',
      description: 'National Government Holiday',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'hol-3',
      date: '2026-01-26',
      name: 'Republic Day',
      description: 'National Government Holiday',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // 5. Product Catalog (Main Units & Low-Side Materials)
  inMemoryDB.products = [
    {
      id: 'prod-ac-1',
      name: 'Daikin 1.5 Ton 3 Star Inverter Split AC',
      model: 'FTKL50U',
      category: 'MAIN_UNIT',
      description: 'Daikin 1.5 Ton 3 Star Inverter Split AC (Copper, PM 2.5 Filter, Triple Display, Dew Clean Technology)',
      defaultUnit: 'Nos',
      defaultPrice: 30423.73,
      availableStock: 15,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-ac-2',
      name: 'Daikin 2.0 Ton 5 Star Inverter Split AC',
      model: 'FTKM71U',
      category: 'MAIN_UNIT',
      description: 'Daikin 2.0 Ton 5 Star Inverter Split AC (Heavy Duty, Coanda Airflow, Stabilizer Free)',
      defaultUnit: 'Nos',
      defaultPrice: 45000.00,
      availableStock: 8,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-ac-3',
      name: 'Voltas 1.5 Ton 5 Star Inverter Split AC',
      model: '185V Vectra',
      category: 'MAIN_UNIT',
      description: 'Voltas 1.5 Ton 5 Star Inverter Split AC (Adjustable Cooling, Superdry Mode)',
      defaultUnit: 'Nos',
      defaultPrice: 32500.00,
      availableStock: 12,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-1',
      name: 'Installation and testing commissioning charges',
      model: 'SRV-INST',
      category: 'LOW_SIDE',
      description: 'Standard Installation and testing commissioning charges for Split AC',
      defaultUnit: 'Service',
      defaultPrice: 1500.00,
      availableStock: 999,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-2',
      name: 'Supply and installation of Copper Pipe with insulation',
      model: 'MAT-COP-01',
      category: 'LOW_SIDE',
      description: 'Supply and installation of Copper Pipe (1/4" & 1/2") with Nitrile rubber insulation',
      defaultUnit: 'Mtr',
      defaultPrice: 1280.00,
      availableStock: 250,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-3',
      name: 'Supply and installation of Communication Cable',
      model: 'MAT-CAB-COM',
      category: 'LOW_SIDE',
      description: 'Supply and installation of 4 Core 1.5 sqmm Communication Cable (Finolex/Polycab)',
      defaultUnit: 'Mtr',
      defaultPrice: 180.00,
      availableStock: 500,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-4',
      name: 'Supply and installation of Supply Cable',
      model: 'MAT-CAB-PWR',
      category: 'LOW_SIDE',
      description: 'Supply and installation of 3 Core 2.5 sqmm Power Supply Cable',
      defaultUnit: 'Mtr',
      defaultPrice: 220.00,
      availableStock: 400,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-5',
      name: 'Supply and installation of Outdoor Heavy Duty Stand',
      model: 'MAT-STD-01',
      category: 'LOW_SIDE',
      description: 'Powder coated MS heavy duty outdoor unit mounting bracket/stand with fasteners',
      defaultUnit: 'Set',
      defaultPrice: 850.00,
      availableStock: 40,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-6',
      name: 'Supply and installation of White Packing Tape',
      model: 'MAT-TPE-01',
      category: 'LOW_SIDE',
      description: 'Vinyl White insulation finishing tape for exposed refrigerant pipes',
      defaultUnit: 'Roll',
      defaultPrice: 150.00,
      availableStock: 100,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // 6. Quotation Configuration & Default Templates
  inMemoryDB.quotationConfig = {
    id: 'q-cfg-1',
    defaultCgstPercent: 9.0,
    defaultSgstPercent: 9.0,
    defaultTerms: `1. Prices are inclusive of prevailing taxes (CGST 9% + SGST 9%) unless specified otherwise.
2. Erection, piping, and cabling works beyond standard supply will be charged on actual measurement.
3. Civil work (core cutting, chipping, masonry closing) and electrical power points near the AC units are in the customer's scope.
4. Delivery within 2-5 working days from the date of confirmed Purchase Order and advance payment.
5. Quotation validity: 15 days from the date of issuance.`,
    defaultPaymentMethod: `• 100% Payment advance with P.O. for Machine.
• 70% Advance of Total Low-side Value along with P.O.
• 25% Payment after completion of erection works.
• 5% Payment after raising the final bill.`,
    availableUnits: 'Nos,Mtr,Sqft,Kg,Set,Box,Piece,Hour,Service,Roll,Other',
    updatedAt: new Date(),
  };

  // 7. Initial Seed Quotation for immediate preview
  const initialQuotationId = 'quot-seed-1';
  inMemoryDB.quotations = [
    {
      id: initialQuotationId,
      quotationNumber: 'ECD-Q-2026-00101',
      revisionNumber: 1,
      originalQuotationId: null,
      date: '2026-08-25',
      customerName: 'Nexus Tech Park Facilities Ltd',
      customerAddress: 'Tower B, 4th Floor, OMR IT Highway, Chennai - 600096',
      customerPhone: '+91 9444012345',
      customerEmail: 'facilities@nexustech.com',
      customerLocation: 'Chennai',
      createdById: 'usr-sales-1',
      hasLowSide: true,
      mainUnitTotal: 30423.73,
      lowSideTotal: 3510.00,
      subtotal: 33933.73,
      cgstPercent: 9.0,
      cgstAmount: 3054.04,
      sgstPercent: 9.0,
      sgstAmount: 3054.04,
      grandTotal: 40041.81,
      termsAndConditions: inMemoryDB.quotationConfig.defaultTerms,
      paymentMethod: inMemoryDB.quotationConfig.defaultPaymentMethod,
      status: 'FINAL',
      notes: 'Corporate client conference room HVAC installation',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  inMemoryDB.quotationItems = [
    {
      id: 'qitem-1',
      quotationId: initialQuotationId,
      section: 'MAIN_UNIT',
      productId: 'prod-ac-1',
      itemOrder: 1,
      description: 'Daikin 1.5 Ton 3 Star Inverter Split AC (Copper, PM 2.5 Filter, Dew Clean Technology)',
      quantity: 1,
      unit: 'Nos',
      unitPrice: 30423.73,
      amount: 30423.73,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'qitem-2',
      quotationId: initialQuotationId,
      section: 'LOW_SIDE',
      productId: 'prod-mat-1',
      itemOrder: 1,
      description: 'Standard Installation and testing commissioning charges',
      quantity: 1,
      unit: 'Service',
      unitPrice: 1500.00,
      amount: 1500.00,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'qitem-3',
      quotationId: initialQuotationId,
      section: 'LOW_SIDE',
      productId: 'prod-mat-2',
      itemOrder: 2,
      description: 'Supply and installation of Copper Pipe with insulation',
      quantity: 1,
      unit: 'Mtr',
      unitPrice: 1280.00,
      amount: 1280.00,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'qitem-4',
      quotationId: initialQuotationId,
      section: 'LOW_SIDE',
      productId: 'prod-mat-5',
      itemOrder: 3,
      description: 'Supply and installation of Outdoor Heavy Duty Stand',
      quantity: 1,
      unit: 'Set',
      unitPrice: 730.00,
      amount: 730.00,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

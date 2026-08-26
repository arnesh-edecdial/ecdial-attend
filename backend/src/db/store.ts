import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

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
      name: 'Arun Kumar',
      email: 'arun@ecdial.com',
      password: 'password123',
      role: 'ADMIN',
      phone: '+91 98765 43210',
      department: 'Management',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'usr-tech-1',
      employeeCode: 'TECH01',
      name: 'Arun Kumar',
      email: 'technician@ecdial.com',
      password: 'password123',
      role: 'TECHNICIAN',
      phone: '+91 98765 43211',
      department: 'HVAC Services',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'usr-sales-1',
      employeeCode: 'SALES01',
      name: 'Priya Sharma',
      email: 'priya@ecdial.com',
      password: 'password123',
      role: 'SALES',
      phone: '+91 98765 43212',
      department: 'Sales & Marketing',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'usr-mgr-1',
      employeeCode: 'MGR001',
      name: 'Suresh Patel',
      email: 'suresh@ecdial.com',
      password: 'password123',
      role: 'MANAGER',
      phone: '+91 98765 43213',
      department: 'Operations',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // 2. Schedules for all users
  for (const user of inMemoryDB.users) {
    for (let day = 0; day <= 6; day++) {
      inMemoryDB.schedules.push({
        id: `sch-${user.id}-${day}`,
        employeeId: user.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        isWorkingDay: day !== 0, // Sunday is OFF
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 3. Office Geo Config
  inMemoryDB.officeConfig = {
    id: 'off-main',
    officeName: 'ECDIAL Headquarters - Coimbatore',
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
  ];

  // 5. Product Catalog: All Machines (Main Units) & Low-Side Materials
  inMemoryDB.products = [
    {
      id: 'prod-ac-1',
      name: 'Daikin 1.5Tr 3Star Inverter Split Ac , 100% Copper (FTKC48XV16)',
      model: 'FTKC48XV16',
      category: 'MAIN_UNIT',
      description: 'Daikin 1.5Tr 3Star Inverter Split Ac , 100% Copper (FTKC48XV16) with PM 2.5 Filter & Dew Clean Technology',
      defaultUnit: 'Nos',
      defaultPrice: 30423.73,
      availableStock: 25,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-ac-2',
      name: 'Daikin 2.0Tr 5Star Inverter Split Ac (FTKM71U)',
      model: 'FTKM71U',
      category: 'MAIN_UNIT',
      description: 'Daikin 2.0Tr 5Star Inverter Split Ac Heavy Duty Coanda Airflow',
      defaultUnit: 'Nos',
      defaultPrice: 45000.00,
      availableStock: 12,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-ac-3',
      name: 'Daikin 1.0Tr 3Star Inverter Split Ac (FTKL35U)',
      model: 'FTKL35U',
      category: 'MAIN_UNIT',
      description: 'Daikin 1.0Tr 3Star Inverter Split Ac Compact Series',
      defaultUnit: 'Nos',
      defaultPrice: 26500.00,
      availableStock: 18,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-ac-4',
      name: 'Daikin 1.5Tr 5Star Inverter Split Ac (FTKF50U)',
      model: 'FTKF50U',
      category: 'MAIN_UNIT',
      description: 'Daikin 1.5Tr 5Star Inverter Split Ac Super Efficient Inverter',
      defaultUnit: 'Nos',
      defaultPrice: 36500.00,
      availableStock: 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // Low-Side Materials matching Image 2
    {
      id: 'prod-mat-1',
      name: 'Installation and testing commissioning Charges of Split ac',
      model: 'SRV-INST',
      category: 'LOW_SIDE',
      description: 'Installation and testing commissioning Charges of Split ac',
      defaultUnit: 'Nos',
      defaultPrice: 1500.00,
      availableStock: 999,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-2',
      name: 'Supply and installation of Copper Pipe',
      model: 'MAT-COP-01',
      category: 'LOW_SIDE',
      description: 'Supply and installation of Copper Pipe with insulation',
      defaultUnit: 'Mtr',
      defaultPrice: 1280.00,
      availableStock: 500,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-3',
      name: 'Supply and installation of Communication Cable',
      model: 'MAT-CAB-COM',
      category: 'LOW_SIDE',
      description: 'Supply and installation of Communication Cable (4 core 1.5 sqmm)',
      defaultUnit: 'Mtr',
      defaultPrice: 290.00,
      availableStock: 600,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-4',
      name: 'Supply and installation of Supply Cable',
      model: 'MAT-CAB-PWR',
      category: 'LOW_SIDE',
      description: 'Supply and installation of Supply Cable (3 core 2.5 sqmm)',
      defaultUnit: 'Mtr',
      defaultPrice: 190.00,
      availableStock: 450,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-5',
      name: 'Supply and installation of Outdoor Stand',
      model: 'MAT-STD-01',
      category: 'LOW_SIDE',
      description: 'Supply and installation of Outdoor Heavy Duty Stand',
      defaultUnit: 'Nos',
      defaultPrice: 1450.00,
      availableStock: 50,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'prod-mat-6',
      name: 'Supply And Installation Of White Packing Tape',
      model: 'MAT-TPE-01',
      category: 'LOW_SIDE',
      description: 'Supply And Installation Of White Packing Tape for piping insulation',
      defaultUnit: 'Nos',
      defaultPrice: 300.00,
      availableStock: 120,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // 6. Quotation Configuration & Default Templates matching Image 2
  inMemoryDB.quotationConfig = {
    id: 'q-cfg-1',
    defaultCgstPercent: 9.0,
    defaultSgstPercent: 9.0,
    defaultTerms: `1. AC Price is inclusive of 18 % taxes. 18% Tax Additional for Lowside.
2. Electrical, Plumbing, civil work, Structural, core cutting, class cutting, scaffolding, Crane works, Aircurtains, IDU Room wall opening for customer scope.
3. We have given the quotation as per the bill of quantities If there is any variation in the quantities used in the site, it will be charged extra, Extra Materials like Copper Pipe, Communication Cable, Supply Cable, etc.,
4. Payment method:
   • 100% Payment advance with P.O for Machine.
   • 70% Advance of Total Lowside Value along with PO
   • 25% After completion of erection works.
   • 5% Payment after raising the final bill.
5. Final bill will be raised on the basis of actual quantities used in the site (after taking the measurement).
6. This Quotation Is Valid For 10 days`,
    defaultPaymentMethod: `(i) 100% Payment advance with P.O for Machine.
(ii) 70% Advance of Total Lowside Value along with PO
(iii) 25% After completion of erection works.
(iv) 5% Payment after raising the final bill.`,
    availableUnits: 'Nos,Mtr,Sqft,Kg,Set,Box,Piece,Hour,Service,Roll,Other',
    updatedAt: new Date(),
  };

  // 7. Seed sample quotation matching Image 2 exactly
  const initialQuotationId = 'quot-seed-1';
  inMemoryDB.quotations = [
    {
      id: initialQuotationId,
      quotationNumber: 'ECD-Q-2026-00124',
      revisionNumber: 1,
      originalQuotationId: null,
      date: '18-08-2026',
      customerName: 'Mr. Senthilnathan',
      customerAddress: 'Coimbatore, Tamil Nadu',
      customerPhone: '+91 98765 43210',
      customerEmail: 'senthilnathan@gmail.com',
      customerLocation: 'Coimbatore, Tamil Nadu',
      createdById: 'usr-sales-1',
      hasLowSide: true,
      mainUnitTotal: 30423.73,
      lowSideTotal: 5010.00,
      subtotal: 30423.73,
      cgstPercent: 9.0,
      cgstAmount: 2738.14,
      sgstPercent: 9.0,
      sgstAmount: 2738.14,
      grandTotal: 35900.00,
      termsAndConditions: inMemoryDB.quotationConfig.defaultTerms,
      paymentMethod: inMemoryDB.quotationConfig.defaultPaymentMethod,
      status: 'FINAL',
      notes: 'Residential Split AC quotation with low-side materials',
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
      description: 'Daikin 1.5Tr 3Star Inverter Split Ac , 100% Copper (FTKC48XV16)',
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
      description: 'Installation and testing commissioning Charges of Split ac',
      quantity: 1,
      unit: 'Nos',
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
      description: 'Supply and installation of Copper Pipe',
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
      productId: 'prod-mat-3',
      itemOrder: 3,
      description: 'Supply and installation of Communication Cable',
      quantity: 1,
      unit: 'Mtr',
      unitPrice: 290.00,
      amount: 290.00,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'qitem-5',
      quotationId: initialQuotationId,
      section: 'LOW_SIDE',
      productId: 'prod-mat-4',
      itemOrder: 4,
      description: 'Supply and installation of Supply Cable',
      quantity: 1,
      unit: 'Mtr',
      unitPrice: 190.00,
      amount: 190.00,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'qitem-6',
      quotationId: initialQuotationId,
      section: 'LOW_SIDE',
      productId: 'prod-mat-5',
      itemOrder: 5,
      description: 'Supply and installation of Outdoor Stand',
      quantity: 1,
      unit: 'Nos',
      unitPrice: 1450.00,
      amount: 1450.00,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'qitem-7',
      quotationId: initialQuotationId,
      section: 'LOW_SIDE',
      productId: 'prod-mat-6',
      itemOrder: 6,
      description: 'Supply And Installation Of White Packing Tape',
      quantity: 1,
      unit: 'Nos',
      unitPrice: 300.00,
      amount: 300.00,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

let isPrismaConnected = false;

export async function initDatabase() {
  try {
    await prisma.$connect();
    isPrismaConnected = true;
    console.log('✅ [DB] Connected to PostgreSQL Database on Supabase via Prisma successfully.');

    // Ensure default Office Config exists if table is empty
    const officeCount = await prisma.officeConfig.count();
    if (officeCount === 0) {
      await prisma.officeConfig.create({
        data: {
          officeName: 'ECDIAL Headquarters - Coimbatore',
          latitude: 11.0168,
          longitude: 76.9558,
          allowedRadiusMeters: 100.0,
          qrRotationSeconds: 30,
          isDefault: true,
        },
      });
      console.log('ℹ️ [DB] Initialized default Office Configuration.');
    }

    // Ensure default Quotation Config exists if table is empty
    const quoteConfigCount = await prisma.quotationConfig.count();
    if (quoteConfigCount === 0) {
      await prisma.quotationConfig.create({
        data: {
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
        },
      });
      console.log('ℹ️ [DB] Initialized default Quotation Configuration.');
    }

    // Seed low-side catalog items & presets
    const { seedCatalogAndPresets } = await import('../services/seedCatalog.service');
    await seedCatalogAndPresets();
  } catch (err: any) {
    isPrismaConnected = false;
    console.error('❌ [DB] Error connecting to PostgreSQL Database:', err);
  }
}

export function isDbConnected() {
  return isPrismaConnected;
}

import { prisma } from '../db/store';

export async function seedCatalogAndPresets() {
  try {
    // 1. Seed Low-Side Catalog Items
    const lowSideDefaults: Array<{
      name: string;
      acType: 'SPLIT' | 'CASSETTE' | 'DUCT' | 'VRV';
      description: string;
      defaultUnit: string;
      defaultPrice: number;
      defaultSupplyRate: number;
      defaultInstallRate: number;
    }> = [
      // --- SPLIT AC LOW-SIDE ---
      {
        name: 'Installation and testing commissioning Charges of Split ac',
        acType: 'SPLIT',
        description: 'Installation and testing commissioning Charges of Split ac',
        defaultUnit: 'Nos',
        defaultPrice: 1500,
        defaultSupplyRate: 0,
        defaultInstallRate: 1500,
      },
      {
        name: 'Supply and installation of Copper Pipe',
        acType: 'SPLIT',
        description: 'Supply and installation of Copper Pipe',
        defaultUnit: 'Mtr',
        defaultPrice: 1280,
        defaultSupplyRate: 1280,
        defaultInstallRate: 0,
      },
      {
        name: 'Supply and installation of Communication Cable',
        acType: 'SPLIT',
        description: 'Supply and installation of Communication Cable',
        defaultUnit: 'Mtr',
        defaultPrice: 290,
        defaultSupplyRate: 290,
        defaultInstallRate: 0,
      },
      {
        name: 'Supply and installation of Supply Cable',
        acType: 'SPLIT',
        description: 'Supply and installation of Supply Cable',
        defaultUnit: 'Mtr',
        defaultPrice: 190,
        defaultSupplyRate: 190,
        defaultInstallRate: 0,
      },
      {
        name: 'Supply and installation of Outdoor Stand',
        acType: 'SPLIT',
        description: 'Supply and installation of Outdoor Stand',
        defaultUnit: 'Nos',
        defaultPrice: 1450,
        defaultSupplyRate: 1450,
        defaultInstallRate: 0,
      },
      {
        name: 'Supply And Installation Of White Packing Tape',
        acType: 'SPLIT',
        description: 'Supply And Installation Of White Packing Tape',
        defaultUnit: 'Nos',
        defaultPrice: 300,
        defaultSupplyRate: 300,
        defaultInstallRate: 0,
      },

      // --- CASSETTE AC LOW-SIDE (Exact Reference) ---
      {
        name: 'Cassette unit installation labour charges',
        acType: 'CASSETTE',
        description: 'Cassette unit installation labour charges',
        defaultUnit: 'Nos',
        defaultPrice: 15000,
        defaultSupplyRate: 0,
        defaultInstallRate: 15000,
      },
      {
        name: 'GI ducting with insulation (supply & fixing)',
        acType: 'CASSETTE',
        description: 'GI ducting with insulation, supply and fixing',
        defaultUnit: 'Sq.Mt',
        defaultPrice: 3700,
        defaultSupplyRate: 2850,
        defaultInstallRate: 850,
      },
      {
        name: 'Supply air diffuser (4-way cassette type)',
        acType: 'CASSETTE',
        description: 'Supply air diffuser, four-way Cassette type',
        defaultUnit: 'Nos',
        defaultPrice: 5500,
        defaultSupplyRate: 4500,
        defaultInstallRate: 1000,
      },
      {
        name: 'Return air grille with filter',
        acType: 'CASSETTE',
        description: 'Return air grille with filter',
        defaultUnit: 'Nos',
        defaultPrice: 4000,
        defaultSupplyRate: 3200,
        defaultInstallRate: 800,
      },
      {
        name: 'Fresh air ducting and motorized damper (if required)',
        acType: 'CASSETTE',
        description: 'Fresh air ducting and motorized damper, if required',
        defaultUnit: 'Lot',
        defaultPrice: 36000,
        defaultSupplyRate: 28000,
        defaultInstallRate: 8000,
      },
      {
        name: 'Refrigerant copper piping (insulated)',
        acType: 'CASSETTE',
        description: 'Refrigerant copper piping, insulated',
        defaultUnit: 'RMT',
        defaultPrice: 1900,
        defaultSupplyRate: 1450,
        defaultInstallRate: 450,
      },
      {
        name: 'Drain piping (PVC 25 mm)',
        acType: 'CASSETTE',
        description: 'Drain piping, PVC 25 mm',
        defaultUnit: 'RMT',
        defaultPrice: 540,
        defaultSupplyRate: 320,
        defaultInstallRate: 220,
      },
      {
        name: 'Electrical cabling and accessories',
        acType: 'CASSETTE',
        description: 'Electrical cabling and accessories',
        defaultUnit: 'Lot',
        defaultPrice: 25000,
        defaultSupplyRate: 18000,
        defaultInstallRate: 7000,
      },
      {
        name: 'Nitrogen pressure testing and vacuuming',
        acType: 'CASSETTE',
        description: 'Nitrogen pressure testing and vacuuming',
        defaultUnit: 'Lot',
        defaultPrice: 8000,
        defaultSupplyRate: 5500,
        defaultInstallRate: 2500,
      },
      {
        name: 'Testing and commissioning',
        acType: 'CASSETTE',
        description: 'Testing and commissioning',
        defaultUnit: 'Lot',
        defaultPrice: 7000,
        defaultSupplyRate: 0,
        defaultInstallRate: 7000,
      },

      // --- DUCT AC LOW-SIDE ---
      {
        name: 'Duct unit installation labour charges',
        acType: 'DUCT',
        description: 'Duct unit installation labour charges',
        defaultUnit: 'Nos',
        defaultPrice: 12000,
        defaultSupplyRate: 0,
        defaultInstallRate: 12000,
      },
      {
        name: 'GI sheet metal ducting with thermal insulation',
        acType: 'DUCT',
        description: 'GI sheet metal ducting with thermal insulation',
        defaultUnit: 'Sq.Mt',
        defaultPrice: 3450,
        defaultSupplyRate: 2600,
        defaultInstallRate: 850,
      },
      {
        name: 'Supply air & return air linear grilles / diffusers',
        acType: 'DUCT',
        description: 'Supply air & return air linear grilles / diffusers',
        defaultUnit: 'Nos',
        defaultPrice: 4400,
        defaultSupplyRate: 3500,
        defaultInstallRate: 900,
      },
      {
        name: 'Refrigerant copper piping with nitrile insulation',
        acType: 'DUCT',
        description: 'Refrigerant copper piping with nitrile insulation',
        defaultUnit: 'RMT',
        defaultPrice: 2050,
        defaultSupplyRate: 1600,
        defaultInstallRate: 450,
      },
      {
        name: 'Drain piping PVC 32 mm with insulation',
        acType: 'DUCT',
        description: 'Drain piping PVC 32 mm with insulation',
        defaultUnit: 'RMT',
        defaultPrice: 550,
        defaultSupplyRate: 350,
        defaultInstallRate: 200,
      },
      {
        name: 'Power and control cabling with conduits',
        acType: 'DUCT',
        description: 'Power and control cabling with conduits',
        defaultUnit: 'Lot',
        defaultPrice: 22500,
        defaultSupplyRate: 16000,
        defaultInstallRate: 6500,
      },
      {
        name: 'Nitrogen holding pressure testing and vacuuming',
        acType: 'DUCT',
        description: 'Nitrogen holding pressure testing and vacuuming',
        defaultUnit: 'Lot',
        defaultPrice: 8000,
        defaultSupplyRate: 5500,
        defaultInstallRate: 2500,
      },
      {
        name: 'Testing, air balancing and commissioning',
        acType: 'DUCT',
        description: 'Testing, air balancing and commissioning',
        defaultUnit: 'Lot',
        defaultPrice: 7500,
        defaultSupplyRate: 0,
        defaultInstallRate: 7500,
      },

      // --- VRV/VRF LOW-SIDE ---
      {
        name: 'VRV/VRF indoor unit installation & hanging charges',
        acType: 'VRV',
        description: 'VRV/VRF indoor unit installation & hanging charges',
        defaultUnit: 'Nos',
        defaultPrice: 8500,
        defaultSupplyRate: 0,
        defaultInstallRate: 8500,
      },
      {
        name: 'VRV/VRF outdoor unit positioning, anti-vibration mounting',
        acType: 'VRV',
        description: 'VRV/VRF outdoor unit positioning, anti-vibration mounting',
        defaultUnit: 'Nos',
        defaultPrice: 18000,
        defaultSupplyRate: 0,
        defaultInstallRate: 18000,
      },
      {
        name: 'Refrigerant copper piping with dual layer insulation',
        acType: 'VRV',
        description: 'Refrigerant copper piping with dual layer insulation',
        defaultUnit: 'RMT',
        defaultPrice: 2400,
        defaultSupplyRate: 1850,
        defaultInstallRate: 550,
      },
      {
        name: 'Refnet joints and Y-branch fittings',
        acType: 'VRV',
        description: 'Refnet joints and Y-branch fittings',
        defaultUnit: 'Nos',
        defaultPrice: 5700,
        defaultSupplyRate: 4500,
        defaultInstallRate: 1200,
      },
      {
        name: 'Shielded 2-core communication bus cable',
        acType: 'VRV',
        description: 'Shielded 2-core communication bus cable',
        defaultUnit: 'RMT',
        defaultPrice: 310,
        defaultSupplyRate: 220,
        defaultInstallRate: 90,
      },
      {
        name: 'Insulated rigid PVC drain line',
        acType: 'VRV',
        description: 'Insulated rigid PVC drain line',
        defaultUnit: 'RMT',
        defaultPrice: 600,
        defaultSupplyRate: 380,
        defaultInstallRate: 220,
      },
      {
        name: 'High pressure nitrogen holding test (41 bar) & vacuuming',
        acType: 'VRV',
        description: 'High pressure nitrogen holding test (41 bar) & vacuuming',
        defaultUnit: 'Lot',
        defaultPrice: 20000,
        defaultSupplyRate: 12000,
        defaultInstallRate: 8000,
      },
      {
        name: 'Certified commissioning, sensor calibration and handover',
        acType: 'VRV',
        description: 'Certified commissioning, sensor calibration and handover',
        defaultUnit: 'Lot',
        defaultPrice: 15000,
        defaultSupplyRate: 0,
        defaultInstallRate: 15000,
      },
    ];

    for (const item of lowSideDefaults) {
      const existing = await prisma.product.findFirst({
        where: {
          name: item.name,
          category: 'LOW_SIDE',
          acType: item.acType,
        },
      });

      if (!existing) {
        await prisma.product.create({
          data: {
            name: item.name,
            category: 'LOW_SIDE',
            acType: item.acType,
            description: item.description,
            defaultUnit: item.defaultUnit,
            defaultPrice: item.defaultPrice,
            defaultSupplyRate: item.defaultSupplyRate,
            defaultInstallRate: item.defaultInstallRate,
            availableStock: 50,
            isActive: true,
          },
        });
      } else if (
        (existing.defaultSupplyRate === null || existing.defaultSupplyRate === 0) &&
        (item.defaultSupplyRate > 0 || item.defaultInstallRate > 0)
      ) {
        // Upgrade existing row with supply/install rates if unpopulated
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            defaultSupplyRate: item.defaultSupplyRate,
            defaultInstallRate: item.defaultInstallRate,
          },
        });
      }
    }

    // 2. Seed Cassette Main Units (High Side) from Reference Image
    const cassetteMainUnits = [
      {
        name: 'Daikin 5 TR Cassette indoor unit (FCF125CV16)',
        model: 'FCF125CV16',
        category: 'MAIN_UNIT',
        acType: 'CASSETTE',
        description: 'Daikin 5 TR Cassette indoor unit (FCF125CV16)',
        defaultUnit: 'Nos',
        defaultPrice: 215000,
        defaultSupplyRate: 215000,
        defaultInstallRate: 0,
      },
      {
        name: 'Daikin 5 TR outdoor unit (RZQ125BY1E)',
        model: 'RZQ125BY1E',
        category: 'MAIN_UNIT',
        acType: 'CASSETTE',
        description: 'Daikin 5 TR outdoor unit (RZQ125BY1E)',
        defaultUnit: 'Nos',
        defaultPrice: 312000,
        defaultSupplyRate: 312000,
        defaultInstallRate: 0,
      },
      {
        name: 'Wired remote controller (BRC1H52)',
        model: 'BRC1H52',
        category: 'MAIN_UNIT',
        acType: 'CASSETTE',
        description: 'Wired remote controller (BRC1H52)',
        defaultUnit: 'Nos',
        defaultPrice: 18500,
        defaultSupplyRate: 18500,
        defaultInstallRate: 0,
      },
      {
        name: 'Standard installation kit & accessories',
        model: 'STD-KIT',
        category: 'MAIN_UNIT',
        acType: 'CASSETTE',
        description: 'Standard installation kit & accessories',
        defaultUnit: 'Lot',
        defaultPrice: 25000,
        defaultSupplyRate: 25000,
        defaultInstallRate: 0,
      },
    ];

    for (const mu of cassetteMainUnits) {
      const existing = await prisma.product.findFirst({
        where: { name: mu.name, category: 'MAIN_UNIT' },
      });
      if (!existing) {
        await prisma.product.create({
          data: {
            name: mu.name,
            model: mu.model,
            category: 'MAIN_UNIT',
            acType: 'CASSETTE',
            description: mu.description,
            defaultUnit: mu.defaultUnit,
            defaultPrice: mu.defaultPrice,
            defaultSupplyRate: mu.defaultSupplyRate,
            defaultInstallRate: mu.defaultInstallRate,
            availableStock: 10,
            isActive: true,
          },
        });
      }
    }

    // 3. Seed Quotation Presets (Terms, Payment, Scope, Requirements)
    const presetDefaults = [
      // CASSETTE SCOPE / EXCLUSIONS (Section C)
      {
        title: 'Cassette Customer Scope & Exclusions',
        presetType: 'SCOPE',
        acType: 'CASSETTE',
        quotationType: 'DAIKIN',
        isDefault: true,
        content: `01. All masonry/civil works: outdoor-unit supports, cutting and making good walls/floor slabs, trenches and scaffolding.
02. Main power supply to each outdoor unit (3-phase) with ELICB and near each indoor unit (single-phase).
03. False-ceiling, boxing, wooden framework and carpentry work.
04. MS angle support for indoor units, if necessary.
05. Provision of necessary drain points.
06. Any under-deck or false-ceiling insulation work.
07. Protected storage space at site.
08. Power for erection, testing and commissioning.
09. Any dismantling work.
10. Items not specifically mentioned in ECDIAL's scope of work are excluded.
11. ODU and AHU lifting to terrace.`,
      },

      // CASSETTE REQUIREMENTS BEFORE COMMISSIONING (Section D)
      {
        title: 'Cassette Requirements Before Commissioning',
        presetType: 'REQUIREMENTS',
        acType: 'CASSETTE',
        quotationType: 'DAIKIN',
        isDefault: true,
        content: `1. Earth voltage must be maintained at a minimum of 0–3 V.
2. Commissioning power: outdoor units, 3-phase 420-440 V; indoor units, single-phase 220-240 V.
3. Electrical works must comply with issued specifications/drawings and electrical safety standards.`,
      },

      // CASSETTE TERMS & CONDITIONS (Section E)
      {
        title: 'Cassette Commercial Proposal Terms (Exclusive GST)',
        presetType: 'TERMS',
        acType: 'CASSETTE',
        quotationType: 'DAIKIN',
        isDefault: true,
        content: `TAX: AC price and labour charges are exclusive of GST and subject to 18% GST.
FINAL BILL: Final bill based on actual quantities used at site after measurement.
VALIDITY: This quotation is valid for 10 days from the date of issue.`,
      },

      // CASSETTE PAYMENT SCHEDULE (Section E)
      {
        title: 'Cassette Milestone Payment Schedule',
        presetType: 'PAYMENT',
        acType: 'CASSETTE',
        quotationType: 'DAIKIN',
        isDefault: true,
        content: `• 100% advance with purchase order for machines.
• 70% advance of total low-side value along with purchase order.
• 25% after completion of erection works.
• 5% payment after raising the final bill.
• Final bill based on actual quantities used at site after measurement.`,
      },

      // SPLIT TERMS & CONDITIONS
      {
        title: 'Split AC Standard Terms (Inclusive Machine GST)',
        presetType: 'TERMS',
        acType: 'SPLIT',
        quotationType: 'ALL',
        isDefault: true,
        content: `1. AC Price is inclusive of 18 % taxes. 18% Tax Additional for Lowside.
2. Electrical, Plumbing, civil work, Structural, core cutting, class cutting, scaffolding, Crane works, Aircurtains, IDU Room wall opening for customer scope.
3. We have given the quotation as per the bill of quantities If there is any variation in the quantities used in the site, it will be charged extra, Extra Materials like Copper Pipe, Communication Cable, Supply Cable, etc.,
4. Payment method:
   • 100% Payment advance with P.O for Machine.
   • 70% Advance of Total Lowside Value along with PO
   • 25% After completion of erection works.
   • 5% Payment after raising the final bill.
5. Final bill will be raised on the basis of actual quantities used in the site (after taking the measurement).
6. This Quotation Is Valid For 10 days`,
      },

      // SPLIT PAYMENT SCHEDULE
      {
        title: 'Split AC Standard Payment Schedule',
        presetType: 'PAYMENT',
        acType: 'SPLIT',
        quotationType: 'ALL',
        isDefault: true,
        content: `(i) 100% Payment advance with P.O for Machine.
(ii) 70% Advance of Total Lowside Value along with PO
(iii) 25% After completion of erection works.
(iv) 5% Payment after raising the final bill.`,
      },
    ];

    for (const preset of presetDefaults) {
      const existing = await prisma.quotationPreset.findFirst({
        where: {
          title: preset.title,
          presetType: preset.presetType,
        },
      });

      if (!existing) {
        await prisma.quotationPreset.create({
          data: {
            title: preset.title,
            presetType: preset.presetType,
            acType: preset.acType,
            quotationType: preset.quotationType,
            content: preset.content,
            isDefault: preset.isDefault,
            isActive: true,
          },
        });
      }
    }

    console.log('✅ [Seed] Category-specific catalogues and quotation presets seeded successfully.');
  } catch (err) {
    console.error('❌ [Seed] Error seeding catalogues and presets:', err);
  }
}

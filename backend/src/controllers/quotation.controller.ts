import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { calculateQuotationTotals, getTodayDateString, roundCurrency } from '../utils/calculations';
import { generateQuotationPDF } from '../services/pdf.service';
import { notificationService } from '../services/notification.service';

async function generateNextQuotationNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await prisma.quotation.count();
  const seq = String(count + 1 + 100).padStart(5, '0');
  return `ECD-Q-${currentYear}-${seq}`;
}

function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const d = new Date(year, (month || 1) - 1, day || 1);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function validTillOrDefault(value: unknown, dateString: string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return addDaysToDateString(dateString, 10);
}

export const quotationController = {
  // 1. Get Quotation System Configuration (GST rates, terms, payment methods, units)
  getConfig: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const config = await prisma.quotationConfig.findFirst();
      res.json({
        success: true,
        data: config,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve quotation config.' });
    }
  },

  // 2. Update Configuration (Admin only)
  updateConfig: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { defaultCgstPercent, defaultSgstPercent, defaultTerms, defaultPaymentMethod, availableUnits } = req.body;

    try {
      const existing = await prisma.quotationConfig.findFirst();
      let updated;
      if (existing) {
        updated = await prisma.quotationConfig.update({
          where: { id: existing.id },
          data: {
            defaultCgstPercent: defaultCgstPercent !== undefined ? Number(defaultCgstPercent) : existing.defaultCgstPercent,
            defaultSgstPercent: defaultSgstPercent !== undefined ? Number(defaultSgstPercent) : existing.defaultSgstPercent,
            defaultTerms: defaultTerms !== undefined ? defaultTerms : existing.defaultTerms,
            defaultPaymentMethod: defaultPaymentMethod !== undefined ? defaultPaymentMethod : existing.defaultPaymentMethod,
            availableUnits: availableUnits !== undefined ? availableUnits : existing.availableUnits,
          },
        });
      } else {
        updated = await prisma.quotationConfig.create({
          data: {
            defaultCgstPercent: Number(defaultCgstPercent) || 9.0,
            defaultSgstPercent: Number(defaultSgstPercent) || 9.0,
            defaultTerms: defaultTerms || 'Standard Terms',
            defaultPaymentMethod: defaultPaymentMethod || '100% Machine with PO',
            availableUnits: availableUnits || 'Nos,Mtr,Sqft,Kg,Set,Box,Piece,Hour,Service,Other',
          },
        });
      }

      res.json({
        success: true,
        message: 'Quotation settings updated.',
        data: updated,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update quotation config.' });
    }
  },

  // 3. Create Fast New Quotation
  createQuotation: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const {
      customerId,
      customerName,
      customerAddress,
      customerPhone,
      customerEmail,
      customerLocation,
      systemDesignation,
      totalCapacity,
      offerType,
      scopeExclusions,
      commissioningReqs,
      quotationType,
      acType,
      hasLowSide,
      includeBankDetails,
      items,
      cgstPercent,
      sgstPercent,
      termsAndConditions,
      paymentMethod,
      status,
      notes,
      pdfName,
    } = req.body;

    try {
      const todayStr = getTodayDateString();
      const quotationNumber = await generateNextQuotationNumber();
      const validTillStr = validTillOrDefault(req.body.validTill, todayStr);
      const currentAcType = String(acType || 'SPLIT').toUpperCase();

      const config = (await prisma.quotationConfig.findFirst()) || {
        defaultCgstPercent: 9.0,
        defaultSgstPercent: 9.0,
        defaultTerms: 'Standard terms apply.',
        defaultPaymentMethod: '100% Machine with PO',
      };

      const cgst = cgstPercent !== undefined ? Number(cgstPercent) : config.defaultCgstPercent;
      const sgst = sgstPercent !== undefined ? Number(sgstPercent) : config.defaultSgstPercent;
      const terms = termsAndConditions || config.defaultTerms;
      const payment = paymentMethod || config.defaultPaymentMethod;

      // Process Line Items and Calculate Totals
      const processedItems = [];
      const stockWarnings = [];

      const rawItems = Array.isArray(items) ? items : [];
      for (let idx = 0; idx < rawItems.length; idx++) {
        const item = rawItems[idx];
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unitPrice) || 0;
        const supRate = item.supplyRate !== undefined && item.supplyRate !== null ? Number(item.supplyRate) : (item.section === 'MAIN_UNIT' ? price : 0);
        const instRate = item.installRate !== undefined && item.installRate !== null ? Number(item.installRate) : 0;
        const supAmt = item.supplyAmount !== undefined && item.supplyAmount !== null && item.supplyAmount !== 0
          ? Number(item.supplyAmount)
          : roundCurrency(qty * supRate);
        const instAmt = item.installAmount !== undefined && item.installAmount !== null && item.installAmount !== 0
          ? Number(item.installAmount)
          : roundCurrency(qty * instRate);

        const itemAmount = (item.amount !== undefined && item.amount !== null && item.amount !== 0)
          ? Number(item.amount)
          : (item.section === 'LOW_SIDE' && (supRate > 0 || instRate > 0)
              ? roundCurrency(supAmt + instAmt)
              : roundCurrency(qty * price));

        // Optional: Check Machine Catalogue stock if productId provided
        if (item.productId) {
          const product = await prisma.product.findUnique({ where: { id: item.productId } });
          if (product && product.availableStock < qty) {
            stockWarnings.push(
              `Warning: Insufficient stock for ${product.name}. Available: ${product.availableStock}, Requested: ${qty}`
            );
          }
        }

        processedItems.push({
          section: item.section || 'MAIN_UNIT',
          productId: item.productId || null,
          brand: item.brand || null,
          itemOrder: idx + 1,
          description: item.description || 'Item Description',
          quantity: qty,
          unit: item.unit || 'Nos',
          unitPrice: price > 0 ? price : supRate,
          amount: itemAmount,
          supplyRate: supRate,
          supplyAmount: supAmt,
          installRate: instRate,
          installAmount: instAmt,
          notes: item.notes || '',
        });
      }

      const totals = calculateQuotationTotals(processedItems, Boolean(hasLowSide), cgst, sgst, currentAcType);
      const finalCustName = customerName ? String(customerName).trim() : '';
      const finalCustAddr = customerAddress ? String(customerAddress).trim() : '';
      const cleanPdfName = pdfName ? String(pdfName).trim() : null;

      // Create Quotation with Items in Supabase DB
      const newQuotation = await prisma.quotation.create({
        data: {
          quotationNumber,
          revisionNumber: 1,
          date: todayStr,
          validTill: validTillStr,
          acType: currentAcType,
          includeBankDetails: includeBankDetails !== undefined ? Boolean(includeBankDetails) : true,
          customerId: customerId || null,
          customerName: finalCustName,
          customerAddress: finalCustAddr,
          customerPhone: customerPhone ? String(customerPhone).trim() : null,
          customerEmail: customerEmail ? String(customerEmail).trim() : null,
          customerLocation: customerLocation ? String(customerLocation).trim() : finalCustAddr,
          systemDesignation: systemDesignation || (currentAcType === 'CASSETTE' ? 'Daikin Cassette' : null),
          totalCapacity: totalCapacity || null,
          offerType: offerType || 'Supply and Installation',
          scopeExclusions: scopeExclusions || null,
          commissioningReqs: commissioningReqs || null,
          createdById: req.user.id,
          quotationType: (quotationType || 'DAIKIN').toUpperCase(),
          hasLowSide: Boolean(hasLowSide),
          mainUnitTotal: totals.mainUnitTotal,
          lowSideSupplyTotal: totals.lowSideSupplyTotal,
          lowSideInstallTotal: totals.lowSideInstallTotal,
          lowSideTotal: totals.lowSideTotal,
          subtotal: totals.subtotal,
          cgstPercent: cgst,
          cgstAmount: totals.cgstAmount,
          sgstPercent: sgst,
          sgstAmount: totals.sgstAmount,
          grandTotal: totals.grandTotal,
          termsAndConditions: terms,
          paymentMethod: payment,
          status: status || 'DRAFT',
          pdfName: cleanPdfName,
          notes: notes || null,
          items: {
            create: processedItems,
          },
        },
        include: {
          items: true,
          customer: true,
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      // Dispatch notification to creator
      notificationService.notifyQuotationCreated({
        userId: req.user.id,
        quotationId: newQuotation.id,
        quotationNumber: newQuotation.quotationNumber,
        customerName: newQuotation.customerName || undefined,
      }).catch((err) => console.error('[Notify Quotation Error]', err));

      res.json({
        success: true,
        message: 'Quotation generated successfully.',
        data: newQuotation,
        stockWarnings: stockWarnings.length > 0 ? stockWarnings : undefined,
      });
    } catch (err: any) {
      console.error('[Create Quotation Error]', err);
      res.status(500).json({ success: false, message: 'Failed to create quotation.' });
    }
  },

  // 4. List Quotations (Sales sees only their own; Admin sees all)
  listQuotations: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { createdBy, status } = req.query;
    const isSales = req.user.role === 'SALES';

    try {
      const quotations = await prisma.quotation.findMany({
        where: {
          ...(isSales ? { createdById: req.user.id } : createdBy ? { createdById: createdBy as string } : {}),
          ...(status ? { status: status as string } : {}),
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true, role: true } },
          customer: true,
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const formatted = quotations.map((q) => ({
        id: q.id,
        quotationNumber: q.quotationNumber,
        revisionNumber: q.revisionNumber,
        date: q.date,
        validTill: (q as any).validTill || addDaysToDateString(q.date, 10),
        acType: (q as any).acType || 'SPLIT',
        includeBankDetails: (q as any).includeBankDetails !== false,
        customerId: q.customerId,
        customer: q.customer,
        customerName: q.customerName || q.customer?.name || '',
        customerAddress: q.customerAddress || q.customer?.address || '',
        customerPhone: q.customerPhone || q.customer?.mobile || '',
        customerEmail: q.customerEmail || q.customer?.email || '',
        customerLocation: q.customerLocation || q.customer?.address || '',
        createdById: q.createdById,
        createdByName: q.createdBy?.name || 'Sales Rep',
        quotationType: (q as any).quotationType || 'DAIKIN',
        hasLowSide: q.hasLowSide,
        mainUnitTotal: q.mainUnitTotal,
        lowSideTotal: q.lowSideTotal,
        subtotal: q.subtotal,
        cgstPercent: q.cgstPercent,
        cgstAmount: q.cgstAmount,
        sgstPercent: q.sgstPercent,
        sgstAmount: q.sgstAmount,
        grandTotal: q.grandTotal,
        termsAndConditions: q.termsAndConditions,
        paymentMethod: q.paymentMethod,
        status: q.status,
        pdfName: (q as any).pdfName || null,
        itemCount: q.items.length,
        items: q.items,
        createdAt: q.createdAt,
      }));

      res.json({
        success: true,
        data: formatted,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to list quotations.' });
    }
  },

  // 5. Get Single Quotation Details
  getQuotationById: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const quotation = await prisma.quotation.findFirst({
        where: {
          OR: [{ id }, { quotationNumber: id }],
        },
        include: {
          items: { orderBy: { itemOrder: 'asc' } },
          createdBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      if (!quotation) {
        res.status(404).json({ success: false, message: 'Quotation not found.' });
        return;
      }

      // Check access permission for Sales
      if (req.user && req.user.role === 'SALES' && quotation.createdById !== req.user.id) {
        res.status(403).json({ success: false, message: 'Access denied to this quotation.' });
        return;
      }

      res.json({
        success: true,
        data: quotation,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve quotation.' });
    }
  },

  // 6. Update Quotation
  updateQuotation: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
      customerName,
      customerAddress,
      customerPhone,
      customerEmail,
      customerLocation,
      systemDesignation,
      totalCapacity,
      offerType,
      scopeExclusions,
      commissioningReqs,
      quotationType,
      acType,
      hasLowSide,
      includeBankDetails,
      validTill,
      items,
      cgstPercent,
      sgstPercent,
      termsAndConditions,
      paymentMethod,
      status,
      notes,
      pdfName,
    } = req.body;

    try {
      const existing = await prisma.quotation.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        res.status(404).json({ success: false, message: 'Quotation not found.' });
        return;
      }

      const cgst = cgstPercent !== undefined ? Number(cgstPercent) : existing.cgstPercent;
      const sgst = sgstPercent !== undefined ? Number(sgstPercent) : existing.sgstPercent;
      const currentAcType = acType !== undefined ? String(acType || 'SPLIT').toUpperCase() : ((existing as any).acType || 'SPLIT');

      let processedItems = existing.items;
      if (Array.isArray(items)) {
        processedItems = items.map((item, idx) => {
          const qty = Number(item.quantity) || 1;
          const price = Number(item.unitPrice) || 0;
          const supRate = item.supplyRate !== undefined && item.supplyRate !== null ? Number(item.supplyRate) : (item.section === 'MAIN_UNIT' ? price : 0);
          const instRate = item.installRate !== undefined && item.installRate !== null ? Number(item.installRate) : 0;
          const supAmt = item.supplyAmount !== undefined && item.supplyAmount !== null && item.supplyAmount !== 0
            ? Number(item.supplyAmount)
            : roundCurrency(qty * supRate);
          const instAmt = item.installAmount !== undefined && item.installAmount !== null && item.installAmount !== 0
            ? Number(item.installAmount)
            : roundCurrency(qty * instRate);

          const itemAmount = (item.amount !== undefined && item.amount !== null && item.amount !== 0)
            ? Number(item.amount)
            : (item.section === 'LOW_SIDE' && (supRate > 0 || instRate > 0)
                ? roundCurrency(supAmt + instAmt)
                : roundCurrency(qty * price));

          return {
            id: item.id || undefined,
            quotationId: id,
            section: item.section || 'MAIN_UNIT',
            productId: item.productId || null,
            brand: item.brand || null,
            itemOrder: idx + 1,
            description: item.description || 'Item',
            quantity: qty,
            unit: item.unit || 'Nos',
            unitPrice: price > 0 ? price : supRate,
            amount: itemAmount,
            supplyRate: supRate,
            supplyAmount: supAmt,
            installRate: instRate,
            installAmount: instAmt,
            notes: item.notes || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }) as any;
      }

      const totals = calculateQuotationTotals(
        processedItems,
        hasLowSide !== undefined ? Boolean(hasLowSide) : existing.hasLowSide,
        cgst,
        sgst,
        currentAcType
      );

      // Re-create items if provided
      if (Array.isArray(items)) {
        await prisma.quotationItem.deleteMany({ where: { quotationId: id } });
        await prisma.quotationItem.createMany({
          data: processedItems.map((pi: any) => ({
            quotationId: id,
            section: pi.section,
            productId: pi.productId,
            brand: pi.brand,
            itemOrder: pi.itemOrder,
            description: pi.description,
            quantity: pi.quantity,
            unit: pi.unit,
            unitPrice: pi.unitPrice,
            amount: pi.amount,
            supplyRate: pi.supplyRate,
            supplyAmount: pi.supplyAmount,
            installRate: pi.installRate,
            installAmount: pi.installAmount,
            notes: pi.notes,
          })),
        });
      }

      const updated = await prisma.quotation.update({
        where: { id },
        data: {
          customerName: customerName !== undefined ? String(customerName).trim() : existing.customerName,
          customerAddress: customerAddress !== undefined ? String(customerAddress).trim() : existing.customerAddress,
          customerPhone: customerPhone !== undefined ? String(customerPhone).trim() : existing.customerPhone,
          customerEmail: customerEmail !== undefined ? String(customerEmail).trim() : existing.customerEmail,
          customerLocation: customerLocation !== undefined ? String(customerLocation).trim() : existing.customerLocation,
          systemDesignation: systemDesignation !== undefined ? systemDesignation : (existing as any).systemDesignation,
          totalCapacity: totalCapacity !== undefined ? totalCapacity : (existing as any).totalCapacity,
          offerType: offerType !== undefined ? offerType : (existing as any).offerType,
          scopeExclusions: scopeExclusions !== undefined ? scopeExclusions : (existing as any).scopeExclusions,
          commissioningReqs: commissioningReqs !== undefined ? commissioningReqs : (existing as any).commissioningReqs,
          validTill: validTill !== undefined ? validTillOrDefault(validTill, existing.date) : ((existing as any).validTill || addDaysToDateString(existing.date, 10)),
          acType: currentAcType,
          includeBankDetails: includeBankDetails !== undefined ? Boolean(includeBankDetails) : ((existing as any).includeBankDetails !== false),
          quotationType: quotationType !== undefined ? (quotationType || 'DAIKIN').toUpperCase() : (existing as any).quotationType,
          hasLowSide: hasLowSide !== undefined ? Boolean(hasLowSide) : existing.hasLowSide,
          mainUnitTotal: totals.mainUnitTotal,
          lowSideSupplyTotal: totals.lowSideSupplyTotal,
          lowSideInstallTotal: totals.lowSideInstallTotal,
          lowSideTotal: totals.lowSideTotal,
          subtotal: totals.subtotal,
          cgstPercent: cgst,
          cgstAmount: totals.cgstAmount,
          sgstPercent: sgst,
          sgstAmount: totals.sgstAmount,
          grandTotal: totals.grandTotal,
          termsAndConditions: termsAndConditions !== undefined ? termsAndConditions : existing.termsAndConditions,
          paymentMethod: paymentMethod !== undefined ? paymentMethod : existing.paymentMethod,
          status: status || existing.status,
          pdfName: pdfName !== undefined ? (pdfName ? String(pdfName).trim() : null) : (existing as any).pdfName,
          notes: notes !== undefined ? notes : existing.notes,
        },
        include: { items: true, customer: true, createdBy: true },
      });

      res.json({
        success: true,
        message: 'Quotation updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update quotation.' });
    }
  },

  // 7. Duplicate Quotation
  duplicateQuotation: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const source = await prisma.quotation.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!source) {
        res.status(404).json({ success: false, message: 'Source quotation not found.' });
        return;
      }

      const todayStr = getTodayDateString();
      const quotationNumber = await generateNextQuotationNumber();

      const duplicated = await prisma.quotation.create({
        data: {
          quotationNumber,
          revisionNumber: 1,
          originalQuotationId: source.id,
          date: todayStr,
          validTill: addDaysToDateString(todayStr, 10),
          acType: (source as any).acType || 'SPLIT',
          includeBankDetails: (source as any).includeBankDetails !== false,
          customerId: source.customerId,
          customerName: source.customerName,
          customerAddress: source.customerAddress,
          customerPhone: source.customerPhone,
          customerEmail: source.customerEmail,
          customerLocation: source.customerLocation,
          createdById: req.user!.id,
          quotationType: (source as any).quotationType || 'DAIKIN',
          hasLowSide: source.hasLowSide,
          mainUnitTotal: source.mainUnitTotal,
          lowSideTotal: source.lowSideTotal,
          subtotal: source.subtotal,
          cgstPercent: source.cgstPercent,
          cgstAmount: source.cgstAmount,
          sgstPercent: source.sgstPercent,
          sgstAmount: source.sgstAmount,
          grandTotal: source.grandTotal,
          termsAndConditions: source.termsAndConditions,
          paymentMethod: source.paymentMethod,
          status: 'DRAFT',
          notes: `Cloned from ${source.quotationNumber}`,
          items: {
            create: source.items.map((it) => ({
              section: it.section,
              productId: it.productId,
              brand: (it as any).brand || null,
              itemOrder: it.itemOrder,
              description: it.description,
              quantity: it.quantity,
              unit: it.unit,
              unitPrice: it.unitPrice,
              amount: it.amount,
              notes: it.notes,
            })),
          },
        },
        include: { items: true, customer: true },
      });

      res.json({
        success: true,
        message: 'Quotation duplicated successfully.',
        data: duplicated,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to duplicate quotation.' });
    }
  },

  // 8. Generate & Export PDF
  exportPdf: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const quotation = await prisma.quotation.findFirst({
        where: {
          OR: [{ id }, { quotationNumber: id }],
        },
        include: {
          items: { orderBy: { itemOrder: 'asc' } },
          createdBy: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      if (!quotation) {
        res.status(404).json({ success: false, message: 'Quotation not found.' });
        return;
      }

      const mainItems = quotation.items.filter((i) => i.section === 'MAIN_UNIT');
      const lowSideItems = quotation.items.filter((i) => i.section === 'LOW_SIDE');

      const pdfBuffer = await generateQuotationPDF({
        quotationNumber: quotation.quotationNumber,
        revisionNumber: quotation.revisionNumber,
        date: quotation.date,
        validTill: (quotation as any).validTill || addDaysToDateString(quotation.date, 10),
        acType: (quotation as any).acType || 'SPLIT',
        includeBankDetails: (quotation as any).includeBankDetails !== false,
        quotationType: ((quotation as any).quotationType || 'DAIKIN') as any,
        customerName: quotation.customerName,
        customerAddress: quotation.customerAddress,
        customerPhone: quotation.customerPhone,
        customerEmail: quotation.customerEmail,
        customerLocation: (quotation as any).customerLocation || quotation.customerAddress,
        systemDesignation: (quotation as any).systemDesignation,
        totalCapacity: (quotation as any).totalCapacity,
        offerType: (quotation as any).offerType,
        scopeExclusions: (quotation as any).scopeExclusions,
        commissioningReqs: (quotation as any).commissioningReqs,
        createdByName: quotation.createdBy?.name || 'ECDIAL Sales Rep',
        createdByEmail: quotation.createdBy?.email || 'sales@ecdial.com',
        hasLowSide: quotation.hasLowSide,
        mainUnitTotal: quotation.mainUnitTotal,
        lowSideSupplyTotal: (quotation as any).lowSideSupplyTotal || 0,
        lowSideInstallTotal: (quotation as any).lowSideInstallTotal || 0,
        lowSideTotal: quotation.lowSideTotal,
        subtotal: quotation.subtotal,
        cgstPercent: quotation.cgstPercent,
        cgstAmount: quotation.cgstAmount,
        sgstPercent: quotation.sgstPercent,
        sgstAmount: quotation.sgstAmount,
        grandTotal: quotation.grandTotal,
        termsAndConditions: quotation.termsAndConditions,
        paymentMethod: quotation.paymentMethod,
        mainItems: mainItems.map((m) => ({
          description: m.description,
          brand: (m as any).brand || undefined,
          quantity: m.quantity,
          unit: m.unit,
          unitPrice: m.unitPrice,
          amount: m.amount,
          supplyRate: (m as any).supplyRate ?? m.unitPrice,
          supplyAmount: (m as any).supplyAmount ?? m.amount,
          installRate: (m as any).installRate ?? 0,
          installAmount: (m as any).installAmount ?? 0,
        })),
        lowSideItems: lowSideItems.map((l) => ({
          description: l.description,
          brand: (l as any).brand || undefined,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          amount: l.amount,
          supplyRate: (l as any).supplyRate ?? l.unitPrice,
          supplyAmount: (l as any).supplyAmount ?? l.amount,
          installRate: (l as any).installRate ?? 0,
          installAmount: (l as any).installAmount ?? 0,
        })),
      });

      const requestedFilename = req.query.filename ? String(req.query.filename).trim() : null;
      const rawName = requestedFilename || (quotation as any).pdfName || `Quotation_${quotation.quotationNumber}`;
      const outFilename = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${outFilename}.pdf"`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error('[PDF Generation Error]', err);
      res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
    }
  },

  // Alias for downloadPdf route
  downloadPdf: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    return quotationController.exportPdf(req, res);
  },

  // 9. Update Quotation Status
  updateStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;

    try {
      const updated = await prisma.quotation.update({
        where: { id },
        data: { status },
      });

      res.json({
        success: true,
        message: `Status updated to ${status}.`,
        data: updated,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update status.' });
    }
  },

  // 10. Delete Quotation
  deleteQuotation: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const existing = await prisma.quotation.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Quotation not found.' });
        return;
      }

      const allowedRoles = ['ADMIN', 'MANAGER', 'IT_ADMIN', 'SALES'];
      if (!allowedRoles.includes(req.user?.role || '') && existing.createdById !== req.user?.id) {
        res.status(403).json({ success: false, message: 'You do not have permission to delete this quotation.' });
        return;
      }

      await prisma.$transaction([
        prisma.quotationItem.deleteMany({ where: { quotationId: id } }),
        prisma.quotation.delete({ where: { id } }),
      ]);

      res.json({
        success: true,
        message: 'Quotation deleted successfully.',
      });
    } catch (err: any) {
      console.error('[Delete Quotation Error]', err);
      res.status(500).json({ success: false, message: 'Failed to delete quotation.' });
    }
  },

  // 11. List Reusable Terms / Payment / Scope Presets
  listPresets: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { presetType, acType, quotationType } = req.query;
      const where: any = { isActive: true };

      if (presetType) {
        where.presetType = String(presetType).toUpperCase();
      }

      if (acType) {
        where.acType = {
          in: [String(acType).toUpperCase(), 'ALL'],
        };
      }

      if (quotationType) {
        where.quotationType = {
          in: [String(quotationType).toUpperCase(), 'ALL'],
        };
      }

      const presets = await prisma.quotationPreset.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      res.json({ success: true, data: presets });
    } catch (err: any) {
      console.error('[List Presets Error]', err);
      res.status(500).json({ success: false, message: 'Failed to list presets.' });
    }
  },

  // 12. Create Preset
  createPreset: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { title, presetType, acType = 'ALL', quotationType = 'ALL', content, metadata, isDefault = false } = req.body;

      if (!title || !presetType || !content) {
        res.status(400).json({ success: false, message: 'Title, presetType, and content are required.' });
        return;
      }

      const preset = await prisma.quotationPreset.create({
        data: {
          title: String(title).trim(),
          presetType: String(presetType).toUpperCase(),
          acType: String(acType || 'ALL').toUpperCase(),
          quotationType: String(quotationType || 'ALL').toUpperCase(),
          content: String(content).trim(),
          metadata: metadata ? String(metadata) : null,
          isDefault: Boolean(isDefault),
          isActive: true,
        },
      });

      res.status(201).json({ success: true, message: 'Preset created.', data: preset });
    } catch (err: any) {
      console.error('[Create Preset Error]', err);
      res.status(500).json({ success: false, message: 'Failed to create preset.' });
    }
  },

  // 13. Update Preset
  updatePreset: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { title, presetType, acType, quotationType, content, metadata, isDefault, isActive } = req.body;

      const existing = await prisma.quotationPreset.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Preset not found.' });
        return;
      }

      const updated = await prisma.quotationPreset.update({
        where: { id },
        data: {
          ...(title !== undefined ? { title: String(title).trim() } : {}),
          ...(presetType !== undefined ? { presetType: String(presetType).toUpperCase() } : {}),
          ...(acType !== undefined ? { acType: String(acType).toUpperCase() } : {}),
          ...(quotationType !== undefined ? { quotationType: String(quotationType).toUpperCase() } : {}),
          ...(content !== undefined ? { content: String(content).trim() } : {}),
          ...(metadata !== undefined ? { metadata: metadata ? String(metadata) : null } : {}),
          ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        },
      });

      res.json({ success: true, message: 'Preset updated.', data: updated });
    } catch (err: any) {
      console.error('[Update Preset Error]', err);
      res.status(500).json({ success: false, message: 'Failed to update preset.' });
    }
  },

  // 14. Delete / Deactivate Preset
  deletePreset: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await prisma.quotationPreset.update({
        where: { id },
        data: { isActive: false },
      });
      res.json({ success: true, message: 'Preset deactivated.' });
    } catch (err: any) {
      console.error('[Delete Preset Error]', err);
      res.status(500).json({ success: false, message: 'Failed to delete preset.' });
    }
  },
};

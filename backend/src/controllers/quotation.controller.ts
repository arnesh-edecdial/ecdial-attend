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
      hasLowSide,
      items,
      cgstPercent,
      sgstPercent,
      termsAndConditions,
      paymentMethod,
      status,
      notes,
    } = req.body;

    try {
      const todayStr = getTodayDateString();
      const quotationNumber = await generateNextQuotationNumber();

      const config = (await prisma.quotationConfig.findFirst()) || {
        defaultCgstPercent: 9.0,
        defaultSgstPercent: 9.0,
        defaultTerms: '1. AC Price inclusive of 18% taxes.',
        defaultPaymentMethod: '100% with PO.',
      };

      const cgst = cgstPercent !== undefined ? Number(cgstPercent) : config.defaultCgstPercent;
      const sgst = sgstPercent !== undefined ? Number(sgstPercent) : config.defaultSgstPercent;
      const terms = termsAndConditions || config.defaultTerms;
      const payment = paymentMethod || config.defaultPaymentMethod;

      const rawItems = Array.isArray(items) ? items : [];
      const processedItems: any[] = [];
      const stockWarnings: string[] = [];

      for (let index = 0; index < rawItems.length; index++) {
        const item = rawItems[index];
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unitPrice) || 0;
        const itemAmount = roundCurrency(qty * price);

        if (item.productId) {
          const prod = await prisma.product.findUnique({ where: { id: item.productId } });
          if (prod && prod.availableStock < qty) {
            stockWarnings.push(
              `Requested quantity (${qty}) for '${prod.name}' exceeds available warehouse stock (${prod.availableStock}).`
            );
          }
        }

        processedItems.push({
          section: item.section || 'MAIN_UNIT',
          productId: item.productId || null,
          itemOrder: index + 1,
          description: item.description || 'AC Equipment / Material',
          quantity: qty,
          unit: item.unit || 'Nos',
          unitPrice: price,
          amount: itemAmount,
          notes: item.notes || '',
        });
      }

      const totals = calculateQuotationTotals(processedItems, Boolean(hasLowSide), cgst, sgst);
      const finalCustName = customerName ? String(customerName).trim() : '';
      const finalCustAddr = customerAddress ? String(customerAddress).trim() : '';

      // Create Quotation with Items in Supabase DB
      const newQuotation = await prisma.quotation.create({
        data: {
          quotationNumber,
          revisionNumber: 1,
          date: todayStr,
          customerId: customerId || null,
          customerName: finalCustName,
          customerAddress: finalCustAddr,
          customerPhone: customerPhone ? String(customerPhone).trim() : null,
          customerEmail: customerEmail ? String(customerEmail).trim() : null,
          customerLocation: customerLocation ? String(customerLocation).trim() : finalCustAddr,
          createdById: req.user.id,
          hasLowSide: Boolean(hasLowSide),
          mainUnitTotal: totals.mainUnitTotal,
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
        customerId: q.customerId,
        customer: q.customer,
        customerName: q.customerName || q.customer?.name || '',
        customerAddress: q.customerAddress || q.customer?.address || '',
        customerPhone: q.customerPhone || q.customer?.mobile || '',
        customerEmail: q.customerEmail || q.customer?.email || '',
        customerLocation: q.customerLocation || q.customer?.address || '',
        createdById: q.createdById,
        createdByName: q.createdBy?.name || 'Sales Rep',
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
      hasLowSide,
      items,
      cgstPercent,
      sgstPercent,
      termsAndConditions,
      paymentMethod,
      status,
      notes,
    } = req.body;

    try {
      const quotation = await prisma.quotation.findUnique({ where: { id } });
      if (!quotation) {
        res.status(404).json({ success: false, message: 'Quotation not found.' });
        return;
      }

      if (req.user && req.user.role === 'SALES' && quotation.createdById !== req.user.id) {
        res.status(403).json({ success: false, message: 'Access denied.' });
        return;
      }

      const cgst = cgstPercent !== undefined ? Number(cgstPercent) : quotation.cgstPercent;
      const sgst = sgstPercent !== undefined ? Number(sgstPercent) : quotation.sgstPercent;
      const rawItems = Array.isArray(items) ? items : [];

      const processedItems: any[] = [];
      rawItems.forEach((item: any, idx: number) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unitPrice) || 0;
        processedItems.push({
          quotationId: quotation.id,
          section: item.section || 'MAIN_UNIT',
          productId: item.productId || null,
          itemOrder: idx + 1,
          description: item.description || 'AC Material',
          quantity: qty,
          unit: item.unit || 'Nos',
          unitPrice: price,
          amount: roundCurrency(qty * price),
          notes: item.notes || '',
        });
      });

      const totals = calculateQuotationTotals(
        processedItems,
        hasLowSide !== undefined ? Boolean(hasLowSide) : quotation.hasLowSide,
        cgst,
        sgst
      );

      // Execute in transaction: delete old items and insert updated items
      await prisma.$transaction([
        prisma.quotationItem.deleteMany({ where: { quotationId: id } }),
        ...(processedItems.length > 0
          ? [prisma.quotationItem.createMany({ data: processedItems })]
          : []),
        prisma.quotation.update({
          where: { id },
          data: {
            ...(customerName ? { customerName: customerName.trim() } : {}),
            ...(customerAddress ? { customerAddress: customerAddress.trim() } : {}),
            ...(customerPhone !== undefined ? { customerPhone: customerPhone ? customerPhone.trim() : null } : {}),
            ...(customerEmail !== undefined ? { customerEmail: customerEmail ? customerEmail.trim() : null } : {}),
            ...(customerLocation !== undefined ? { customerLocation: customerLocation ? customerLocation.trim() : null } : {}),
            ...(hasLowSide !== undefined ? { hasLowSide: Boolean(hasLowSide) } : {}),
            mainUnitTotal: totals.mainUnitTotal,
            lowSideTotal: totals.lowSideTotal,
            subtotal: totals.subtotal,
            cgstPercent: cgst,
            cgstAmount: totals.cgstAmount,
            sgstPercent: sgst,
            sgstAmount: totals.sgstAmount,
            grandTotal: totals.grandTotal,
            ...(termsAndConditions ? { termsAndConditions } : {}),
            ...(paymentMethod ? { paymentMethod } : {}),
            ...(status ? { status } : {}),
            ...(notes !== undefined ? { notes } : {}),
          },
        }),
      ]);

      const updated = await prisma.quotation.findUnique({
        where: { id },
        include: { items: true },
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

  // 7. Update Status
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

  // 8. Dynamic Professional PDF Generation
  downloadPdf: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const quotation = await prisma.quotation.findFirst({
        where: {
          OR: [{ id }, { quotationNumber: id }],
        },
        include: {
          items: { orderBy: { itemOrder: 'asc' } },
          createdBy: true,
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
        customerName: quotation.customerName,
        customerAddress: quotation.customerAddress,
        customerPhone: quotation.customerPhone,
        customerEmail: quotation.customerEmail,
        createdByName: quotation.createdBy?.name || 'ECDIAL Sales Rep',
        createdByEmail: quotation.createdBy?.email || 'sales@ecdial.com',
        hasLowSide: quotation.hasLowSide,
        mainUnitTotal: quotation.mainUnitTotal,
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
          quantity: m.quantity,
          unit: m.unit,
          unitPrice: m.unitPrice,
          amount: m.amount,
        })),
        lowSideItems: lowSideItems.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
          amount: l.amount,
        })),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Quotation_${quotation.quotationNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error('[PDF Generation Error]', err);
      res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
    }
  },

  // 9. Delete Quotation (Rule 19)
  deleteQuotation: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const existing = await prisma.quotation.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Quotation not found.' });
        return;
      }

      // Permissions: ADMIN, MANAGER, IT_ADMIN, SALES or the salesman who created it
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
};

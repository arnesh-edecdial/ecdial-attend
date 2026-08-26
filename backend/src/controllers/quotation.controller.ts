import { Response } from 'express';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { calculateQuotationTotals, getTodayDateString, roundCurrency } from '../utils/calculations';
import { generateQuotationPDF } from '../services/pdf.service';

/**
 * Generate sequential formatted quotation number e.g. ECD-Q-2026-00125
 */
function generateNextQuotationNumber(): string {
  const currentYear = new Date().getFullYear();
  const count = inMemoryDB.quotations.length + 1;
  const seq = String(count + 100).padStart(5, '0');
  return `ECD-Q-${currentYear}-${seq}`;
}

export const quotationController = {
  // 1. Get Quotation System Configuration (GST rates, terms, payment methods, units)
  getConfig: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({
      success: true,
      data: inMemoryDB.quotationConfig,
    });
  },

  // 2. Update Configuration (Admin only)
  updateConfig: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { defaultCgstPercent, defaultSgstPercent, defaultTerms, defaultPaymentMethod, availableUnits } = req.body;

    inMemoryDB.quotationConfig = {
      ...inMemoryDB.quotationConfig,
      defaultCgstPercent: defaultCgstPercent !== undefined ? Number(defaultCgstPercent) : inMemoryDB.quotationConfig.defaultCgstPercent,
      defaultSgstPercent: defaultSgstPercent !== undefined ? Number(defaultSgstPercent) : inMemoryDB.quotationConfig.defaultSgstPercent,
      defaultTerms: defaultTerms !== undefined ? defaultTerms : inMemoryDB.quotationConfig.defaultTerms,
      defaultPaymentMethod: defaultPaymentMethod !== undefined ? defaultPaymentMethod : inMemoryDB.quotationConfig.defaultPaymentMethod,
      availableUnits: availableUnits !== undefined ? availableUnits : inMemoryDB.quotationConfig.availableUnits,
      updatedAt: new Date(),
    };

    res.json({
      success: true,
      message: 'Quotation settings updated.',
      data: inMemoryDB.quotationConfig,
    });
  },

  // 3. Create Fast New Quotation (Requires only Customer Name & Customer Address)
  createQuotation: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

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

    // Minimum requirement: Customer Name and Customer Address
    if (!customerName || !customerName.trim()) {
      res.status(400).json({ success: false, message: 'Customer Name is required.' });
      return;
    }

    if (!customerAddress || !customerAddress.trim()) {
      res.status(400).json({ success: false, message: 'Customer Address is required.' });
      return;
    }

    const todayStr = getTodayDateString();
    const quotationNumber = generateNextQuotationNumber();

    // Default configuration values
    const config = inMemoryDB.quotationConfig;
    const cgst = cgstPercent !== undefined ? Number(cgstPercent) : config.defaultCgstPercent;
    const sgst = sgstPercent !== undefined ? Number(sgstPercent) : config.defaultSgstPercent;
    const terms = termsAndConditions || config.defaultTerms;
    const payment = paymentMethod || config.defaultPaymentMethod;

    // Prepare quotation items and check stock warnings (stock is NOT reduced)
    const processedItems: any[] = [];
    const rawItems = Array.isArray(items) ? items : [];
    const stockWarnings: string[] = [];

    rawItems.forEach((item: any, index: number) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const itemAmount = roundCurrency(qty * price);

      if (item.productId) {
        const prod = inMemoryDB.products.find((p) => p.id === item.productId);
        if (prod && prod.availableStock < qty) {
          stockWarnings.push(`'${item.description}' exceeds current available stock (Requested: ${qty}, Available: ${prod.availableStock})`);
        }
      }

      processedItems.push({
        id: `qitem-${Date.now()}-${index}`,
        section: item.section || 'MAIN_UNIT',
        productId: item.productId || null,
        itemOrder: index + 1,
        description: item.description || 'AC Equipment',
        quantity: qty,
        unit: item.unit || 'Nos',
        unitPrice: price,
        amount: itemAmount,
        notes: item.notes || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Authoritative calculations
    const totals = calculateQuotationTotals(processedItems, Boolean(hasLowSide), cgst, sgst);

    const quotationId = `quot-${Date.now()}`;
    const newQuotation = {
      id: quotationId,
      quotationNumber,
      revisionNumber: 1,
      originalQuotationId: null,
      date: todayStr,
      customerName: customerName.trim(),
      customerAddress: customerAddress.trim(),
      customerPhone: customerPhone || null,
      customerEmail: customerEmail || null,
      customerLocation: customerLocation || null,
      createdById: req.user.id,
      hasLowSide: Boolean(hasLowSide),
      mainUnitTotal: totals.mainUnitTotal,
      lowSideTotal: totals.lowSideTotal,
      subtotal: totals.subtotal,
      cgstPercent: totals.cgstPercent,
      cgstAmount: totals.cgstAmount,
      sgstPercent: totals.sgstPercent,
      sgstAmount: totals.sgstAmount,
      grandTotal: totals.grandTotal,
      termsAndConditions: terms,
      paymentMethod: payment,
      status: status || 'DRAFT', // 'DRAFT' | 'FINAL' | 'SENT'
      notes: notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryDB.quotations.push(newQuotation);
    processedItems.forEach((pi) => {
      pi.quotationId = quotationId;
      inMemoryDB.quotationItems.push(pi);
    });

    // Audit log
    inMemoryDB.auditLogs.push({
      id: `aud-${Date.now()}`,
      employeeId: req.user.id,
      employeeName: req.user.name,
      action: 'QUOTATION_CREATED',
      date: todayStr,
      timestamp: new Date(),
      method: 'SALES_PORTAL',
      performedById: req.user.id,
      details: JSON.stringify({
        quotationNumber,
        customerName: newQuotation.customerName,
        grandTotal: totals.grandTotal,
        itemCount: processedItems.length,
      }),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: `Quotation ${quotationNumber} created successfully.`,
      data: {
        ...newQuotation,
        items: processedItems,
        stockWarnings: stockWarnings.length > 0 ? stockWarnings : null,
      },
    });
  },

  // 4. List Quotations with Filters
  listQuotations: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const status = req.query.status as string;
    const search = (req.query.search as string)?.toLowerCase();
    const createdBy = req.query.createdBy as string;

    let list = [...inMemoryDB.quotations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Sales reps view their own quotations unless admin/manager
    if (req.user && req.user.role === 'SALES') {
      list = list.filter((q) => q.createdById === req.user!.id);
    } else if (createdBy) {
      list = list.filter((q) => q.createdById === createdBy);
    }

    if (status) {
      list = list.filter((q) => q.status === status);
    }

    if (search) {
      list = list.filter(
        (q) =>
          q.quotationNumber.toLowerCase().includes(search) ||
          q.customerName.toLowerCase().includes(search) ||
          q.customerAddress.toLowerCase().includes(search)
      );
    }

    const formattedList = list.map((q) => {
      const creator = inMemoryDB.users.find((u) => u.id === q.createdById);
      const itemsCount = inMemoryDB.quotationItems.filter((qi) => qi.quotationId === q.id).length;
      return {
        ...q,
        createdByName: creator?.name || 'Sales Rep',
        itemsCount,
      };
    });

    res.json({
      success: true,
      data: formattedList,
    });
  },

  // 5. Get Quotation By ID (Details & Item Breakdown)
  getQuotationById: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params.id;
    const quotation = inMemoryDB.quotations.find((q) => q.id === id || q.quotationNumber === id);

    if (!quotation) {
      res.status(404).json({ success: false, message: 'Quotation not found.' });
      return;
    }

    const items = inMemoryDB.quotationItems
      .filter((qi) => qi.quotationId === quotation.id)
      .sort((a, b) => a.itemOrder - b.itemOrder);

    const creator = inMemoryDB.users.find((u) => u.id === quotation.createdById);

    res.json({
      success: true,
      data: {
        ...quotation,
        createdByName: creator?.name || 'Sales Rep',
        createdByEmail: creator?.email || 'sales@ecdial.com',
        items,
      },
    });
  },

  // 6. Update Quotation (or create revision if finalized)
  updateQuotation: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params.id;
    const quotation = inMemoryDB.quotations.find((q) => q.id === id || q.quotationNumber === id);

    if (!quotation) {
      res.status(404).json({ success: false, message: 'Quotation not found.' });
      return;
    }

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

    const cgst = cgstPercent !== undefined ? Number(cgstPercent) : quotation.cgstPercent;
    const sgst = sgstPercent !== undefined ? Number(sgstPercent) : quotation.sgstPercent;

    // Process updated items
    const rawItems = Array.isArray(items) ? items : [];
    const processedItems: any[] = [];

    rawItems.forEach((item: any, index: number) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const itemAmount = roundCurrency(qty * price);

      processedItems.push({
        id: item.id || `qitem-${Date.now()}-${index}`,
        quotationId: quotation.id,
        section: item.section || 'MAIN_UNIT',
        productId: item.productId || null,
        itemOrder: index + 1,
        description: item.description || 'Equipment',
        quantity: qty,
        unit: item.unit || 'Nos',
        unitPrice: price,
        amount: itemAmount,
        notes: item.notes || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const totals = calculateQuotationTotals(processedItems, Boolean(hasLowSide !== undefined ? hasLowSide : quotation.hasLowSide), cgst, sgst);

    // If quotation was already finalized and being revised, increase revision number
    if (quotation.status === 'FINAL' || quotation.status === 'SENT') {
      quotation.revisionNumber = (quotation.revisionNumber || 1) + 1;
    }

    quotation.customerName = customerName !== undefined ? customerName.trim() : quotation.customerName;
    quotation.customerAddress = customerAddress !== undefined ? customerAddress.trim() : quotation.customerAddress;
    quotation.customerPhone = customerPhone !== undefined ? customerPhone : quotation.customerPhone;
    quotation.customerEmail = customerEmail !== undefined ? customerEmail : quotation.customerEmail;
    quotation.customerLocation = customerLocation !== undefined ? customerLocation : quotation.customerLocation;
    quotation.hasLowSide = hasLowSide !== undefined ? Boolean(hasLowSide) : quotation.hasLowSide;
    quotation.mainUnitTotal = totals.mainUnitTotal;
    quotation.lowSideTotal = totals.lowSideTotal;
    quotation.subtotal = totals.subtotal;
    quotation.cgstPercent = totals.cgstPercent;
    quotation.cgstAmount = totals.cgstAmount;
    quotation.sgstPercent = totals.sgstPercent;
    quotation.sgstAmount = totals.sgstAmount;
    quotation.grandTotal = totals.grandTotal;
    quotation.termsAndConditions = termsAndConditions !== undefined ? termsAndConditions : quotation.termsAndConditions;
    quotation.paymentMethod = paymentMethod !== undefined ? paymentMethod : quotation.paymentMethod;
    quotation.status = status !== undefined ? status : quotation.status;
    quotation.notes = notes !== undefined ? notes : quotation.notes;
    quotation.updatedAt = new Date();

    // Replace items
    inMemoryDB.quotationItems = inMemoryDB.quotationItems.filter((qi) => qi.quotationId !== quotation.id);
    processedItems.forEach((pi) => inMemoryDB.quotationItems.push(pi));

    // Audit log
    inMemoryDB.auditLogs.push({
      id: `aud-${Date.now()}`,
      employeeId: req.user?.id,
      employeeName: req.user?.name || 'Sales',
      action: 'QUOTATION_UPDATED',
      date: getTodayDateString(),
      timestamp: new Date(),
      method: 'SALES_PORTAL',
      performedById: req.user?.id,
      details: JSON.stringify({
        quotationNumber: quotation.quotationNumber,
        revision: quotation.revisionNumber,
        grandTotal: totals.grandTotal,
      }),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: `Quotation ${quotation.quotationNumber} updated successfully.`,
      data: {
        ...quotation,
        items: processedItems,
      },
    });
  },

  // 7. Update Quotation Status (DRAFT, FINAL, SENT, ACCEPTED, REJECTED, EXPIRED)
  updateStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params.id;
    const { status } = req.body;

    const allowed = ['DRAFT', 'FINAL', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowed.join(', ')}` });
      return;
    }

    const quotation = inMemoryDB.quotations.find((q) => q.id === id || q.quotationNumber === id);
    if (!quotation) {
      res.status(404).json({ success: false, message: 'Quotation not found.' });
      return;
    }

    quotation.status = status;
    quotation.updatedAt = new Date();

    res.json({
      success: true,
      message: `Quotation status updated to ${status}.`,
      data: quotation,
    });
  },

  // 8. Download / Stream Professional A4 PDF
  downloadPdf: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params.id;
    const quotation = inMemoryDB.quotations.find((q) => q.id === id || q.quotationNumber === id);

    if (!quotation) {
      res.status(404).json({ success: false, message: 'Quotation not found.' });
      return;
    }

    const items = inMemoryDB.quotationItems
      .filter((qi) => qi.quotationId === quotation.id)
      .sort((a, b) => a.itemOrder - b.itemOrder);

    const mainItems = items.filter((i) => i.section === 'MAIN_UNIT');
    const lowSideItems = items.filter((i) => i.section === 'LOW_SIDE');
    const creator = inMemoryDB.users.find((u) => u.id === quotation.createdById);

    try {
      const pdfBuffer = await generateQuotationPDF({
        quotationNumber: quotation.quotationNumber,
        revisionNumber: quotation.revisionNumber,
        date: quotation.date,
        customerName: quotation.customerName,
        customerAddress: quotation.customerAddress,
        customerPhone: quotation.customerPhone,
        customerEmail: quotation.customerEmail,
        createdByName: creator?.name || 'ECDIAL Sales Executive',
        createdByEmail: creator?.email || 'sales@ecdial.com',
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
        mainItems,
        lowSideItems,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Quotation_${quotation.quotationNumber}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Failed to generate quotation PDF: ' + err.message });
    }
  },
};

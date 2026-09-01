import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const customerController = {
  // 1. List Customers (Newest First, Multi-field Search, Pagination)
  listCustomers: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const search = (req.query.search as string)?.trim();
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const skip = (page - 1) * limit;

      const whereClause: any = {};
      if (search && search.length > 0) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { mobile: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [customers, totalCount] = await Promise.all([
        prisma.customer.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            _count: {
              select: { quotations: true },
            },
          },
        }),
        prisma.customer.count({ where: whereClause }),
      ]);

      res.json({
        success: true,
        data: customers,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
      });
    } catch (err: any) {
      console.error('[List Customers Error]', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve customers.' });
    }
  },

  // 2. Get Single Customer
  getCustomer: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          quotations: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              quotationNumber: true,
              date: true,
              grandTotal: true,
              status: true,
            },
          },
        },
      });

      if (!customer) {
        res.status(404).json({ success: false, message: 'Customer not found.' });
        return;
      }

      res.json({ success: true, data: customer });
    } catch (err: any) {
      console.error('[Get Customer Error]', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve customer.' });
    }
  },

  // 3. Create Customer (All fields optional, instant creation)
  createCustomer: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name, address, mobile, email, notes } = req.body;

      const cleanName = name ? String(name).trim() : null;
      const cleanAddress = address ? String(address).trim() : null;
      const cleanMobile = mobile ? String(mobile).trim() : null;
      const cleanEmail = email ? String(email).trim() : null;
      const cleanNotes = notes ? String(notes).trim() : null;

      // Allow creating customer even if only one field is provided
      const finalName = cleanName || (cleanMobile ? `Customer (${cleanMobile})` : cleanAddress ? `Customer (${cleanAddress})` : 'New Customer');

      const customer = await prisma.customer.create({
        data: {
          name: finalName,
          address: cleanAddress,
          mobile: cleanMobile,
          email: cleanEmail,
          notes: cleanNotes,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Customer saved successfully.',
        data: customer,
      });
    } catch (err: any) {
      console.error('[Create Customer Error]', err);
      res.status(500).json({ success: false, message: 'Failed to create customer.' });
    }
  },

  // 4. Update Customer
  updateCustomer: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, address, mobile, email, notes } = req.body;

      const existing = await prisma.customer.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Customer not found.' });
        return;
      }

      const updated = await prisma.customer.update({
        where: { id },
        data: {
          name: name !== undefined ? String(name).trim() : existing.name,
          address: address !== undefined ? String(address).trim() : existing.address,
          mobile: mobile !== undefined ? String(mobile).trim() : existing.mobile,
          email: email !== undefined ? String(email).trim() : existing.email,
          notes: notes !== undefined ? String(notes).trim() : existing.notes,
        },
      });

      res.json({
        success: true,
        message: 'Customer updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      console.error('[Update Customer Error]', err);
      res.status(500).json({ success: false, message: 'Failed to update customer.' });
    }
  },

  // 5. Delete Customer
  deleteCustomer: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await prisma.customer.delete({ where: { id } });
      res.json({ success: true, message: 'Customer deleted successfully.' });
    } catch (err: any) {
      console.error('[Delete Customer Error]', err);
      res.status(500).json({ success: false, message: 'Failed to delete customer.' });
    }
  },
};

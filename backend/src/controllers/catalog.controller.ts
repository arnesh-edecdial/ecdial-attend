import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const catalogController = {
  // 1. List Products (Sales sees only active products; Admin sees all)
  listProducts: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const category = req.query.category as string; // 'MAIN_UNIT' | 'LOW_SIDE'
    const search = (req.query.search as string)?.toLowerCase().trim();
    const activeOnly = req.query.activeOnly === 'true' || req.user?.role === 'SALES';

    try {
      const products = await prisma.product.findMany({
        where: {
          ...(activeOnly ? { isActive: true } : {}),
          ...(category ? { category } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as any } },
                  { description: { contains: search, mode: 'insensitive' as any } },
                  { model: { contains: search, mode: 'insensitive' as any } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: products,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to list products.' });
    }
  },

  // 2. Add Machine Model / Product (Admin Only)
  createProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const {
      name,
      model,
      category = 'MAIN_UNIT',
      description,
      defaultUnit = 'Nos',
      defaultPrice,
      availableStock = 10,
      imageUrl,
    } = req.body;

    if (!name || defaultPrice === undefined) {
      res.status(400).json({ success: false, message: 'Product name and price are required.' });
      return;
    }

    try {
      const newProduct = await prisma.product.create({
        data: {
          name: name.trim(),
          model: model ? model.trim() : null,
          category,
          description: description ? description.trim() : `${name} (${category})`,
          defaultUnit: defaultUnit || 'Nos',
          defaultPrice: Number(defaultPrice) || 0,
          availableStock: availableStock !== undefined ? Number(availableStock) : 0,
          imageUrl: imageUrl || null,
          isActive: true,
        },
      });

      res.json({
        success: true,
        message: `Product '${newProduct.name}' added successfully.`,
        data: newProduct,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to create product.' });
    }
  },

  // 3. Update Machine Model / Product (Admin Only)
  updateProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
      name,
      model,
      category,
      description,
      defaultUnit,
      defaultPrice,
      availableStock,
      imageUrl,
      isActive,
    } = req.body;

    try {
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      const updated = await prisma.product.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name: name.trim() } : {}),
          ...(model !== undefined ? { model: model ? model.trim() : null } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(description !== undefined ? { description: description.trim() } : {}),
          ...(defaultUnit !== undefined ? { defaultUnit } : {}),
          ...(defaultPrice !== undefined ? { defaultPrice: Number(defaultPrice) } : {}),
          ...(availableStock !== undefined ? { availableStock: Number(availableStock) } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        },
      });

      res.json({
        success: true,
        message: `Product '${updated.name}' updated.`,
        data: updated,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update product.' });
    }
  },

  // 4. Toggle Product Active Status (Admin Only)
  toggleProductStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      const updated = await prisma.product.update({
        where: { id },
        data: { isActive: !existing.isActive },
      });

      res.json({
        success: true,
        message: `Product '${updated.name}' is now ${updated.isActive ? 'Active' : 'Disabled'}.`,
        data: updated,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to toggle product status.' });
    }
  },

  // 5. Delete Product (Admin Only)
  deleteProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const existing = await prisma.product.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      await prisma.product.delete({ where: { id } });

      res.json({
        success: true,
        message: `Product '${existing.name}' deleted.`,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to delete product.' });
    }
  },
};

import { Response } from 'express';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const catalogController = {
  listProducts: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const category = req.query.category as string; // 'MAIN_UNIT' | 'LOW_SIDE'
    const search = (req.query.search as string)?.toLowerCase();

    let list = inMemoryDB.products.filter((p) => p.isActive);

    if (category) {
      list = list.filter((p) => p.category === category);
    }

    if (search) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          (p.model && p.model.toLowerCase().includes(search))
      );
    }

    res.json({
      success: true,
      data: list,
    });
  },

  createProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name, model, category, description, defaultUnit, defaultPrice, availableStock } = req.body;

    if (!name || !description || defaultPrice === undefined) {
      res.status(400).json({ success: false, message: 'Name, description, and default price are required.' });
      return;
    }

    const newProd = {
      id: `prod-${Date.now()}`,
      name,
      model: model || null,
      category: category || 'MAIN_UNIT',
      description,
      defaultUnit: defaultUnit || 'Nos',
      defaultPrice: Number(defaultPrice),
      availableStock: availableStock !== undefined ? Number(availableStock) : 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryDB.products.push(newProd);

    res.json({
      success: true,
      message: 'Product added to catalogue.',
      data: newProd,
    });
  },
};

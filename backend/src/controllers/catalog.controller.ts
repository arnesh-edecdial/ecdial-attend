import { Response } from 'express';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const catalogController = {
  // 1. List Products (Sales sees only active machines; Admin sees all)
  listProducts: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const category = req.query.category as string; // 'MAIN_UNIT' | 'LOW_SIDE'
    const search = (req.query.search as string)?.toLowerCase();
    const activeOnly = req.query.activeOnly === 'true' || req.user?.role === 'SALES';

    let list = inMemoryDB.products;

    if (activeOnly) {
      list = list.filter((p) => p.isActive);
    }

    if (category) {
      list = list.filter((p) => p.category === category);
    }

    if (search) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          (p.model && p.model.toLowerCase().includes(search)) ||
          (p.brand && p.brand.toLowerCase().includes(search))
      );
    }

    res.json({
      success: true,
      data: list,
    });
  },

  // 2. Add Machine Model / Product (Admin Only)
  createProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (req.user && req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Only Admin can add machine models.' });
      return;
    }

    const {
      name,
      brand,
      model,
      capacity,
      category,
      description,
      defaultUnit,
      defaultPrice,
      availableStock,
      image,
    } = req.body;

    if (!name || defaultPrice === undefined) {
      res.status(400).json({ success: false, message: 'Model name and price are required.' });
      return;
    }

    const newProd = {
      id: `prod-${Date.now()}`,
      name,
      brand: brand || 'Daikin',
      model: model || name,
      capacity: capacity || '1.5 Ton',
      category: category || 'MAIN_UNIT',
      description: description || `${brand || 'Daikin'} ${capacity || ''} Air Conditioner`,
      defaultUnit: defaultUnit || 'Nos',
      defaultPrice: Number(defaultPrice),
      availableStock: availableStock !== undefined ? Number(availableStock) : 10,
      image: image || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryDB.products.push(newProd);

    res.json({
      success: true,
      message: `Machine Model '${newProd.name}' added successfully.`,
      data: newProd,
    });
  },

  // 3. Update Machine Model (Admin Only)
  updateProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (req.user && req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Only Admin can modify machine models.' });
      return;
    }

    const { id } = req.params;
    const prod = inMemoryDB.products.find((p) => p.id === id);

    if (!prod) {
      res.status(404).json({ success: false, message: 'Machine model not found.' });
      return;
    }

    const {
      name,
      brand,
      model,
      capacity,
      description,
      defaultUnit,
      defaultPrice,
      availableStock,
      image,
      isActive,
    } = req.body;

    if (name !== undefined) prod.name = name;
    if (brand !== undefined) prod.brand = brand;
    if (model !== undefined) prod.model = model;
    if (capacity !== undefined) prod.capacity = capacity;
    if (description !== undefined) prod.description = description;
    if (defaultUnit !== undefined) prod.defaultUnit = defaultUnit;
    if (defaultPrice !== undefined) prod.defaultPrice = Number(defaultPrice);
    if (availableStock !== undefined) prod.availableStock = Number(availableStock);
    if (image !== undefined) prod.image = image;
    if (isActive !== undefined) prod.isActive = Boolean(isActive);
    prod.updatedAt = new Date();

    res.json({
      success: true,
      message: `Machine Model '${prod.name}' updated.`,
      data: prod,
    });
  },

  // 4. Toggle Active Status (Admin Only)
  toggleProductStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (req.user && req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Only Admin can change machine model status.' });
      return;
    }

    const { id } = req.params;
    const prod = inMemoryDB.products.find((p) => p.id === id);

    if (!prod) {
      res.status(404).json({ success: false, message: 'Machine model not found.' });
      return;
    }

    prod.isActive = !prod.isActive;
    prod.updatedAt = new Date();

    res.json({
      success: true,
      message: `Machine Model '${prod.name}' is now ${prod.isActive ? 'Active' : 'Disabled'}.`,
      data: prod,
    });
  },

  // 5. Delete Machine Model (Admin Only)
  deleteProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (req.user && req.user.role !== 'ADMIN') {
      res.status(403).json({ success: false, message: 'Only Admin can delete machine models.' });
      return;
    }

    const { id } = req.params;
    const idx = inMemoryDB.products.findIndex((p) => p.id === id);

    if (idx === -1) {
      res.status(404).json({ success: false, message: 'Machine model not found.' });
      return;
    }

    const deleted = inMemoryDB.products.splice(idx, 1)[0];

    res.json({
      success: true,
      message: `Machine Model '${deleted.name}' deleted.`,
    });
  },
};

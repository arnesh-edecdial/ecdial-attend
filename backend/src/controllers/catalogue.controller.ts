import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { catalogueSyncService } from '../services/catalogueSync.service';

const ADMIN_MANAGEMENT_ROLES = ['ADMIN', 'IT_ADMIN', 'MANAGER'] as const;

export const catalogueController = {
  /**
   * 1. List all available AC catalogues and brochures (All authenticated employees)
   */
  listCatalogues: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { category, search } = req.query;

      const where: any = {};
      if (category && typeof category === 'string' && category !== 'ALL') {
        where.category = { equals: category, mode: 'insensitive' };
      }
      if (search && typeof search === 'string' && search.trim().length > 0) {
        const q = search.trim();
        where.OR = [
          { displayName: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ];
      }

      const catalogues = await prisma.catalogue.findMany({
        where,
        orderBy: [{ category: 'asc' }, { displayName: 'asc' }],
      });

      res.json({
        success: true,
        data: catalogues,
      });
    } catch (err: any) {
      console.error('[List Catalogues Error]', err);
      res.status(500).json({ success: false, message: 'Failed to fetch catalogues.' });
    }
  },

  /**
   * 2. Get Single Catalogue Metadata
   */
  getById: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const catalogue = await prisma.catalogue.findUnique({
        where: { id },
      });

      if (!catalogue) {
        res.status(404).json({ success: false, message: 'Catalogue not found.' });
        return;
      }

      res.json({
        success: true,
        data: catalogue,
      });
    } catch (err: any) {
      console.error('[Get Catalogue Error]', err);
      res.status(500).json({ success: false, message: 'Failed to fetch catalogue.' });
    }
  },

  /**
   * 3. Rename & Edit Catalogue Metadata (Admin Only)
   */
  renameCatalogue: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { displayName, model, category, description } = req.body;

      const isAdmin = Boolean(req.user?.role && (ADMIN_MANAGEMENT_ROLES as readonly string[]).includes(req.user.role));
      if (!isAdmin) {
        res.status(403).json({ success: false, message: 'Only Admins can edit catalogue details.' });
        return;
      }

      if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
        res.status(400).json({ success: false, message: 'A valid catalogue name is required.' });
        return;
      }

      const existing = await prisma.catalogue.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Catalogue record not found.' });
        return;
      }

      const updated = await prisma.catalogue.update({
        where: { id },
        data: {
          displayName: displayName.trim(),
          ...(model !== undefined ? { model: model ? model.trim() : null } : {}),
          ...(category !== undefined ? { category: category ? category.trim() : 'Catalogue' } : {}),
          ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
        },
      });

      res.json({
        success: true,
        message: 'Catalogue updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      console.error('[Rename Catalogue Error]', err);
      res.status(500).json({ success: false, message: 'Failed to update catalogue.' });
    }
  },

  /**
   * 4. Upload New Catalogue / Brochure PDF (Admin Only)
   */
  uploadDocument: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const isAdmin = Boolean(req.user?.role && (ADMIN_MANAGEMENT_ROLES as readonly string[]).includes(req.user.role));
      if (!isAdmin) {
        res.status(403).json({ success: false, message: 'Only Admins can upload catalogues/brochures.' });
        return;
      }

      const { displayName, category = 'Catalogue', description, model, fileBase64, fileName } = req.body;

      if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
        res.status(400).json({ success: false, message: 'Document name is required.' });
        return;
      }

      if (!fileBase64 || typeof fileBase64 !== 'string') {
        res.status(400).json({ success: false, message: 'File payload is required.' });
        return;
      }

      // Convert base64 data to buffer
      // Handle optional data URI prefix e.g. "data:application/pdf;base64,..."
      const rawBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '').trim();
      const fileBuffer = Buffer.from(rawBase64, 'base64');

      if (fileBuffer.length < 100) {
        res.status(400).json({ success: false, message: 'Invalid or empty file payload.' });
        return;
      }

      const sanitizedName = displayName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '_');
      const safeExtension = fileName && fileName.toLowerCase().endsWith('.pdf') ? '.pdf' : '.pdf';
      const storageFileName = `${sanitizedName}_${Date.now()}${safeExtension}`;

      const cataloguesDir = path.resolve(__dirname, '../../assets/catalogues');
      if (!fs.existsSync(cataloguesDir)) {
        fs.mkdirSync(cataloguesDir, { recursive: true });
      }

      const destinationPath = path.join(cataloguesDir, storageFileName);
      fs.writeFileSync(destinationPath, fileBuffer);

      const created = await prisma.catalogue.create({
        data: {
          displayName: displayName.trim(),
          fileName: storageFileName,
          category: category ? String(category).trim() : 'Catalogue',
          description: description ? String(description).trim() : null,
          model: model ? String(model).trim() : 'AC Unit / Brochure',
          uploadedById: req.user?.id || null,
          fileSize: fileBuffer.length,
        },
      });

      res.status(201).json({
        success: true,
        message: 'Document uploaded and registered successfully.',
        data: created,
      });
    } catch (err: any) {
      console.error('[Upload Document Error]', err);
      res.status(500).json({ success: false, message: 'Failed to upload document.' });
    }
  },

  /**
   * 5. Delete Catalogue / Brochure (Admin Only)
   */
  deleteCatalogue: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const isAdmin = Boolean(req.user?.role && (ADMIN_MANAGEMENT_ROLES as readonly string[]).includes(req.user.role));
      if (!isAdmin) {
        res.status(403).json({ success: false, message: 'Only Admins can delete catalogues.' });
        return;
      }

      const existing = await prisma.catalogue.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Catalogue not found.' });
        return;
      }

      // Remove physical file from disk if present
      const filePath = catalogueSyncService.getCatalogueFilePath(existing.fileName);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn('[Delete Catalogue Unlink Warning]', unlinkErr);
        }
      }

      await prisma.catalogue.delete({ where: { id } });

      res.json({
        success: true,
        message: 'Catalogue deleted successfully.',
        data: { id },
      });
    } catch (err: any) {
      console.error('[Delete Catalogue Error]', err);
      res.status(500).json({ success: false, message: 'Failed to delete catalogue.' });
    }
  },

  /**
   * 6. Download / Stream Catalogue PDF
   */
  downloadCatalogue: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const catalogue = await prisma.catalogue.findUnique({ where: { id } });

      if (!catalogue) {
        res.status(404).json({ success: false, message: 'Catalogue record not found.' });
        return;
      }

      const filePath = catalogueSyncService.getCatalogueFilePath(catalogue.fileName);
      if (!filePath || !fs.existsSync(filePath)) {
        res.status(404).json({ success: false, message: 'Catalogue PDF file is missing on the server.' });
        return;
      }

      const sanitizedName = catalogue.displayName.replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim();
      const outputFilename = sanitizedName.toLowerCase().endsWith('.pdf') ? sanitizedName : `${sanitizedName}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${outputFilename}"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', (streamErr) => {
        console.error('[Catalogue Stream Error]', streamErr);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Failed to stream catalogue file.' });
        }
      });
      fileStream.pipe(res);
    } catch (err: any) {
      console.error('[Download Catalogue Error]', err);
      res.status(500).json({ success: false, message: 'Failed to download catalogue.' });
    }
  },
};

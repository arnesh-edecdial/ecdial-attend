import { Response } from 'express';
import fs from 'fs';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { catalogueSyncService } from '../services/catalogueSync.service';
import { storageClient, B2_BUCKET_NAME } from '../config/storage';
import {
  CATALOGUE_BUCKET,
  createSignedDownloadUrl,
  createSignedUploadUrl,
  deleteObject,
  ensureBucket,
  getObjectSize,
  maxUploadBytes,
  supabaseConfigured,
} from '../services/supabaseStorage.service';

const ADMIN_MANAGEMENT_ROLES = ['ADMIN', 'IT_ADMIN', 'MANAGER'] as const;

/**
 * Catalogue / brochure PDFs live in the same Backblaze B2 bucket as the product photos.
 * (The server runs serverless: its disk is read-only, so files can never be written to ./assets.)
 * Objects are stored under  <prefix>/<fileName>.  Override the folder with B2_CATALOGUE_PREFIX if needed.
 */
const CATALOGUE_PREFIX = (process.env.B2_CATALOGUE_PREFIX || 'catalogues').replace(/^\/+|\/+$/g, '');
const catalogueKey = (storedFileName: string) => `${CATALOGUE_PREFIX}/${storedFileName}`;

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
   * 4a. Step 1 of upload (Admin Only): validate, then hand back a signed URL so the browser can
   *     upload the PDF straight to Supabase Storage (no file passes through this server).
   */
  createUploadUrl: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!supabaseConfigured()) {
        res.status(503).json({ success: false, message: 'Supabase Storage is not configured (set SUPABASE_SERVICE_ROLE_KEY).' });
        return;
      }
      const { fileName, fileSize } = req.body || {};
      if (typeof fileName !== 'string' || !/\.pdf$/i.test(fileName)) {
        res.status(400).json({ success: false, message: 'Only .pdf files are allowed.' });
        return;
      }
      await ensureBucket();
      const limit = maxUploadBytes();
      if (Number(fileSize) > limit) {
        res.status(413).json({ success: false, message: `PDF exceeds the storage limit of ${Math.floor(limit / 1048576)} MB.` });
        return;
      }
      const safe = fileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_\-]+/g, '_').replace(/^_+|_+$/g, '') || 'catalogue';
      const storagePath = `${Date.now()}_${safe}.pdf`;
      const { uploadUrl } = await createSignedUploadUrl(storagePath);
      res.json({ success: true, data: { uploadUrl, storagePath, bucket: CATALOGUE_BUCKET, maxBytes: limit } });
    } catch (err: any) {
      console.error('[Create Upload URL Error]', err);
      res.status(500).json({ success: false, message: 'Failed to prepare upload.' });
    }
  },

  /**
   * 4b. Step 2 of upload (Admin Only): after the browser finished uploading, verify the object
   *     exists in Supabase and store its metadata (name, path, size, date) in the Catalogue table.
   */
  registerUpload: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { displayName, storagePath, category = 'Catalogue', description, model } = req.body || {};
      if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
        res.status(400).json({ success: false, message: 'Document name is required.' });
        return;
      }
      if (typeof storagePath !== 'string' || !/^[\w\-]+\.pdf$/i.test(storagePath)) {
        res.status(400).json({ success: false, message: 'Invalid storage path.' });
        return;
      }
      const size = await getObjectSize(storagePath);
      if (size === null) {
        res.status(400).json({ success: false, message: 'The file was not found in storage. Upload it again.' });
        return;
      }
      const existing = await prisma.catalogue.findFirst({ where: { storagePath } });
      if (existing) {
        res.json({ success: true, data: existing });
        return;
      }
      const created = await prisma.catalogue.create({
        data: {
          displayName: displayName.trim(),
          fileName: storagePath,
          storagePath,
          category: category ? String(category).trim() : 'Catalogue',
          description: description ? String(description).trim() : null,
          model: model ? String(model).trim() : 'AC Unit / Brochure',
          uploadedById: req.user?.id || null,
          fileSize: size,
        },
      });
      res.status(201).json({ success: true, message: 'Document registered successfully.', data: created });
    } catch (err: any) {
      console.error('[Register Upload Error]', err);
      res.status(500).json({ success: false, message: 'Failed to register document.' });
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

      if ((existing as any).storagePath) {
        await deleteObject((existing as any).storagePath);
      } else {
      // Legacy uploads live in B2
      try {
        await storageClient.send(
          new DeleteObjectCommand({ Bucket: B2_BUCKET_NAME, Key: catalogueKey(existing.fileName) }),
        );
      } catch (b2Err) {
        console.warn('[Delete Catalogue B2 Warning]', b2Err);
      }

      // Older files shipped with the deployment may still be on disk (read-only on serverless, so this can fail harmlessly)
      const filePath = catalogueSyncService.getCatalogueFilePath(existing.fileName);
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn('[Delete Catalogue Unlink Warning]', unlinkErr);
        }
      }
      }

      // products pointing at this PDF fall back to the generated spec PDF
      await (prisma.product as any).updateMany({ where: { catalogueDocId: id }, data: { catalogueDocId: null } });
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

      const sanitizedName = catalogue.displayName.replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim();
      const outputFilename = sanitizedName.toLowerCase().endsWith('.pdf') ? sanitizedName : `${sanitizedName}.pdf`;
      const pdfHeaders = () => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${outputFilename}"`);
      };

      // 0) Uploaded via the web admin page: redirect to a short-lived signed Supabase URL
      if ((catalogue as any).storagePath) {
        const signed = await createSignedDownloadUrl((catalogue as any).storagePath, outputFilename);
        if (!signed) {
          res.status(404).json({ success: false, message: 'Catalogue PDF file is missing in storage.' });
          return;
        }
        res.redirect(302, signed);
        return;
      }

      // 1) Older catalogue files that ship with the deployment (read from disk)
      const legacyPath = catalogueSyncService.getCatalogueFilePath(catalogue.fileName);
      if (legacyPath && fs.existsSync(legacyPath)) {
        pdfHeaders();
        const fileStream = fs.createReadStream(legacyPath);
        fileStream.on('error', (streamErr) => {
          console.error('[Catalogue Stream Error]', streamErr);
          if (!res.headersSent) res.status(500).json({ success: false, message: 'Failed to stream catalogue file.' });
        });
        fileStream.pipe(res);
        return;
      }

      // 2) Everything uploaded from the app: stream from B2
      try {
        const result = await storageClient.send(
          new GetObjectCommand({ Bucket: B2_BUCKET_NAME, Key: catalogueKey(catalogue.fileName) }),
        );
        if (!result.Body) {
          res.status(404).json({ success: false, message: 'Catalogue PDF file is missing on the server.' });
          return;
        }
        pdfHeaders();
        if (result.ContentLength != null) res.setHeader('Content-Length', String(result.ContentLength));
        res.setHeader('Cache-Control', 'private, max-age=3600');
        const body = result.Body as NodeJS.ReadableStream;
        body.on('error', (streamErr) => {
          console.error('[Catalogue B2 Stream Error]', streamErr);
          if (!res.headersSent) res.status(500).end();
        });
        body.pipe(res);
      } catch (b2Err: any) {
        if (b2Err?.name === 'NoSuchKey' || b2Err?.$metadata?.httpStatusCode === 404) {
          res.status(404).json({ success: false, message: 'Catalogue PDF file is missing on the server.' });
        } else {
          throw b2Err;
        }
      }
    } catch (err: any) {
      console.error('[Download Catalogue Error]', err);
      res.status(500).json({ success: false, message: 'Failed to download catalogue.' });
    }
  },
};

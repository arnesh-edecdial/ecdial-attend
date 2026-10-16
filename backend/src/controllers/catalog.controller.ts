import { Response } from 'express';
import { randomUUID } from 'crypto';
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  storageClient,
  B2_BUCKET_NAME,
  B2_PRODUCT_IMAGE_PREFIX,
  createB2ProductImageDownloadUrl,
  clearB2ImageDownloadUrlCache,
} from '../config/storage';
import { generateProductCataloguePDF } from '../services/productCataloguePdf.service';

const ADMIN_MANAGEMENT_ROLES = ['ADMIN', 'MANAGER', 'IT_ADMIN', 'SALES'];

function parseJsonField<T>(field: any, fallback: T): T {
  if (!field) return fallback;
  if (typeof field === 'object') return field;
  try {
    return JSON.parse(field);
  } catch {
    return fallback;
  }
}

function normalizeProduct(p: any) {
  const images = parseJsonField<any[]>(p.images, []);
  const specifications = parseJsonField<any[]>(p.specifications, []);
  return {
    ...p,
    brand: p.brand || (p.description ? p.description.match(/\[Brand:\s*([^\]]+)\]/i)?.[1]?.trim() : null) || 'Daikin',
    images,
    specifications,
  };
}

export const catalogController = {
  // 1. List Products (Sales sees only active products; Admin sees all)
  listProducts: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const category = req.query.category as string; // 'MAIN_UNIT' | 'LOW_SIDE'
    const acType = req.query.acType as string | undefined;
    const brand = req.query.brand as string | undefined;
    const search = (req.query.search as string)?.toLowerCase().trim();
    const activeOnly = req.query.activeOnly === 'true';

    try {
      const formattedAcType = acType ? acType.toUpperCase() : undefined;

      const whereClause: any = {
        ...(activeOnly ? { isActive: true } : {}),
        ...(category ? { category } : {}),
      };

      if (brand && brand !== 'ALL') {
        whereClause.OR = [
          { brand: { equals: brand, mode: 'insensitive' as any } },
          { description: { contains: brand, mode: 'insensitive' as any } },
          { name: { contains: brand, mode: 'insensitive' as any } },
        ];
      }

      if (formattedAcType) {
        if (category === 'LOW_SIDE') {
          whereClause.acType = formattedAcType;
        } else if (category === 'MAIN_UNIT') {
          whereClause.OR = [
            { acType: formattedAcType },
            { acType: 'ALL' },
          ];
        } else {
          whereClause.acType = formattedAcType;
        }
      }

      if (search) {
        const searchCondition = [
          { name: { contains: search, mode: 'insensitive' as any } },
          { description: { contains: search, mode: 'insensitive' as any } },
          { model: { contains: search, mode: 'insensitive' as any } },
          { brand: { contains: search, mode: 'insensitive' as any } },
        ];

        if (whereClause.OR) {
          whereClause.AND = [{ OR: whereClause.OR }, { OR: searchCondition }];
          delete whereClause.OR;
        } else {
          whereClause.OR = searchCondition;
        }
      }

      const products = await (prisma.product as any).findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });

      const normalized = products.map(normalizeProduct);

      res.json({
        success: true,
        data: normalized,
      });
    } catch (err: any) {
      console.error('[listProducts error]', err);
      res.status(500).json({ success: false, message: 'Failed to list products.' });
    }
  },

  // 2. Get Product By ID
  getProductById: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const product = await (prisma.product as any).findUnique({ where: { id } });
      if (!product) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      const normalized = normalizeProduct(product);

      // Attach signed download URLs for images
      if (normalized.images && normalized.images.length > 0) {
        normalized.images = await Promise.all(
          normalized.images.map(async (img: any) => {
            try {
              const signedUrl = await createB2ProductImageDownloadUrl(img.storageFileName);
              return { ...img, signedUrl };
            } catch {
              return img;
            }
          })
        );
      }

      res.json({
        success: true,
        data: normalized,
      });
    } catch (err: any) {
      console.error('[getProductById error]', err);
      res.status(500).json({ success: false, message: 'Failed to fetch product.' });
    }
  },

  // 3. Add Machine Model / Product Catalogue Entry
  createProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const {
      name,
      model,
      brand,
      category = 'MAIN_UNIT',
      acType = 'SPLIT',
      description,
      defaultUnit = 'Nos',
      defaultPrice,
      defaultSupplyRate,
      defaultInstallRate,
      availableStock = 10,
      imageUrl,
      images,
      specifications,
    } = req.body;

    const supRate = defaultSupplyRate !== undefined ? Number(defaultSupplyRate) : undefined;
    const instRate = defaultInstallRate !== undefined ? Number(defaultInstallRate) : undefined;
    const calcPrice = defaultPrice !== undefined ? Number(defaultPrice) : ((supRate || 0) + (instRate || 0));

    if (!name || (defaultPrice === undefined && supRate === undefined && instRate === undefined)) {
      res.status(400).json({ success: false, message: 'Product name and rates/price are required.' });
      return;
    }

    try {
      const imagesJson = typeof images === 'object' ? JSON.stringify(images) : (images || null);
      const specsJson = typeof specifications === 'object' ? JSON.stringify(specifications) : (specifications || null);

      const newProduct = await (prisma.product as any).create({
        data: {
          name: name.trim(),
          model: model ? model.trim() : null,
          brand: brand ? brand.trim() : null,
          category,
          acType: String(acType || 'SPLIT').toUpperCase(),
          description: description ? description.trim() : `${name} (${category})`,
          defaultUnit: defaultUnit || 'Nos',
          defaultPrice: calcPrice,
          defaultSupplyRate: supRate !== undefined ? supRate : (category === 'LOW_SIDE' ? 0 : calcPrice),
          defaultInstallRate: instRate !== undefined ? instRate : 0,
          availableStock: availableStock !== undefined ? Number(availableStock) : 0,
          imageUrl: imageUrl || null,
          images: imagesJson,
          specifications: specsJson,
          isActive: true,
        },
      });

      res.status(201).json({
        success: true,
        message: `Product '${newProduct.name}' added successfully.`,
        data: normalizeProduct(newProduct),
      });
    } catch (err: any) {
      console.error('[createProduct error]', err);
      res.status(500).json({ success: false, message: 'Failed to create product.' });
    }
  },

  // 4. Update Machine Model / Product Catalogue Entry
  updateProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const {
      name,
      model,
      brand,
      category,
      acType,
      description,
      defaultUnit,
      defaultPrice,
      defaultSupplyRate,
      defaultInstallRate,
      availableStock,
      imageUrl,
      images,
      specifications,
      isActive,
    } = req.body;

    try {
      const existing = await (prisma.product as any).findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (model !== undefined) updateData.model = model ? model.trim() : null;
      if (brand !== undefined) updateData.brand = brand ? brand.trim() : null;
      if (category !== undefined) updateData.category = category;
      if (acType !== undefined) updateData.acType = String(acType).toUpperCase();
      if (description !== undefined) updateData.description = description.trim();
      if (defaultUnit !== undefined) updateData.defaultUnit = defaultUnit;
      if (defaultPrice !== undefined) updateData.defaultPrice = Number(defaultPrice);
      if (defaultSupplyRate !== undefined) updateData.defaultSupplyRate = Number(defaultSupplyRate);
      if (defaultInstallRate !== undefined) updateData.defaultInstallRate = Number(defaultInstallRate);
      if (availableStock !== undefined) updateData.availableStock = Number(availableStock);
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);

      if (images !== undefined) {
        updateData.images = typeof images === 'object' ? JSON.stringify(images) : images;
      }
      if (specifications !== undefined) {
        updateData.specifications = typeof specifications === 'object' ? JSON.stringify(specifications) : specifications;
      }

      const updated = await (prisma.product as any).update({
        where: { id },
        data: updateData,
      });

      res.json({
        success: true,
        message: `Product '${updated.name}' updated successfully.`,
        data: normalizeProduct(updated),
      });
    } catch (err: any) {
      console.error('[updateProduct error]', err);
      res.status(500).json({ success: false, message: 'Failed to update product.' });
    }
  },

  // 5. Upload Product Image (Direct binary buffer to B2 bucket)
  uploadProductImage: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const product = await (prisma.product as any).findUnique({ where: { id } });
      if (!product) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        res.status(400).json({ success: false, message: 'Missing or empty image payload.' });
        return;
      }

      if (buf.length > 12 * 1024 * 1024) {
        res.status(413).json({ success: false, message: 'Image exceeds maximum allowed size of 12MB.' });
        return;
      }

      const ct = (req.headers['content-type'] as string) || 'image/jpeg';
      let ext = '.jpg';
      if (ct.includes('png')) ext = '.png';
      else if (ct.includes('webp')) ext = '.webp';
      else if (ct.includes('gif')) ext = '.gif';

      const storageFileName = `prod_${id}_${randomUUID()}${ext}`;
      const storageKey = `${B2_PRODUCT_IMAGE_PREFIX}/${storageFileName}`;

      await storageClient.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: storageKey,
          Body: buf,
          ContentType: ct,
          ContentLength: buf.length,
        }),
      );

      const existingImages = parseJsonField<any[]>(product.images, []);
      const newImageItem = {
        id: randomUUID(),
        storageFileName,
        imageUrl: `/api/products/images/${storageFileName}`,
        fileSize: buf.length,
        contentType: ct,
        createdAt: new Date().toISOString(),
      };

      existingImages.push(newImageItem);

      await (prisma.product as any).update({
        where: { id },
        data: {
          images: JSON.stringify(existingImages),
          // Set primary imageUrl if not already set
          imageUrl: product.imageUrl || newImageItem.imageUrl,
        },
      });

      const signedUrl = await createB2ProductImageDownloadUrl(storageFileName).catch(() => newImageItem.imageUrl);

      res.status(201).json({
        success: true,
        message: 'Product image uploaded successfully.',
        data: {
          ...newImageItem,
          signedUrl,
        },
      });
    } catch (err: any) {
      console.error('[uploadProductImage error]', err);
      res.status(500).json({ success: false, message: 'Failed to upload product image.' });
    }
  },

  // 6. Delete Product Image
  deleteProductImage: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id, storageFileName } = req.params;
    try {
      const product = await (prisma.product as any).findUnique({ where: { id } });
      if (!product) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      const existingImages = parseJsonField<any[]>(product.images, []);
      const filteredImages = existingImages.filter(
        (img: any) => img.storageFileName !== storageFileName && img.id !== storageFileName
      );

      // Attempt deletion from B2 storage
      const storageKey = `${B2_PRODUCT_IMAGE_PREFIX}/${storageFileName}`;
      clearB2ImageDownloadUrlCache(storageFileName);

      try {
        await storageClient.send(
          new DeleteObjectCommand({
            Bucket: B2_BUCKET_NAME,
            Key: storageKey,
          }),
        );
      } catch (b2Err) {
        console.warn('[B2 delete error, continuing with DB update]', b2Err);
      }

      await (prisma.product as any).update({
        where: { id },
        data: {
          images: JSON.stringify(filteredImages),
          imageUrl: filteredImages.length > 0 ? filteredImages[0].imageUrl : null,
        },
      });

      res.json({
        success: true,
        message: 'Image deleted successfully.',
        data: { remainingCount: filteredImages.length },
      });
    } catch (err: any) {
      console.error('[deleteProductImage error]', err);
      res.status(500).json({ success: false, message: 'Failed to delete product image.' });
    }
  },

  // 7. Serve Product Image (Stream directly from B2 bucket)
  serveProductImage: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { filename } = req.params;
    if (!filename || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({ success: false, message: 'Invalid image filename.' });
      return;
    }

    try {
      const storageKey = `${B2_PRODUCT_IMAGE_PREFIX}/${filename}`;
      const result = await storageClient.send(
        new GetObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: storageKey,
        }),
      );

      if (!result.Body) {
        res.status(404).json({ success: false, message: 'Image not found.' });
        return;
      }

      let contentType = 'image/jpeg';
      if (filename.endsWith('.png')) contentType = 'image/png';
      else if (filename.endsWith('.webp')) contentType = 'image/webp';
      else if (filename.endsWith('.gif')) contentType = 'image/gif';

      res.setHeader('Content-Type', contentType);
      if (result.ContentLength != null) {
        res.setHeader('Content-Length', String(result.ContentLength));
      }
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const body = result.Body as NodeJS.ReadableStream;
      body.on('error', (err) => {
        console.error('[serveProductImage stream error]', err);
        if (!res.headersSent) res.status(500).end();
      });
      body.pipe(res);
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
        res.status(404).json({ success: false, message: 'Image file does not exist.' });
      } else {
        console.error('[serveProductImage error]', err);
        res.status(500).json({ success: false, message: 'Failed to stream product image.' });
      }
    }
  },

  // 8. Generate & Export AC Product Catalogue PDF
  exportCataloguePdf: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const product = await (prisma.product as any).findUnique({ where: { id } });
      if (!product) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      const normalized = normalizeProduct(product);
      const pdfBuffer = await generateProductCataloguePDF(normalized);

      const sanitizedName = (product.name || 'Catalogue').replace(/[^a-zA-Z0-9_\-\s]/g, '_').trim();
      const filename = `ECDIAL_Catalogue_${sanitizedName}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      res.end(pdfBuffer);
    } catch (err: any) {
      console.error('[exportCataloguePdf error]', err);
      res.status(500).json({ success: false, message: 'Failed to generate catalogue PDF.' });
    }
  },

  // 9. Delete Product (Safe Deletion with B2 Image Cleanup)
  deleteProduct: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const existing = await (prisma.product as any).findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      // Clean up associated images from B2 storage
      const images = parseJsonField<any[]>(existing.images, []);
      for (const img of images) {
        if (img.storageFileName) {
          clearB2ImageDownloadUrlCache(img.storageFileName);
          storageClient.send(
            new DeleteObjectCommand({
              Bucket: B2_BUCKET_NAME,
              Key: `${B2_PRODUCT_IMAGE_PREFIX}/${img.storageFileName}`,
            })
          ).catch((e) => console.warn('[B2 cleanup warning]', e));
        }
      }

      await (prisma.product as any).delete({ where: { id } });

      res.json({
        success: true,
        message: `Product catalogue for '${existing.name}' and associated assets deleted safely.`,
      });
    } catch (err: any) {
      console.error('[deleteProduct error]', err);
      res.status(500).json({ success: false, message: 'Failed to delete product.' });
    }
  },

  // 10. Toggle Product Status
  toggleProductStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const existing = await (prisma.product as any).findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Product not found.' });
        return;
      }

      const updated = await (prisma.product as any).update({
        where: { id },
        data: { isActive: !existing.isActive },
      });

      res.json({
        success: true,
        message: `Product '${updated.name}' is now ${updated.isActive ? 'Active' : 'Disabled'}.`,
        data: normalizeProduct(updated),
      });
    } catch (err: any) {
      console.error('[toggleProductStatus error]', err);
      res.status(500).json({ success: false, message: 'Failed to toggle product status.' });
    }
  },
};

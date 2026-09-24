import fs from 'fs';
import path from 'path';
import { prisma } from '../db/store';

/**
 * Normalizes a raw PDF filename into a clean human-readable default display title.
 * e.g. "RA_Master_Catalogue (1)-31.pdf" -> "RA Master Catalogue - Page 31"
 */
function formatDefaultCatalogueName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, '');
  const match = base.match(/RA_Master_Catalogue\s*(?:\(\d+\))?-(\d+(?:-copy-\d+)?)/i);
  if (match) {
    const pageNum = match[1].replace('-copy-', ' (Copy ');
    return `RA Master Catalogue - Page ${pageNum}${match[1].includes('-copy-') ? ')' : ''}`;
  }
  return base.replace(/[_]/g, ' ').replace(/\s+/g, ' ').trim();
}

export const catalogueSyncService = {
  /**
   * Scans backend/assets/catalogues (and mobile/assets/catlogues fallback)
   * and synchronizes physical PDF records into the database Catalogue table.
   * If a record already exists, displayName is NEVER overwritten (preserves Admin renames).
   */
  syncCataloguesFromDisk: async (): Promise<number> => {
    try {
      const primaryDir = path.resolve(__dirname, '../../assets/catalogues');
      const fallbackDir = path.resolve(__dirname, '../../../mobile/assets/catlogues');

      let targetDir = primaryDir;
      if (!fs.existsSync(primaryDir) || fs.readdirSync(primaryDir).length === 0) {
        if (fs.existsSync(fallbackDir)) {
          targetDir = fallbackDir;
          // Ensure primary dir exists and copy files
          if (!fs.existsSync(primaryDir)) {
            fs.mkdirSync(primaryDir, { recursive: true });
          }
          const fallbackFiles = fs.readdirSync(fallbackDir);
          for (const file of fallbackFiles) {
            if (file.toLowerCase().endsWith('.pdf')) {
              fs.copyFileSync(path.join(fallbackDir, file), path.join(primaryDir, file));
            }
          }
          targetDir = primaryDir;
        }
      }

      if (!fs.existsSync(targetDir)) {
        console.log('[CatalogueSync] Catalogue directory not found:', targetDir);
        return 0;
      }

      const files = fs.readdirSync(targetDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
      if (files.length === 0) {
        console.log('[CatalogueSync] No PDF catalogue files found on disk.');
        return 0;
      }

      let addedCount = 0;
      for (const file of files) {
        const filePath = path.join(targetDir, file);
        const stats = fs.statSync(filePath);

        // Check if database already has this physical file registered
        const existing = await prisma.catalogue.findFirst({
          where: { fileName: file },
        });

        if (!existing) {
          const defaultName = formatDefaultCatalogueName(file);
          await prisma.catalogue.create({
            data: {
              fileName: file,
              displayName: defaultName,
              fileSize: stats.size,
              model: 'Daikin / AC Unit',
            },
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        console.log(`✅ [CatalogueSync] Registered ${addedCount} new catalogue(s) in database.`);
      } else {
        console.log(`ℹ️ [CatalogueSync] All ${files.length} catalogue(s) are already synchronized in database.`);
      }

      return addedCount;
    } catch (err: any) {
      console.error('[CatalogueSync Error]', err);
      return 0;
    }
  },

  getCatalogueFilePath: (fileName: string): string | null => {
    const primaryPath = path.resolve(__dirname, '../../assets/catalogues', fileName);
    if (fs.existsSync(primaryPath)) return primaryPath;

    const fallbackPath = path.resolve(__dirname, '../../../mobile/assets/catlogues', fileName);
    if (fs.existsSync(fallbackPath)) return fallbackPath;

    return null;
  },
};

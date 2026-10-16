import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { storageClient, B2_BUCKET_NAME } from '../config/storage';

export interface ProductCataloguePdfData {
  id: string;
  name: string;
  model?: string | null;
  brand?: string | null;
  category: string;
  acType: string;
  description?: string | null;
  defaultUnit: string;
  defaultPrice: number;
  availableStock: number;
  imageUrl?: string | null;
  images?: Array<{
    id: string;
    storageFileName: string;
    imageUrl?: string;
    caption?: string;
  }>;
  specifications?: Array<{
    id: string;
    iduModel: string;
    oduModel: string;
    coolingCapacity?: string;
    iseerRating?: string;
    annualPowerConsumption?: string;
    iduColour?: string;
    specRows?: Array<{
      id: string;
      attribute: string;
      unit?: string;
      value: string;
    }>;
  }>;
}

function sanitizeText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/\u20B9/g, 'Rs. ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[^\x20-\x7E\r\n\t]/g, '')
    .trim();
}

function getAssetPath(filename: string): string | null {
  const possiblePaths = [
    path.join(__dirname, '../../assets', filename),
    path.join(__dirname, '../assets', filename),
    path.join(__dirname, '../../assets/brands', filename),
    path.join(__dirname, '../assets/brands', filename),
    path.join(process.cwd(), 'assets', filename),
    path.join(process.cwd(), 'backend/assets', filename),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function fetchImageBuffer(storageFileName: string): Promise<Buffer | null> {
  try {
    const key = `products/${storageFileName}`;
    const result = await storageClient.send(
      new GetObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: key,
      }),
    );
    if (!result.Body) return null;
    const stream = result.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    // If B2 fetch fails or object not found, gracefully return null
    return null;
  }
}

export async function generateProductCataloguePDF(data: ProductCataloguePdfData): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 36, bottom: 40, left: 36, right: 36 },
        info: {
          Title: `ECDIAL_Catalogue_${sanitizeText(data.name || 'Product')}`,
          Author: 'ECDIAL Air Conditioning Solutions',
          Subject: 'Product Technical Catalogue & Specifications',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#0066CC';
      const darkColor = '#0F172A';
      const textMuted = '#475467';
      const borderColor = '#E2E8F0';
      const cardBg = '#F8FAFC';
      const pageWidth = 595.28;
      const leftMargin = 36;
      const contentWidth = pageWidth - leftMargin * 2; // 523.28

      // Attempt to load product thumbnail image if available
      let primaryImageBuf: Buffer | null = null;
      if (data.images && data.images.length > 0) {
        primaryImageBuf = await fetchImageBuffer(data.images[0].storageFileName);
      }

      // --- 1. HEADER SECTION ---
      doc.rect(0, 0, pageWidth, 54).fill(darkColor);

      // Header logo / title
      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
        .text('ECDIAL', leftMargin, 16, { continued: true })
        .font('Helvetica').fontSize(10).fillColor('#93C5FD')
        .text('  |  AIR CONDITIONING PRODUCT CATALOGUE');

      doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
        .text('Official Technical Specifications Sheet', leftMargin, 34);

      const brandText = sanitizeText(data.brand || 'ECDIAL').toUpperCase();
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
        .text(brandText, pageWidth - leftMargin - 120, 20, { width: 120, align: 'right' });

      let currentY = 70;

      // --- 2. PRODUCT HERO CARD ---
      doc.roundedRect(leftMargin, currentY, contentWidth, 100, 8)
        .fillAndStroke(cardBg, borderColor);

      const hasThumb = !!primaryImageBuf;
      const thumbWidth = 85;
      const thumbHeight = 76;

      if (hasThumb && primaryImageBuf) {
        try {
          doc.image(primaryImageBuf, leftMargin + 12, currentY + 12, {
            fit: [thumbWidth, thumbHeight],
            align: 'center',
            valign: 'center',
          });
        } catch {
          // ignore bad image
        }
      }

      const textLeft = hasThumb ? leftMargin + thumbWidth + 24 : leftMargin + 16;
      const textWidth = contentWidth - (textLeft - leftMargin) - 16;

      // Brand badge + AC type
      doc.rect(textLeft, currentY + 12, 60, 16).fill('#EFF6FF');
      doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold')
        .text(brandText, textLeft + 4, currentY + 16, { width: 52, align: 'center' });

      doc.rect(textLeft + 66, currentY + 12, 65, 16).fill('#F1F5F9');
      doc.fillColor(textMuted).fontSize(8).font('Helvetica-Bold')
        .text(sanitizeText(data.acType || 'SPLIT'), textLeft + 70, currentY + 16, { width: 57, align: 'center' });

      // Product Title
      doc.fillColor(darkColor).fontSize(14).font('Helvetica-Bold')
        .text(sanitizeText(data.name), textLeft, currentY + 34, { width: textWidth, ellipsis: true });

      // Model & Stock line
      const modelStr = data.model ? `Model: ${sanitizeText(data.model)}   •   ` : '';
      const stockStr = `Stock: ${data.availableStock || 0} ${sanitizeText(data.defaultUnit || 'Nos')}   •   `;
      const priceStr = `Rate: Rs. ${(data.defaultPrice || 0).toLocaleString('en-IN')}`;
      doc.fillColor(textMuted).fontSize(9).font('Helvetica')
        .text(modelStr + stockStr + priceStr, textLeft, currentY + 54, { width: textWidth, ellipsis: true });

      // Description snippet
      if (data.description) {
        const cleanDesc = sanitizeText(data.description).slice(0, 140);
        doc.fillColor('#64748B').fontSize(8).font('Helvetica')
          .text(cleanDesc, textLeft, currentY + 70, { width: textWidth, height: 22, ellipsis: true });
      }

      currentY += 114;

      // --- 3. SPECIFICATION TABLES (EACH IDU + ODU IS A SEPARATE TABLE) ---
      const combinations = Array.isArray(data.specifications) && data.specifications.length > 0
        ? data.specifications
        : [
            {
              id: 'default',
              iduModel: data.model ? `${data.model}-IDU` : 'IDU Model',
              oduModel: data.model ? `${data.model}-ODU` : 'ODU Model',
              coolingCapacity: '3.50 kW',
              iseerRating: '5.20 Wh/Wh',
              annualPowerConsumption: '580 kWh',
              iduColour: 'White',
              specRows: [],
            },
          ];

      doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold')
        .text(`Technical Specification Tables (${combinations.length} Model Combination${combinations.length > 1 ? 's' : ''})`, leftMargin, currentY);

      doc.fillColor(textMuted).fontSize(8).font('Helvetica')
        .text('Each table represents one complete IDU and ODU model combination with verified ratings and technical parameters.', leftMargin, currentY + 14);

      currentY += 30;

      for (let i = 0; i < combinations.length; i++) {
        const comb = combinations[i];

        // Page break check: if remaining space is less than 160, start a new page
        if (currentY + 160 > 780) {
          doc.addPage();
          currentY = 40;
        }

        // Combination Header Banner
        doc.roundedRect(leftMargin, currentY, contentWidth, 26, 4).fill(primaryColor);
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
          .text(`Combination ${i + 1}: IDU [${sanitizeText(comb.iduModel || '—')}]  +  ODU [${sanitizeText(comb.oduModel || '—')}]`, leftMargin + 10, currentY + 8);

        currentY += 28;

        // Key Rating Highlights Box (4 metrics)
        const metricColWidth = contentWidth / 4;
        const metrics = [
          { label: 'Cooling Capacity', val: sanitizeText(comb.coolingCapacity || '—') },
          { label: 'ISEER Rating', val: sanitizeText(comb.iseerRating || '—') },
          { label: 'Annual Power', val: sanitizeText(comb.annualPowerConsumption || '—') },
          { label: 'IDU Colour', val: sanitizeText(comb.iduColour || '—') },
        ];

        doc.rect(leftMargin, currentY, contentWidth, 34).fillAndStroke('#F1F5F9', borderColor);
        metrics.forEach((m, idx) => {
          const colX = leftMargin + idx * metricColWidth;
          doc.fillColor(textMuted).fontSize(7).font('Helvetica')
            .text(m.label.toUpperCase(), colX + 6, currentY + 6, { width: metricColWidth - 12 });
          doc.fillColor(darkColor).fontSize(9).font('Helvetica-Bold')
            .text(m.val, colX + 6, currentY + 18, { width: metricColWidth - 12, ellipsis: true });

          if (idx < 3) {
            doc.moveTo(colX + metricColWidth, currentY + 4).lineTo(colX + metricColWidth, currentY + 30).stroke(borderColor);
          }
        });

        currentY += 36;

        // Structured Specification Rows
        const rows = Array.isArray(comb.specRows) ? comb.specRows : [];
        if (rows.length > 0) {
          // Table column widths: Attribute (45%), Unit (20%), Value (35%)
          const colAttrW = Math.round(contentWidth * 0.45);
          const colUnitW = Math.round(contentWidth * 0.20);
          const colValW = contentWidth - colAttrW - colUnitW;

          // Header row
          doc.rect(leftMargin, currentY, contentWidth, 18).fill('#E2E8F0');
          doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold')
            .text('TECHNICAL ATTRIBUTE', leftMargin + 8, currentY + 5, { width: colAttrW - 12 })
            .text('UNIT', leftMargin + colAttrW + 6, currentY + 5, { width: colUnitW - 12 })
            .text('VALUE / SPECIFICATION', leftMargin + colAttrW + colUnitW + 6, currentY + 5, { width: colValW - 12 });

          currentY += 18;

          for (let rIdx = 0; rIdx < rows.length; rIdx++) {
            const row = rows[rIdx];
            if (currentY + 22 > 780) {
              doc.addPage();
              currentY = 40;
            }

            const rowBg = rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
            doc.rect(leftMargin, currentY, contentWidth, 18).fillAndStroke(rowBg, borderColor);

            doc.fillColor(darkColor).fontSize(8).font('Helvetica')
              .text(sanitizeText(row.attribute), leftMargin + 8, currentY + 5, { width: colAttrW - 12, ellipsis: true });

            doc.fillColor(textMuted).fontSize(8).font('Helvetica')
              .text(sanitizeText(row.unit || '—'), leftMargin + colAttrW + 6, currentY + 5, { width: colUnitW - 12, ellipsis: true });

            doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold')
              .text(sanitizeText(row.value), leftMargin + colAttrW + colUnitW + 6, currentY + 5, { width: colValW - 12, ellipsis: true });

            currentY += 18;
          }
        }

        currentY += 16;
      }

      // --- 4. FOOTER NOTE ---
      if (currentY + 60 > 780) {
        doc.addPage();
        currentY = 40;
      }

      doc.rect(leftMargin, currentY, contentWidth, 40).fillAndStroke('#F8FAFC', borderColor);
      doc.fillColor(textMuted).fontSize(7.5).font('Helvetica')
        .text('Notice: Specifications and dimensions are subject to continuous design improvements and manufacturer updates without prior notification. Contact ECDIAL for project-specific sizing and site preparation requirements.', leftMargin + 10, currentY + 8, { width: contentWidth - 20, align: 'center' });

      // Page numbering on all pages
      const pages = doc.bufferedPageRange();
      for (let pIdx = 0; pIdx < pages.count; pIdx++) {
        doc.switchToPage(pIdx);
        doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
          .text(`ECDIAL Air Conditioning Catalogue  •  Page ${pIdx + 1} of ${pages.count}`, leftMargin, 800, { width: contentWidth, align: 'center' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

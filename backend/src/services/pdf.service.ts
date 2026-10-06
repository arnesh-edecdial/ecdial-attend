import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

export interface PDFQuotationData {
  quotationNumber: string;
  revisionNumber?: number;
  date: string;
  validTill?: string;
  acType?: 'SPLIT' | 'VRV' | 'DUCT' | string;
  includeBankDetails?: boolean;
  quotationType?: 'DAIKIN' | 'ECDIAL';
  customerName?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  createdByName?: string;
  createdByEmail?: string;
  hasLowSide: boolean;
  mainUnitTotal: number;
  lowSideTotal: number;
  subtotal: number;
  cgstPercent: number;
  cgstAmount: number;
  sgstPercent: number;
  sgstAmount: number;
  grandTotal: number;
  termsAndConditions?: string;
  paymentMethod?: string;
  mainItems: Array<{
    description: string;
    brand?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }>;
  lowSideItems: Array<{
    description: string;
    brand?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }>;
}

function sanitizePdfText(str: string | null | undefined): string {
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
    path.join(process.cwd(), 'backend/assets/brands', filename),
    path.join(
      'C:/Users/arnes/.gemini/antigravity-ide/brain/78cac626-56d1-4691-80a3-c0cd8bcebf5c/.user_uploaded',
      filename === 'daikin_quotation_header.png' || filename === 'quotation_header.png'
        ? 'media_1788114894031.png'
        : filename === 'daikin_quotation_terms_payment.png' || filename === 'quotation_terms_payment.png'
        ? 'media_1788114894051.png'
        : filename === 'daikin_quotation_footer.png' || filename === 'quotation_footer.png'
        ? 'media_1788114894076.png'
        : filename === 'ecdial_quotation_header.png'
        ? 'media_1788282241529.png'
        : filename === 'ecdial_quotation_footer.png'
        ? 'media_1788282241446.png'
        : filename === 'ecdial_quotation_terms_payment.png'
        ? 'media_1788282241614.png'
        : filename
    ),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Helper to detect unique brands in quotation items
function detectQuotationBrands(items: Array<{ description?: string; brand?: string }>): string[] {
  const brandOrder = ['MITSUBISHI', 'DAIKIN', 'LG', 'GENERAL', 'GODREJ', 'BLUESTAR', 'ONIDA'];
  const brandSet = new Set<string>();

  for (const item of items) {
    const rawBrand = (item.brand || '').trim().toUpperCase();
    const desc = (item.description || '').toUpperCase();

    if (rawBrand === 'DAIKIN' || desc.includes('DAIKIN')) brandSet.add('DAIKIN');
    if (rawBrand.includes('MITSUBISHI') || desc.includes('MITSUBISHI')) brandSet.add('MITSUBISHI');
    if (rawBrand === 'LG' || desc.includes('LG ') || desc.includes('LG-') || desc.includes('(US-Q') || desc.startsWith('LG')) brandSet.add('LG');
    if (rawBrand.includes('GENERAL') || desc.includes('GENERAL') || desc.includes('O GENERAL') || desc.includes('ASGA')) brandSet.add('GENERAL');
    if (rawBrand.includes('GODREJ') || desc.includes('GODREJ') || desc.includes('GIC18')) brandSet.add('GODREJ');
    if (rawBrand.includes('BLUE') || rawBrand.includes('STAR') || rawBrand.includes('BLUSTAR') || desc.includes('BLUE STAR') || desc.includes('BLUESTAR') || desc.includes('BLUSTAR')) brandSet.add('BLUESTAR');
    if (rawBrand.includes('ONIDA') || desc.includes('ONIDA')) brandSet.add('ONIDA');
  }

  // Preserve canonical display order matching reference Image 3
  const detected = brandOrder.filter((b) => brandSet.has(b));
  return detected.length > 0 ? detected : ['DAIKIN'];
}

export function generateQuotationPDF(data: PDFQuotationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const isEcDial = (data.quotationType || 'DAIKIN').toUpperCase() === 'ECDIAL';

      // Standard A4 dimensions: 595.28 x 841.89 pt
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        autoFirstPage: true,
        info: {
          Title: `Quotation_${sanitizePdfText(data.customerName) || 'Offer'}`,
          Author: isEcDial ? 'EC DIAL - Electrical & HVAC Solutions' : 'ECDIAL - Authorized Daikin Dealer',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Theme Colors
      const daikinDarkNavy = '#0A1E3F';
      const daikinBrightBlue = '#0066CC';
      const ecDialOrange = '#FF5722';
      const ecDialNavy = '#0A1E3F';
      
      const themePrimary = isEcDial ? ecDialNavy : daikinDarkNavy;
      const themeAccent = isEcDial ? ecDialOrange : daikinBrightBlue;

      const ruleGray = '#CBD5E1';
      const rowAltBg = '#F9FBFC';
      const textDark = '#0F172A';
      const textMuted = '#475569';
      const orangeBadge = '#EA580C';
      const orangeBg = '#FFF7ED';
      const orangeBorder = '#FDBA74';

      const leftMargin = 32;
      const rightMargin = 563.28;
      const contentWidth = rightMargin - leftMargin; // 531.28 pt

      const mainItems = data.mainItems || [];
      const lowSideItems = data.hasLowSide && data.lowSideItems ? data.lowSideItems : [];

      // Asset Paths
      const headerFilename = isEcDial ? 'ecdial_quotation_header.png' : 'daikin_quotation_header.png';
      const footerFilename = isEcDial ? 'ecdial_quotation_footer.png' : 'daikin_quotation_footer.png';
      const termsFilename = isEcDial ? 'ecdial_quotation_terms.png' : 'daikin_quotation_terms.png';
      const paymentFilename = isEcDial ? 'ecdial_quotation_payment.png' : 'daikin_quotation_payment.png';
      const bankFilename = isEcDial ? 'ecdial_quotation_bank.png' : 'daikin_quotation_bank.png';
      const fillerFilename = isEcDial ? 'ecdial_quotation_bank_filler.png' : 'daikin_quotation_bank_filler.png';

      const headerPath = getAssetPath(headerFilename) || getAssetPath(isEcDial ? 'quotation_header.png' : 'daikin_quotation_header.png');
      const footerPath = getAssetPath(footerFilename) || getAssetPath(isEcDial ? 'quotation_footer.png' : 'daikin_quotation_footer.png');
      const termsPath = getAssetPath(termsFilename);
      const paymentPath = getAssetPath(paymentFilename);
      const bankPath = getAssetPath(data.includeBankDetails === false ? fillerFilename : bankFilename);

      const headerWidth = 595.28;
      const headerHeight = isEcDial ? headerWidth * (299 / 1315) : headerWidth * (162 / 718);
      const footerWidth = 595.28;
      const footerHeight = isEcDial ? (footerWidth * (130 / 1024)) : (footerWidth * (106 / 1024));
      const footerY = 841.89 - footerHeight;

      // Extract brands for Authorized Dealer Strip
      const allItems = [...mainItems, ...lowSideItems];
      const activeBrands = detectQuotationBrands(allItems);

      // Brand Logo Filenames
      const brandLogoFiles: Record<string, string> = {
        MITSUBISHI: 'mitsubishi.png',
        DAIKIN: 'daikin.png',
        LG: 'lg.png',
        GENERAL: 'general.png',
        GODREJ: 'godrej.png',
        BLUESTAR: 'bluestar.png',
        ONIDA: 'onida.png',
      };

      // Space Management:
      // 1 to 3 Main Units + up to 7 Low Side items comfortably fit on 1 Page!
      // Only trigger 2-page mode if mainItems >= 4 OR (mainItems.length + lowSideItems.length > 10)
      const isTwoPages = mainItems.length >= 4 || (mainItems.length + lowSideItems.length > 10);
      const totalPages = isTwoPages ? 2 : 1;

      const formattedDate = (() => {
        const raw = sanitizePdfText(data.date);
        if (!raw) return '18-05-2026';
        if (raw.includes('-') && raw.split('-')[0].length === 4) {
          const [yyyy, mm, dd] = raw.split('-');
          return `${dd}-${mm}-${yyyy}`;
        }
        return raw;
      })();

      const formattedValidTill = (() => {
        const raw = sanitizePdfText(data.validTill);
        if (!raw) {
          const rawDate = sanitizePdfText(data.date);
          const [yyyy, mm, dd] = rawDate.split('-').map(Number);
          const d = new Date(yyyy, (mm || 1) - 1, dd || 1);
          d.setDate(d.getDate() + 10);
          return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
        }
        if (raw.includes('-') && raw.split('-')[0].length === 4) {
          const [yyyy, mm, dd] = raw.split('-');
          return `${dd}-${mm}-${yyyy}`;
        }
        return raw;
      })();

      // Function to draw Top Header
      const drawHeaderBanner = () => {
        if (headerPath) {
          try {
            doc.image(headerPath, 0, 0, { width: headerWidth, height: headerHeight });
          } catch {
            drawFallbackHeader();
          }
        } else {
          drawFallbackHeader();
        }
      };

      const drawFallbackHeader = () => {
        doc.rect(0, 0, headerWidth, headerHeight).fill('#FFFFFF');
        doc.rect(0, 0, headerWidth, 6).fill(themeAccent);
        doc.fillColor(themePrimary).fontSize(20).font('Helvetica-Bold')
          .text(isEcDial ? 'Ec Dial' : 'DAIKIN AIR CONDITIONERS', leftMargin, 20);
        doc.fillColor(themeAccent).fontSize(10).font('Helvetica-Bold')
          .text(isEcDial ? 'Electrical & HVAC Solutions' : 'Authorized Sales & Service Dealer', leftMargin, 46);
      };

      // Function to draw Footer Banner
      const drawFooterBanner = () => {
        if (footerPath) {
          try {
            doc.image(footerPath, 0, footerY, { width: footerWidth, height: footerHeight });
          } catch {
            drawFallbackFooter();
          }
        } else {
          drawFallbackFooter();
        }
      };

      const drawFallbackFooter = () => {
        doc.rect(0, footerY, footerWidth, footerHeight).fill(themePrimary);
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Oblique')
          .text(isEcDial ? 'Thank you for your trust in Ec Dial.' : 'Thank you for choosing Daikin & ECDIAL.', 0, footerY + 22, { width: footerWidth, align: 'center' });
      };

      // Function to draw Prominent Authorized Dealer Brand Logos Strip (Matching Image 3)
      const drawAuthorizedBrandLogos = (startY: number): number => {
        const brandHeading = 'AUTHORIZED SALES & SERVICE DEALER';
        
        doc.fillColor(themePrimary).fontSize(8).font('Helvetica-Bold');
        const headingWidth = doc.widthOfString(brandHeading);
        const headingX = leftMargin + (contentWidth - headingWidth) / 2;
        
        // Draw left rule, heading, right rule
        const ruleLeftEnd = headingX - 10;
        const ruleRightStart = headingX + headingWidth + 10;
        
        doc.moveTo(leftMargin + 10, startY + 4).lineTo(ruleLeftEnd, startY + 4).lineWidth(0.6).strokeColor(ruleGray).stroke();
        doc.text(brandHeading, headingX, startY);
        doc.moveTo(ruleRightStart, startY + 4).lineTo(rightMargin - 10, startY + 4).lineWidth(0.6).strokeColor(ruleGray).stroke();

        // Draw Prominent Brand Logos with Vertical Separator Lines '|'
        const logosY = startY + 12;
        const totalCount = activeBrands.length;
        const logoTargetHeight = 26;

        if (totalCount === 1) {
          // Single logo placed cleanly in center without distortion (prominent size: width ~120, height ~28)
          const brandKey = activeBrands[0];
          const logoFilename = brandLogoFiles[brandKey] || 'daikin.png';
          const logoPath = getAssetPath(logoFilename);
          const logoTargetWidth = 120;
          const logoX = leftMargin + (contentWidth - logoTargetWidth) / 2;

          if (logoPath) {
            try {
              doc.image(logoPath, logoX, logosY, { fit: [logoTargetWidth, logoTargetHeight], align: 'center', valign: 'center' });
            } catch {
              doc.fillColor(themePrimary).fontSize(10).font('Helvetica-Bold').text(brandKey, logoX, logosY + 6, { width: logoTargetWidth, align: 'center' });
            }
          }
          return logosY + logoTargetHeight + 4;
        } else {
          // Multiple logos centered side-by-side with crisp vertical dividers '|'
          const logoTargetWidth = Math.min(88, Math.floor((contentWidth - (totalCount - 1) * 20) / totalCount));
          const gap = 20;
          const totalW = totalCount * logoTargetWidth + (totalCount - 1) * gap;
          let currentX = leftMargin + (contentWidth - totalW) / 2;

          for (let i = 0; i < totalCount; i++) {
            const brandKey = activeBrands[i];
            const logoFilename = brandLogoFiles[brandKey] || 'daikin.png';
            const logoPath = getAssetPath(logoFilename);

            if (logoPath) {
              try {
                doc.image(logoPath, currentX, logosY, { fit: [logoTargetWidth, logoTargetHeight], align: 'center', valign: 'center' });
              } catch {
                doc.fillColor(themePrimary).fontSize(9).font('Helvetica-Bold').text(brandKey, currentX, logosY + 6, { width: logoTargetWidth, align: 'center' });
              }
            }

            // Draw vertical separator line between logos (Image 3 style)
            if (i < totalCount - 1) {
              const dividerX = currentX + logoTargetWidth + gap / 2;
              doc.moveTo(dividerX, logosY + 2).lineTo(dividerX, logosY + logoTargetHeight - 2).lineWidth(0.6).strokeColor(ruleGray).stroke();
            }

            currentX += logoTargetWidth + gap;
          }

          return logosY + logoTargetHeight + 4;
        }
      };

      // ==========================================
      // PAGE 1 RENDERING
      // ==========================================
      drawHeaderBanner();

      // Date / Valid Till / Page strip
      const metaY = headerHeight + 6;
      const metaH = 23;
      doc.roundedRect(leftMargin, metaY, contentWidth, metaH, 4)
        .fillAndStroke(isEcDial ? '#F8F5FF' : '#EFF7FF', isEcDial ? '#D7D1F4' : '#B8D6F2');
      doc.fillColor(themePrimary).fontSize(7.5).font('Helvetica-Bold')
        .text(`Date: ${formattedDate}`, leftMargin + 12, metaY + 7);
      doc.fillColor(themePrimary).fontSize(7.5).font('Helvetica-Bold')
        .text(`Valid Till: ${formattedValidTill}`, leftMargin + 190, metaY + 7);
      doc.fillColor(themePrimary).fontSize(7.5).font('Helvetica-Bold')
        .text(`Page: 1 of ${totalPages}`, rightMargin - 100, metaY + 7, { width: 88, align: 'right' });

      // Top Customer & Summary Area
      const clientBoxY = metaY + metaH + 8;
      const clientBoxWidth = 265;
      const quoteCardWidth = 210;
      const quoteCardX = rightMargin - quoteCardWidth;

      // Customer Info (Left)
      doc.fillColor(themePrimary).fontSize(8.5).font('Helvetica').text('To,', leftMargin, clientBoxY);
      const custName = sanitizePdfText(data.customerName) || 'Valued Customer';
      doc.fillColor(themePrimary).fontSize(11).font('Helvetica-Bold')
        .text(custName, leftMargin, clientBoxY + 12, { width: clientBoxWidth });

      let custInfoY = clientBoxY + 28;
      if (data.customerAddress) {
        const custAddr = sanitizePdfText(data.customerAddress);
        doc.fillColor(textMuted).fontSize(8).font('Helvetica')
          .text(custAddr, leftMargin, custInfoY, { width: clientBoxWidth });
        custInfoY += doc.heightOfString(custAddr, { width: clientBoxWidth }) + 3;
      }
      if (data.customerPhone) {
        doc.fillColor(textMuted).fontSize(8).font('Helvetica')
          .text(`Mobile: ${sanitizePdfText(data.customerPhone)}`, leftMargin, custInfoY, { width: clientBoxWidth });
      }

      // Quotation Summary Card (Right) - NO quotation number in header as requested
      const quoteCardY = clientBoxY;
      const cardRowH = 15;
      const summaryHeaderH = 18;
      const cardTotalRows = 3; // Sub Total, CGST, SGST
      const quoteCardHeight = summaryHeaderH + (cardTotalRows * cardRowH) + 20;

      // Main Container with rounded border
      doc.roundedRect(quoteCardX, quoteCardY, quoteCardWidth, quoteCardHeight, 4)
        .lineWidth(1).strokeColor(ruleGray).fillAndStroke('#FFFFFF', ruleGray);

      // Card Header (Clean Centered Title - NO Quotation Number)
      doc.roundedRect(quoteCardX, quoteCardY, quoteCardWidth, summaryHeaderH, 3)
        .fill(themePrimary);
      
      doc.fillColor('#FFFFFF').fontSize(9.5).font('Helvetica-Bold')
        .text('QUOTATION', quoteCardX, quoteCardY + 4.5, { width: quoteCardWidth, align: 'center' });

      // Rows
      let curRowY = quoteCardY + summaryHeaderH;

      // Row 1: Sub Total
      doc.fillColor(textMuted).fontSize(8).font('Helvetica')
        .text(isTwoPages ? 'Sub Total (A)' : 'Sub Total', quoteCardX + 8, curRowY + 3.5);
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
        .text(`Rs. ${data.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, quoteCardX + 80, curRowY + 3, { width: quoteCardWidth - 88, align: 'right' });
      doc.moveTo(quoteCardX, curRowY + cardRowH).lineTo(quoteCardX + quoteCardWidth, curRowY + cardRowH).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      curRowY += cardRowH;

      // Row 3: CGST 9%
      doc.fillColor(textDark).fontSize(8).font('Helvetica-Bold')
        .text(`CGST ${data.cgstPercent}%`, quoteCardX + 8, curRowY + 3.5);
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
        .text(`Rs. ${data.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, quoteCardX + 80, curRowY + 3, { width: quoteCardWidth - 88, align: 'right' });
      doc.moveTo(quoteCardX, curRowY + cardRowH).lineTo(quoteCardX + quoteCardWidth, curRowY + cardRowH).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
      curRowY += cardRowH;

      // Row 4: SGST 9%
      doc.fillColor(textDark).fontSize(8).font('Helvetica-Bold')
        .text(`SGST ${data.sgstPercent}%`, quoteCardX + 8, curRowY + 3.5);
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
        .text(`Rs. ${data.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, quoteCardX + 80, curRowY + 3, { width: quoteCardWidth - 88, align: 'right' });
      curRowY += cardRowH;

      // Row 5: Total Banner (Navy)
      doc.rect(quoteCardX, curRowY, quoteCardWidth, 20).fill(themePrimary);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
        .text(isTwoPages ? 'TOTAL (A)' : 'TOTAL', quoteCardX + 8, curRowY + 5.5);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
        .text(`Rs. ${data.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, quoteCardX + 60, curRowY + 5, { width: quoteCardWidth - 68, align: 'right' });

      // Table Geometry
      let y = quoteCardY + quoteCardHeight + 8;

      const cols = {
        sl: leftMargin,
        slW: 34,
        desc: leftMargin + 34,
        descW: 242,
        qty: leftMargin + 276,
        qtyW: 42,
        unit: leftMargin + 318,
        unitW: 40,
        price: leftMargin + 358,
        priceW: 84,
        amount: leftMargin + 442,
        amountW: 89.28,
      };

      // Draw Section Header Pill
      const drawSectionPill = (badgeLetter: string, title: string, itemCount: number) => {
        doc.roundedRect(leftMargin, y, 22, 17, 4).fill(themePrimary);
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
          .text(badgeLetter, leftMargin, y + 3.5, { width: 22, align: 'center' });

        doc.fillColor(themePrimary).fontSize(9.5).font('Helvetica-Bold')
          .text(title, leftMargin + 28, y + 3.5);
        
        const countText = `( ${itemCount} ITEMS )`;
        const titleW = doc.widthOfString(title);
        doc.fillColor(orangeBadge).fontSize(8).font('Helvetica-Bold')
          .text(countText, leftMargin + 30 + titleW, y + 4.5);

        y += 20;
      };

      // Draw Table Header Bar
      const drawTableHeader = (priceLabel = 'Price (Rs.)') => {
        doc.rect(leftMargin, y, contentWidth, 16).fill(themePrimary);
        doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
        doc.text('SL.No', cols.sl, y + 4, { width: cols.slW, align: 'center' });
        doc.text('Description', cols.desc + 6, y + 4, { width: cols.descW - 6, align: 'left' });
        doc.text('Qty', cols.qty, y + 4, { width: cols.qtyW, align: 'center' });
        doc.text('Unit', cols.unit, y + 4, { width: cols.unitW, align: 'center' });
        doc.text(priceLabel, cols.price, y + 4, { width: cols.priceW, align: 'right' });
        doc.text('Amount (Rs.)', cols.amount, y + 4, { width: cols.amountW - 6, align: 'right' });
        y += 16;
      };

      // In 1-Page mode, set safe row heights to guarantee ZERO overlap with Terms & Conditions
      const mainUnitRowHeight1P = mainItems.length === 1 ? 25 : 22;
      const lowSideRowHeight1P = lowSideItems.length <= 4 ? 20 : (lowSideItems.length <= 6 ? 17 : 15.5);
      const sectionGap1P = 6;

      // SECTION A: MAIN UNITS TABLE
      drawSectionPill('A', 'MAIN UNITS', mainItems.length);
      drawTableHeader('Price (Rs.)');

      const mainRowH = isTwoPages ? 30 : mainUnitRowHeight1P;

      // Render Section A Rows
      mainItems.forEach((item, idx) => {
        const isAlt = idx % 2 === 1;
        if (isAlt) {
          doc.rect(leftMargin, y, contentWidth, mainRowH).fill(rowAltBg);
        }

        doc.rect(leftMargin, y, contentWidth, mainRowH).lineWidth(0.5).strokeColor(ruleGray).stroke();
        doc.moveTo(cols.desc, y).lineTo(cols.desc, y + mainRowH).stroke();
        doc.moveTo(cols.qty, y).lineTo(cols.qty, y + mainRowH).stroke();
        doc.moveTo(cols.unit, y).lineTo(cols.unit, y + mainRowH).stroke();
        doc.moveTo(cols.price, y).lineTo(cols.price, y + mainRowH).stroke();
        doc.moveTo(cols.amount, y).lineTo(cols.amount, y + mainRowH).stroke();

        const vCenter = y + (mainRowH - 9) / 2;

        doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
          .text(String(idx + 1), cols.sl, vCenter, { width: cols.slW, align: 'center' });

        const descStr = sanitizePdfText(item.description);
        doc.fillColor(textDark).fontSize(7.5).font('Helvetica-Bold')
          .text(descStr, cols.desc + 6, y + 4, { width: cols.descW - 12, lineGap: 1 });

        doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
          .text(String(item.quantity), cols.qty, vCenter, { width: cols.qtyW, align: 'center' });

        doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
          .text(sanitizePdfText(item.unit) || 'Nos', cols.unit, vCenter, { width: cols.unitW, align: 'center' });

        doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
          .text(item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.price, vCenter, { width: cols.priceW, align: 'right' });

        doc.fillColor(textDark).fontSize(7.5).font('Helvetica-Bold')
          .text(item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.amount, vCenter, { width: cols.amountW - 6, align: 'right' });

        y += mainRowH;
      });

      // Total (A) Subtotal Row
      doc.rect(leftMargin, y, contentWidth, 16).fill('#FFFFFF');
      doc.rect(leftMargin, y, contentWidth, 16).lineWidth(0.8).strokeColor(ruleGray).stroke();
      doc.fillColor(themePrimary).fontSize(8).font('Helvetica-Bold')
        .text('Total (A)', leftMargin + 8, y + 4);
      doc.fillColor(themePrimary).fontSize(8.5).font('Helvetica-Bold')
        .text(`Rs. ${data.mainUnitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, cols.amount, y + 3.5, { width: cols.amountW - 6, align: 'right' });
      y += 16;

      // ==========================================
      // SINGLE PAGE MODE vs TWO PAGE MODE
      // ==========================================
      if (!isTwoPages) {
        // --- 1-PAGE MODE (Fits 1 to 3 Main Units + Low-side items perfectly) ---
        if (lowSideItems.length > 0) {
          y += sectionGap1P;
          drawSectionPill('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', lowSideItems.length);
          drawTableHeader('Price (Rs.)');

          lowSideItems.forEach((item, idx) => {
            const isAlt = idx % 2 === 1;
            if (isAlt) doc.rect(leftMargin, y, contentWidth, lowSideRowHeight1P).fill(rowAltBg);
            doc.rect(leftMargin, y, contentWidth, lowSideRowHeight1P).lineWidth(0.5).strokeColor(ruleGray).stroke();
            doc.moveTo(cols.desc, y).lineTo(cols.desc, y + lowSideRowHeight1P).stroke();
            doc.moveTo(cols.qty, y).lineTo(cols.qty, y + lowSideRowHeight1P).stroke();
            doc.moveTo(cols.unit, y).lineTo(cols.unit, y + lowSideRowHeight1P).stroke();
            doc.moveTo(cols.price, y).lineTo(cols.price, y + lowSideRowHeight1P).stroke();
            doc.moveTo(cols.amount, y).lineTo(cols.amount, y + lowSideRowHeight1P).stroke();

            const vCenter = y + (lowSideRowHeight1P - 8) / 2;

            doc.fillColor(textDark).fontSize(7).font('Helvetica').text(String(idx + 1), cols.sl, vCenter, { width: cols.slW, align: 'center' });
            doc.fillColor(textDark).fontSize(7).font('Helvetica').text(sanitizePdfText(item.description), cols.desc + 6, y + 3.5, { width: cols.descW - 12 });
            doc.fillColor(textDark).fontSize(7).font('Helvetica').text(String(item.quantity), cols.qty, vCenter, { width: cols.qtyW, align: 'center' });
            doc.fillColor(textDark).fontSize(7).font('Helvetica').text(sanitizePdfText(item.unit) || 'Nos', cols.unit, vCenter, { width: cols.unitW, align: 'center' });
            doc.fillColor(textDark).fontSize(7).font('Helvetica').text(item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.price, vCenter, { width: cols.priceW, align: 'right' });
            doc.fillColor(textDark).fontSize(7).font('Helvetica-Bold').text(item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.amount, vCenter, { width: cols.amountW - 6, align: 'right' });
            y += lowSideRowHeight1P;
          });

          // Note: Total (B) has been removed as requested!
        }

        // Bottom commercial section: Terms left, Payment + Bank/Filler right.
        const dealerStripHeight = isEcDial ? 42 : 0;
        const dealerStartY = footerY - dealerStripHeight;
        const availableBottomHeight = Math.max(150, dealerStartY - y - 10);
        const gap = 8;
        const leftW = Math.min(315, contentWidth * 0.60);
        const rightW = contentWidth - leftW - gap;
        const termsRatio = 820 / 1600;
        const paymentRatio = 500 / 1200;
        const bankRatio = 460 / 1200;
        const rightGap = 6;
        const maxRightH = (availableBottomHeight - rightGap) / 2;
        const termsH = Math.min(availableBottomHeight, leftW * termsRatio);
        const paymentH = Math.min(maxRightH, rightW * paymentRatio);
        const bankH = Math.min(maxRightH, rightW * bankRatio);
        const stackH = paymentH + rightGap + bankH;
        const blockH = Math.max(termsH, stackH);
        const blockY = y + 5 + Math.max(0, (availableBottomHeight - blockH) / 2);
        const termsY = blockY + Math.max(0, (blockH - termsH) / 2);
        const rightX = leftMargin + leftW + gap;
        const stackY = blockY + Math.max(0, (blockH - stackH) / 2);

        if (termsPath) {
          try { doc.image(termsPath, leftMargin, termsY, { width: leftW, height: termsH }); } catch {}
        }
        if (paymentPath) {
          try { doc.image(paymentPath, rightX, stackY, { width: rightW, height: paymentH }); } catch {}
        }
        if (bankPath) {
          try { doc.image(bankPath, rightX, stackY + paymentH + rightGap, { width: rightW, height: bankH }); } catch {}
        }

        if (isEcDial) {
          drawAuthorizedBrandLogos(dealerStartY);
        }

        drawFooterBanner();
      } else {
        // --- TWO-PAGE MODE (For 4+ Main Units OR >10 items) ---
        const noteBoxY = footerY - 40;
        const noteBoxWidth = contentWidth;
        const noteBoxHeight = 30;

        doc.roundedRect(leftMargin, noteBoxY, noteBoxWidth, noteBoxHeight, 4)
          .lineWidth(0.8).strokeColor(orangeBorder).fillAndStroke(orangeBg, orangeBorder);
        
        doc.fillColor(orangeBadge).fontSize(8).font('Helvetica-Bold')
          .text('NOTE:', leftMargin + 8, noteBoxY + 6);
        doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
          .text('Low side materials, Terms & Conditions & Payment Details continued on next page.', leftMargin + 42, noteBoxY + 6, { width: noteBoxWidth - 210 });

        // Clean Continued on next page Link (NO garbled emojis/characters)
        doc.fillColor(themeAccent).fontSize(9).font('Helvetica-Bold')
          .text('Continued on next page ->', rightMargin - 165, noteBoxY + 10, { width: 155, align: 'right' });

        drawFooterBanner();

        // ==========================================
        // PAGE 2 RENDERING (Generous Vertical Spacing between items)
        // ==========================================
        doc.addPage({ size: 'A4', margin: 0 });
        drawHeaderBanner();

        // Page 2 Subheader on Right
        const p2SubY = headerHeight + 8;
        doc.fillColor(textMuted).fontSize(8.5).font('Helvetica')
          .text(`Date: ${formattedDate}   |   Page 2 of 2`, leftMargin, p2SubY, { width: contentWidth, align: 'right' });

        y = p2SubY + 16;

        // Reserve the bottom commercial section on Page 2.
        const p2DealerHeight = isEcDial ? 42 : 0;
        const p2DealerStartY = footerY - p2DealerHeight;
        const p2BottomTop = Math.max(y + 10, p2DealerStartY - 205);

        // SECTION B: LOW SIDE TABLE (Dynamically expanded with generous padding to fill Page 2 gracefully)
        drawSectionPill('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', lowSideItems.length);
        drawTableHeader('Price (Rs.)');

        const availableSpaceP2 = p2BottomTop - y - 10;
        const countLowSide = Math.max(1, lowSideItems.length);
        const lowSideRowHeight2P = Math.max(30, Math.min(42, Math.floor(availableSpaceP2 / (countLowSide + 1.2))));

        lowSideItems.forEach((item, idx) => {
          const isAlt = idx % 2 === 1;
          if (isAlt) {
            doc.rect(leftMargin, y, contentWidth, lowSideRowHeight2P).fill(rowAltBg);
          }

          doc.rect(leftMargin, y, contentWidth, lowSideRowHeight2P).lineWidth(0.5).strokeColor(ruleGray).stroke();
          doc.moveTo(cols.desc, y).lineTo(cols.desc, y + lowSideRowHeight2P).stroke();
          doc.moveTo(cols.qty, y).lineTo(cols.qty, y + lowSideRowHeight2P).stroke();
          doc.moveTo(cols.unit, y).lineTo(cols.unit, y + lowSideRowHeight2P).stroke();
          doc.moveTo(cols.price, y).lineTo(cols.price, y + lowSideRowHeight2P).stroke();
          doc.moveTo(cols.amount, y).lineTo(cols.amount, y + lowSideRowHeight2P).stroke();

          const vCenter = y + (lowSideRowHeight2P - 9) / 2;

          doc.fillColor(textDark).fontSize(8.5).font('Helvetica')
            .text(String(idx + 1), cols.sl, vCenter, { width: cols.slW, align: 'center' });

          doc.fillColor(textDark).fontSize(8).font('Helvetica')
            .text(sanitizePdfText(item.description), cols.desc + 6, y + 6, { width: cols.descW - 12, lineGap: 1 });

          doc.fillColor(textDark).fontSize(8.5).font('Helvetica')
            .text(String(item.quantity), cols.qty, vCenter, { width: cols.qtyW, align: 'center' });

          doc.fillColor(textDark).fontSize(8.5).font('Helvetica')
            .text(sanitizePdfText(item.unit) || 'Nos', cols.unit, vCenter, { width: cols.unitW, align: 'center' });

          doc.fillColor(textDark).fontSize(8.5).font('Helvetica')
            .text(item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.price, vCenter, { width: cols.priceW, align: 'right' });

          doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
            .text(item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.amount, vCenter, { width: cols.amountW - 6, align: 'right' });

          y += lowSideRowHeight2P;
        });

        // Page 2 commercial section: terms + payment + bank/filler.
        const p2AvailableBottomHeight = Math.max(150, p2DealerStartY - y - 10);
        const p2Gap = 8;
        const p2LeftW = Math.min(315, contentWidth * 0.60);
        const p2RightW = contentWidth - p2LeftW - p2Gap;
        const p2TermsH = Math.min(p2AvailableBottomHeight, p2LeftW * (820 / 1600));
        const p2PaymentH = Math.min((p2AvailableBottomHeight - 6) / 2, p2RightW * (500 / 1200));
        const p2BankH = Math.min((p2AvailableBottomHeight - 6) / 2, p2RightW * (460 / 1200));
        const p2StackH = p2PaymentH + 6 + p2BankH;
        const p2BlockH = Math.max(p2TermsH, p2StackH);
        const p2BlockY = p2DealerStartY - p2BlockH - 5;
        const p2TermsY2 = p2BlockY + Math.max(0, (p2BlockH - p2TermsH) / 2);
        const p2RightX = leftMargin + p2LeftW + p2Gap;
        const p2StackY = p2BlockY + Math.max(0, (p2BlockH - p2StackH) / 2);
        if (termsPath) { try { doc.image(termsPath, leftMargin, p2TermsY2, { width: p2LeftW, height: p2TermsH }); } catch {} }
        if (paymentPath) { try { doc.image(paymentPath, p2RightX, p2StackY, { width: p2RightW, height: p2PaymentH }); } catch {} }
        if (bankPath) { try { doc.image(bankPath, p2RightX, p2StackY + p2PaymentH + 6, { width: p2RightW, height: p2BankH }); } catch {} }

        // Prominent Authorized Brand Logos Strip on Page 2 (Directly before footer)
        if (isEcDial) {
          drawAuthorizedBrandLogos(p2DealerStartY);
        }

        drawFooterBanner();
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

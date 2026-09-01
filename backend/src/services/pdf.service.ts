import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

export interface PDFQuotationData {
  quotationNumber: string;
  revisionNumber?: number;
  date: string;
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
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
  }>;
  lowSideItems: Array<{
    description: string;
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
    path.join(process.cwd(), 'assets', filename),
    path.join(process.cwd(), 'backend/assets', filename),
    path.join(
      'C:/Users/arnes/.gemini/antigravity-ide/brain/78cac626-56d1-4691-80a3-c0cd8bcebf5c/.user_uploaded',
      filename === 'quotation_header.png'
        ? 'media_1788114894031.png'
        : filename === 'quotation_terms_payment.png'
        ? 'media_1788114894051.png'
        : 'media_1788114894076.png'
    ),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function generateQuotationPDF(data: PDFQuotationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Standard A4 dimensions: 595.28 x 841.89 pt
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        autoFirstPage: true,
        info: {
          Title: `Quotation_${sanitizePdfText(data.quotationNumber) || 'Offer'}`,
          Author: 'ECDIAL - Authorized Sales & Service Dealer',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Brand Color Palette matching Reference Images
      const daikinDarkNavy = '#0A1E3F';
      const daikinDarkBlue = '#004080';
      const daikinBrightBlue = '#0066CC';
      const ruleGray = '#CBD5E1';
      const lightBgGray = '#F8FAFC';
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

      // Asset Paths & Dimensions
      const headerPath = getAssetPath('quotation_header.png');
      const footerPath = getAssetPath('quotation_footer.png');
      const termsPaymentPath = getAssetPath('quotation_terms_payment.png');

      const headerWidth = 595.28;
      const headerHeight = headerWidth * (119 / 637); // ~111.2 pt
      const footerWidth = 595.28;
      const footerHeight = footerWidth * (106 / 1024); // ~61.6 pt
      const footerY = 841.89 - footerHeight; // ~780.29 pt

      const termsWidth = contentWidth;
      const termsHeight = termsWidth * (176 / 572); // ~163.4 pt

      // Helper to format date as DD-MM-YYYY
      const formatDisplayDate = (dateStr?: string): string => {
        if (!dateStr) return '18-05-2026';
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[0].length === 4) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr;
      };

      const displayDate = formatDisplayDate(sanitizePdfText(data.date));

      // Space available between Customer Summary Card and Terms block
      const termsY1Page = footerY - termsHeight - 8; // ~608.89 pt

      // If Main Units >= 4 or total items > 7, use 2 pages. Otherwise, use 1 page.
      const isTwoPages = mainItems.length >= 4 || (mainItems.length + lowSideItems.length > 7);
      const totalPages = isTwoPages ? 2 : 1;

      // Helper to draw the Top Header on any page
      const drawHeaderBanner = () => {
        if (headerPath) {
          doc.image(headerPath, 0, 0, { width: headerWidth });
        } else {
          doc.rect(0, 0, headerWidth, headerHeight).fill('#F8FAFC');
          doc.fillColor(daikinBrightBlue).fontSize(22).font('Helvetica-Bold').text('DAIKIN', 34, 28);
          doc.fillColor(daikinDarkNavy).fontSize(9).font('Helvetica-Bold').text('AIR CONDITIONERS', 34, 52);
        }
      };

      // Helper to draw Footer Banner on any page
      const drawFooterBanner = () => {
        if (footerPath) {
          doc.image(footerPath, 0, footerY, { width: footerWidth });
        } else {
          doc.rect(0, 841.89 - 30, headerWidth, 30).fill(daikinDarkNavy);
          doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica')
            .text('Thanking you and assure our best service always. • ECDIAL Coimbatore', leftMargin, 841.89 - 20);
        }
      };

      // =========================================================================
      // 2. RENDER PAGE 1 TOP SECTION
      // =========================================================================
      drawHeaderBanner();

      let y = headerHeight + 8;

      // Customer Info (Left) & Quotation Commercial Summary Box (Right)
      const cleanCustomerName = sanitizePdfText(data.customerName);
      const cleanCustomerAddress = sanitizePdfText(data.customerAddress);
      const cleanCustomerPhone = sanitizePdfText(data.customerPhone);
      const hasCustomer = cleanCustomerName.length > 0;

      const rightCardWidth = 205;
      const rightCardX = rightMargin - rightCardWidth;
      const cardHeight = 114;
      const cardRowH = 18;

      // Left Customer Box
      if (hasCustomer) {
        doc.fillColor(daikinBrightBlue).fontSize(11).font('Helvetica-Bold')
          .text('To,', leftMargin, y + 2);
        doc.fillColor(textDark).fontSize(13.5).font('Helvetica-Bold')
          .text(cleanCustomerName, leftMargin, y + 18, { width: 280 });
        
        let custY = y + 36;
        if (cleanCustomerAddress.length > 0) {
          doc.fillColor(textMuted).fontSize(9.5).font('Helvetica')
            .text(cleanCustomerAddress, leftMargin, custY, { width: 280 });
          custY += doc.heightOfString(cleanCustomerAddress, { width: 280 }) + 4;
        }
        if (cleanCustomerPhone.length > 0) {
          doc.fillColor(textMuted).fontSize(9.5).font('Helvetica')
            .text(`Mobile: ${cleanCustomerPhone}`, leftMargin, custY, { width: 280 });
        }
      }

      // Right: Quotation Commercial Summary Box (Crisp High-Contrast Grid)
      doc.roundedRect(rightCardX, y, rightCardWidth, cardHeight, 5)
        .lineWidth(0.8).strokeColor('#CBD5E1').fillAndStroke('#FFFFFF', '#CBD5E1');

      // Top Navy Header: QUOTATION
      doc.roundedRect(rightCardX, y, rightCardWidth, 23, 5).fill(daikinDarkNavy);
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
        .text('QUOTATION', rightCardX, y + 6.5, { width: rightCardWidth, align: 'center' });

      // Row 1: Date (Clean date only, quotation number removed as requested)
      const r1Y = y + 23;
      doc.rect(rightCardX, r1Y, rightCardWidth, cardRowH).fill('#F8FAFC');
      doc.rect(rightCardX, r1Y, rightCardWidth, 0.6).fill('#E2E8F0');
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica')
        .text(`Date: ${displayDate}`, rightCardX, r1Y + 4.5, { width: rightCardWidth, align: 'center' });

      // Row 2: Sub Total
      const r2Y = r1Y + cardRowH;
      doc.rect(rightCardX, r2Y, rightCardWidth, 0.6).fill('#E2E8F0');
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
        .text(isTwoPages ? 'Sub Total (A)' : 'Sub Total', rightCardX + 10, r2Y + 4.5);
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
        .text(`Rs. ${Number(data.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 80, r2Y + 4.5, { width: rightCardWidth - 90, align: 'right' });

      // Row 3: CGST (Crisp dark text)
      const r3Y = r2Y + cardRowH;
      doc.rect(rightCardX, r3Y, rightCardWidth, 0.6).fill('#E2E8F0');
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
        .text(`CGST ${data.cgstPercent || 9}%`, rightCardX + 10, r3Y + 4.5);
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
        .text(`Rs. ${Number(data.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 80, r3Y + 4.5, { width: rightCardWidth - 90, align: 'right' });

      // Row 4: SGST (Crisp dark text)
      const r4Y = r3Y + cardRowH;
      doc.rect(rightCardX, r4Y, rightCardWidth, 0.6).fill('#E2E8F0');
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
        .text(`SGST ${data.sgstPercent || 9}%`, rightCardX + 10, r4Y + 4.5);
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
        .text(`Rs. ${Number(data.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 80, r4Y + 4.5, { width: rightCardWidth - 90, align: 'right' });

      // Row 5: Total Banner
      const r5Y = r4Y + cardRowH;
      doc.roundedRect(rightCardX, r5Y, rightCardWidth, 24, 5).fill(daikinDarkNavy);
      doc.fillColor('#FFFFFF').fontSize(9.5).font('Helvetica-Bold')
        .text(isTwoPages ? 'TOTAL (A)' : 'TOTAL', rightCardX + 10, r5Y + 6.5);
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
        .text(`Rs. ${Number(data.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 75, r5Y + 6, { width: rightCardWidth - 85, align: 'right' });

      // Vertical divider in middle of summary box
      doc.rect(rightCardX + 90, r1Y, 0.6, cardRowH * 4).fill('#E2E8F0');

      y += cardHeight + 10;

      // =========================================================================
      // 3. TABLE COLUMN LAYOUT & DYNAMIC PROPORTIONAL HEIGHT CALCULATOR
      // =========================================================================
      // Column Coordinates (Total: 531.28 pt)
      const colX = {
        sl: leftMargin, // 32
        slW: 34,
        desc: leftMargin + 34, // 66
        descW: 248,
        qty: leftMargin + 282, // 314
        qtyW: 38,
        unit: leftMargin + 320, // 352
        unitW: 38,
        price: leftMargin + 358, // 390
        priceW: 84,
        amount: leftMargin + 442, // 474
        amountW: 89.28,
      };

      // Calculate Auto-Flex row heights for 1-Page mode to perfectly fill the space
      let mainUnitRowHeight = 36;
      let lowSideRowHeight = 28;
      let sectionGap = 12;

      if (!isTwoPages) {
        const availableSpaceForTables = termsY1Page - y - 10;
        const fixedHeadersHeight = 44 + (lowSideItems.length > 0 ? 58 : 0);
        const freeSpaceForRows = Math.max(120, availableSpaceForTables - fixedHeadersHeight);
        
        const totalWeightedItems = 1.3 * (mainItems.length || 1) + 1.0 * (lowSideItems.length || 0);
        const baseUnit = freeSpaceForRows / totalWeightedItems;

        mainUnitRowHeight = Math.max(30, Math.min(48, Math.floor(baseUnit * 1.3)));
        lowSideRowHeight = Math.max(24, Math.min(36, Math.floor(baseUnit * 1.0)));
        sectionGap = Math.max(10, Math.min(20, Math.floor((availableSpaceForTables - (fixedHeadersHeight + mainItems.length * mainUnitRowHeight + lowSideItems.length * lowSideRowHeight)) / 2)));
      }

      const drawSectionTable = (
        badgeLetter: string,
        titleText: string,
        itemCountText: string | null,
        items: Array<{ description: string; quantity: number; unit: string; unitPrice: number; amount: number }>,
        subtotalLabel: string | null,
        subtotalVal: number | null,
        rowHeight: number
      ) => {
        if (!items || items.length === 0) return;

        // 1. Section Header Badge & Title
        doc.roundedRect(leftMargin, y, 22, 20, 4).fill(daikinDarkNavy);
        doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
          .text(badgeLetter, leftMargin + 7, y + 4.5);

        doc.fillColor(daikinDarkNavy).fontSize(11).font('Helvetica-Bold')
          .text(titleText, leftMargin + 30, y + 4.5);

        let titleW = doc.widthOfString(titleText);
        if (itemCountText) {
          doc.fillColor(orangeBadge).fontSize(10).font('Helvetica-Bold')
            .text(itemCountText, leftMargin + 34 + titleW, y + 4.5);
          titleW += doc.widthOfString(itemCountText) + 8;
        }

        // Thin Rule Line extending across remaining width
        const ruleStartX = leftMargin + 38 + titleW;
        if (ruleStartX < rightMargin) {
          doc.rect(ruleStartX, y + 12, rightMargin - ruleStartX, 0.8).fill(ruleGray);
        }

        y += 24;

        // 2. Table Column Header
        const headerH = 22;
        doc.roundedRect(leftMargin, y, contentWidth, headerH, 4).fill(daikinDarkNavy);
        doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
        doc.text('SL.No', colX.sl, y + 6.5, { width: colX.slW, align: 'center' });
        doc.text('Description', colX.desc + 6, y + 6.5, { width: colX.descW - 6 });
        doc.text('Qty', colX.qty, y + 6.5, { width: colX.qtyW, align: 'center' });
        doc.text('Unit', colX.unit, y + 6.5, { width: colX.unitW, align: 'center' });
        doc.text('Price (Rs.)', colX.price, y + 6.5, { width: colX.priceW - 4, align: 'right' });
        doc.text('Amount (Rs.)', colX.amount, y + 6.5, { width: colX.amountW - 6, align: 'right' });
        y += headerH;

        // 3. Table Rows with Generous Spacing & 2-Line Support
        items.forEach((item, index) => {
          const rowBg = index % 2 === 0 ? '#FFFFFF' : rowAltBg;
          
          const descText = sanitizePdfText(item.description);
          doc.fontSize(8.5).font('Helvetica-Bold');
          const textH = doc.heightOfString(descText, { width: colX.descW - 10 });
          const actualRowHeight = Math.max(rowHeight, textH + 12);

          doc.rect(leftMargin, y, contentWidth, actualRowHeight).lineWidth(0.5).strokeColor(ruleGray).fillAndStroke(rowBg, ruleGray);

          const verticalTextY = y + (actualRowHeight - 9) / 2;

          // SL.No
          doc.fillColor(textMuted).fontSize(8.5).font('Helvetica')
            .text(String(index + 1), colX.sl, verticalTextY, { width: colX.slW, align: 'center' });

          // Description (supports 2-line wrap)
          const descVerticalY = y + Math.max(5, (actualRowHeight - textH) / 2);
          doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
            .text(descText, colX.desc + 6, descVerticalY, { width: colX.descW - 10 });

          // Qty
          doc.fillColor(textDark).font('Helvetica')
            .text(String(item.quantity || 1), colX.qty, verticalTextY, { width: colX.qtyW, align: 'center' });

          // Unit
          doc.text(sanitizePdfText(item.unit) || 'Nos', colX.unit, verticalTextY, { width: colX.unitW, align: 'center' });

          // Price
          doc.text(Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.price, verticalTextY, { width: colX.priceW - 4, align: 'right' });

          // Amount
          doc.font('Helvetica-Bold')
            .text(Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), colX.amount, verticalTextY, { width: colX.amountW - 6, align: 'right' });

          y += actualRowHeight;
        });

        // 4. Subtotal Row Bar (Optional when explicit subtotal provided)
        if (subtotalLabel && subtotalVal !== null) {
          const subtotalH = 22;
          doc.roundedRect(leftMargin, y, contentWidth, subtotalH, 3).lineWidth(0.6).strokeColor(ruleGray).fillAndStroke('#F1F5F9', ruleGray);
          doc.fillColor(textDark).fontSize(9.5).font('Helvetica-Bold')
            .text(subtotalLabel, leftMargin + 10, y + 6);
          doc.fillColor(textDark).fontSize(10).font('Helvetica-Bold')
            .text(`Rs. ${Number(subtotalVal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colX.amount - 80, y + 5.5, { width: colX.amountW + 74, align: 'right' });

          y += subtotalH;
        }

        y += sectionGap;
      };

      // =========================================================================
      // 4. EXECUTE PAGE RENDERING (SINGLE-PAGE vs TWO-PAGES)
      // =========================================================================
      if (!isTwoPages) {
        // --- SINGLE-PAGE MODE ---
        drawSectionTable('A', 'MAIN UNIT', null, mainItems, null, null, mainUnitRowHeight);

        if (lowSideItems.length > 0) {
          drawSectionTable('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', null, lowSideItems, null, null, lowSideRowHeight);
        }

        if (termsPaymentPath) {
          doc.image(termsPaymentPath, leftMargin, termsY1Page, { width: termsWidth });
        }

        drawFooterBanner();
      } else {
        // --- TWO-PAGE MODE (Image 2 & 3 Reference Style) ---
        // PAGE 1: Section A (Main Units)
        const mainSubtotal = data.mainUnitTotal || mainItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
        const countBadgeText = `( ${mainItems.length} ITEMS )`;
        
        drawSectionTable('A', 'MAIN UNITS', countBadgeText, mainItems, null, null, 36);

        // Page 1 Bottom: Note box & Continued Link
        const noteBoxY = 735;
        const noteBoxHeight = 32;
        const noteBoxWidth = 320;

        // Note Box
        doc.roundedRect(leftMargin, noteBoxY, noteBoxWidth, noteBoxHeight, 4)
          .lineWidth(0.8).strokeColor(orangeBorder).fillAndStroke(orangeBg, orangeBorder);
        
        doc.fillColor(orangeBadge).fontSize(8).font('Helvetica-Bold')
          .text('NOTE:', leftMargin + 8, noteBoxY + 6);
        doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
          .text('Low side / additional materials (If added).\nTerms & Conditions, Payment Method & Other details on next page.', leftMargin + 40, noteBoxY + 6, { width: noteBoxWidth - 48 });

        // Continued on next page Link / Icon on Right
        doc.fillColor(daikinBrightBlue).fontSize(10).font('Helvetica-Bold')
          .text('📄  Continued on next page →', rightMargin - 180, noteBoxY + 10, { width: 180, align: 'right' });

        // Footer on Page 1
        drawFooterBanner();

        // PAGE 2
        doc.addPage({ size: 'A4', margin: 0 });

        drawHeaderBanner();

        // Subheader on Page 2: Date and Page 2 of 2
        const p2SubY = headerHeight + 6;
        doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold')
          .text(`Date: ${displayDate}`, rightMargin - 200, p2SubY, { width: 90, align: 'right' });
        doc.fillColor(textMuted).fontSize(9).font('Helvetica')
          .text('|', rightMargin - 105, p2SubY, { width: 10, align: 'center' });
        doc.fillColor(daikinBrightBlue).fontSize(9).font('Helvetica-Bold')
          .text(`Page 2 of ${totalPages}`, rightMargin - 90, p2SubY, { width: 90, align: 'right' });

        y = headerHeight + 22;

        // Section B: Low Side Items
        if (lowSideItems.length > 0) {
          const lowSideCountBadge = `( ${lowSideItems.length} ITEMS )`;
          drawSectionTable('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', lowSideCountBadge, lowSideItems, null, null, 30);
        }

        // Terms & Conditions / Payment Method on Page 2
        const p2TermsY = footerY - termsHeight - 8;
        if (termsPaymentPath) {
          doc.image(termsPaymentPath, leftMargin, p2TermsY, { width: termsWidth });
        }

        // Footer on Page 2
        drawFooterBanner();
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

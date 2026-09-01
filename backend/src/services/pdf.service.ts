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

      // =========================================================================
      // 1. DETERMINE MULTI-PAGE vs SINGLE-PAGE & DYNAMIC ROW HEIGHTS
      // =========================================================================
      // Terms block sits right above the footer with an 8pt gap
      const termsY1Page = footerY - termsHeight - 8; // ~608.89 pt

      // Space available between Customer Summary Card (ends at ~228pt) and Terms block (starts at ~608pt)
      const availableTableHeight1Page = termsY1Page - 228 - 10; // ~370.89 pt

      // If Main Units >= 4 or total items > 8, use 2 pages. Otherwise, use 1 page.
      const isTwoPages = mainItems.length >= 4 || (mainItems.length + lowSideItems.length > 8);
      const totalPages = isTwoPages ? 2 : 1;

      // Helper to draw the Top Header on Page 1
      const drawPage1Header = () => {
        if (headerPath) {
          doc.image(headerPath, 0, 0, { width: headerWidth });
        } else {
          doc.rect(0, 0, headerWidth, headerHeight).fill('#F8FAFC');
          doc.fillColor(daikinBrightBlue).fontSize(22).font('Helvetica-Bold').text('DAIKIN', 34, 28);
          doc.fillColor(daikinDarkNavy).fontSize(9).font('Helvetica-Bold').text('AIR CONDITIONERS', 34, 52);
        }
      };

      // Helper to draw the Top Header on Page 2
      const drawPage2Header = () => {
        const p2HeaderH = 46;
        doc.rect(0, 0, headerWidth, p2HeaderH).fill('#F8FAFC');
        
        // Brand on Left
        doc.fillColor(daikinBrightBlue).fontSize(16).font('Helvetica-Bold').text('DAIKIN', leftMargin, 12);
        doc.fillColor(daikinDarkNavy).fontSize(8).font('Helvetica-Bold').text('AIR CONDITIONERS', leftMargin + 65, 16);
        doc.fillColor(textMuted).fontSize(8).font('Helvetica').text('ECDIAL ENGINEERING SOLUTIONS', leftMargin + 165, 16);

        // Date & Page 2 of 2 on Right
        doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold')
          .text(`Date: ${sanitizePdfText(data.date)}`, rightMargin - 220, 10, { width: 100, align: 'right' });
        doc.fillColor(daikinBrightBlue).fontSize(9).font('Helvetica-Bold')
          .text(`Page 2 of ${totalPages}`, rightMargin - 105, 10, { width: 105, align: 'right' });
        doc.fillColor(textMuted).fontSize(8).font('Helvetica')
          .text(sanitizePdfText(data.quotationNumber), rightMargin - 150, 24, { width: 150, align: 'right' });

        // Accent Bottom Border
        doc.rect(0, p2HeaderH - 1.5, headerWidth, 1.5).fill(daikinBrightBlue);
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
      drawPage1Header();

      let y = headerHeight + 5;

      // Customer Info (Left) & Quotation Commercial Summary Box (Right)
      const cleanCustomerName = sanitizePdfText(data.customerName);
      const cleanCustomerAddress = sanitizePdfText(data.customerAddress);
      const cleanCustomerPhone = sanitizePdfText(data.customerPhone);
      const hasCustomer = cleanCustomerName.length > 0;

      const rightCardWidth = 205;
      const rightCardX = rightMargin - rightCardWidth;
      const cardHeight = 112;

      // Top Meta: Date and Page Number indicator above cards if multi-page
      if (isTwoPages) {
        doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold')
          .text(`Date: ${sanitizePdfText(data.date)}`, rightMargin - 220, y - 2, { width: 110, align: 'right' });
        doc.fillColor(daikinBrightBlue).fontSize(9).font('Helvetica-Bold')
          .text(`Page 1 of ${totalPages}`, rightMargin - 100, y - 2, { width: 100, align: 'right' });
        y += 10;
      }

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

      // Right: Quotation Commercial Card
      doc.roundedRect(rightCardX, y, rightCardWidth, cardHeight, 6)
        .lineWidth(0.8).strokeColor(ruleGray).fillAndStroke('#FFFFFF', ruleGray);

      // Top Dark Blue Header: QUOTATION
      doc.roundedRect(rightCardX, y, rightCardWidth, 23, 5).fill(daikinDarkNavy);
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
        .text('QUOTATION', rightCardX, y + 6.5, { width: rightCardWidth, align: 'center' });

      // Summary Meta: Date & Quote Number
      const dateY = y + 27;
      doc.fillColor(textMuted).fontSize(8.5).font('Helvetica')
        .text(`Date: ${sanitizePdfText(data.date)}`, rightCardX + 10, dateY);
      doc.text(sanitizePdfText(data.quotationNumber), rightCardX + 80, dateY, { width: rightCardWidth - 90, align: 'right' });

      // Divider line below meta
      doc.rect(rightCardX, y + 39, rightCardWidth, 0.8).fill(ruleGray);

      // Breakdown Lines
      const cardBodyY = y + 44;
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica');
      doc.text('Sub Total', rightCardX + 12, cardBodyY);
      doc.font('Helvetica-Bold').text(`Rs. ${Number(data.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 75, cardBodyY, { width: rightCardWidth - 87, align: 'right' });
      doc.rect(rightCardX + 10, cardBodyY + 13, rightCardWidth - 20, 0.5).fill('#EEF3F8');

      doc.font('Helvetica').text(`CGST ${data.cgstPercent || 9}%`, rightCardX + 12, cardBodyY + 17);
      doc.font('Helvetica-Bold').text(`Rs. ${Number(data.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 75, cardBodyY + 17, { width: rightCardWidth - 87, align: 'right' });
      doc.rect(rightCardX + 10, cardBodyY + 30, rightCardWidth - 20, 0.5).fill('#EEF3F8');

      doc.font('Helvetica').text(`SGST ${data.sgstPercent || 9}%`, rightCardX + 12, cardBodyY + 34);
      doc.font('Helvetica-Bold').text(`Rs. ${Number(data.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 75, cardBodyY + 34, { width: rightCardWidth - 87, align: 'right' });

      // Total Banner (Bright Blue / Royal Blue Pill)
      doc.roundedRect(rightCardX, y + cardHeight - 24, rightCardWidth, 24, 5).fill(daikinDarkNavy);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
        .text('TOTAL', rightCardX + 12, y + cardHeight - 17);
      doc.fontSize(12).font('Helvetica-Bold')
        .text(`Rs. ${Number(data.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 65, y + cardHeight - 18, { width: rightCardWidth - 77, align: 'right' });

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
          
          // Determine dynamic row height if description wraps
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
        // --- SINGLE-PAGE MODE (Image 3 Reference Style) ---
        // Render Section A (Main Unit)
        drawSectionTable('A', 'MAIN UNIT', null, mainItems, null, null, mainUnitRowHeight);

        // Render Section B (Low Side Extra Materials)
        if (lowSideItems.length > 0) {
          drawSectionTable('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', null, lowSideItems, null, null, lowSideRowHeight);
        }

        // Terms & Conditions / Payment Method sits right at the bottom above the footer!
        if (termsPaymentPath) {
          doc.image(termsPaymentPath, leftMargin, termsY1Page, { width: termsWidth });
        }

        // Footer Banner at very bottom
        drawFooterBanner();
      } else {
        // --- TWO-PAGE MODE (Image 2 Reference Style) ---
        // PAGE 1: Section A (Main Units) with roomy rows & Continuation Note
        const mainSubtotal = data.mainUnitTotal || mainItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
        const countBadgeText = `( ${mainItems.length} ITEMS )`;
        
        drawSectionTable('A', 'MAIN UNITS', countBadgeText, mainItems, 'Total (A)', mainSubtotal, 34);

        // Page 1 Bottom Continuation Notice Bar
        const noteBoxY = 745;
        const noteBoxHeight = 26;
        const noteBoxWidth = 340;

        // Orange Outlined Note Box
        doc.roundedRect(leftMargin, noteBoxY, noteBoxWidth, noteBoxHeight, 4)
          .lineWidth(1).strokeColor(orangeBorder).fillAndStroke(orangeBg, orangeBorder);
        
        doc.fillColor(orangeBadge).fontSize(7.5).font('Helvetica-Bold')
          .text('NOTE:', leftMargin + 6, noteBoxY + 5);
        doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
          .text('Low side / additional materials (If added), Terms & Conditions, Payment Method & Other details on next page.', leftMargin + 36, noteBoxY + 5, { width: noteBoxWidth - 42 });

        // Continued on next page Link / Text on Right
        doc.fillColor(daikinDarkNavy).fontSize(9.5).font('Helvetica-Bold')
          .text('Continued on next page ->', rightMargin - 150, noteBoxY + 7.5, { width: 150, align: 'right' });

        // Navy bottom line on Page 1
        doc.rect(0, 841.89 - 8, headerWidth, 8).fill(daikinDarkNavy);

        // PAGE 2: Add Page
        doc.addPage({ size: 'A4', margin: 0 });

        drawPage2Header();
        y = 58;

        // Section B: Low Side Items (if any)
        if (lowSideItems.length > 0) {
          const lowSideSubtotal = data.lowSideTotal || lowSideItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
          const lowSideCountBadge = `( ${lowSideItems.length} ITEMS )`;
          drawSectionTable('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', lowSideCountBadge, lowSideItems, 'Total (B)', lowSideSubtotal, 28);
        }

        // Terms & Conditions / Payment Method on Page 2 sits above footer
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

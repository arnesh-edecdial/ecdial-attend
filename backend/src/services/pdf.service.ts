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
    path.join('C:/Users/arnes/.gemini/antigravity-ide/brain/78cac626-56d1-4691-80a3-c0cd8bcebf5c/.user_uploaded', filename === 'quotation_header.png' ? 'media_1788114894031.png' : filename === 'quotation_terms_payment.png' ? 'media_1788114894051.png' : 'media_1788114894076.png'),
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

      const primaryNavy = '#0A1E3F';
      const darkTableNavy = '#004080';
      const accentBlue = '#0066CC';
      const borderGray = '#CBD5E1';
      const textDark = '#0F172A';
      const textMuted = '#475569';

      const leftMargin = 32;
      const rightMargin = 563.28;
      const contentWidth = rightMargin - leftMargin; // 531.28 pt

      // =========================================================================
      // 1. FIXED TOP HEADER IMAGE (Full width A4 top)
      // =========================================================================
      const headerPath = getAssetPath('quotation_header.png');
      const headerWidth = 595.28;
      const headerHeight = headerWidth * (119 / 637); // ~111.2 pt

      if (headerPath) {
        doc.image(headerPath, 0, 0, { width: headerWidth });
      } else {
        // Fallback drawing if image missing
        doc.rect(0, 0, headerWidth, headerHeight).fill('#F8FAFC');
        doc.fillColor('#0099E5').fontSize(22).font('Helvetica-Bold').text('DAIKIN', 34, 30);
      }

      // =========================================================================
      // 2. FIXED BOTTOM FOOTER & FIXED TERMS/PAYMENT IMAGES
      // =========================================================================
      const footerPath = getAssetPath('quotation_footer.png');
      const footerWidth = 595.28;
      const footerHeight = footerWidth * (106 / 1024); // ~61.6 pt
      const footerY = 841.89 - footerHeight; // ~780.29 pt

      if (footerPath) {
        doc.image(footerPath, 0, footerY, { width: footerWidth });
      }

      const termsPaymentPath = getAssetPath('quotation_terms_payment.png');
      const termsWidth = contentWidth;
      const termsHeight = termsWidth * (176 / 572); // ~163.4 pt
      const termsY = footerY - termsHeight - 8; // ~608.8 pt

      if (termsPaymentPath) {
        doc.image(termsPaymentPath, leftMargin, termsY, { width: termsWidth });
      }

      // =========================================================================
      // 3. DYNAMIC MIDDLE SECTION (Between Header and Terms Image)
      // =========================================================================
      let y = headerHeight + 8; // Starts at ~119 pt

      // Dynamic Colors from DaikinQuotationDynamic
      const daikinDarkBlue = '#005A96';
      const daikinBrightBlue = '#0072BC';
      const ruleGray = '#DCE6EF';
      const rowDividerGray = '#EEF3F8';
      const metaGray = '#5B6B84';

      // Customer Information (Left) & Quotation Summary Card (Right)
      const cleanCustomerName = sanitizePdfText(data.customerName);
      const cleanCustomerAddress = sanitizePdfText(data.customerAddress);
      const cleanCustomerPhone = sanitizePdfText(data.customerPhone);
      const hasCustomer = cleanCustomerName.length > 0;
      
      const rightCardWidth = 205;
      const rightCardX = rightMargin - rightCardWidth;
      const cardHeight = 110;

      if (hasCustomer) {
        doc.fillColor(daikinBrightBlue).fontSize(11).font('Helvetica-Bold')
          .text('To,', leftMargin, y + 2);
        doc.fillColor(textDark).fontSize(13.5).font('Helvetica-Bold')
          .text(cleanCustomerName, leftMargin, y + 18);
        if (cleanCustomerAddress.length > 0) {
          doc.fillColor(metaGray).fontSize(10).font('Helvetica')
            .text(cleanCustomerAddress, leftMargin, y + 36, { width: 280 });
        }
        if (cleanCustomerPhone.length > 0) {
          doc.fillColor(metaGray).fontSize(9.5).font('Helvetica')
            .text(`Phone: ${cleanCustomerPhone}`, leftMargin, y + 52, { width: 280 });
        }
      }

      // Quotation Summary Card (Matching DaikinQuotationDynamic .qd-summary-card)
      doc.roundedRect(rightCardX, y, rightCardWidth, cardHeight, 6)
        .lineWidth(0.8).strokeColor(ruleGray).fillAndStroke('#FFFFFF', ruleGray);

      // Top Dark Blue Header: QUOTATION
      doc.roundedRect(rightCardX, y, rightCardWidth, 23, 5).fill(daikinDarkBlue);
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
        .text('QUOTATION', rightCardX, y + 6.5, { width: rightCardWidth, align: 'center' });

      // Summary Meta: Date & Quote Number
      const dateY = y + 27;
      doc.fillColor(metaGray).fontSize(8.5).font('Helvetica')
        .text(`Date: ${sanitizePdfText(data.date)}`, rightCardX + 10, dateY);
      doc.text(sanitizePdfText(data.quotationNumber), rightCardX + 80, dateY, { width: rightCardWidth - 90, align: 'right' });

      // Divider line below meta
      doc.rect(rightCardX, y + 39, rightCardWidth, 0.8).fill(ruleGray);

      // Breakdown Lines
      const cardBodyY = y + 44;
      doc.fillColor(textDark).fontSize(8.5).font('Helvetica');
      doc.text('Sub Total (A)', rightCardX + 12, cardBodyY);
      doc.font('Helvetica-Bold').text(`Rs.  ${Number(data.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 80, cardBodyY, { width: rightCardWidth - 92, align: 'right' });
      doc.rect(rightCardX + 10, cardBodyY + 12, rightCardWidth - 20, 0.5).fill(rowDividerGray);

      doc.font('Helvetica').text(`CGST ${data.cgstPercent || 9}%`, rightCardX + 12, cardBodyY + 16);
      doc.font('Helvetica-Bold').text(`Rs.  ${Number(data.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 80, cardBodyY + 16, { width: rightCardWidth - 92, align: 'right' });
      doc.rect(rightCardX + 10, cardBodyY + 28, rightCardWidth - 20, 0.5).fill(rowDividerGray);

      doc.font('Helvetica').text(`SGST ${data.sgstPercent || 9}%`, rightCardX + 12, cardBodyY + 32);
      doc.font('Helvetica-Bold').text(`Rs.  ${Number(data.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 80, cardBodyY + 32, { width: rightCardWidth - 92, align: 'right' });

      // Total Banner (Bright Blue / Royal Blue Pill)
      doc.roundedRect(rightCardX, y + cardHeight - 23, rightCardWidth, 23, 5).fill(daikinBrightBlue);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
        .text('TOTAL (A)', rightCardX + 12, y + cardHeight - 16);
      doc.fontSize(12).font('Helvetica-Bold')
        .text(`Rs. ${Number(data.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 70, y + cardHeight - 17, { width: rightCardWidth - 82, align: 'right' });

      y += cardHeight + 12;

      // =========================================================================
      // 4. DYNAMIC SPACE MANAGER FOR TABLES (MAIN UNIT & LOW SIDE)
      // =========================================================================
      const mainItems = data.mainItems || [];
      const lowSideItems = (data.hasLowSide && data.lowSideItems) ? data.lowSideItems : [];
      const totalItemCount = mainItems.length + lowSideItems.length;

      // Calculate dynamic row heights based on available space between current y and termsY
      const availableTableSpace = termsY - y - 10;
      let targetRowHeight = 23;
      let headerHeightTable = 21;

      if (totalItemCount <= 6) {
        targetRowHeight = 24;
      } else if (totalItemCount <= 10) {
        targetRowHeight = 20;
      } else if (totalItemCount > 10) {
        targetRowHeight = Math.max(16, Math.floor((availableTableSpace - 60) / (totalItemCount || 1)));
      }

      const drawSectionTable = (
        sectionLetter: string,
        sectionTitle: string,
        items: Array<{ description: string; quantity: number; unit: string; unitPrice: number; amount: number }>,
        rowHeight: number
      ) => {
        if (!items || items.length === 0) return;

        // Section Title & Badge (Matching DaikinQuotationDynamic .qd-section-heading)
        doc.roundedRect(leftMargin, y, 18, 16, 4).fill(daikinBrightBlue);
        doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
          .text(sectionLetter, leftMargin + 5.5, y + 3);

        doc.fillColor(daikinDarkBlue).fontSize(10.5).font('Helvetica-Bold')
          .text(sectionTitle, leftMargin + 24, y + 3.5);

        // Thin Rule Line extending across remaining width
        const titleWidth = doc.widthOfString(sectionTitle);
        const ruleStartX = leftMargin + 28 + titleWidth;
        if (ruleStartX < rightMargin) {
          doc.rect(ruleStartX, y + 9, rightMargin - ruleStartX, 0.8).fill(ruleGray);
        }

        y += 20;

        // Table Header
        doc.roundedRect(leftMargin, y, contentWidth, headerHeightTable, 4).fill(daikinDarkBlue);
        doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold');
        doc.text('Sl.No', leftMargin + 4, y + 6, { width: 34, align: 'center' });
        doc.text('Description', leftMargin + 42, y + 6, { width: 236 });
        doc.text('Qty', leftMargin + 282, y + 6, { width: 32, align: 'center' });
        doc.text('Unit', leftMargin + 318, y + 6, { width: 38, align: 'center' });
        doc.text('Price (INR)', leftMargin + 360, y + 6, { width: 78, align: 'right' });
        doc.text('Amount (INR)', leftMargin + 442, y + 6, { width: 82, align: 'right' });
        y += headerHeightTable;

        // Table Rows
        items.forEach((item, index) => {
          const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F9FBFC';
          doc.rect(leftMargin, y, contentWidth, rowHeight).lineWidth(0.5).strokeColor(ruleGray).fillAndStroke(rowBg, ruleGray);

          doc.fillColor(metaGray).fontSize(8).font('Helvetica');
          doc.text(String(index + 1), leftMargin + 4, y + (rowHeight - 9) / 2, { width: 34, align: 'center' });
          doc.fillColor(textDark).font('Helvetica-Bold').text(sanitizePdfText(item.description), leftMargin + 42, y + (rowHeight - 9) / 2, { width: 236, height: rowHeight - 3 });
          doc.font('Helvetica');
          doc.text(String(item.quantity || 1), leftMargin + 282, y + (rowHeight - 9) / 2, { width: 32, align: 'center' });
          doc.text(sanitizePdfText(item.unit) || 'Nos', leftMargin + 318, y + (rowHeight - 9) / 2, { width: 38, align: 'center' });
          doc.text(Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), leftMargin + 360, y + (rowHeight - 9) / 2, { width: 78, align: 'right' });
          doc.font('Helvetica-Bold').text(Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), leftMargin + 442, y + (rowHeight - 9) / 2, { width: 82, align: 'right' });

          y += rowHeight;
        });

        y += 10;
      };

      // Render Section A: MAIN UNIT
      drawSectionTable('A', 'MAIN UNIT', mainItems, targetRowHeight);

      // Render Section B: LOW SIDE
      if (lowSideItems.length > 0) {
        drawSectionTable('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', lowSideItems, targetRowHeight - 2);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}



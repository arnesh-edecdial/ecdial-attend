import PDFDocument from 'pdfkit';

export interface PDFQuotationData {
  quotationNumber: string;
  revisionNumber?: number;
  date: string;
  customerName: string;
  customerAddress: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  createdByName: string;
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
  termsAndConditions: string;
  paymentMethod: string;
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

export function generateQuotationPDF(data: PDFQuotationData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 28,
        info: {
          Title: `Quotation_${data.quotationNumber}`,
          Author: 'ECDIAL - Authorized Sales & Service Dealer',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const primaryNavy = '#0A1E3F';
      const brandCyan = '#0066CC';
      const accentBlue = '#0052A3';
      const tableHeaderBg = '#0052A3';
      const lightBg = '#F8FAFC';
      const borderGray = '#D1D9E6';
      const textDark = '#1E293B';
      const textMuted = '#475569';

      const pageWidth = doc.page.width;
      const leftMargin = 28;
      const rightMargin = pageWidth - 28;
      const contentWidth = rightMargin - leftMargin;

      // 1. TOP HEADER BANNER (Matching Image 2 with Daikin / ECDIAL Branding)
      doc.save();
      // Draw top header curved accent
      doc.rect(leftMargin, 20, contentWidth, 68).fill('#FFFFFF');

      // Left Logo Branding
      doc.fillColor(brandCyan).fontSize(24).font('Helvetica-Bold')
        .text('DAIKIN', leftMargin + 8, 28);
      doc.fillColor(primaryNavy).fontSize(8.5).font('Helvetica-Bold')
        .text('A I R   C O N D I T I O N E R S', leftMargin + 8, 54);
      doc.fontSize(7.5).font('Helvetica')
        .text('ECDIAL ENGINEERING SOLUTIONS', leftMargin + 8, 66);

      // Blue decorative wave shapes on top
      doc.path('M 260 20 L 380 20 L 320 88 L 230 88 Z').fill(accentBlue);
      doc.path('M 310 20 L 400 20 L 350 88 L 290 88 Z').fill(brandCyan);

      // Right Dealer Info Box
      const rightHeaderX = rightMargin - 180;
      doc.fillColor(primaryNavy).fontSize(9).font('Helvetica-Bold')
        .text('Authorized Sales & Service Dealer', rightHeaderX, 28, { width: 175, align: 'right' });
      doc.fillColor(textMuted).fontSize(7.5).font('Helvetica')
        .text('Coimbatore, Tamil Nadu', rightHeaderX, 42, { width: 175, align: 'right' })
        .text('+91 98765 43210', rightHeaderX, 54, { width: 175, align: 'right' })
        .text('sales@daikincoimbatore.in', rightHeaderX, 66, { width: 175, align: 'right' });
      doc.restore();

      let y = 98;

      // 2. CUSTOMER INFO (LEFT) & QUOTATION SUMMARY BOX (RIGHT)
      const leftBoxWidth = contentWidth * 0.52;
      const rightBoxWidth = contentWidth * 0.44;
      const rightBoxX = rightMargin - rightBoxWidth;

      // To Customer Block
      doc.fillColor(primaryNavy).fontSize(10).font('Helvetica-Bold').text('To,', leftMargin, y);
      doc.fontSize(14).font('Helvetica-Bold').text(data.customerName, leftMargin, y + 14);
      doc.fillColor(textMuted).fontSize(9).font('Helvetica').text(`📍 ${data.customerAddress}`, leftMargin, y + 34, { width: leftBoxWidth - 10 });
      if (data.customerPhone) {
        doc.text(`Phone: ${data.customerPhone}`, leftMargin, y + 50);
      }

      // Quotation Summary Card (Matching Image 2)
      doc.rect(rightBoxX, y, rightBoxWidth, 88).lineWidth(1).strokeColor(borderGray).fillAndStroke('#FFFFFF', borderGray);

      // Card Header
      doc.rect(rightBoxX, y, rightBoxWidth, 20).fill(brandCyan);
      doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
        .text('QUOTATION', rightBoxX + 10, y + 5);
      doc.fontSize(8.5).font('Helvetica')
        .text(`Date: ${data.date}`, rightBoxX + 100, y + 6, { width: rightBoxWidth - 110, align: 'right' });

      // Breakdown Lines
      const cardRowY = y + 24;
      doc.fillColor(textDark).fontSize(8).font('Helvetica');

      doc.text('Sub Total (A)', rightBoxX + 10, cardRowY);
      doc.text(`₹  ${Number(data.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightBoxX + 90, cardRowY, { width: rightBoxWidth - 100, align: 'right' });

      doc.text(`CGST ${data.cgstPercent}%`, rightBoxX + 10, cardRowY + 12);
      doc.text(`₹  ${Number(data.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightBoxX + 90, cardRowY + 12, { width: rightBoxWidth - 100, align: 'right' });

      doc.text(`SGST ${data.sgstPercent}%`, rightBoxX + 10, cardRowY + 24);
      doc.text(`₹  ${Number(data.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightBoxX + 90, cardRowY + 24, { width: rightBoxWidth - 100, align: 'right' });

      // Total Banner (Navy Blue)
      doc.rect(rightBoxX, y + 66, rightBoxWidth, 22).fill(primaryNavy);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
        .text('TOTAL (A)', rightBoxX + 10, y + 72);
      doc.fontSize(11).font('Helvetica-Bold')
        .text(`₹ ${Number(data.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightBoxX + 80, y + 71, { width: rightBoxWidth - 90, align: 'right' });

      y += 100;

      // 3. TABLE DRAWING HELPER (Matching Section A & Section B from Image 2)
      const drawSectionTable = (
        sectionBadge: string,
        sectionTitle: string,
        items: Array<{ description: string; quantity: number; unit: string; unitPrice: number; amount: number }>
      ) => {
        // Section Header with Badge
        doc.rect(leftMargin, y, 20, 16).fill(accentBlue);
        doc.fillColor('#FFFFFF').fontSize(9.5).font('Helvetica-Bold')
          .text(sectionBadge, leftMargin + 6, y + 3);

        doc.fillColor(primaryNavy).fontSize(9.5).font('Helvetica-Bold')
          .text(sectionTitle, leftMargin + 26, y + 3);

        // Header blue line
        doc.rect(leftMargin + 190, y + 8, contentWidth - 190, 1.5).fill(accentBlue);
        y += 20;

        // Table Header
        doc.rect(leftMargin, y, contentWidth, 18).fill(tableHeaderBg);
        doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
        doc.text('Sl.No', leftMargin + 5, y + 5, { width: 35, align: 'center' });
        doc.text('Description', leftMargin + 45, y + 5, { width: 235 });
        doc.text('Qty', leftMargin + 285, y + 5, { width: 35, align: 'center' });
        doc.text('Unit', leftMargin + 325, y + 5, { width: 45, align: 'center' });
        doc.text('Price (₹)', leftMargin + 375, y + 5, { width: 75, align: 'right' });
        doc.text('Amount (₹)', leftMargin + 455, y + 5, { width: 75, align: 'right' });
        y += 18;

        // Table Rows
        items.forEach((item, index) => {
          const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F9FBFE';
          const rowHeight = 22;
          doc.rect(leftMargin, y, contentWidth, rowHeight).lineWidth(0.5).strokeColor(borderGray).fillAndStroke(rowBg, borderGray);

          doc.fillColor(textDark).fontSize(8).font('Helvetica');
          doc.text(String(index + 1), leftMargin + 5, y + 6, { width: 35, align: 'center' });
          doc.font('Helvetica-Bold').text(item.description, leftMargin + 45, y + 6, { width: 235, height: 16 });
          doc.font('Helvetica');
          doc.text(String(item.quantity), leftMargin + 285, y + 6, { width: 35, align: 'center' });
          doc.text(item.unit, leftMargin + 325, y + 6, { width: 45, align: 'center' });
          doc.text(Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 }), leftMargin + 375, y + 6, { width: 75, align: 'right' });
          doc.font('Helvetica-Bold').text(Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }), leftMargin + 455, y + 6, { width: 75, align: 'right' });

          y += rowHeight;
        });

        y += 10;
      };

      // Render Section A: MAIN UNIT
      drawSectionTable('A', 'MAIN UNIT', data.mainItems);

      // Render Section B: LOW SIDE (B) IF NEED EXTRA MATERIALS
      if (data.hasLowSide && data.lowSideItems && data.lowSideItems.length > 0) {
        if (y > 540) {
          doc.addPage();
          y = 28;
        }
        drawSectionTable('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', data.lowSideItems);
      }

      // Check for Terms Box Page Break
      if (y > 580) {
        doc.addPage();
        y = 28;
      }

      // 4. BOTTOM TWO-COLUMN BOXES: TERMS & CONDITIONS (LEFT) + PAYMENT METHOD (RIGHT)
      const boxWidth = (contentWidth - 14) / 2;
      const boxHeight = 165;
      const rightColX = leftMargin + boxWidth + 14;

      // Left Box: TERMS & CONDITIONS
      doc.rect(leftMargin, y, boxWidth, boxHeight).lineWidth(1).strokeColor(borderGray).fillAndStroke('#FFFFFF', borderGray);
      doc.rect(leftMargin, y, boxWidth, 22).fill('#F1F5F9');
      doc.fillColor(primaryNavy).fontSize(9).font('Helvetica-Bold')
        .text('📝  TERMS & CONDITIONS', leftMargin + 8, y + 6);

      const termsList = [
        'AC Price is inclusive of 18 % taxes. 18% Tax Additional for Lowside.',
        'Electrical, Plumbing, civil work, Structural, core cutting, scaffolding, IDU Room wall opening for customer scope.',
        'We have given the quotation as per BOQ. Any variation in site quantities will be charged extra.',
        'Payment: 100% Machine with PO, 70% Lowside with PO, 25% on erection, 5% on final bill.',
        'Final bill will be raised on actual measured quantities at site.',
        'This Quotation Is Valid For 10 days.',
      ];

      let termY = y + 28;
      termsList.forEach((term, idx) => {
        // Number badge
        doc.circle(leftMargin + 14, termY + 4, 6).fill(primaryNavy);
        doc.fillColor('#FFFFFF').fontSize(6.5).font('Helvetica-Bold').text(String(idx + 1), leftMargin + 11.5, termY + 1.5);

        doc.fillColor(textDark).fontSize(6.5).font('Helvetica')
          .text(term, leftMargin + 25, termY, { width: boxWidth - 32 });
        termY += 21;
      });

      // Right Box: PAYMENT METHOD
      doc.rect(rightColX, y, boxWidth, boxHeight).lineWidth(1).strokeColor(borderGray).fillAndStroke('#FFFFFF', borderGray);
      doc.rect(rightColX, y, boxWidth, 22).fill('#F1F5F9');
      doc.fillColor(primaryNavy).fontSize(9).font('Helvetica-Bold')
        .text('💳  PAYMENT METHOD', rightColX + 8, y + 6);

      const paymentList = [
        { num: 'i', text: '100% Payment advance with P.O for Machine.' },
        { num: 'ii', text: '70% Advance of Total Lowside Value along with PO.' },
        { num: 'iii', text: '25% After completion of erection works.' },
        { num: 'iv', text: '5% Payment after raising the final bill.' },
      ];

      let payY = y + 28;
      paymentList.forEach((pay) => {
        doc.circle(rightColX + 14, payY + 5, 7).fill(brandCyan);
        doc.fillColor('#FFFFFF').fontSize(6.5).font('Helvetica-Bold').text(pay.num, rightColX + 11, payY + 2.5);

        doc.fillColor(textDark).fontSize(7).font('Helvetica')
          .text(pay.text, rightColX + 26, payY + 2, { width: boxWidth - 34 });
        payY += 24;
      });

      // Quality Cooling Badge
      doc.rect(rightColX + 12, payY + 4, boxWidth - 24, 28).fill('#EBF3FC');
      doc.fillColor(brandCyan).fontSize(7.5).font('Helvetica-Bold')
        .text('🛡️ Quality Cooling. Trusted Service. Every Time.', rightColX + 18, payY + 14);

      y += boxHeight + 10;

      // 5. FOOTER BANNER (Dark Blue with Handshake & AC unit silhouettes)
      if (y > doc.page.height - 45) {
        doc.addPage();
        y = doc.page.height - 45;
      }

      doc.rect(leftMargin, y, contentWidth, 32).fill(primaryNavy);
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
        .text('🤝  Thanking you and assure our best service always.', leftMargin + 12, y + 11);

      // AC Unit Icons text representation on right
      doc.fontSize(8).font('Helvetica')
        .text('❄️ Split AC Indoor / Outdoor Units', rightMargin - 160, y + 11, { width: 150, align: 'right' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

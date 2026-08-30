import PDFDocument from 'pdfkit';

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

      const primaryNavy = '#0B1E3F';
      const brandCyan = '#0084D6';
      const accentBlue = '#005CA9';
      const darkHeaderBg = '#004A8F';
      const borderGray = '#CBD5E1';
      const textDark = '#1E293B';
      const textMuted = '#64748B';

      const leftMargin = 32;
      const rightMargin = 563;
      const contentWidth = rightMargin - leftMargin; // 531 pt

      // 1. TOP RIGHT DECORATIVE WAVES (Matching Image 2)
      doc.save();
      doc.path('M 400 0 C 460 30, 520 20, 595 105 L 595 0 Z').fill('#0084D6');
      doc.path('M 440 0 C 490 20, 545 15, 595 70 L 595 0 Z').fill('#38BDF8');
      doc.restore();

      // 2. TOP BRANDING HEADER
      // Daikin Logo text and ECDIAL subtitle
      doc.fillColor('#0084D6').fontSize(22).font('Helvetica-Bold')
        .text('DAIKIN', leftMargin, 26);
      doc.fillColor(primaryNavy).fontSize(8).font('Helvetica-Bold')
        .text('AIR CONDITIONERS', leftMargin, 50);
      doc.fillColor(textMuted).fontSize(7).font('Helvetica')
        .text('ECDIAL ENGINEERING SOLUTIONS', leftMargin, 60);

      // Authorized Dealer Info on the right
      const dealerX = rightMargin - 190;
      doc.fillColor(primaryNavy).fontSize(8.5).font('Helvetica-Bold')
        .text('Authorized Sales & Service Dealer', dealerX, 26, { width: 185, align: 'right' });
      
      // Vector location dot + text
      doc.circle(dealerX + 50, 41, 2).fill(brandCyan);
      doc.fillColor(textMuted).fontSize(7.5).font('Helvetica')
        .text('Coimbatore, Tamil Nadu', dealerX, 38, { width: 185, align: 'right' });
      
      // Vector phone dot + text
      doc.circle(dealerX + 80, 52, 2).fill(brandCyan);
      doc.text('+91 98765 43210', dealerX, 49, { width: 185, align: 'right' });
      
      // Vector email dot + text
      doc.circle(dealerX + 40, 63, 2).fill(brandCyan);
      doc.text('sales@daikincoimbatore.in', dealerX, 60, { width: 185, align: 'right' });

      // Thin separator below header
      doc.rect(leftMargin, 74, contentWidth, 0.5).fill('#E2E8F0');

      let y = 82;

      // 3. CUSTOMER BLOCK (LEFT) & QUOTATION SUMMARY CARD (RIGHT)
      const cleanCustomerName = sanitizePdfText(data.customerName);
      const cleanCustomerAddress = sanitizePdfText(data.customerAddress);
      const cleanCustomerPhone = sanitizePdfText(data.customerPhone);
      const hasCustomer = cleanCustomerName.length > 0;
      const rightCardWidth = 185;
      const rightCardX = rightMargin - rightCardWidth;

      if (hasCustomer) {
        doc.fillColor(primaryNavy).fontSize(9).font('Helvetica-Bold')
          .text('To,', leftMargin, y + 2);
        doc.fillColor(textDark).fontSize(11).font('Helvetica-Bold')
          .text(cleanCustomerName, leftMargin, y + 14);
        if (cleanCustomerAddress.length > 0) {
          doc.fillColor(textMuted).fontSize(8).font('Helvetica')
            .text(cleanCustomerAddress, leftMargin, y + 28, { width: 290 });
        }
        if (cleanCustomerPhone.length > 0) {
          doc.fillColor(textMuted).fontSize(8).font('Helvetica')
            .text(`Phone: ${cleanCustomerPhone}`, leftMargin, y + 42, { width: 290 });
        }
      }

      // Quotation Summary Card (Image 2 style)
      const cardHeight = 82;
      doc.roundedRect(rightCardX, y, rightCardWidth, cardHeight, 4).lineWidth(0.8).strokeColor(borderGray).fillAndStroke('#FFFFFF', borderGray);

      // Top Navy Header
      doc.roundedRect(rightCardX, y, rightCardWidth, 18, 3).fill(primaryNavy);
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
        .text('QUOTATION', rightCardX + 8, y + 5);
      doc.fontSize(7.5).font('Helvetica')
        .text(`Date: ${sanitizePdfText(data.date)}`, rightCardX + 70, y + 5.5, { width: rightCardWidth - 78, align: 'right' });

      // Breakdown Lines
      const cardY = y + 22;
      doc.fillColor(textDark).fontSize(7.5).font('Helvetica');
      doc.text('Sub Total (A)', rightCardX + 8, cardY);
      doc.text(`Rs.  ${Number(data.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 70, cardY, { width: rightCardWidth - 78, align: 'right' });

      doc.text(`CGST ${data.cgstPercent || 9}%`, rightCardX + 8, cardY + 11);
      doc.text(`Rs.  ${Number(data.cgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 70, cardY + 11, { width: rightCardWidth - 78, align: 'right' });

      doc.text(`SGST ${data.sgstPercent || 9}%`, rightCardX + 8, cardY + 22);
      doc.text(`Rs.  ${Number(data.sgstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 70, cardY + 22, { width: rightCardWidth - 78, align: 'right' });

      // Total Banner (Navy Blue)
      doc.roundedRect(rightCardX, y + cardHeight - 20, rightCardWidth, 20, 3).fill(darkHeaderBg);
      doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
        .text('TOTAL (A)', rightCardX + 8, y + cardHeight - 15);
      doc.fontSize(9.5).font('Helvetica-Bold')
        .text(`Rs. ${Number(data.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightCardX + 60, y + cardHeight - 15, { width: rightCardWidth - 68, align: 'right' });

      y += cardHeight + 10;

      // 4. TABLE DRAWING HELPER
      const drawSectionTable = (
        sectionLetter: string,
        sectionTitle: string,
        items: Array<{ description: string; quantity: number; unit: string; unitPrice: number; amount: number }>
      ) => {
        // Section Title & Badge
        doc.roundedRect(leftMargin, y, 16, 14, 2).fill(darkHeaderBg);
        doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
          .text(sectionLetter, leftMargin + 4.5, y + 2.5);

        doc.fillColor(primaryNavy).fontSize(8.5).font('Helvetica-Bold')
          .text(sectionTitle, leftMargin + 22, y + 3);

        y += 18;

        // Table Header
        doc.roundedRect(leftMargin, y, contentWidth, 16, 2).fill(darkHeaderBg);
        doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold');
        doc.text('Sl.No', leftMargin + 4, y + 4.5, { width: 28, align: 'center' });
        doc.text('Description', leftMargin + 36, y + 4.5, { width: 240 });
        doc.text('Qty', leftMargin + 280, y + 4.5, { width: 30, align: 'center' });
        doc.text('Unit', leftMargin + 315, y + 4.5, { width: 35, align: 'center' });
        doc.text('Price (INR)', leftMargin + 355, y + 4.5, { width: 80, align: 'right' });
        doc.text('Amount (INR)', leftMargin + 440, y + 4.5, { width: 85, align: 'right' });
        y += 16;

        // Table Rows
        items.forEach((item, index) => {
          const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
          const rowHeight = 18;
          doc.rect(leftMargin, y, contentWidth, rowHeight).lineWidth(0.5).strokeColor(borderGray).fillAndStroke(rowBg, borderGray);

          doc.fillColor(textDark).fontSize(7).font('Helvetica');
          doc.text(String(index + 1), leftMargin + 4, y + 5, { width: 28, align: 'center' });
          doc.font('Helvetica-Bold').text(sanitizePdfText(item.description), leftMargin + 36, y + 5, { width: 240, height: 12 });
          doc.font('Helvetica');
          doc.text(String(item.quantity || 1), leftMargin + 280, y + 5, { width: 30, align: 'center' });
          doc.text(sanitizePdfText(item.unit) || 'Nos', leftMargin + 315, y + 5, { width: 35, align: 'center' });
          doc.text(Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), leftMargin + 355, y + 5, { width: 80, align: 'right' });
          doc.font('Helvetica-Bold').text(Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), leftMargin + 440, y + 5, { width: 85, align: 'right' });

          y += rowHeight;
        });

        y += 8;
      };

      // Render Section A: MAIN UNIT
      drawSectionTable('A', 'MAIN UNIT', data.mainItems || []);

      // Render Section B: LOW SIDE
      if (data.hasLowSide && data.lowSideItems && data.lowSideItems.length > 0) {
        drawSectionTable('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', data.lowSideItems);
      }

      // 5. BOTTOM BOXES: TERMS & CONDITIONS (LEFT) + PAYMENT METHOD (RIGHT)
      const boxWidth = (contentWidth - 10) / 2;
      const boxHeight = 142;
      const rightColX = leftMargin + boxWidth + 10;

      // Left Box: TERMS & CONDITIONS
      doc.roundedRect(leftMargin, y, boxWidth, boxHeight, 4).lineWidth(0.8).strokeColor(borderGray).fillAndStroke('#FFFFFF', borderGray);
      doc.roundedRect(leftMargin, y, boxWidth, 18, 3).fill('#F1F5F9');
      
      // Vector document icon badge
      doc.rect(leftMargin + 8, y + 5, 8, 8).fill(darkHeaderBg);
      doc.fillColor(primaryNavy).fontSize(8).font('Helvetica-Bold')
        .text('TERMS & CONDITIONS', leftMargin + 20, y + 5);

      const termsList = [
        'AC Price is inclusive of 18 % taxes. 18% Tax Additional for Lowside.',
        'Electrical, Plumbing, civil work, Structural, core cutting, scaffolding, IDU Room wall opening for customer scope.',
        'We have given the quotation as per BOQ. Any variation in site quantities will be charged extra.',
        'Payment: 100% Machine with PO, 70% Lowside with PO, 25% on erection, 5% on final bill.',
        'Final bill will be raised on actual measured quantities at site.',
        'This Quotation Is Valid For 10 days.',
      ];

      let termY = y + 22;
      termsList.forEach((term, idx) => {
        doc.circle(leftMargin + 12, termY + 3.5, 4.5).fill(darkHeaderBg);
        doc.fillColor('#FFFFFF').fontSize(5.5).font('Helvetica-Bold')
          .text(String(idx + 1), leftMargin + 10, termY + 1.5);

        doc.fillColor(textDark).fontSize(6).font('Helvetica')
          .text(term, leftMargin + 20, termY, { width: boxWidth - 26, lineGap: 0.5 });
        termY += 19;
      });

      // Right Box: PAYMENT METHOD
      doc.roundedRect(rightColX, y, boxWidth, boxHeight, 4).lineWidth(0.8).strokeColor(borderGray).fillAndStroke('#FFFFFF', borderGray);
      doc.roundedRect(rightColX, y, boxWidth, 18, 3).fill('#F1F5F9');
      
      // Vector card icon badge
      doc.rect(rightColX + 8, y + 5, 8, 8).fill(brandCyan);
      doc.fillColor(primaryNavy).fontSize(8).font('Helvetica-Bold')
        .text('PAYMENT METHOD', rightColX + 20, y + 5);

      const paymentList = [
        { num: 'i', text: '100% Payment advance with P.O for Machine.' },
        { num: 'ii', text: '70% Advance of Total Lowside Value along with PO.' },
        { num: 'iii', text: '25% After completion of erection works.' },
        { num: 'iv', text: '5% Payment after raising the final bill.' },
      ];

      let payY = y + 23;
      paymentList.forEach((pay) => {
        doc.circle(rightColX + 13, payY + 4, 5.5).fill(brandCyan);
        doc.fillColor('#FFFFFF').fontSize(5.5).font('Helvetica-Bold')
          .text(pay.num, rightColX + 10.5, payY + 2);

        doc.fillColor(textDark).fontSize(6.5).font('Helvetica')
          .text(pay.text, rightColX + 23, payY + 1.5, { width: boxWidth - 28 });
        payY += 21;
      });

      // Quality Cooling Pill (Matching Image 2)
      doc.roundedRect(rightColX + 8, payY + 4, boxWidth - 16, 20, 3).fill('#EBF5FF');
      doc.fillColor(brandCyan).fontSize(7).font('Helvetica-Bold')
        .text('Quality Cooling. Trusted Service. Every Time.', rightColX + 12, payY + 10, { width: boxWidth - 24, align: 'center' });

      y += boxHeight + 8;

      // 6. FOOTER BAR (Matching Image 2 with subtle curves and dual messages)
      doc.roundedRect(leftMargin, y, contentWidth, 24, 4).fill(primaryNavy);
      
      // Left Shield & Quality Message
      doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold')
        .text('Quality Cooling. Trusted Service. Every Time.', leftMargin + 10, y + 7.5);

      // Right Message
      doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold')
        .text('Thanking you and assure our best service always.', rightMargin - 220, y + 7.5, { width: 210, align: 'right' });

      // Subtle bottom right curve decorative swoosh
      doc.save();
      doc.path('M 480 841.89 C 520 820, 560 830, 595.28 800 L 595.28 841.89 Z').fill('#38BDF8');
      doc.restore();

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}


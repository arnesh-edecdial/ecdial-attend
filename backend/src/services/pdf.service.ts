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
        margin: 36, // 0.5 inch margins
        info: {
          Title: `Quotation_${data.quotationNumber}`,
          Author: 'ECDIAL HVAC Solutions',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#0F2A4A'; // Deep Navy
      const accentColor = '#0066CC';  // Cyan/Royal Blue
      const lightBg = '#F4F7FB';
      const borderColor = '#D1D9E6';
      const textColor = '#222222';
      const mutedColor = '#555555';

      const pageWidth = doc.page.width;
      const leftMargin = 36;
      const rightMargin = pageWidth - 36;
      const contentWidth = rightMargin - leftMargin;

      // 1. Header Banner
      doc.rect(leftMargin, 36, contentWidth, 65).fill(primaryColor);

      // Logo / Company Name
      doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold')
        .text('ECDIAL', leftMargin + 15, 48);
      doc.fontSize(9).font('Helvetica')
        .text('AIR CONDITIONING & ENGINEERING SOLUTIONS', leftMargin + 15, 72)
        .text('GSTIN: 33AAAAE1234F1Z5 | PAN: AAAAE1234F | Tel: +91 44 2847 9000', leftMargin + 15, 84);

      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
        .text('QUOTATION', rightMargin - 150, 48, { width: 135, align: 'right' });
      doc.fontSize(9).font('Helvetica')
        .text('Official Commercial Offer', rightMargin - 150, 66, { width: 135, align: 'right' });

      // 2. Metadata Grid (Quotation Details & Customer Info)
      let y = 110;
      const colWidth = (contentWidth - 10) / 2;

      // Customer Card
      doc.rect(leftMargin, y, colWidth, 75).lineWidth(1).strokeColor(borderColor).fillAndStroke(lightBg, borderColor);
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('CUSTOMER DETAILS', leftMargin + 10, y + 8);
      doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text(data.customerName, leftMargin + 10, y + 23);
      doc.fillColor(mutedColor).fontSize(8.5).font('Helvetica').text(data.customerAddress, leftMargin + 10, y + 37, { width: colWidth - 20, height: 26 });
      if (data.customerPhone) {
        doc.text(`Phone: ${data.customerPhone}`, leftMargin + 10, y + 60);
      }

      // Quotation Info Card
      const rightCardX = leftMargin + colWidth + 10;
      doc.rect(rightCardX, y, colWidth, 75).lineWidth(1).strokeColor(borderColor).fillAndStroke(lightBg, borderColor);
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('QUOTATION REFERENCE', rightCardX + 10, y + 8);
      doc.fillColor(mutedColor).fontSize(9).font('Helvetica');
      
      doc.text('Quotation No:', rightCardX + 10, y + 24);
      doc.fillColor(primaryColor).font('Helvetica-Bold').text(data.quotationNumber, rightCardX + 85, y + 24);
      
      doc.fillColor(mutedColor).font('Helvetica').text('Date:', rightCardX + 10, y + 38);
      doc.fillColor(textColor).font('Helvetica').text(data.date, rightCardX + 85, y + 38);

      doc.fillColor(mutedColor).text('Sales Rep:', rightCardX + 10, y + 52);
      doc.fillColor(textColor).font('Helvetica').text(data.createdByName || 'ECDIAL Sales Team', rightCardX + 85, y + 52);

      y += 85;

      // Helper function to draw tables
      const drawTable = (
        title: string,
        items: Array<{ description: string; quantity: number; unit: string; unitPrice: number; amount: number }>,
        subtotalAmount: number
      ) => {
        // Section Title
        doc.rect(leftMargin, y, contentWidth, 20).fill(accentColor);
        doc.fillColor('#FFFFFF').fontSize(9.5).font('Helvetica-Bold').text(title, leftMargin + 8, y + 5);
        y += 20;

        // Table Header
        doc.rect(leftMargin, y, contentWidth, 18).fill('#E8EEF5');
        doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold');
        doc.text('S.No', leftMargin + 5, y + 4, { width: 30, align: 'center' });
        doc.text('Item Description', leftMargin + 40, y + 4, { width: 230 });
        doc.text('Qty', leftMargin + 275, y + 4, { width: 35, align: 'center' });
        doc.text('Unit', leftMargin + 315, y + 4, { width: 45, align: 'center' });
        doc.text('Rate (₹)', leftMargin + 365, y + 4, { width: 75, align: 'right' });
        doc.text('Amount (₹)', leftMargin + 445, y + 4, { width: 75, align: 'right' });
        y += 18;

        // Table Rows
        doc.font('Helvetica').fontSize(8.5);
        items.forEach((item, index) => {
          const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F9FBFE';
          doc.rect(leftMargin, y, contentWidth, 22).fill(rowBg);

          doc.fillColor(mutedColor).text(`${index + 1}`, leftMargin + 5, y + 6, { width: 30, align: 'center' });
          doc.fillColor(textColor).text(item.description, leftMargin + 40, y + 6, { width: 230, height: 16 });
          doc.text(String(item.quantity), leftMargin + 275, y + 6, { width: 35, align: 'center' });
          doc.text(item.unit, leftMargin + 315, y + 6, { width: 45, align: 'center' });
          doc.text(Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), leftMargin + 365, y + 6, { width: 75, align: 'right' });
          doc.font('Helvetica-Bold').text(Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), leftMargin + 445, y + 6, { width: 75, align: 'right' });
          doc.font('Helvetica');

          doc.rect(leftMargin, y + 21, contentWidth, 1).fill('#E2E8F0');
          y += 22;
        });

        // Section Subtotal
        doc.rect(leftMargin, y, contentWidth, 18).fill('#F1F4F9');
        doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold');
        doc.text('Section Subtotal:', leftMargin + 300, y + 4, { width: 140, align: 'right' });
        doc.text(`₹ ${Number(subtotalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, leftMargin + 445, y + 4, { width: 75, align: 'right' });
        y += 24;
      };

      // 3. Render Main Units
      drawTable('MAIN UNIT (A) - EQUIPMENT & SYSTEM', data.mainItems, data.mainUnitTotal);

      // 4. Render Low-Side Materials if enabled
      if (data.hasLowSide && data.lowSideItems && data.lowSideItems.length > 0) {
        if (y > 600) {
          doc.addPage();
          y = 36;
        }
        drawTable('LOW-SIDE MATERIALS (B) - PIPING, CABLING & ACCESSORIES', data.lowSideItems, data.lowSideTotal);
      }

      // Check if we need page break for summary & terms
      if (y > 560) {
        doc.addPage();
        y = 36;
      }

      // 5. Commercial Summary / Tax Calculation Box
      const summaryWidth = 240;
      const summaryX = rightMargin - summaryWidth;

      doc.rect(summaryX, y, summaryWidth, 92).lineWidth(1).strokeColor(borderColor).fillAndStroke(lightBg, borderColor);
      doc.fontSize(8.5).font('Helvetica');

      const drawSummaryRow = (label: string, valueStr: string, rowY: number, isBold: boolean = false, isAccent: boolean = false) => {
        if (isAccent) {
          doc.rect(summaryX, rowY - 2, summaryWidth, 18).fill(primaryColor);
          doc.fillColor('#FFFFFF').font('Helvetica-Bold');
        } else {
          doc.fillColor(isBold ? primaryColor : mutedColor).font(isBold ? 'Helvetica-Bold' : 'Helvetica');
        }
        doc.text(label, summaryX + 10, rowY, { width: 120 });
        doc.text(valueStr, summaryX + 120, rowY, { width: 110, align: 'right' });
      };

      drawSummaryRow('Subtotal (A + B):', `₹ ${Number(data.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, y + 6, true);
      drawSummaryRow(`CGST (${data.cgstPercent}%):`, `₹ ${Number(data.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, y + 22);
      drawSummaryRow(`SGST (${data.sgstPercent}%):`, `₹ ${Number(data.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, y + 38);
      drawSummaryRow('Total Tax (18%):', `₹ ${Number(data.cgstAmount + data.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, y + 54);
      drawSummaryRow('GRAND TOTAL (INR):', `₹ ${Number(data.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, y + 74, true, true);

      y += 105;

      // 6. Terms & Conditions and Payment Method
      if (y > 620) {
        doc.addPage();
        y = 36;
      }

      doc.rect(leftMargin, y, contentWidth, 18).fill(primaryColor);
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold').text('TERMS, CONDITIONS & PAYMENT MILESTONES', leftMargin + 8, y + 4);
      y += 24;

      // Terms Box
      doc.rect(leftMargin, y, contentWidth, 75).lineWidth(1).strokeColor(borderColor).fillAndStroke('#FFFFFF', borderColor);
      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('Terms & Conditions:', leftMargin + 8, y + 6);
      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica').text(data.termsAndConditions || 'Standard ECDIAL terms apply.', leftMargin + 8, y + 18, { width: contentWidth - 16 });

      y += 82;

      // Payment Box
      doc.rect(leftMargin, y, contentWidth, 55).lineWidth(1).strokeColor(borderColor).fillAndStroke('#FFFFFF', borderColor);
      doc.fillColor(primaryColor).fontSize(8.5).font('Helvetica-Bold').text('Payment Method / Schedule:', leftMargin + 8, y + 6);
      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica').text(data.paymentMethod || '100% advance with PO.', leftMargin + 8, y + 18, { width: contentWidth - 16 });

      y += 65;

      // 7. Signatory & Acceptance Block
      if (y > 680) {
        doc.addPage();
        y = 36;
      }

      const sigBoxWidth = (contentWidth - 20) / 2;
      
      // Customer Acceptance
      doc.rect(leftMargin, y, sigBoxWidth, 45).lineWidth(1).strokeColor(borderColor).stroke();
      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica').text('Customer Signature & Seal of Acceptance:', leftMargin + 6, y + 4);
      doc.text('Date: _______________', leftMargin + 6, y + 32);

      // Authorized Signatory
      const authX = leftMargin + sigBoxWidth + 20;
      doc.rect(authX, y, sigBoxWidth, 45).lineWidth(1).strokeColor(borderColor).stroke();
      doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold').text('For ECDIAL AIR CONDITIONING SOLUTIONS', authX + 6, y + 4);
      doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica').text('Authorized Signatory', authX + 6, y + 32);

      // 8. Footer on bottom of current page
      doc.fontSize(7.5).fillColor(mutedColor).text(
        'This is a computer-generated quotation issued by ECDIAL. For support, call +91 44 2847 9000 or email sales@ecdial.com.',
        leftMargin,
        doc.page.height - 30,
        { width: contentWidth, align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

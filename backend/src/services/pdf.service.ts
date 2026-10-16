import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';

export interface PDFQuotationData {
  quotationNumber: string;
  revisionNumber?: number;
  date: string;
  validTill?: string;
  acType?: 'SPLIT' | 'CASSETTE' | 'VRV' | 'DUCT' | string;
  includeBankDetails?: boolean;
  quotationType?: 'DAIKIN' | 'ECDIAL';
  customerName?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerLocation?: string | null;
  systemDesignation?: string | null;
  totalCapacity?: string | null;
  offerType?: string | null;
  scopeExclusions?: string | null;
  commissioningReqs?: string | null;
  createdByName?: string;
  createdByEmail?: string;
  hasLowSide: boolean;
  mainUnitTotal: number;
  lowSideSupplyTotal?: number;
  lowSideInstallTotal?: number;
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
    supplyRate?: number;
    supplyAmount?: number;
    installRate?: number;
    installAmount?: number;
  }>;
  lowSideItems: Array<{
    description: string;
    brand?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    amount: number;
    supplyRate?: number;
    supplyAmount?: number;
    installRate?: number;
    installAmount?: number;
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
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

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

  const detected = brandOrder.filter((b) => brandSet.has(b));
  return detected.length > 0 ? detected : ['DAIKIN'];
}

export async function generateQuotationPDF(data: PDFQuotationData): Promise<Buffer> {
  const isEcDial = (data.quotationType || 'DAIKIN').toUpperCase() === 'ECDIAL';
  const rawAcType = String(data.acType || 'SPLIT').toUpperCase();
  const isCassetteOrCommercial = rawAcType === 'CASSETTE' || rawAcType === 'DUCT' || rawAcType === 'VRV';

  // Prepare QR code buffer for Bank Details
  let qrBuffer: Buffer | null = null;
  try {
    const upiString = 'upi://pay?pa=59212062011123@hdfcbank&pn=ECDIAL&mc=0000&mode=02&purpose=00';
    qrBuffer = await QRCode.toBuffer(upiString, {
      type: 'png',
      width: 260,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: isEcDial ? '#0A1E3F' : '#0B2545',
        light: '#FFFFFF',
      },
    });
  } catch {
    qrBuffer = null;
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        autoFirstPage: true,
        info: {
          Title: `Quotation_${sanitizePdfText(data.customerName) || 'ECDIAL'}`,
          Author: isEcDial ? 'EC DIAL - Electrical & HVAC Solutions' : 'ECDIAL - Authorized Daikin Dealer',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      if (isCassetteOrCommercial) {
        renderCassetteProposal(doc, data, isEcDial, qrBuffer);
      } else {
        renderSplitQuotation(doc, data, isEcDial);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// CASSETTE 2-PAGE COMMERCIAL PROPOSAL (Matches Reference Layout Exactly)
// ============================================================================
function renderCassetteProposal(
  doc: PDFKit.PDFDocument,
  data: PDFQuotationData,
  isEcDial: boolean,
  qrBuffer: Buffer | null
) {
  // Theme Color Palette
  const daikinNavy = '#0B2545';
  const daikinBrightBlue = '#0082C8';
  const ecDialNavy = '#0A1E3F';
  const ecDialOrange = '#FF5722';

  const themePrimary = isEcDial ? ecDialNavy : daikinNavy;
  const themeAccent = isEcDial ? ecDialOrange : daikinBrightBlue;
  const textDark = '#0F172A';
  const textMuted = '#475569';
  const borderLight = isEcDial ? '#F3D2C6' : '#CDE0EE';
  const bgCard = isEcDial ? '#FCF9F7' : '#F5F9FD';
  const tableHeaderBg = isEcDial ? '#FBECE6' : '#EAF2F9';
  const rowAltBg = '#F8FAFC';

  const pageWidth = 595.28;
  const leftMargin = 34;
  const rightMargin = 561.28;
  const contentWidth = rightMargin - leftMargin; // 527.28 pt

  // Banner Header / Footer assets
  const headerFilename = isEcDial ? 'ecdial_quotation_header.png' : 'daikin_quotation_header.png';
  const footerFilename = isEcDial ? 'ecdial_quotation_footer.png' : 'daikin_quotation_footer.png';
  const headerPath = getAssetPath(headerFilename) || getAssetPath('daikin_quotation_header.png');
  const footerPath = getAssetPath(footerFilename) || getAssetPath('daikin_quotation_footer.png');

  const headerHeight = 126;
  const footerHeight = 58;
  const footerY = 841.89 - footerHeight;

  const drawHeaderBanner = () => {
    if (headerPath) {
      try {
        doc.image(headerPath, 0, 0, { width: pageWidth, height: headerHeight });
      } catch {
        drawFallbackHeader();
      }
    } else {
      drawFallbackHeader();
    }
  };

  const drawFallbackHeader = () => {
    doc.rect(0, 0, pageWidth, headerHeight).fill(themePrimary);
    doc.fillColor('#FFFFFF').fontSize(22).font('Helvetica-Bold')
      .text(isEcDial ? 'EC DIAL SOLUTIONS' : 'DAIKIN AIR CONDITIONING SOLUTIONS', leftMargin, 35);
    doc.fillColor(themeAccent).fontSize(10).font('Helvetica-Bold')
      .text('COMFORT FOR A BRIGHTER TOMORROW', leftMargin, 65);
  };

  const drawFooterBanner = (pageLabel: string) => {
    if (footerPath) {
      try {
        doc.image(footerPath, 0, footerY, { width: pageWidth, height: footerHeight });
      } catch {
        drawFallbackFooter();
      }
    } else {
      drawFallbackFooter();
    }

    // Page indicator overlay at bottom right
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
      .text(pageLabel, rightMargin - 70, footerY + 24, { width: 60, align: 'right' });
  };

  const drawFallbackFooter = () => {
    doc.rect(0, footerY, pageWidth, footerHeight).fill(themePrimary);
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica')
      .text('ECDIAL - Authorized HVAC Sales & Service', leftMargin, footerY + 22);
  };

  // Section Badge Helper
  const drawSectionBadge = (letter: string, title: string, subtitle: string, startY: number): number => {
    const badgeSize = 16;
    doc.roundedRect(leftMargin, startY, badgeSize, badgeSize, 3).fill(themeAccent);
    doc.fillColor('#FFFFFF').fontSize(9.5).font('Helvetica-Bold')
      .text(letter, leftMargin, startY + 3, { width: badgeSize, align: 'center' });

    doc.fillColor(themePrimary).fontSize(10.5).font('Helvetica-Bold')
      .text(title, leftMargin + badgeSize + 8, startY + 2.5);

    if (subtitle) {
      doc.fillColor(textMuted).fontSize(7.5).font('Helvetica')
        .text(subtitle, leftMargin + badgeSize + 8, startY + 15);
      return startY + 27;
    }
    return startY + 22;
  };

  // ==========================================
  // PAGE 1: Equipment & Cost Schedule
  // ==========================================
  drawHeaderBanner();

  let y = headerHeight + 8;

  // Title: COMMERCIAL PROPOSAL / 01 & Equipment & Cost Schedule
  doc.fillColor(themeAccent).fontSize(7.5).font('Helvetica-Bold')
    .text('COMMERCIAL PROPOSAL / 01', leftMargin, y);
  y += 11;

  doc.fillColor(themePrimary).fontSize(16).font('Helvetica-Bold')
    .text('Equipment & Cost Schedule', leftMargin, y);
  y += 22;

  // Horizontal Accent Rule
  doc.moveTo(leftMargin, y).lineTo(rightMargin, y).lineWidth(1.2).strokeColor(themeAccent).stroke();
  y += 8;

  // Customer / System Information Panel (3-column card)
  const infoCardH = 46;
  doc.roundedRect(leftMargin, y, contentWidth, infoCardH, 4)
    .lineWidth(0.8).strokeColor(borderLight).fillAndStroke(bgCard, borderLight);

  const colW = (contentWidth - 24) / 3;

  // Column 1: Prepared For
  doc.fillColor(themeAccent).fontSize(7).font('Helvetica-Bold')
    .text('PREPARED FOR', leftMargin + 10, y + 6);
  doc.fillColor(themePrimary).fontSize(11).font('Helvetica-Bold')
    .text(sanitizePdfText(data.customerName) || 'Valued Customer', leftMargin + 10, y + 17, { width: colW, lineGap: 1 });
  if (data.customerAddress) {
    doc.fillColor(textMuted).fontSize(7.5).font('Helvetica')
      .text(sanitizePdfText(data.customerAddress), leftMargin + 10, y + 31, { width: colW, ellipsis: true });
  }

  // Column 2: System Designation
  const col2X = leftMargin + 10 + colW + 6;
  doc.fillColor(themeAccent).fontSize(7).font('Helvetica-Bold')
    .text('SYSTEM DESIGNATION', col2X, y + 6);
  const sysDesignation = sanitizePdfText(data.systemDesignation) || (isEcDial ? 'ECDIAL Cassette' : 'Daikin Cassette');
  doc.fillColor(themePrimary).fontSize(11).font('Helvetica-Bold')
    .text(sysDesignation, col2X, y + 17, { width: colW });
  const capText = data.totalCapacity ? `Total capacity • ${sanitizePdfText(data.totalCapacity)}` : 'Total capacity • 5 TR';
  doc.fillColor(textMuted).fontSize(7.5).font('Helvetica')
    .text(capText, col2X, y + 31, { width: colW });

  // Column 3: Offer Type
  const col3X = col2X + colW + 6;
  doc.fillColor(themeAccent).fontSize(7).font('Helvetica-Bold')
    .text('OFFER TYPE', col3X, y + 6);
  const offerTypeText = sanitizePdfText(data.offerType) || 'Supply and Installation';
  doc.fillColor(themePrimary).fontSize(11).font('Helvetica-Bold')
    .text(offerTypeText, col3X, y + 17, { width: colW });

  y += infoCardH + 8;

  // ------------------------------------------
  // SECTION A: MAIN UNITS / HIGH-SIDE EQUIPMENT
  // ------------------------------------------
  y = drawSectionBadge('A', 'MAIN UNITS / HIGH-SIDE EQUIPMENT', 'Supply schedule - model references retained from source quotation', y);

  // Table Geometry Section A
  const colA = {
    item: leftMargin,
    itemW: 32,
    desc: leftMargin + 32,
    descW: 255.28,
    unit: leftMargin + 287.28,
    unitW: 40,
    qty: leftMargin + 327.28,
    qtyW: 35,
    rate: leftMargin + 362.28,
    rateW: 80,
    amount: leftMargin + 442.28,
    amountW: 85,
  };

  // Header Row A
  const rowHA = 17;
  doc.roundedRect(leftMargin, y, contentWidth, rowHA, 2).fill(tableHeaderBg);
  doc.rect(leftMargin, y, contentWidth, rowHA).lineWidth(0.6).strokeColor(borderLight).stroke();
  doc.fillColor(themePrimary).fontSize(7.5).font('Helvetica-Bold');
  doc.text('Item', colA.item, y + 4.5, { width: colA.itemW, align: 'center' });
  doc.text('Equipment / model description', colA.desc + 6, y + 4.5, { width: colA.descW - 8, align: 'left' });
  doc.text('Unit', colA.unit, y + 4.5, { width: colA.unitW, align: 'center' });
  doc.text('Qty', colA.qty, y + 4.5, { width: colA.qtyW, align: 'center' });
  doc.text('Supply rate (Rs.)', colA.rate, y + 4.5, { width: colA.rateW - 4, align: 'right' });
  doc.text('Amount (Rs.)', colA.amount, y + 4.5, { width: colA.amountW - 6, align: 'right' });
  y += rowHA;

  const mainItems = data.mainItems && data.mainItems.length > 0 ? data.mainItems : [];
  const mainRowH = 17;

  mainItems.forEach((item, idx) => {
    const isAlt = idx % 2 === 1;
    if (isAlt) doc.rect(leftMargin, y, contentWidth, mainRowH).fill(rowAltBg);
    doc.rect(leftMargin, y, contentWidth, mainRowH).lineWidth(0.5).strokeColor(borderLight).stroke();

    const rateVal = item.supplyRate !== undefined && item.supplyRate > 0 ? item.supplyRate : item.unitPrice;
    const amountVal = item.amount !== undefined && item.amount > 0 ? item.amount : (item.quantity * rateVal);

    doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
      .text(String(idx + 1), colA.item, y + 4.5, { width: colA.itemW, align: 'center' });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica-Bold')
      .text(sanitizePdfText(item.description), colA.desc + 6, y + 4.5, { width: colA.descW - 12, ellipsis: true });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
      .text(sanitizePdfText(item.unit) || 'Nos', colA.unit, y + 4.5, { width: colA.unitW, align: 'center' });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
      .text(String(item.quantity), colA.qty, y + 4.5, { width: colA.qtyW, align: 'center' });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
      .text(rateVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colA.rate, y + 4.5, { width: colA.rateW - 4, align: 'right' });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica-Bold')
      .text(amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colA.amount, y + 4.5, { width: colA.amountW - 6, align: 'right' });

    y += mainRowH;
  });

  // Total - High-Side Equipment Row
  doc.rect(leftMargin, y, contentWidth, 18).lineWidth(0.8).strokeColor(borderLight).fillAndStroke(bgCard, borderLight);
  doc.fillColor(themePrimary).fontSize(8.5).font('Helvetica-Bold')
    .text('TOTAL - HIGH-SIDE EQUIPMENT', leftMargin + 8, y + 4.5);
  doc.fillColor(themePrimary).fontSize(9.5).font('Helvetica-Bold')
    .text(`Rs. ${data.mainUnitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, colA.amount - 20, y + 4, { width: colA.amountW + 14, align: 'right' });
  y += 24;

  // ------------------------------------------
  // SECTION B: LOW-SIDE WORKS
  // ------------------------------------------
  y = drawSectionBadge('B', 'LOW-SIDE WORKS', 'Supply and installation amounts shown separately', y);

  const colB = {
    item: leftMargin,
    itemW: 32,
    desc: leftMargin + 32,
    descW: 260.28,
    unit: leftMargin + 292.28,
    unitW: 38,
    qty: leftMargin + 330.28,
    qtyW: 34,
    supply: leftMargin + 364.28,
    supplyW: 81,
    install: leftMargin + 445.28,
    installW: 82,
  };

  // Header Row B
  const rowHB = 17;
  doc.roundedRect(leftMargin, y, contentWidth, rowHB, 2).fill(tableHeaderBg);
  doc.rect(leftMargin, y, contentWidth, rowHB).lineWidth(0.6).strokeColor(borderLight).stroke();
  doc.fillColor(themePrimary).fontSize(7.5).font('Helvetica-Bold');
  doc.text('Item', colB.item, y + 4.5, { width: colB.itemW, align: 'center' });
  doc.text('Work description / specification', colB.desc + 6, y + 4.5, { width: colB.descW - 8, align: 'left' });
  doc.text('Unit', colB.unit, y + 4.5, { width: colB.unitW, align: 'center' });
  doc.text('Qty', colB.qty, y + 4.5, { width: colB.qtyW, align: 'center' });
  doc.text('Supply amount (Rs.)', colB.supply, y + 4.5, { width: colB.supplyW - 4, align: 'right' });
  doc.text('Installation (Rs.)', colB.install, y + 4.5, { width: colB.installW - 6, align: 'right' });
  y += rowHB;

  const lowSideItems = data.lowSideItems && data.lowSideItems.length > 0 ? data.lowSideItems : [];
  const lowRowH = 15.5;

  let calcLowSupplyTotal = 0;
  let calcLowInstallTotal = 0;

  lowSideItems.forEach((item, idx) => {
    const isAlt = idx % 2 === 1;
    if (isAlt) doc.rect(leftMargin, y, contentWidth, lowRowH).fill(rowAltBg);
    doc.rect(leftMargin, y, contentWidth, lowRowH).lineWidth(0.5).strokeColor(borderLight).stroke();

    const supAmt = item.supplyAmount !== undefined && item.supplyAmount > 0
      ? item.supplyAmount
      : (item.supplyRate !== undefined && item.supplyRate > 0 ? (item.quantity * item.supplyRate) : 0);
    const instAmt = item.installAmount !== undefined && item.installAmount > 0
      ? item.installAmount
      : (item.installRate !== undefined && item.installRate > 0 ? (item.quantity * item.installRate) : 0);

    calcLowSupplyTotal += supAmt;
    calcLowInstallTotal += instAmt;

    doc.fillColor(textDark).fontSize(7).font('Helvetica')
      .text(String(idx + 1), colB.item, y + 3.8, { width: colB.itemW, align: 'center' });
    doc.fillColor(textDark).fontSize(7).font('Helvetica')
      .text(sanitizePdfText(item.description), colB.desc + 6, y + 3.8, { width: colB.descW - 12, ellipsis: true });
    doc.fillColor(textDark).fontSize(7).font('Helvetica')
      .text(sanitizePdfText(item.unit) || 'Nos', colB.unit, y + 3.8, { width: colB.unitW, align: 'center' });
    doc.fillColor(textDark).fontSize(7).font('Helvetica')
      .text(String(item.quantity), colB.qty, y + 3.8, { width: colB.qtyW, align: 'center' });

    doc.fillColor(textDark).fontSize(7).font('Helvetica')
      .text(supAmt > 0 ? supAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—', colB.supply, y + 3.8, { width: colB.supplyW - 4, align: 'right' });
    doc.fillColor(textDark).fontSize(7).font('Helvetica')
      .text(instAmt > 0 ? instAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—', colB.install, y + 3.8, { width: colB.installW - 6, align: 'right' });

    y += lowRowH;
  });

  const finalLowSupply = data.lowSideSupplyTotal && data.lowSideSupplyTotal > 0 ? data.lowSideSupplyTotal : calcLowSupplyTotal;
  const finalLowInstall = data.lowSideInstallTotal && data.lowSideInstallTotal > 0 ? data.lowSideInstallTotal : calcLowInstallTotal;

  // Subtotal Bar: TOTAL LOW-SIDE WORKS
  const subBarH = 19;
  doc.roundedRect(leftMargin, y, contentWidth, subBarH, 2).fill(themePrimary);
  doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
    .text('TOTAL LOW-SIDE WORKS', leftMargin + 10, y + 5);

  const subAmountsText = `Supply  Rs. ${finalLowSupply.toLocaleString('en-IN', { minimumFractionDigits: 2 })}   /   Installation  Rs. ${finalLowInstall.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold')
    .text(subAmountsText, colB.supply - 60, y + 5, { width: contentWidth - (colB.supply - leftMargin - 60) - 8, align: 'right' });
  y += subBarH + 8;

  // TOTAL PROJECT COST (A + B) Banner
  const totalProjectCost = Math.round((data.mainUnitTotal + finalLowSupply + finalLowInstall + Number.EPSILON) * 100) / 100;
  const bannerH = 28;
  const rightBoxW = 160;
  const leftBoxW = contentWidth - rightBoxW;

  // Navy left container
  doc.roundedRect(leftMargin, y, contentWidth, bannerH, 4).fill(themePrimary);
  doc.fillColor('#FFFFFF').fontSize(9.5).font('Helvetica-Bold')
    .text('TOTAL PROJECT COST (A + B)', leftMargin + 14, y + 8.5);

  // Accent right box
  doc.roundedRect(rightMargin - rightBoxW, y, rightBoxW, bannerH, 4).fill(themeAccent);
  doc.fillColor('#FFFFFF').fontSize(12.5).font('Helvetica-Bold')
    .text(`Rs. ${totalProjectCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, rightMargin - rightBoxW, y + 7.5, { width: rightBoxW - 14, align: 'right' });

  drawFooterBanner('01 / 02');

  // ==========================================
  // PAGE 2: Scope, Terms & Payment
  // ==========================================
  doc.addPage({ size: 'A4', margin: 0 });
  drawHeaderBanner();

  y = headerHeight + 8;

  // Title: COMMERCIAL PROPOSAL / 02 & Scope, Terms & Payment
  doc.fillColor(themeAccent).fontSize(7.5).font('Helvetica-Bold')
    .text('COMMERCIAL PROPOSAL / 02', leftMargin, y);
  y += 11;

  doc.fillColor(themePrimary).fontSize(16).font('Helvetica-Bold')
    .text('Scope, Terms & Payment', leftMargin, y);
  y += 22;

  doc.moveTo(leftMargin, y).lineTo(rightMargin, y).lineWidth(1.2).strokeColor(themeAccent).stroke();
  y += 8;

  // ------------------------------------------
  // SECTION C: CUSTOMER SCOPE / EXCLUSIONS
  // ------------------------------------------
  y = drawSectionBadge('C', 'CUSTOMER SCOPE / EXCLUSIONS', 'Items below are to be arranged by the customer unless agreed otherwise', y);

  const scopeItems = [
    'All masonry/civil works: outdoor-unit supports, cutting and making good walls/floor slabs, trenches and scaffolding.',
    'Main power supply to each outdoor unit (3-phase) with ELICB and near each indoor unit (single-phase).',
    'False-ceiling, boxing, wooden framework and carpentry work.',
    'MS angle support for indoor units, if necessary.',
    'Provision of necessary drain points.',
    'Any under-deck or false-ceiling insulation work.',
    'Protected storage space at site.',
    'Power for erection, testing and commissioning.',
    'Any dismantling work.',
    "Items not specifically mentioned in ECDIAL's scope of work are excluded.",
    'ODU and AHU lifting to terrace.',
  ];

  const scopeRowH = 14;
  scopeItems.forEach((text, idx) => {
    const isAlt = idx % 2 === 1;
    if (isAlt) doc.rect(leftMargin, y, contentWidth, scopeRowH).fill(rowAltBg);
    doc.rect(leftMargin, y, contentWidth, scopeRowH).lineWidth(0.5).strokeColor(borderLight).stroke();

    const numStr = String(idx + 1).padStart(2, '0');
    // Pill number badge
    doc.roundedRect(leftMargin + 4, y + 2, 18, scopeRowH - 4, 2).lineWidth(0.5).strokeColor(themeAccent).fillAndStroke(bgCard, themeAccent);
    doc.fillColor(themeAccent).fontSize(6.5).font('Helvetica-Bold')
      .text(numStr, leftMargin + 4, y + 3.8, { width: 18, align: 'center' });

    doc.fillColor(textDark).fontSize(7).font('Helvetica')
      .text(text, leftMargin + 28, y + 3.5, { width: contentWidth - 32 });

    y += scopeRowH;
  });

  y += 8;

  // ------------------------------------------
  // SECTION D: REQUIREMENTS BEFORE COMMISSIONING
  // ------------------------------------------
  y = drawSectionBadge('D', 'REQUIREMENTS BEFORE COMMISSIONING', '', y);

  const reqItems = [
    'Earth voltage must be maintained at a minimum of 0–3 V.',
    'Commissioning power: outdoor units, 3-phase 420-440 V; indoor units, single-phase 220-240 V.',
    'Electrical works must comply with issued specifications/drawings and electrical safety standards.',
  ];

  reqItems.forEach((text, idx) => {
    doc.fillColor(themeAccent).fontSize(8).font('Helvetica-Bold')
      .text(`${idx + 1}.`, leftMargin + 6, y);
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
      .text(text, leftMargin + 20, y, { width: contentWidth - 24 });
    y += 13;
  });

  y += 6;

  // ------------------------------------------
  // SECTION E: TERMS & CONDITIONS
  // ------------------------------------------
  y = drawSectionBadge('E', 'TERMS & CONDITIONS', '', y);

  const termsCardH = 68;
  doc.roundedRect(leftMargin, y, contentWidth, termsCardH, 4)
    .lineWidth(0.8).strokeColor(borderLight).fillAndStroke(bgCard, borderLight);

  // Row 1: TAX
  doc.fillColor(themeAccent).fontSize(7.5).font('Helvetica-Bold')
    .text('TAX', leftMargin + 10, y + 6);
  doc.fillColor(textDark).fontSize(7.5).font('Helvetica')
    .text('AC price and labour charges are exclusive of GST and subject to 18% GST.', leftMargin + 90, y + 6, { width: contentWidth - 100 });

  doc.moveTo(leftMargin, y + 18).lineTo(rightMargin, y + 18).lineWidth(0.5).strokeColor(borderLight).stroke();

  // Row 2: PAYMENT SCHEDULE
  doc.fillColor(themeAccent).fontSize(7.5).font('Helvetica-Bold')
    .text('PAYMENT SCHEDULE', leftMargin + 10, y + 23);

  const paymentBullets = [
    '100% advance with purchase order for machines.',
    '70% advance of total low-side value along with purchase order.',
    '25% after completion of erection works.',
    '5% payment after raising the final bill.',
    'Final bill based on actual quantities used at site after measurement.',
  ];

  let pY = y + 23;
  paymentBullets.forEach((bullet) => {
    doc.fillColor(themeAccent).fontSize(7).font('Helvetica-Bold')
      .text('•', leftMargin + 90, pY);
    doc.fillColor(textDark).fontSize(7).font('Helvetica')
      .text(bullet, leftMargin + 98, pY, { width: contentWidth - 110 });
    pY += 8.5;
  });

  y += termsCardH + 8;

  // ------------------------------------------
  // SECTION F: BANK DETAILS & QR CODE
  // ------------------------------------------
  y = drawSectionBadge('F', 'BANK DETAILS', '', y);

  const bankCardH = 68;
  doc.roundedRect(leftMargin, y, contentWidth, bankCardH, 4)
    .lineWidth(0.8).strokeColor(borderLight).fillAndStroke(bgCard, borderLight);

  // Left side: Bank Fields
  const bankFields = [
    { label: 'ACCOUNT NAME', val: 'ECDIAL' },
    { label: 'ACCOUNT NUMBER', val: '59212062011123' },
    { label: 'BANK', val: 'HDFC LTD.' },
    { label: 'BRANCH', val: 'Tirupur Main Branch (Aristo International)' },
    { label: 'IFSC CODE', val: 'HDFC0000445' },
  ];

  let bY = y + 7;
  bankFields.forEach((field) => {
    doc.fillColor(textMuted).fontSize(7).font('Helvetica-Bold')
      .text(field.label, leftMargin + 12, bY, { width: 100 });
    doc.fillColor(themePrimary).fontSize(7.5).font('Helvetica-Bold')
      .text(field.val, leftMargin + 115, bY, { width: 220 });
    bY += 11.5;
  });

  // Vertical Divider
  const qrDividerX = rightMargin - 120;
  doc.moveTo(qrDividerX, y + 6).lineTo(qrDividerX, y + bankCardH - 6).lineWidth(0.5).strokeColor(borderLight).stroke();

  // Right side: Scan to pay & QR code
  doc.fillColor(themeAccent).fontSize(6.5).font('Helvetica-Bold')
    .text('SCAN TO PAY', qrDividerX + 6, y + 8, { width: 110, align: 'center' });
  doc.fillColor(textMuted).fontSize(5.5).font('Helvetica')
    .text('(UPI / BANK TRANSFER)', qrDividerX + 6, y + 17, { width: 110, align: 'center' });

  if (qrBuffer) {
    try {
      doc.image(qrBuffer, qrDividerX + 38, y + 25, { width: 38, height: 38 });
    } catch {}
  }

  drawFooterBanner('02 / 02');
}

// ============================================================================
// SPLIT AC TEMPLATE (Retains original layout & Sub Total (A) = Total (A))
// ============================================================================
function renderSplitQuotation(
  doc: PDFKit.PDFDocument,
  data: PDFQuotationData,
  isEcDial: boolean
) {
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

  const leftMargin = 32;
  const rightMargin = 563.28;
  const contentWidth = rightMargin - leftMargin;

  const mainItems = data.mainItems || [];
  const lowSideItems = data.hasLowSide && data.lowSideItems ? data.lowSideItems : [];

  const headerFilename = isEcDial ? 'ecdial_quotation_header.png' : 'daikin_quotation_header.png';
  const footerFilename = isEcDial ? 'ecdial_quotation_footer.png' : 'daikin_quotation_footer.png';
  const termsFilename = isEcDial ? 'ecdial_quotation_terms.png' : 'daikin_quotation_terms.png';
  const paymentFilename = isEcDial ? 'ecdial_quotation_payment.png' : 'daikin_quotation_payment.png';
  const bankFilename = isEcDial ? 'ecdial_quotation_bank.png' : 'daikin_quotation_bank.png';
  const fillerFilename = isEcDial ? 'ecdial_quotation_bank_filler.png' : 'daikin_quotation_bank_filler.png';

  const headerPath = getAssetPath(headerFilename);
  const footerPath = getAssetPath(footerFilename);
  const termsPath = getAssetPath(termsFilename);
  const paymentPath = getAssetPath(paymentFilename);
  const bankPath = getAssetPath(data.includeBankDetails === false ? fillerFilename : bankFilename);

  const headerWidth = 595.28;
  const headerHeight = isEcDial ? headerWidth * (299 / 1315) : headerWidth * (162 / 718);
  const footerWidth = 595.28;
  const footerHeight = isEcDial ? (footerWidth * (130 / 1024)) : (footerWidth * (106 / 1024));
  const footerY = 841.89 - footerHeight;

  const allItems = [...mainItems, ...lowSideItems];
  const activeBrands = detectQuotationBrands(allItems);

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
    if (!raw) return '28-05-2026';
    if (raw.includes('-') && raw.split('-')[0].length === 4) {
      const [yyyy, mm, dd] = raw.split('-');
      return `${dd}-${mm}-${yyyy}`;
    }
    return raw;
  })();

  const drawHeaderBanner = () => {
    if (headerPath) {
      try {
        doc.image(headerPath, 0, 0, { width: headerWidth, height: headerHeight });
      } catch {}
    }
  };

  const drawFooterBanner = () => {
    if (footerPath) {
      try {
        doc.image(footerPath, 0, footerY, { width: footerWidth, height: footerHeight });
      } catch {}
    }
  };

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

  // Quotation Summary Card (Right) - Sub Total (A) equals high-side Total (A)
  const quoteCardY = clientBoxY;
  const cardRowH = 15;
  const summaryHeaderH = 18;
  const quoteCardHeight = summaryHeaderH + (3 * cardRowH) + 20;

  doc.roundedRect(quoteCardX, quoteCardY, quoteCardWidth, quoteCardHeight, 4)
    .lineWidth(1).strokeColor(ruleGray).fillAndStroke('#FFFFFF', ruleGray);

  doc.roundedRect(quoteCardX, quoteCardY, quoteCardWidth, summaryHeaderH, 3).fill(themePrimary);
  doc.fillColor('#FFFFFF').fontSize(9.5).font('Helvetica-Bold')
    .text('QUOTATION', quoteCardX, quoteCardY + 4.5, { width: quoteCardWidth, align: 'center' });

  let curRowY = quoteCardY + summaryHeaderH;

  // Sub Total (A) - Exact Match to High-Side Total (A)
  doc.fillColor(textMuted).fontSize(8).font('Helvetica')
    .text('Sub Total (A)', quoteCardX + 8, curRowY + 3.5);
  doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
    .text(`Rs. ${data.mainUnitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, quoteCardX + 80, curRowY + 3, { width: quoteCardWidth - 88, align: 'right' });
  doc.moveTo(quoteCardX, curRowY + cardRowH).lineTo(quoteCardX + quoteCardWidth, curRowY + cardRowH).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
  curRowY += cardRowH;

  // CGST
  doc.fillColor(textDark).fontSize(8).font('Helvetica-Bold')
    .text(`CGST ${data.cgstPercent}%`, quoteCardX + 8, curRowY + 3.5);
  doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
    .text(`Rs. ${data.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, quoteCardX + 80, curRowY + 3, { width: quoteCardWidth - 88, align: 'right' });
  doc.moveTo(quoteCardX, curRowY + cardRowH).lineTo(quoteCardX + quoteCardWidth, curRowY + cardRowH).lineWidth(0.5).strokeColor('#E2E8F0').stroke();
  curRowY += cardRowH;

  // SGST
  doc.fillColor(textDark).fontSize(8).font('Helvetica-Bold')
    .text(`SGST ${data.sgstPercent}%`, quoteCardX + 8, curRowY + 3.5);
  doc.fillColor(textDark).fontSize(8.5).font('Helvetica-Bold')
    .text(`Rs. ${data.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, quoteCardX + 80, curRowY + 3, { width: quoteCardWidth - 88, align: 'right' });
  curRowY += cardRowH;

  // TOTAL (A)
  doc.rect(quoteCardX, curRowY, quoteCardWidth, 20).fill(themePrimary);
  doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold')
    .text('TOTAL (A)', quoteCardX + 8, curRowY + 5.5);
  doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica-Bold')
    .text(`Rs. ${data.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, quoteCardX + 60, curRowY + 5, { width: quoteCardWidth - 68, align: 'right' });

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

  // Section A: MAIN UNITS
  drawSectionPill('A', 'MAIN UNITS', mainItems.length);
  drawTableHeader('Price (Rs.)');

  const mainRowH = isTwoPages ? 28 : (mainItems.length === 1 ? 25 : 22);

  mainItems.forEach((item, idx) => {
    const isAlt = idx % 2 === 1;
    if (isAlt) doc.rect(leftMargin, y, contentWidth, mainRowH).fill(rowAltBg);
    doc.rect(leftMargin, y, contentWidth, mainRowH).lineWidth(0.5).strokeColor(ruleGray).stroke();

    const vCenter = y + (mainRowH - 9) / 2;
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica').text(String(idx + 1), cols.sl, vCenter, { width: cols.slW, align: 'center' });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica-Bold').text(sanitizePdfText(item.description), cols.desc + 6, y + 4, { width: cols.descW - 12 });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica').text(String(item.quantity), cols.qty, vCenter, { width: cols.qtyW, align: 'center' });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica').text(sanitizePdfText(item.unit) || 'Nos', cols.unit, vCenter, { width: cols.unitW, align: 'center' });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica').text(item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.price, vCenter, { width: cols.priceW, align: 'right' });
    doc.fillColor(textDark).fontSize(7.5).font('Helvetica-Bold').text(item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.amount, vCenter, { width: cols.amountW - 6, align: 'right' });
    y += mainRowH;
  });

  // Total (A) Subtotal Row
  doc.rect(leftMargin, y, contentWidth, 16).fill('#FFFFFF');
  doc.rect(leftMargin, y, contentWidth, 16).lineWidth(0.8).strokeColor(ruleGray).stroke();
  doc.fillColor(themePrimary).fontSize(8).font('Helvetica-Bold').text('Total (A)', leftMargin + 8, y + 4);
  doc.fillColor(themePrimary).fontSize(8.5).font('Helvetica-Bold').text(`Rs. ${data.mainUnitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, cols.amount, y + 3.5, { width: cols.amountW - 6, align: 'right' });
  y += 16;

  // Section B: LOW SIDE
  if (lowSideItems.length > 0) {
    y += 6;
    drawSectionPill('B', 'LOW SIDE (B) IF NEED EXTRA MATERIALS', lowSideItems.length);
    drawTableHeader('Price (Rs.)');

    const lowSideRowH = lowSideItems.length <= 4 ? 20 : (lowSideItems.length <= 6 ? 17 : 15);
    lowSideItems.forEach((item, idx) => {
      const isAlt = idx % 2 === 1;
      if (isAlt) doc.rect(leftMargin, y, contentWidth, lowSideRowH).fill(rowAltBg);
      doc.rect(leftMargin, y, contentWidth, lowSideRowH).lineWidth(0.5).strokeColor(ruleGray).stroke();

      const vCenter = y + (lowSideRowH - 8) / 2;
      doc.fillColor(textDark).fontSize(7).font('Helvetica').text(String(idx + 1), cols.sl, vCenter, { width: cols.slW, align: 'center' });
      doc.fillColor(textDark).fontSize(7).font('Helvetica').text(sanitizePdfText(item.description), cols.desc + 6, y + 3.5, { width: cols.descW - 12 });
      doc.fillColor(textDark).fontSize(7).font('Helvetica').text(String(item.quantity), cols.qty, vCenter, { width: cols.qtyW, align: 'center' });
      doc.fillColor(textDark).fontSize(7).font('Helvetica').text(sanitizePdfText(item.unit) || 'Nos', cols.unit, vCenter, { width: cols.unitW, align: 'center' });
      doc.fillColor(textDark).fontSize(7).font('Helvetica').text(item.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.price, vCenter, { width: cols.priceW, align: 'right' });
      doc.fillColor(textDark).fontSize(7).font('Helvetica-Bold').text(item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }), cols.amount, vCenter, { width: cols.amountW - 6, align: 'right' });
      y += lowSideRowH;
    });
  }

  // Commercial Footer Blocks (Terms & Payment images / text)
  const availableBottomH = Math.max(140, footerY - y - 10);
  const gap = 8;
  const leftW = Math.min(315, contentWidth * 0.60);
  const rightW = contentWidth - leftW - gap;
  const termsH = Math.min(availableBottomH, leftW * (820 / 1600));
  const paymentH = Math.min((availableBottomH - 6) / 2, rightW * (500 / 1200));
  const bankH = Math.min((availableBottomH - 6) / 2, rightW * (460 / 1200));
  const rightX = leftMargin + leftW + gap;

  if (termsPath) {
    try { doc.image(termsPath, leftMargin, y + 8, { width: leftW, height: termsH }); } catch {}
  }
  if (paymentPath) {
    try { doc.image(paymentPath, rightX, y + 8, { width: rightW, height: paymentH }); } catch {}
  }
  if (bankPath) {
    try { doc.image(bankPath, rightX, y + 8 + paymentH + 4, { width: rightW, height: bankH }); } catch {}
  }

  drawFooterBanner();
}

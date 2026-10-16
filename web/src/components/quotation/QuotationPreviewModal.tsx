import React from 'react';
import { X, Download, Share2, Shield, MapPin, CheckCircle2, Phone, Mail, QrCode } from 'lucide-react';
import { Quotation, QuotationItem } from '../../types';
import { api } from '../../services/api';

interface QuotationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation | null;
  items: QuotationItem[];
}

export const QuotationPreviewModal: React.FC<QuotationPreviewModalProps> = ({
  isOpen,
  onClose,
  quotation,
  items,
}) => {
  if (!isOpen || !quotation) return null;

  const quoteItems = items.length > 0 ? items : (quotation.items || []);
  const mainItems = quoteItems.filter((i) => i.section === 'MAIN_UNIT');
  const lowSideItems = quoteItems.filter((i) => i.section === 'LOW_SIDE');

  const isCassette = quotation.acType === 'CASSETTE' || quotation.acType === 'DUCT' || quotation.acType === 'VRV';
  const isDaikin = quotation.quotationType !== 'ECDIAL';

  const downloadPdf = async () => {
    try {
      await api.downloadQuotationPdf(quotation.id);
    } catch (error: any) {
      alert(error?.message || 'Failed to download quotation PDF. Please log in again and retry.');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `ECDIAL Quotation - ${quotation.quotationNumber}`,
        text: `Quotation for ${quotation.customerName || 'Customer'} - Total: ₹${Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Quotation link copied to clipboard!');
    }
  };

  const scopeList = quotation.scopeExclusions
    ? quotation.scopeExclusions.split('\n').filter((l) => l.trim().length > 0)
    : [
        'All masonry/civil works: outdoor-unit supports, cutting and making good walls/floor slabs, trenches and scaffolding.',
        'Main power supply to each outdoor unit (3-phase) with ELCB and near each indoor unit (single-phase).',
        'False-ceiling, boxing, wooden framework and carpentry work.',
        'MS angle support for indoor units, if necessary.',
        'Provision of necessary drain points.',
        'Any under-deck or false-ceiling insulation work.',
        'Protected storage space at site.',
        'Power for erection, testing and commissioning.',
        'Any dismantling work.',
        'Items not specifically mentioned in ECDIAL’s scope of work are excluded.',
        'ODU and AHU lifting to terrace.',
      ];

  const reqsList = quotation.commissioningReqs
    ? quotation.commissioningReqs.split('\n').filter((l) => l.trim().length > 0)
    : [
        'Earth voltage must be maintained at a minimum of 0–3 V.',
        'Commissioning power: outdoor units, 3-phase 420-440 V; indoor units, single-phase 220-240 V.',
        'Electrical works must comply with issued specifications/drawings and electrical safety standards.',
      ];

  const paymentList = quotation.paymentMethod
    ? quotation.paymentMethod.split('\n').filter((l) => l.trim().length > 0)
    : [
        '100% advance with purchase order for machines.',
        '70% advance of total low-side value along with purchase order.',
        '25% after completion of erection works.',
        '5% payment after raising the final bill.',
        'Final bill based on actual quantities used at site after measurement.',
      ];

  const brandPrimary = isDaikin ? '#0875C9' : '#0A1E3F';
  const brandAccent = isDaikin ? '#0066CC' : '#F2791E';

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-container" style={{ maxWidth: '960px', maxHeight: '95vh' }}>
        {/* Action Header */}
        <div className="modal-header" style={{ background: '#091322', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="badge badge-present">
              {isCassette ? 'Commercial Proposal' : 'Official Quotation'}
            </span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
              {quotation.quotationNumber}
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              ({quotation.acType || 'SPLIT'} • {quotation.quotationType || 'DAIKIN'})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleShare}>
              <Share2 size={14} /> Share
            </button>
            <button className="btn btn-primary btn-sm" onClick={downloadPdf}>
              <Download size={14} /> Download Official PDF
            </button>
            <button className="btn btn-secondary btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="modal-body" style={{ background: '#CBD5E1', padding: '24px', overflowY: 'auto' }}>
          {isCassette ? (
            /* ==================== 2-PAGE CASSETTE LAYOUT MATCHING REFERENCE ==================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {/* PAGE 1: Equipment & Cost Schedule */}
              <div
                style={{
                  background: '#FFFFFF',
                  color: '#1E293B',
                  borderRadius: '4px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
                  fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  overflow: 'hidden',
                }}
              >
                {/* Header Banner */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#FFFFFF',
                    padding: '20px 28px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '2px', lineHeight: 1 }}>
                      {isDaikin ? 'DAIKIN' : 'ECDIAL'}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', marginTop: 4, opacity: 0.9 }}>
                      AIR CONDITIONING SOLUTIONS
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', opacity: 0.85 }}>
                      COMFORT FOR A BRIGHTER TOMORROW
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, marginTop: 4 }}>
                      Date: {quotation.date} | Valid: {quotation.validTill || '10 Days'}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '28px' }}>
                  {/* Title Bar */}
                  <div style={{ borderBottom: '2px solid #0875C9', paddingBottom: '10px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0875C9', letterSpacing: '1px' }}>
                      COMMERCIAL PROPOSAL / 01
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0' }}>
                      Equipment & Cost Schedule
                    </h2>
                  </div>

                  {/* Customer / System Information Panel */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1.2fr 1fr',
                      gap: '16px',
                      background: '#F0F9FF',
                      border: '1px solid #BAE6FD',
                      borderRadius: '8px',
                      padding: '16px 20px',
                      marginBottom: '24px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                        PREPARED FOR
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 850, color: '#0f172a', marginTop: 2 }}>
                        {quotation.customerName || 'Customer'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#475569', marginTop: 2 }}>
                        {quotation.customerAddress || 'Site Address'}
                      </div>
                      {quotation.customerPhone && (
                        <div style={{ fontSize: '11px', color: '#0284c7', marginTop: 2 }}>
                          📞 {quotation.customerPhone}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                        SYSTEM DESIGNATION
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: 850, color: '#0f172a', marginTop: 2 }}>
                        {quotation.systemDesignation || `${quotation.acType || 'Cassette'} AC`}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#475569', marginTop: 2 }}>
                        Total capacity: {quotation.totalCapacity || '5 TR'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                        OFFER TYPE
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 850, color: '#0f172a', marginTop: 2 }}>
                        {quotation.offerType || 'Supply and Installation'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>
                        Ref: {quotation.quotationNumber}
                      </div>
                    </div>
                  </div>

                  {/* SECTION A: MAIN UNITS / HIGH-SIDE EQUIPMENT */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          background: '#0875C9',
                          color: '#FFFFFF',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 900,
                          fontSize: '12px',
                        }}
                      >
                        A
                      </span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.5px' }}>
                          MAIN UNITS / HIGH-SIDE EQUIPMENT
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          Supply schedule - model references retained from source quotation
                        </div>
                      </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1' }}>
                          <th style={{ padding: '8px', width: '45px', textAlign: 'center', color: '#334155' }}>Item</th>
                          <th style={{ padding: '8px', textAlign: 'left', color: '#334155' }}>Equipment / model description</th>
                          <th style={{ padding: '8px', width: '55px', textAlign: 'center', color: '#334155' }}>Unit</th>
                          <th style={{ padding: '8px', width: '45px', textAlign: 'center', color: '#334155' }}>Qty</th>
                          <th style={{ padding: '8px', width: '110px', textAlign: 'right', color: '#334155' }}>Supply rate (₹)</th>
                          <th style={{ padding: '8px', width: '115px', textAlign: 'right', color: '#334155' }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mainItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 0 ? '#FFFFFF' : '#F9FBFC' }}>
                            <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '8px', fontWeight: 700, color: '#0f172a' }}>{item.description}</td>
                            <td style={{ padding: '8px', textAlign: 'center', color: '#475569' }}>{item.unit}</td>
                            <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                              {Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                              {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                        {/* High Side Equipment Total Bar */}
                        <tr style={{ background: '#F0F9FF', borderTop: '2px solid #BAE6FD' }}>
                          <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 900, color: '#0875C9', fontSize: '12px' }}>
                            TOTAL – HIGH-SIDE EQUIPMENT
                          </td>
                          <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, fontSize: '14px', color: '#0875C9', fontFamily: 'monospace' }}>
                            ₹ {Number(quotation.mainUnitTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* SECTION B: LOW-SIDE WORKS */}
                  {lowSideItems.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '4px',
                            background: '#0875C9',
                            color: '#FFFFFF',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 900,
                            fontSize: '12px',
                          }}
                        >
                          B
                        </span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.5px' }}>
                            LOW-SIDE WORKS
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            Supply and installation amounts shown separately
                          </div>
                        </div>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1' }}>
                            <th style={{ padding: '8px', width: '45px', textAlign: 'center', color: '#334155' }}>Item</th>
                            <th style={{ padding: '8px', textAlign: 'left', color: '#334155' }}>Work description / specification</th>
                            <th style={{ padding: '8px', width: '55px', textAlign: 'center', color: '#334155' }}>Unit</th>
                            <th style={{ padding: '8px', width: '45px', textAlign: 'center', color: '#334155' }}>Qty</th>
                            <th style={{ padding: '8px', width: '115px', textAlign: 'right', color: '#334155' }}>Supply amount (₹)</th>
                            <th style={{ padding: '8px', width: '115px', textAlign: 'right', color: '#334155' }}>Installation (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lowSideItems.map((item, idx) => {
                            const supAmt = (item.supplyAmount !== undefined && item.supplyAmount !== null)
                              ? item.supplyAmount
                              : (item.supplyRate ? item.quantity * item.supplyRate : 0);
                            const instAmt = (item.installAmount !== undefined && item.installAmount !== null)
                              ? item.installAmount
                              : (item.installRate ? item.quantity * item.installRate : 0);
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 0 ? '#FFFFFF' : '#F9FBFC' }}>
                                <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                                <td style={{ padding: '8px', color: '#1E293B' }}>{item.description}</td>
                                <td style={{ padding: '8px', textAlign: 'center', color: '#475569' }}>{item.unit}</td>
                                <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                                  {supAmt > 0 ? Number(supAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                                  {instAmt > 0 ? Number(instAmt).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                          {/* Low-Side Totals Bar */}
                          <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
                            <td colSpan={3} style={{ padding: '10px 14px', fontWeight: 900, fontSize: '11px', letterSpacing: '0.5px' }}>
                              TOTAL LOW-SIDE WORKS
                            </td>
                            <td colSpan={3} style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: '12px' }}>
                              Supply ₹ {Number(quotation.lowSideSupplyTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              <span style={{ margin: '0 8px', opacity: 0.6 }}>/</span>
                              Installation ₹ {Number(quotation.lowSideInstallTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TOTAL PROJECT COST (A + B) Banner */}
                  <div
                    style={{
                      background: 'linear-gradient(90deg, #0875C9 0%, #0369A1 100%)',
                      color: '#FFFFFF',
                      padding: '16px 24px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 12px rgba(8, 117, 201, 0.25)',
                    }}
                  >
                    <div style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '1px' }}>
                      TOTAL PROJECT COST (A + B)
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                      ₹ {Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {/* Page 1 Footer indicator */}
                  <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10.5px' }}>
                    <div>ECDIAL Air Conditioning Solutions • Coimbatore & Tiruppur</div>
                    <div style={{ fontWeight: 800 }}>01 / 02</div>
                  </div>
                </div>
              </div>

              {/* PAGE 2: Scope, Terms & Payment */}
              <div
                style={{
                  background: '#FFFFFF',
                  color: '#1E293B',
                  borderRadius: '4px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
                  fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  overflow: 'hidden',
                }}
              >
                {/* Header Banner */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#FFFFFF',
                    padding: '20px 28px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '2px', lineHeight: 1 }}>
                      {isDaikin ? 'DAIKIN' : 'ECDIAL'}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', marginTop: 4, opacity: 0.9 }}>
                      AIR CONDITIONING SOLUTIONS
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', opacity: 0.85 }}>
                      COMFORT FOR A BRIGHTER TOMORROW
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, marginTop: 4 }}>
                      Date: {quotation.date}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '28px' }}>
                  {/* Title Bar */}
                  <div style={{ borderBottom: '2px solid #0875C9', paddingBottom: '10px', marginBottom: '20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#0875C9', letterSpacing: '1px' }}>
                      COMMERCIAL PROPOSAL / 02
                    </div>
                    <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '4px 0 0 0' }}>
                      Scope, Terms & Payment
                    </h2>
                  </div>

                  {/* SECTION C: CUSTOMER SCOPE / EXCLUSIONS */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          background: '#0875C9',
                          color: '#FFFFFF',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 900,
                          fontSize: '12px',
                        }}
                      >
                        C
                      </span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                          CUSTOMER SCOPE / EXCLUSIONS
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          Items below are to be arranged by the customer unless agreed otherwise
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {scopeList.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            background: '#F8FAFC',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: '1px solid #E2E8F0',
                            fontSize: '11px',
                          }}
                        >
                          <span
                            style={{
                              background: '#E0F2FE',
                              color: '#0369A1',
                              fontWeight: 800,
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              flexShrink: 0,
                            }}
                          >
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span style={{ color: '#334155' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION D: REQUIREMENTS BEFORE COMMISSIONING */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          background: '#0875C9',
                          color: '#FFFFFF',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 900,
                          fontSize: '12px',
                        }}
                      >
                        D
                      </span>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                        REQUIREMENTS BEFORE COMMISSIONING
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {reqsList.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            background: '#F8FAFC',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            border: '1px solid #E2E8F0',
                            fontSize: '11px',
                          }}
                        >
                          <span style={{ fontWeight: 800, color: '#0875C9', flexShrink: 0 }}>{idx + 1}.</span>
                          <span style={{ color: '#334155' }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SECTION E: TERMS & CONDITIONS */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          background: '#0875C9',
                          color: '#FFFFFF',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 900,
                          fontSize: '12px',
                        }}
                      >
                        E
                      </span>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                        TERMS & CONDITIONS
                      </div>
                    </div>

                    <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: '1px solid #E2E8F0' }}>
                        <div style={{ background: '#E0F2FE', padding: '10px 14px', fontWeight: 800, color: '#0369A1', fontSize: '11px' }}>
                          TAX
                        </div>
                        <div style={{ padding: '10px 14px', color: '#1E293B', fontSize: '11px' }}>
                          AC price and labour charges are exclusive of GST and subject to 18% GST.
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr' }}>
                        <div style={{ background: '#E0F2FE', padding: '10px 14px', fontWeight: 800, color: '#0369A1', fontSize: '11px' }}>
                          PAYMENT SCHEDULE
                        </div>
                        <div style={{ padding: '10px 14px', color: '#1E293B', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {paymentList.map((p, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                              <span style={{ color: '#0875C9', fontWeight: 900 }}>•</span>
                              <span>{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION F: BANK DETAILS */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          background: '#0875C9',
                          color: '#FFFFFF',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 900,
                          fontSize: '12px',
                        }}
                      >
                        F
                      </span>
                      <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                        BANK DETAILS
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 180px',
                        gap: '16px',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '14px 18px',
                        background: '#F8FAFC',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', rowGap: '6px', fontSize: '11px' }}>
                        <span style={{ fontWeight: 800, color: '#475569' }}>ACCOUNT NAME</span>
                        <strong style={{ color: '#0f172a' }}>ECDIAL</strong>

                        <span style={{ fontWeight: 800, color: '#475569' }}>ACCOUNT NUMBER</span>
                        <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>59212062011123</strong>

                        <span style={{ fontWeight: 800, color: '#475569' }}>BANK</span>
                        <strong style={{ color: '#0f172a' }}>HDFC LTD.</strong>

                        <span style={{ fontWeight: 800, color: '#475569' }}>BRANCH</span>
                        <span style={{ color: '#0f172a' }}>Tirupur Main Branch (Aristo International)</span>

                        <span style={{ fontWeight: 800, color: '#475569' }}>IFSC CODE</span>
                        <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>HDFC0000445</strong>
                      </div>

                      <div style={{ textAlign: 'center', borderLeft: '1px solid #E2E8F0', paddingLeft: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: '9px', fontWeight: 800, color: '#0875C9', letterSpacing: '0.5px', marginBottom: '6px' }}>
                          SCAN TO PAY (UPI / BANK TRANSFER)
                        </div>
                        <div style={{ width: '80px', height: '80px', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '4px', display: 'grid', placeItems: 'center' }}>
                          <QrCode size={64} color="#0f172a" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Page 2 Footer indicator */}
                  <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10.5px' }}>
                    <div>📞 8248098044 / 8144144436 | ✉️ edecdial@gmail.com | 📍 Tiruppur, Tamil Nadu</div>
                    <div style={{ fontWeight: 800 }}>02 / 02</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ==================== SPLIT AC SINGLE PAGE LAYOUT ==================== */
            <div
              style={{
                background: '#FFFFFF',
                color: '#1E293B',
                padding: '36px',
                borderRadius: '6px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
                fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                fontSize: '12px',
                lineHeight: '1.4',
                position: 'relative',
              }}
            >
              {/* Header Banner */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: '20px',
                  borderBottom: `2px solid ${brandAccent}`,
                  marginBottom: '20px',
                }}
              >
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: brandAccent, letterSpacing: '1px', lineHeight: 1 }}>
                    {isDaikin ? 'DAIKIN' : 'ECDIAL'}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: brandPrimary, letterSpacing: '2px', marginTop: '4px' }}>
                    AIR CONDITIONERS
                  </div>
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                    ECDIAL ENGINEERING SOLUTIONS
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: brandPrimary }}>
                    Authorized Sales & Service Dealer
                  </div>
                  <div style={{ fontSize: '10px', color: '#475569', marginTop: '3px' }}>
                    📍 Coimbatore, Tamil Nadu
                  </div>
                  <div style={{ fontSize: '10px', color: '#475569' }}>
                    📞 +91 98765 43210
                  </div>
                  <div style={{ fontSize: '10px', color: brandAccent }}>
                    ✉️ edecdial@gmail.com
                  </div>
                </div>
              </div>

              {/* Customer & Quotation Box */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', marginBottom: '24px' }}>
                <div style={{ padding: '6px 0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: brandPrimary, marginBottom: '4px' }}>To,</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: brandPrimary }}>
                    {quotation.customerName || 'Customer'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    📍 {quotation.customerAddress || 'Address'}
                  </div>
                  {quotation.customerPhone && (
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                      Phone: {quotation.customerPhone}
                    </div>
                  )}
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      background: brandAccent,
                      color: '#FFFFFF',
                      padding: '8px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.5px' }}>QUOTATION</span>
                    <span style={{ fontSize: '10.5px' }}>📅 Date: {quotation.date}</span>
                  </div>

                  <div style={{ padding: '10px 14px', background: '#F8FAFC', fontSize: '11.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span style={{ color: '#475569' }}>Sub Total (A)</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        ₹ {Number(quotation.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span style={{ color: '#475569' }}>CGST {quotation.cgstPercent}%</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        ₹ {Number(quotation.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span style={{ color: '#475569' }}>SGST {quotation.sgstPercent}%</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        ₹ {Number(quotation.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: brandPrimary,
                      color: '#FFFFFF',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 800 }}>TOTAL (A)</span>
                    <span style={{ fontSize: '15px', fontWeight: 900, fontFamily: 'monospace', color: '#60A5FA' }}>
                      ₹ {Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section A: MAIN UNIT */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ background: brandPrimary, color: '#FFFFFF', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>A</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: brandPrimary }}>MAIN UNITS</span>
                  {mainItems.length > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C' }}>( {mainItems.length} ITEMS )</span>
                  )}
                  <div style={{ flex: 1, height: '1px', background: '#CBD5E1' }} />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: brandPrimary, color: '#FFFFFF' }}>
                      <th style={{ padding: '8px', width: '45px', textAlign: 'center' }}>SL.No</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '8px', width: '50px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px', width: '60px', textAlign: 'center' }}>Unit</th>
                      <th style={{ padding: '8px', width: '95px', textAlign: 'right' }}>Price (₹)</th>
                      <th style={{ padding: '8px', width: '105px', textAlign: 'right' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainItems.map((item, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F9FBFC', borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#64748B' }}>{idx + 1}</td>
                        <td style={{ padding: '8px', fontWeight: 700, color: brandPrimary }}>{item.description}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.unit}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                          {Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>
                          {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#F1F5F9', borderTop: '1px solid #CBD5E1' }}>
                      <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 800, color: brandPrimary }}>
                        Total (A)
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 900, fontFamily: 'monospace', color: brandPrimary }}>
                        ₹ {Number(quotation.mainUnitTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section B: LOW SIDE */}
              {quotation.hasLowSide && lowSideItems.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ background: brandPrimary, color: '#FFFFFF', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>B</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: brandPrimary }}>LOW SIDE (B) IF NEED EXTRA MATERIALS</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C' }}>( {lowSideItems.length} ITEMS )</span>
                    <div style={{ flex: 1, height: '1px', background: '#CBD5E1' }} />
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: brandPrimary, color: '#FFFFFF' }}>
                        <th style={{ padding: '8px', width: '45px', textAlign: 'center' }}>SL.No</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Description</th>
                        <th style={{ padding: '8px', width: '50px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px', width: '60px', textAlign: 'center' }}>Unit</th>
                        <th style={{ padding: '8px', width: '95px', textAlign: 'right' }}>Price (₹)</th>
                        <th style={{ padding: '8px', width: '105px', textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowSideItems.map((item, idx) => (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F9FBFC', borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px', textAlign: 'center', color: '#64748B' }}>{idx + 1}</td>
                          <td style={{ padding: '8px', color: '#1E293B' }}>{item.description}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{item.unit}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace' }}>
                            {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#F1F5F9', borderTop: '1px solid #CBD5E1' }}>
                        <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 800, color: brandPrimary }}>
                          Total (B)
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 900, fontFamily: 'monospace', color: brandPrimary }}>
                          ₹ {Number(quotation.lowSideTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Terms & Payment Method */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#F1F5F9', padding: '8px 12px', fontWeight: 800, fontSize: '11px', color: brandPrimary }}>
                    📝 TERMS & CONDITIONS
                  </div>
                  <div style={{ padding: '12px', fontSize: '9.5px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(quotation.termsAndConditions ? quotation.termsAndConditions.split('\n') : []).map((t, i) => (
                      <div key={i} style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ color: brandAccent, fontWeight: 900 }}>•</span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#F1F5F9', padding: '8px 12px', fontWeight: 800, fontSize: '11px', color: brandPrimary }}>
                    💳 PAYMENT METHOD
                  </div>
                  <div style={{ padding: '12px', fontSize: '9.5px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(quotation.paymentMethod ? quotation.paymentMethod.split('\n') : []).map((p, i) => (
                      <div key={i} style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ color: brandAccent, fontWeight: 900 }}>✓</span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer Banner */}
              <div
                style={{
                  background: brandPrimary,
                  color: '#FFFFFF',
                  padding: '12px 18px',
                  borderRadius: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 700 }}>
                  <span>🤝</span>
                  <span>Thanking you and assure our best service always.</span>
                </div>
                <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                  ❄️ Split AC Indoor / Outdoor Units
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

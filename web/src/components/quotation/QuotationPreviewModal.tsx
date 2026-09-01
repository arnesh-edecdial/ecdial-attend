import React from 'react';
import { X, Download, Share2, Shield, MapPin, CheckCircle2, Phone, Mail } from 'lucide-react';
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

  const mainItems = items.filter((i) => i.section === 'MAIN_UNIT');
  const lowSideItems = items.filter((i) => i.section === 'LOW_SIDE');

  const downloadPdf = () => {
    window.open(api.getPdfDownloadUrl(quotation.id), '_blank');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `ECDIAL Quotation - ${quotation.quotationNumber}`,
        text: `Quotation for ${quotation.customerName} - Total: ₹${Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Quotation link copied to clipboard!');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '880px', maxHeight: '95vh' }}>
        {/* Action Header */}
        <div className="modal-header" style={{ background: '#091322', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="badge badge-present">Official Commercial Offer</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
              {quotation.quotationNumber}
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

        {/* Printable Paper Canvas (Matching Image 2 Reference exactly) */}
        <div className="modal-body" style={{ background: '#E2E8F0', padding: '24px', overflowY: 'auto' }}>
          <div style={{
            background: '#FFFFFF',
            color: '#1E293B',
            padding: '36px',
            borderRadius: '6px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            lineHeight: '1.4',
            position: 'relative',
          }}>
            {/* 1. Header Banner matching Image 2 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              paddingBottom: '20px',
              borderBottom: '2px solid #0066CC',
              marginBottom: '20px',
            }}>
              {/* Left Brand */}
              <div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#0066CC', letterSpacing: '1px', lineHeight: 1 }}>
                  DAIKIN
                </div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#0A1E3F', letterSpacing: '2px', marginTop: '4px' }}>
                  AIR CONDITIONERS
                </div>
                <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                  ECDIAL ENGINEERING SOLUTIONS
                </div>
              </div>

              {/* Right Dealer Info */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0A1E3F' }}>
                  Authorized Sales & Service Dealer
                </div>
                <div style={{ fontSize: '10px', color: '#475569', marginTop: '3px' }}>
                  📍 Coimbatore, Tamil Nadu
                </div>
                <div style={{ fontSize: '10px', color: '#475569' }}>
                  📞 +91 98765 43210
                </div>
                <div style={{ fontSize: '10px', color: '#0066CC' }}>
                  ✉️ sales@daikincoimbatore.in
                </div>
              </div>
            </div>

            {/* 2. Customer & Quotation Commercial Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px', marginBottom: '24px' }}>
              {/* Left: To Customer */}
              <div style={{ padding: '6px 0' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0A1E3F', marginBottom: '4px' }}>To,</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#0A1E3F' }}>
                  {quotation.customerName}
                </div>
                <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  📍 {quotation.customerAddress}
                </div>
                {quotation.customerPhone && (
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                    Phone: {quotation.customerPhone}
                  </div>
                )}
              </div>

              {/* Right: Quotation Commercial Card (Matching Image 2) */}
              <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{
                  background: '#0066CC',
                  color: '#FFFFFF',
                  padding: '8px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
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

                <div style={{
                  background: '#0A1E3F',
                  color: '#FFFFFF',
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 800 }}>TOTAL (A)</span>
                  <span style={{ fontSize: '15px', fontWeight: 900, fontFamily: 'monospace', color: '#60A5FA' }}>
                    ₹ {Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Section A: MAIN UNIT */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ background: '#0A1E3F', color: '#FFFFFF', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>A</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0A1E3F' }}>MAIN UNITS</span>
                {mainItems.length > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C' }}>( {mainItems.length} ITEMS )</span>
                )}
                <div style={{ flex: 1, height: '1px', background: '#CBD5E1' }} />
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#0A1E3F', color: '#FFFFFF' }}>
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
                      <td style={{ padding: '8px', fontWeight: 700, color: '#0A1E3F' }}>{item.description}</td>
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
                  {/* Total (A) Subtotal Row */}
                  <tr style={{ background: '#F1F5F9', borderTop: '1px solid #CBD5E1' }}>
                    <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 800, color: '#0A1E3F' }}>
                      Total (A)
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 900, fontFamily: 'monospace', color: '#0A1E3F' }}>
                      ₹ {Number(quotation.mainUnitTotal || mainItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4. Section B: LOW SIDE (B) IF NEED EXTRA MATERIALS */}
            {quotation.hasLowSide && lowSideItems.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ background: '#0A1E3F', color: '#FFFFFF', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>B</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#0A1E3F' }}>LOW SIDE (B) IF NEED EXTRA MATERIALS</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C' }}>( {lowSideItems.length} ITEMS )</span>
                  <div style={{ flex: 1, height: '1px', background: '#CBD5E1' }} />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#0A1E3F', color: '#FFFFFF' }}>
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
                    {/* Total (B) Subtotal Row */}
                    <tr style={{ background: '#F1F5F9', borderTop: '1px solid #CBD5E1' }}>
                      <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 800, color: '#0A1E3F' }}>
                        Total (B)
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 900, fontFamily: 'monospace', color: '#0A1E3F' }}>
                        ₹ {Number(quotation.lowSideTotal || lowSideItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. Terms & Conditions (Left) & Payment Method (Right) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '24px' }}>
              {/* Terms Box */}
              <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ background: '#F1F5F9', padding: '8px 12px', fontWeight: 800, fontSize: '11px', color: '#0A1E3F' }}>
                  📝 TERMS & CONDITIONS
                </div>
                <div style={{ padding: '12px', fontSize: '9.5px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ background: '#0A1E3F', color: '#FFFFFF', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, flexShrink: 0 }}>1</span>
                    <span>AC Price is inclusive of 18 % taxes. 18% Tax Additional for Lowside.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ background: '#0A1E3F', color: '#FFFFFF', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, flexShrink: 0 }}>2</span>
                    <span>Electrical, Plumbing, civil work, Structural, core cutting, scaffolding, IDU Room wall opening for customer scope.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ background: '#0A1E3F', color: '#FFFFFF', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, flexShrink: 0 }}>3</span>
                    <span>We have given quotation as per BOQ. Extra materials like Copper Pipe, cables will be charged as per actuals.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ background: '#0A1E3F', color: '#FFFFFF', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, flexShrink: 0 }}>4</span>
                    <span>Payment: 100% Machine with PO, 70% Lowside with PO, 25% on erection, 5% on final bill.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ background: '#0A1E3F', color: '#FFFFFF', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, flexShrink: 0 }}>5</span>
                    <span>Final bill will be raised on basis of actual quantities at site.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ background: '#0A1E3F', color: '#FFFFFF', borderRadius: '50%', width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 800, flexShrink: 0 }}>6</span>
                    <span>This Quotation Is Valid For 10 days.</span>
                  </div>
                </div>
              </div>

              {/* Payment Method Box */}
              <div style={{ border: '1px solid #CBD5E1', borderRadius: '6px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ background: '#F1F5F9', padding: '8px 12px', fontWeight: 800, fontSize: '11px', color: '#0A1E3F' }}>
                    💳 PAYMENT METHOD
                  </div>
                  <div style={{ padding: '12px', fontSize: '10px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#0066CC', color: '#FFFFFF', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, flexShrink: 0 }}>i</span>
                      <span>100% Payment advance with P.O for Machine.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#0066CC', color: '#FFFFFF', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, flexShrink: 0 }}>ii</span>
                      <span>70% Advance of Total Lowside Value along with PO.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#0066CC', color: '#FFFFFF', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, flexShrink: 0 }}>iii</span>
                      <span>25% After completion of erection works.</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#0066CC', color: '#FFFFFF', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 800, flexShrink: 0 }}>iv</span>
                      <span>5% Payment after raising the final bill.</span>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#EBF3FC', padding: '8px 12px', margin: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={16} color="#0066CC" />
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#0066CC' }}>
                    Quality Cooling. Trusted Service. Every Time.
                  </span>
                </div>
              </div>
            </div>

            {/* 6. Footer Banner matching Image 2 */}
            <div style={{
              background: '#0A1E3F',
              color: '#FFFFFF',
              padding: '12px 18px',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontWeight: 700 }}>
                <span>🤝</span>
                <span>Thanking you and assure our best service always.</span>
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>
                ❄️ Split AC Indoor / Outdoor Units
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

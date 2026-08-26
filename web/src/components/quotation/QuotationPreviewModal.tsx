import React from 'react';
import { X, Download, Printer, Share2, CheckCircle2, Shield } from 'lucide-react';
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
        text: `Quotation for ${quotation.customerName} - Total: ₹${quotation.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Quotation link copied to clipboard!');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '850px', maxHeight: '95vh' }}>
        {/* Action Header */}
        <div className="modal-header" style={{ background: '#091322' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="badge badge-present">Quotation Document Preview</span>
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

        {/* Printable Paper Canvas Preview */}
        <div className="modal-body" style={{ background: '#E2E8F0', padding: '24px', overflowY: 'auto' }}>
          <div style={{
            background: '#FFFFFF',
            color: '#1A202C',
            padding: '36px',
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            lineHeight: '1.4',
          }}>
            {/* Header Banner */}
            <div style={{
              background: '#0F2A4A',
              color: '#FFFFFF',
              padding: '16px 20px',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>ECDIAL</h1>
                <div style={{ fontSize: '10px', opacity: 0.9 }}>AIR CONDITIONING & ENGINEERING SOLUTIONS</div>
                <div style={{ fontSize: '9px', opacity: 0.75, marginTop: '2px' }}>
                  GSTIN: 33AAAAE1234F1Z5 | PAN: AAAAE1234F | Tel: +91 44 2847 9000
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '1px' }}>QUOTATION</div>
                <div style={{ fontSize: '10px', opacity: 0.85 }}>Commercial Offer</div>
              </div>
            </div>

            {/* Customer & Quote Details Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#0F2A4A', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Customer Details:
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A202C' }}>{quotation.customerName}</div>
                <div style={{ fontSize: '11px', color: '#4A5568', whiteSpace: 'pre-line', marginTop: '2px' }}>
                  {quotation.customerAddress}
                </div>
                {quotation.customerPhone && (
                  <div style={{ fontSize: '11px', color: '#4A5568', marginTop: '4px' }}>
                    Phone: {quotation.customerPhone}
                  </div>
                )}
              </div>

              <div style={{ padding: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#0F2A4A', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Quotation Details:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '4px', fontSize: '11.5px' }}>
                  <span style={{ color: '#718096' }}>Quote No:</span>
                  <strong style={{ color: '#0F2A4A' }}>{quotation.quotationNumber}</strong>
                  <span style={{ color: '#718096' }}>Date:</span>
                  <span>{quotation.date}</span>
                  <span style={{ color: '#718096' }}>Sales Exec:</span>
                  <span>{quotation.createdByName || 'ECDIAL Sales Team'}</span>
                </div>
              </div>
            </div>

            {/* Section A: Main Unit */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ background: '#0066CC', color: '#FFFFFF', padding: '6px 10px', fontWeight: 700, fontSize: '11px', borderRadius: '4px 4px 0 0' }}>
                MAIN UNIT (A) - EQUIPMENT & SYSTEM
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E0' }}>
                <thead>
                  <tr style={{ background: '#EDF2F7', color: '#2D3748', fontSize: '10.5px' }}>
                    <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '35px', textAlign: 'center' }}>S.No</th>
                    <th style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'left' }}>Item Description</th>
                    <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '45px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '55px', textAlign: 'center' }}>Unit</th>
                    <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '85px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '95px', textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {mainItems.map((item, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F7FAFC' }}>
                      <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'center' }}>{idx + 1}</td>
                      <td style={{ padding: '6px', border: '1px solid #CBD5E0', fontWeight: 600 }}>{item.description}</td>
                      <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'center' }}>{item.unit}</td>
                      <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'right', fontFamily: 'monospace' }}>
                        {Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                        {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: '#EDF2F7', fontWeight: 700 }}>
                    <td colSpan={5} style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'right' }}>
                      Main Unit Subtotal (A):
                    </td>
                    <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'right', fontFamily: 'monospace' }}>
                      ₹{Number(quotation.mainUnitTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section B: Low-Side Materials (if enabled) */}
            {quotation.hasLowSide && lowSideItems.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ background: '#0066CC', color: '#FFFFFF', padding: '6px 10px', fontWeight: 700, fontSize: '11px', borderRadius: '4px 4px 0 0' }}>
                  LOW-SIDE MATERIALS (B) - PIPING, CABLING & ACCESSORIES
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E0' }}>
                  <thead>
                    <tr style={{ background: '#EDF2F7', color: '#2D3748', fontSize: '10.5px' }}>
                      <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '35px', textAlign: 'center' }}>S.No</th>
                      <th style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'left' }}>Item Description</th>
                      <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '45px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '55px', textAlign: 'center' }}>Unit</th>
                      <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '85px', textAlign: 'right' }}>Rate (₹)</th>
                      <th style={{ padding: '6px', border: '1px solid #CBD5E0', width: '95px', textAlign: 'right' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowSideItems.map((item, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F7FAFC' }}>
                        <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ padding: '6px', border: '1px solid #CBD5E0' }}>{item.description}</td>
                        <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'center' }}>{item.unit}</td>
                        <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'right', fontFamily: 'monospace' }}>
                          {Number(item.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                          {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#EDF2F7', fontWeight: 700 }}>
                      <td colSpan={5} style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'right' }}>
                        Low-Side Subtotal (B):
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #CBD5E0', textAlign: 'right', fontFamily: 'monospace' }}>
                        ₹{Number(quotation.lowSideTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Financial Summary Box */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <div style={{ width: '280px', border: '1px solid #CBD5E0', borderRadius: '4px', background: '#F8FAFC', padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ color: '#4A5568' }}>Subtotal (A + B):</span>
                  <strong style={{ fontFamily: 'monospace' }}>₹{Number(quotation.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px' }}>
                  <span style={{ color: '#718096' }}>CGST ({quotation.cgstPercent}%):</span>
                  <span style={{ fontFamily: 'monospace' }}>₹{Number(quotation.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px' }}>
                  <span style={{ color: '#718096' }}>SGST ({quotation.sgstPercent}%):</span>
                  <span style={{ fontFamily: 'monospace' }}>₹{Number(quotation.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 0 0',
                  marginTop: '6px',
                  borderTop: '2px solid #0F2A4A',
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#0F2A4A',
                }}>
                  <span>GRAND TOTAL:</span>
                  <span style={{ fontFamily: 'monospace' }}>₹{Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Terms & Payment Method */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px', fontSize: '10px' }}>
              <div style={{ padding: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                <div style={{ fontWeight: 700, color: '#0F2A4A', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Terms & Conditions:
                </div>
                <div style={{ color: '#4A5568', whiteSpace: 'pre-line' }}>{quotation.termsAndConditions}</div>
              </div>

              <div style={{ padding: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px' }}>
                <div style={{ fontWeight: 700, color: '#0F2A4A', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Payment Method:
                </div>
                <div style={{ color: '#4A5568', whiteSpace: 'pre-line' }}>{quotation.paymentMethod}</div>
              </div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '20px', borderTop: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#718096' }}>Customer Signature & Seal:</div>
                <div style={{ marginTop: '24px', fontSize: '10px', color: '#A0AEC0' }}>Date: _________________</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F2A4A' }}>For ECDIAL AIR CONDITIONING SOLUTIONS</div>
                <div style={{ marginTop: '24px', fontSize: '10px', color: '#718096' }}>Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

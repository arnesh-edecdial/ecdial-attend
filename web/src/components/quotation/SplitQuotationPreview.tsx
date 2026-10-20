import React, { useEffect, useState } from 'react';
import { X, Download, Pencil } from 'lucide-react';
import { previewHtml, downloadQuotationPdf } from '../../utils/quotation/quotationPrint';
import { resolveQuotationType } from '../../utils/quotation/quotationType';

interface Props {
  isOpen: boolean;
  quotation: any | null;
  onClose: () => void;
  onEdit?: () => void;
}

/**
 * Split quotation preview. Renders the SAME paginated A4 HTML as the Android app
 * (buildQuotationHtml), so the web preview and the PDF match the phone exactly.
 */
export const SplitQuotationPreview: React.FC<Props> = ({ isOpen, quotation, onClose, onEdit }) => {
  const [html, setHtml] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    if (!isOpen || !quotation) return;
    setHtml('');
    setError('');
    previewHtml(quotation)
      .then((h) => alive && setHtml(h))
      .catch((e) => alive && setError(e?.message || 'Could not render the quotation.'));
    return () => { alive = false; };
  }, [isOpen, quotation]);

  if (!isOpen || !quotation) return null;

  const kind = resolveQuotationType(quotation);
  const acLabel = ({ SPLIT: 'Split AC', CASSETTE: 'Cassette AC', DUCT: 'Duct AC', VRV: 'VRV / VRF' } as Record<string, string>)[String(quotation.acType || 'SPLIT').toUpperCase()] || 'Split AC';
  const fileName = quotation.pdfName || `${kind}_Quotation_${quotation.customerName || quotation.quotationNumber || ''}`;

  const download = async () => {
    try {
      setBusy(true);
      await downloadQuotationPdf(quotation, fileName);
    } catch (e: any) {
      alert(e?.message || 'Could not create the PDF.');
    } finally {
      setBusy(false);
    }
  };

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
    borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#0F172A',
    fontWeight: 600, fontSize: 13, cursor: 'pointer',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#E6E9F0', borderRadius: 12, width: 'min(680px, 100%)', height: 'min(94vh, 1000px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {quotation.quotationNumber || 'Quotation'} · {kind === 'DAIKIN' ? 'Daikin' : 'Ec Dial'} · {acLabel}
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>{quotation.customerName || 'No customer name'}</div>
          </div>
          {onEdit && (
            <button style={btn} onClick={onEdit}><Pencil size={14} /> Edit</button>
          )}
          <button style={{ ...btn, background: '#0B4A86', color: '#fff', border: 0, opacity: busy ? 0.6 : 1 }} onClick={download} disabled={busy || !html}>
            <Download size={14} /> {busy ? 'Preparing…' : 'Download PDF'}
          </button>
          <button style={{ ...btn, padding: 0, width: 36, justifyContent: 'center' }} onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
          {error ? (
            <div style={{ padding: 24, color: '#B91C1C' }}>{error}</div>
          ) : !html ? (
            <div style={{ padding: 24, color: '#64748B' }}>Rendering…</div>
          ) : (
            <iframe title="Quotation preview" srcDoc={html} style={{ width: 620, minWidth: 620, height: '100%', border: 0, background: '#E6E9F0' }} />
          )}
        </div>
        <div style={{ padding: '6px 14px', fontSize: 11, color: '#64748B', background: '#fff', borderTop: '1px solid #E2E8F0' }}>
          Download PDF opens the print dialog: choose “Save as PDF”, paper A4, margins None.
        </div>
      </div>
    </div>
  );
};

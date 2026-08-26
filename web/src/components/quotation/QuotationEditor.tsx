import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { QuotationItem } from '../../types';
import { CatalogPickerModal } from './CatalogPickerModal';
import { QuotationPreviewModal } from './QuotationPreviewModal';
import { Plus, Trash2, BookOpen, Eye, FileDown, Save, Sparkles, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface QuotationEditorProps {
  editQuotationId?: string | null;
  onSuccess?: () => void;
}

export const QuotationEditor: React.FC<QuotationEditorProps> = ({
  editQuotationId,
  onSuccess,
}) => {
  const { currentUser } = useAuth();

  // 1. Customer Details (Minimum: Name + Address)
  const [customerName, setCustomerName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');

  // 2. Main Units Table Items
  const [mainItems, setMainItems] = useState<QuotationItem[]>([
    {
      section: 'MAIN_UNIT',
      itemOrder: 1,
      description: 'Daikin 1.5 Ton 3 Star Inverter Split AC',
      quantity: 1,
      unit: 'Nos',
      unitPrice: 30423.73,
      amount: 30423.73,
    },
  ]);

  // 3. Low-Side Materials Toggle & Items
  const [hasLowSide, setHasLowSide] = useState<boolean>(false);
  const [lowSideItems, setLowSideItems] = useState<QuotationItem[]>([
    {
      section: 'LOW_SIDE',
      itemOrder: 1,
      description: 'Standard Installation and testing commissioning charges',
      quantity: 1,
      unit: 'Service',
      unitPrice: 1500.0,
      amount: 1500.0,
    },
    {
      section: 'LOW_SIDE',
      itemOrder: 2,
      description: 'Supply and installation of Copper Pipe with insulation',
      quantity: 1,
      unit: 'Mtr',
      unitPrice: 1280.0,
      amount: 1280.0,
    },
  ]);

  // 4. Configurable Terms & Payment
  const [terms, setTerms] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [cgstPercent, setCgstPercent] = useState<number>(9.0);
  const [sgstPercent, setSgstPercent] = useState<number>(9.0);

  // 5. Modals & State
  const [catalogModalOpen, setCatalogModalOpen] = useState<boolean>(false);
  const [catalogSection, setCatalogSection] = useState<'MAIN_UNIT' | 'LOW_SIDE'>('MAIN_UNIT');
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [savedQuotation, setSavedQuotation] = useState<any>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [stockWarnings, setStockWarnings] = useState<string[] | null>(null);

  const availableUnits = ['Nos', 'Mtr', 'Sqft', 'Kg', 'Set', 'Box', 'Piece', 'Hour', 'Service', 'Roll', 'Other'];

  // Load default quotation configuration or existing quotation if editing
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const configRes = await api.getQuotationConfig();
        if (configRes.success) {
          setTerms(configRes.data.defaultTerms);
          setPaymentMethod(configRes.data.defaultPaymentMethod);
          setCgstPercent(configRes.data.defaultCgstPercent);
          setSgstPercent(configRes.data.defaultSgstPercent);
        }

        if (editQuotationId) {
          const quoteRes = await api.getQuotationById(editQuotationId);
          if (quoteRes.success) {
            const q = quoteRes.data;
            setCustomerName(q.customerName);
            setCustomerAddress(q.customerAddress);
            setCustomerPhone(q.customerPhone || '');
            setCustomerEmail(q.customerEmail || '');
            setHasLowSide(q.hasLowSide);
            setTerms(q.termsAndConditions);
            setPaymentMethod(q.paymentMethod);
            setCgstPercent(q.cgstPercent);
            setSgstPercent(q.sgstPercent);

            const m = q.items.filter((i: any) => i.section === 'MAIN_UNIT');
            const l = q.items.filter((i: any) => i.section === 'LOW_SIDE');
            if (m.length > 0) setMainItems(m);
            if (l.length > 0) setLowSideItems(l);
          }
        }
      } catch (err) {
        console.error('Failed to load defaults', err);
      }
    };
    loadDefaults();
  }, [editQuotationId]);

  // Live Item Editing Helpers
  const updateItem = (
    section: 'MAIN_UNIT' | 'LOW_SIDE',
    index: number,
    field: keyof QuotationItem,
    value: any
  ) => {
    const targetList = section === 'MAIN_UNIT' ? [...mainItems] : [...lowSideItems];
    const item = { ...targetList[index] };

    if (field === 'quantity') {
      const qty = parseFloat(value) || 0;
      item.quantity = qty;
      item.amount = Math.round((qty * item.unitPrice + Number.EPSILON) * 100) / 100;
    } else if (field === 'unitPrice') {
      const price = parseFloat(value) || 0;
      item.unitPrice = price;
      item.amount = Math.round((item.quantity * price + Number.EPSILON) * 100) / 100;
    } else if (field === 'description') {
      item.description = value;
    } else if (field === 'unit') {
      item.unit = value;
    }

    targetList[index] = item;
    if (section === 'MAIN_UNIT') {
      setMainItems(targetList);
    } else {
      setLowSideItems(targetList);
    }
  };

  const addItem = (section: 'MAIN_UNIT' | 'LOW_SIDE') => {
    const newItem: QuotationItem = {
      section,
      itemOrder: (section === 'MAIN_UNIT' ? mainItems.length : lowSideItems.length) + 1,
      description: section === 'MAIN_UNIT' ? 'Custom AC Equipment' : 'Custom Material / Service',
      quantity: 1,
      unit: section === 'MAIN_UNIT' ? 'Nos' : 'Mtr',
      unitPrice: 0,
      amount: 0,
    };
    if (section === 'MAIN_UNIT') {
      setMainItems([...mainItems, newItem]);
    } else {
      setLowSideItems([...lowSideItems, newItem]);
    }
  };

  const removeItem = (section: 'MAIN_UNIT' | 'LOW_SIDE', index: number) => {
    if (section === 'MAIN_UNIT') {
      if (mainItems.length <= 1) return;
      setMainItems(mainItems.filter((_, i) => i !== index));
    } else {
      setLowSideItems(lowSideItems.filter((_, i) => i !== index));
    }
  };

  // Instant Live Totals Calculation
  const mainUnitTotal = mainItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const lowSideTotal = hasLowSide ? lowSideItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) : 0;
  const subtotal = Math.round((mainUnitTotal + lowSideTotal + Number.EPSILON) * 100) / 100;
  const cgstAmount = Math.round(((subtotal * cgstPercent) / 100 + Number.EPSILON) * 100) / 100;
  const sgstAmount = Math.round(((subtotal * sgstPercent) / 100 + Number.EPSILON) * 100) / 100;
  const grandTotal = Math.round((subtotal + cgstAmount + sgstAmount + Number.EPSILON) * 100) / 100;

  // Handle Save / Preview / Generate PDF
  const handleSaveQuotation = async (status: 'DRAFT' | 'FINAL') => {
    if (!customerName.trim()) {
      alert('Please enter the Customer Name.');
      return null;
    }
    if (!customerAddress.trim()) {
      alert('Please enter the Customer Address.');
      return null;
    }

    setIsSaving(true);
    setStatusMessage(null);
    setStockWarnings(null);

    const allItems = [
      ...mainItems.map((i, idx) => ({ ...i, section: 'MAIN_UNIT' as const, itemOrder: idx + 1 })),
      ...(hasLowSide ? lowSideItems.map((i, idx) => ({ ...i, section: 'LOW_SIDE' as const, itemOrder: idx + 1 })) : []),
    ];

    try {
      let res;
      if (editQuotationId) {
        res = await api.updateQuotation(editQuotationId, {
          customerName,
          customerAddress,
          customerPhone,
          customerEmail,
          hasLowSide,
          items: allItems,
          cgstPercent,
          sgstPercent,
          termsAndConditions: terms,
          paymentMethod,
          status,
        });
      } else {
        res = await api.createQuotation({
          customerName,
          customerAddress,
          customerPhone,
          customerEmail,
          hasLowSide,
          items: allItems,
          cgstPercent,
          sgstPercent,
          termsAndConditions: terms,
          paymentMethod,
          status,
        });
      }

      if (res.success) {
        setSavedQuotation(res.data);
        setStatusMessage(res.message);
        if (res.data.stockWarnings) {
          setStockWarnings(res.data.stockWarnings);
        }
        if (onSuccess) onSuccess();
        return res.data;
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save quotation');
    } finally {
      setIsSaving(false);
    }
    return null;
  };

  const handleOpenPreview = async () => {
    const quote = await handleSaveQuotation('DRAFT');
    if (quote) {
      setPreviewModalOpen(true);
    }
  };

  const handleGeneratePdf = async () => {
    const quote = await handleSaveQuotation('FINAL');
    if (quote) {
      window.open(api.getPdfDownloadUrl(quote.id), '_blank');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Quick Actions */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <Sparkles size={18} color="var(--primary-400)" />
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>
              {editQuotationId ? 'Edit Quotation' : 'Create Fast Quotation'}
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Zero-friction quotation creation • Editable catalogue snapshots • Authoritative backend totals
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => handleSaveQuotation('DRAFT')} disabled={isSaving}>
            <Save size={15} /> Save Draft
          </button>
          <button className="btn btn-secondary" onClick={handleOpenPreview} disabled={isSaving}>
            <Eye size={15} /> Preview
          </button>
          <button className="btn btn-primary" onClick={handleGeneratePdf} disabled={isSaving}>
            <FileDown size={15} /> Generate PDF
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.15)', border: '1px solid var(--status-present)', color: 'var(--status-present)', fontSize: '13.5px', fontWeight: 600 }}>
          ✓ {statusMessage}
        </div>
      )}

      {stockWarnings && stockWarnings.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.15)', border: '1px solid var(--status-pending)', color: 'var(--status-pending)', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
            <AlertTriangle size={15} /> Stock Availability Advisory:
          </div>
          <ul style={{ paddingLeft: '20px' }}>
            {stockWarnings.map((w, idx) => (
              <li key={idx}>{w} (Quotation created without stock out)</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. CUSTOMER INFORMATION */}
      <div className="glass-card">
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '16px' }}>
          1. Customer Information
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Customer Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Nexus Tech Park Facilities Ltd / Mr. Rajesh"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. +91 94440 12345"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer Address *</label>
            <textarea
              className="form-control"
              placeholder="Enter full site/billing address..."
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              style={{ minHeight: '60px' }}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email Address (Optional)</label>
            <input
              type="email"
              className="form-control"
              placeholder="e.g. facilities@nexustech.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2. MAIN UNIT ITEMS */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            2. Main Unit (Equipment & System)
          </h3>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setCatalogSection('MAIN_UNIT');
                setCatalogModalOpen(true);
              }}
            >
              <BookOpen size={14} /> Browse Catalogue
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => addItem('MAIN_UNIT')}>
              <Plus size={14} /> + Add Item
            </button>
          </div>
        </div>

        {/* Table of Main Unit Items */}
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Item Description</th>
                <th style={{ width: '100px' }}>Qty</th>
                <th style={{ width: '120px' }}>Unit ▼</th>
                <th style={{ width: '150px' }}>Unit Price (₹)</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ width: '45px' }}></th>
              </tr>
            </thead>
            <tbody>
              {mainItems.map((item, index) => (
                <tr key={index}>
                  <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{index + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={item.description}
                      onChange={(e) => updateItem('MAIN_UNIT', index, 'description', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="form-control"
                      value={item.quantity}
                      onChange={(e) => updateItem('MAIN_UNIT', index, 'quantity', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={item.unit}
                      onChange={(e) => updateItem('MAIN_UNIT', index, 'unit', e.target.value)}
                    >
                      {availableUnits.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={item.unitPrice}
                      onChange={(e) => updateItem('MAIN_UNIT', index, 'unitPrice', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-icon btn-sm"
                      onClick={() => removeItem('MAIN_UNIT', index)}
                      disabled={mainItems.length <= 1}
                      title="Remove row"
                    >
                      <Trash2 size={14} color="var(--status-absent)" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', fontSize: '13.5px', fontWeight: 700 }}>
          <span style={{ color: 'var(--text-muted)', marginRight: '12px' }}>Main Unit Total:</span>
          <span style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
            ₹{mainUnitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 3. LOW-SIDE MATERIALS (OPTIONAL TOGGLE) */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasLowSide ? '16px' : 0 }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              3. Low-Side Materials (Optional)
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Enable if installation piping, cabling, stands, or extra accessories are required
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: hasLowSide ? 'var(--status-present)' : 'var(--text-dim)' }}>
              {hasLowSide ? 'LOW-SIDE ENABLED (ON)' : 'LOW-SIDE DISABLED (OFF)'}
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={hasLowSide}
                onChange={(e) => setHasLowSide(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {hasLowSide && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setCatalogSection('LOW_SIDE');
                  setCatalogModalOpen(true);
                }}
              >
                <BookOpen size={14} /> Browse Materials
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => addItem('LOW_SIDE')}>
                <Plus size={14} /> + Add Material
              </button>
            </div>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>Material / Service Description</th>
                    <th style={{ width: '100px' }}>Qty</th>
                    <th style={{ width: '120px' }}>Unit ▼</th>
                    <th style={{ width: '150px' }}>Rate (₹)</th>
                    <th style={{ width: '150px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ width: '45px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lowSideItems.map((item, index) => (
                    <tr key={index}>
                      <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{index + 1}</td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={item.description}
                          onChange={(e) => updateItem('LOW_SIDE', index, 'description', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          step="0.1"
                          className="form-control"
                          value={item.quantity}
                          onChange={(e) => updateItem('LOW_SIDE', index, 'quantity', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={item.unit}
                          onChange={(e) => updateItem('LOW_SIDE', index, 'unit', e.target.value)}
                        >
                          {availableUnits.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          className="form-control"
                          value={item.unitPrice}
                          onChange={(e) => updateItem('LOW_SIDE', index, 'unitPrice', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                        ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => removeItem('LOW_SIDE', index)}
                          title="Remove row"
                        >
                          <Trash2 size={14} color="var(--status-absent)" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', fontSize: '13.5px', fontWeight: 700 }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '12px' }}>Low-Side Materials Total:</span>
              <span style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                ₹{lowSideTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. TOTALS BREAKDOWN & TERMS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
        {/* Terms & Payment Presets */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            4. Terms, Conditions & Payment Milestones
          </h3>

          <div className="form-group">
            <label className="form-label">Terms & Conditions</label>
            <textarea
              className="form-control"
              style={{ minHeight: '100px', fontSize: '12.5px' }}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Payment Method / Milestones</label>
            <textarea
              className="form-control"
              style={{ minHeight: '90px', fontSize: '12.5px' }}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '16px' }}>
              Quotation Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Main Unit (A):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{mainUnitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              {hasLowSide && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Low-Side (B):</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>₹{lowSideTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)', fontWeight: 700 }}>
                <span style={{ color: '#FFFFFF' }}>Subtotal:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <span>CGST ({cgstPercent}%):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <span>SGST ({sgstPercent}%):</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '12px',
                marginTop: '6px',
                borderTop: '2px solid var(--primary-500)',
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--primary-400)',
              }}>
                <span>GRAND TOTAL:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
            <button className="btn btn-primary" onClick={handleGeneratePdf} disabled={isSaving}>
              <FileDown size={16} /> Generate & Download PDF
            </button>
            <button className="btn btn-secondary" onClick={handleOpenPreview} disabled={isSaving}>
              <Eye size={16} /> Preview Quotation
            </button>
          </div>
        </div>
      </div>

      {/* Catalog Selector Modal */}
      <CatalogPickerModal
        isOpen={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        section={catalogSection}
        onSelectItem={(item) => {
          if (catalogSection === 'MAIN_UNIT') {
            setMainItems([
              ...mainItems,
              {
                section: 'MAIN_UNIT',
                productId: item.productId,
                itemOrder: mainItems.length + 1,
                description: item.description,
                quantity: 1,
                unit: item.unit,
                unitPrice: item.unitPrice,
                amount: item.unitPrice,
              },
            ]);
          } else {
            setLowSideItems([
              ...lowSideItems,
              {
                section: 'LOW_SIDE',
                productId: item.productId,
                itemOrder: lowSideItems.length + 1,
                description: item.description,
                quantity: 1,
                unit: item.unit,
                unitPrice: item.unitPrice,
                amount: item.unitPrice,
              },
            ]);
          }
        }}
      />

      {/* Preview Modal */}
      {savedQuotation && (
        <QuotationPreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          quotation={savedQuotation}
          items={savedQuotation.items || []}
        />
      )}
    </div>
  );
};

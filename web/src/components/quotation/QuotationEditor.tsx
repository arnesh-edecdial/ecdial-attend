import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { QuotationItem } from '../../types';
import { CatalogPickerModal } from './CatalogPickerModal';
import { QuotationPreviewModal } from './QuotationPreviewModal';
import { Plus, Trash2, BookOpen, Eye, FileDown, Save, Sparkles, AlertTriangle, ChevronDown } from 'lucide-react';
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
  const [machinesList, setMachinesList] = useState<any[]>([]);

  // 1. Customer Details (Minimum: Name + Address)
  const [customerName, setCustomerName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');

  // 2. Main Units Table Items matching Image 2
  const [mainItems, setMainItems] = useState<QuotationItem[]>([
    {
      section: 'MAIN_UNIT',
      itemOrder: 1,
      description: 'Daikin 1.5Tr 3Star Inverter Split Ac , 100% Copper (FTKC48XV16)',
      quantity: 1,
      unit: 'Nos',
      unitPrice: 30423.73,
      amount: 30423.73,
    },
  ]);

  // 3. Low-Side Materials Toggle & Items matching Image 2
  const [hasLowSide, setHasLowSide] = useState<boolean>(true);
  const [lowSideItems, setLowSideItems] = useState<QuotationItem[]>([
    {
      section: 'LOW_SIDE',
      itemOrder: 1,
      description: 'Installation and testing commissioning Charges of Split ac',
      quantity: 1,
      unit: 'Nos',
      unitPrice: 1500.0,
      amount: 1500.0,
    },
    {
      section: 'LOW_SIDE',
      itemOrder: 2,
      description: 'Supply and installation of Copper Pipe',
      quantity: 1,
      unit: 'Mtr',
      unitPrice: 1280.0,
      amount: 1280.0,
    },
    {
      section: 'LOW_SIDE',
      itemOrder: 3,
      description: 'Supply and installation of Communication Cable',
      quantity: 1,
      unit: 'Mtr',
      unitPrice: 290.0,
      amount: 290.0,
    },
    {
      section: 'LOW_SIDE',
      itemOrder: 4,
      description: 'Supply and installation of Supply Cable',
      quantity: 1,
      unit: 'Mtr',
      unitPrice: 190.0,
      amount: 190.0,
    },
    {
      section: 'LOW_SIDE',
      itemOrder: 5,
      description: 'Supply and installation of Outdoor Stand',
      quantity: 1,
      unit: 'Nos',
      unitPrice: 1450.0,
      amount: 1450.0,
    },
    {
      section: 'LOW_SIDE',
      itemOrder: 6,
      description: 'Supply And Installation Of White Packing Tape',
      quantity: 1,
      unit: 'Nos',
      unitPrice: 300.0,
      amount: 300.0,
    },
  ]);

  // 4. Terms & Payment matching Image 2
  const [terms, setTerms] = useState<string>(`1. AC Price is inclusive of 18 % taxes. 18% Tax Additional for Lowside.
2. Electrical, Plumbing, civil work, Structural, core cutting, class cutting, scaffolding, Crane works, Aircurtains, IDU Room wall opening for customer scope.
3. We have given the quotation as per the bill of quantities If there is any variation in the quantities used in the site, it will be charged extra, Extra Materials like Copper Pipe, Communication Cable, Supply Cable, etc.,
4. Payment method:
   • 100% Payment advance with P.O for Machine.
   • 70% Advance of Total Lowside Value along with PO
   • 25% After completion of erection works.
   • 5% Payment after raising the final bill.
5. Final bill will be raised on the basis of actual quantities used in the site (after taking the measurement).
6. This Quotation Is Valid For 10 days`);

  const [paymentMethod, setPaymentMethod] = useState<string>(`(i) 100% Payment advance with P.O for Machine.
(ii) 70% Advance of Total Lowside Value along with PO
(iii) 25% After completion of erection works.
(iv) 5% Payment after raising the final bill.`);

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

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const [configRes, productsRes] = await Promise.all([
          api.getQuotationConfig(),
          api.listProducts('MAIN_UNIT'),
        ]);

        if (productsRes.success) {
          setMachinesList(productsRes.data);
        }

        if (configRes.success) {
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

  const handleSelectPreconfiguredMachine = (machineId: string, index: number) => {
    const selected = machinesList.find((m) => m.id === machineId);
    if (selected) {
      updateItem('MAIN_UNIT', index, 'description', selected.name);
      updateItem('MAIN_UNIT', index, 'unitPrice', selected.defaultPrice);
      updateItem('MAIN_UNIT', index, 'unit', selected.defaultUnit);
    }
  };

  const addItem = (section: 'MAIN_UNIT' | 'LOW_SIDE') => {
    const newItem: QuotationItem = {
      section,
      itemOrder: (section === 'MAIN_UNIT' ? mainItems.length : lowSideItems.length) + 1,
      description: section === 'MAIN_UNIT' ? 'Daikin AC Equipment' : 'Low-Side Material / Service',
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
      alert('Please enter Customer Name.');
      return null;
    }
    if (!customerAddress.trim()) {
      alert('Please enter Customer Address.');
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
              {editQuotationId ? 'Edit Quotation' : 'Create Quotation (Commercial Offer)'}
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            All machine and low-side unit prices are 100% editable • Machine catalog list accessible for Sales & Admin
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

      {/* 1. CUSTOMER INFORMATION */}
      <div className="glass-card">
        <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '16px' }}>
          1. Customer Details (To,)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="Mobile Number"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Customer Address / Site Location</label>
          <input
            type="text"
            className="form-control"
            placeholder="Address / Location"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
          />
        </div>
      </div>

      {/* 2. SECTION A: MAIN UNIT */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: 'var(--primary-500)', color: '#FFFFFF', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>A</span>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF' }}>
              MAIN UNIT (Machines & Equipment)
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setCatalogSection('MAIN_UNIT');
                setCatalogModalOpen(true);
              }}
            >
              <BookOpen size={14} /> Catalog Shortcut
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => addItem('MAIN_UNIT')}>
              <Plus size={14} /> + Add Machine
            </button>
          </div>
        </div>

        {/* Table of Main Unit Items */}
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>Sl.No</th>
                <th>Description (Choose from Catalog or Type Custom)</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Qty</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Unit ▼</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Price (₹) [Editable]</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ width: '45px' }}></th>
              </tr>
            </thead>
            <tbody>
              {mainItems.map((item, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontWeight: 700 }}>{index + 1}</td>
                  <td>
                    {/* Machine Dropdown Quick Picker */}
                    {machinesList.length > 0 && (
                      <div style={{ marginBottom: '6px' }}>
                        <select
                          className="form-select"
                          style={{ padding: '4px 8px', fontSize: '12px', background: 'rgba(0, 102, 204, 0.1)', borderColor: 'var(--primary-500)' }}
                          onChange={(e) => handleSelectPreconfiguredMachine(e.target.value, index)}
                          defaultValue=""
                        >
                          <option value="" disabled>⚡ Quick Pick Machine from Catalogue...</option>
                          {machinesList.map((m) => (
                            <option key={m.id} value={m.id}>{m.name} — ₹{m.defaultPrice}</option>
                          ))}
                        </select>
                      </div>
                    )}
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
                      style={{ textAlign: 'center' }}
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
                      className="form-control font-mono"
                      style={{ textAlign: 'right' }}
                      value={item.unitPrice}
                      onChange={(e) => updateItem('MAIN_UNIT', index, 'unitPrice', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', fontSize: '14px', fontWeight: 700 }}>
          <span style={{ color: 'var(--text-muted)', marginRight: '12px' }}>Main Unit Total:</span>
          <span style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
            ₹{mainUnitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 3. SECTION B: LOW-SIDE MATERIALS */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasLowSide ? '16px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ background: 'var(--primary-500)', color: '#FFFFFF', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>B</span>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF' }}>
                LOW SIDE (B) IF NEED EXTRA MATERIALS
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Piping, cabling, outdoor stand, white packing tape, installation charges (all rates editable)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: hasLowSide ? 'var(--status-present)' : 'var(--text-dim)' }}>
              {hasLowSide ? 'ENABLED (ON)' : 'DISABLED (OFF)'}
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
                <Plus size={14} /> + Add Material Row
              </button>
            </div>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>Sl.No</th>
                    <th>Description</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Qty</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Unit ▼</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>Price (₹) [Editable]</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ width: '45px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lowSideItems.map((item, index) => (
                    <tr key={index}>
                      <td style={{ textAlign: 'center', color: 'var(--text-dim)', fontWeight: 700 }}>{index + 1}</td>
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
                          style={{ textAlign: 'center' }}
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
                          className="form-control font-mono"
                          style={{ textAlign: 'right' }}
                          value={item.unitPrice}
                          onChange={(e) => updateItem('LOW_SIDE', index, 'unitPrice', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', fontSize: '14px', fontWeight: 700 }}>
              <span style={{ color: 'var(--text-muted)', marginRight: '12px' }}>Low-Side Total:</span>
              <span style={{ color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                ₹{lowSideTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. TOTALS & TERMS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
        {/* Terms & Payment Presets matching Image 2 */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Terms & Conditions (1 to 6) & Payment Milestones (i to iv)
          </h3>

          <div className="form-group">
            <label className="form-label">Terms & Conditions</label>
            <textarea
              className="form-control"
              style={{ minHeight: '120px', fontSize: '12px' }}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Payment Method / Milestones</label>
            <textarea
              className="form-control"
              style={{ minHeight: '90px', fontSize: '12px' }}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>
        </div>

        {/* Commercial Summary Box */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--primary-400)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '16px' }}>
              Quotation Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Sub Total (A):</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <span>CGST {cgstPercent}%:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <span>SGST {sgstPercent}%:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '12px',
                marginTop: '8px',
                borderTop: '2px solid var(--primary-500)',
                fontSize: '18px',
                fontWeight: 900,
                color: 'var(--primary-400)',
              }}>
                <span>TOTAL (A):</span>
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

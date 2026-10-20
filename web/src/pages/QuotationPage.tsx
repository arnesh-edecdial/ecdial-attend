import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Quotation, ProductItem, CustomerItem } from '../types';
import { QuotationEditor } from '../components/quotation/QuotationEditor';
import { QuotationPreviewModal } from '../components/quotation/QuotationPreviewModal';
import { SplitQuotationEditor } from '../components/quotation/SplitQuotationEditor';
import { ProposalQuotationEditor } from '../components/quotation/ProposalQuotationEditor';
import { SplitQuotationPreview } from '../components/quotation/SplitQuotationPreview';
import { resolveQuotationType } from '../utils/quotation/quotationType';
import {
  FileSpreadsheet,
  FilePlus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Layers,
  Settings,
  Plus,
  Save,
  CheckCircle,
  Clock,
  Send,
  XCircle,
  Users,
  User,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface QuotationPageProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const QuotationPage: React.FC<QuotationPageProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Edit / Preview state
  const [editingQuotationId, setEditingQuotationId] = useState<string | null>(null);
  const [newQuoteStep, setNewQuoteStep] = useState<'CATEGORY' | 'TEMPLATE' | 'CUSTOMER' | 'EDITOR'>('CATEGORY');
  const [selectedAcType, setSelectedAcType] = useState<'SPLIT' | 'CASSETTE' | 'DUCT' | 'VRV'>('SPLIT');
  const [selectedTemplate, setSelectedTemplate] = useState<'ECDIAL' | 'DAIKIN'>('DAIKIN');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);

  // Customer step state
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [customerList, setCustomerList] = useState<CustomerItem[]>([]);
  const [customerLoading, setCustomerLoading] = useState<boolean>(false);
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const [manualName, setManualName] = useState<string>('');
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualAddress, setManualAddress] = useState<string>('');
  const [manualEmail, setManualEmail] = useState<string>('');

  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);

  // Products state
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productCategory, setProductCategory] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');

  // Config state
  const [config, setConfig] = useState<any>(null);
  const [configSaving, setConfigSaving] = useState<boolean>(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);

  const fetchQuotations = async () => {
    try {
      setIsLoading(true);
      const res = await api.listQuotations(statusFilter, searchFilter);
      if (res.success) {
        setQuotations(res.data);
      }
    } catch (err) {
      console.error('Failed to load quotations', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.listProducts(productCategory, productSearch);
      if (res.success) setProducts(res.data);
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await api.getQuotationConfig();
      if (res.success) setConfig(res.data);
    } catch (err) {
      console.error('Failed to load config', err);
    }
  };

  const fetchCustomers = async (search?: string) => {
    try {
      setCustomerLoading(true);
      const res = await api.listCustomers(search);
      if (res.success) {
        setCustomerList(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setCustomerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'QUOTATION_LIST') fetchQuotations();
    if (activeTab === 'CATALOGUE') fetchProducts();
    if (activeTab === 'QUOTATION_CONFIG') fetchConfig();
  }, [activeTab, statusFilter, searchFilter, productCategory, productSearch]);

  useEffect(() => {
    if (newQuoteStep === 'CUSTOMER') {
      const timeoutId = setTimeout(() => {
        fetchCustomers(customerSearch);
      }, 250);
      return () => clearTimeout(timeoutId);
    }
  }, [newQuoteStep, customerSearch]);

  const handleOpenPreview = async (quoteId: string) => {
    try {
      const res = await api.getQuotationById(quoteId);
      if (res.success) {
        setPreviewQuotation(res.data);
        setPreviewModalOpen(true);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to open preview');
    }
  };

  const handleDeleteQuotation = async (q: any) => {
    if (!window.confirm(`Delete quotation ${q.quotationNumber}${q.customerName ? ' for ' + q.customerName : ''}? This cannot be undone.`)) return;
    try {
      const res = await api.deleteQuotation(q.id);
      if (res?.success === false) throw new Error(res.message || 'Failed to delete quotation');
      fetchQuotations();
    } catch (err: any) {
      alert(err.message || 'Failed to delete quotation');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await api.updateQuotationStatus(id, newStatus);
      if (res.success) fetchQuotations();
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setConfigSaving(true);
    setConfigMessage(null);
    try {
      const res = await api.updateQuotationConfig(config);
      if (res.success) setConfigMessage('Quotation templates and GST rates updated.');
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setConfigSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FINAL':
      case 'ACCEPTED':
        return 'badge-present';
      case 'SENT':
        return 'badge-overtime';
      case 'DRAFT':
        return 'badge-pending';
      case 'REJECTED':
      case 'EXPIRED':
        return 'badge-absent';
      default:
        return 'badge-grey';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Tab 1: New Quotation Fast Wizard */}
      {activeTab === 'NEW_QUOTATION' && !editingQuotationId && newQuoteStep !== 'EDITOR' && (
        <div className="glass-card" style={{ padding: 32, maxWidth: 1080, margin: '0 auto', width: '100%' }}>
          {/* Progress Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            {[
              { step: 'CATEGORY', label: '1. AC Category', active: newQuoteStep === 'CATEGORY' },
              { step: 'TEMPLATE', label: '2. Quotation Brand', active: newQuoteStep === 'TEMPLATE' },
              { step: 'CUSTOMER', label: '3. Customer Details', active: newQuoteStep === 'CUSTOMER' },
            ].map((s, idx) => (
              <div
                key={s.step}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: s.active ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: s.active ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: s.active ? '1px solid #38bdf8' : '1px solid transparent',
                }}
              >
                <span>{s.label}</span>
                {idx < 2 && <span style={{ color: 'var(--text-dim, #64748b)', marginLeft: 8 }}>›</span>}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ color: 'var(--primary-400)', fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>
              ECDIAL • QUOTATION BUILDER
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 850, margin: '8px 0' }}>
              {newQuoteStep === 'CATEGORY' && 'Choose AC Category'}
              {newQuoteStep === 'TEMPLATE' && 'Choose Quotation Brand & Template'}
              {newQuoteStep === 'CUSTOMER' && 'Select Customer (Optional)'}
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {newQuoteStep === 'CATEGORY' && 'Select the equipment category to initialize the appropriate high-side models and low-side checklist.'}
              {newQuoteStep === 'TEMPLATE' && `Selected category: ${({ SPLIT: 'Split AC', CASSETTE: 'Cassette AC', DUCT: 'Duct AC', VRV: 'VRV / VRF' } as any)[selectedAcType]}. Choose Daikin or ECDIAL branding.`}
              {newQuoteStep === 'CUSTOMER' && 'Search existing customers or enter new details. All customer fields are optional and creation will never be blocked.'}
            </p>
          </div>

          {/* STEP 1: AC CATEGORY */}
          {newQuoteStep === 'CATEGORY' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
              {[
                { id: 'SPLIT', title: 'Split AC', detail: 'Residential & small commercial', icon: '❄️', color: '#8CCFF0' },
                { id: 'CASSETTE', title: 'Cassette AC', detail: 'Ceiling cassette systems', icon: '▦', color: '#F8B56B' },
                { id: 'DUCT', title: 'Duct AC', detail: 'Ductable concealed systems', icon: '≋', color: '#83D4C3' },
                { id: 'VRV', title: 'VRV / VRF', detail: 'Variable refrigerant systems', icon: '◈', color: '#E89B91' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedAcType(item.id as any);
                    setNewQuoteStep('TEMPLATE');
                  }}
                  style={{
                    textAlign: 'left',
                    padding: 20,
                    minHeight: 150,
                    borderRadius: 16,
                    border: '1px solid var(--border-color, #29364d)',
                    background: 'var(--surface-2, #111d32)',
                    color: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 18,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color, #29364d)')}
                >
                  <span
                    style={{
                      width: 46,
                      height: 46,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 12,
                      background: item.color,
                      color: '#10203b',
                      fontSize: 25,
                      fontWeight: 900,
                    }}
                  >
                    {item.icon}
                  </span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 18 }}>{item.title}</strong>
                    <small style={{ display: 'block', marginTop: 5, color: 'var(--text-muted)' }}>{item.detail}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* STEP 2: TEMPLATE / BRAND */}
          {newQuoteStep === 'TEMPLATE' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {[
                  {
                    id: 'DAIKIN',
                    title: 'Daikin Commercial Proposal',
                    detail: 'Official Daikin-branded two-page proposal layout with crisp header and footer assets.',
                    color: '#0875C9',
                    badge: 'DAIKIN BLUE',
                  },
                  {
                    id: 'ECDIAL',
                    title: 'ECDIAL Quotation',
                    detail: 'ECDIAL corporate branding with navy & orange accents, terms, and bank details.',
                    color: '#F2791E',
                    badge: 'ECDIAL NAVY & ORANGE',
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedTemplate(item.id as any);
                      setNewQuoteStep('CUSTOMER');
                    }}
                    style={{
                      textAlign: 'left',
                      padding: 24,
                      borderRadius: 16,
                      border: `1.5px solid ${item.color}`,
                      background: 'var(--surface-2, #111d32)',
                      color: 'inherit',
                      cursor: 'pointer',
                      minHeight: 160,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 900, color: item.color, letterSpacing: 1.2, marginBottom: 12 }}>
                        {item.badge}
                      </div>
                      <strong style={{ display: 'block', fontSize: 19 }}>{item.title}</strong>
                      <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
                        {item.detail}
                      </span>
                    </div>
                    <div style={{ marginTop: 20, fontWeight: 800, color: item.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                      Continue to Customer Selection <ArrowRight size={16} />
                    </div>
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}
                onClick={() => setNewQuoteStep('CATEGORY')}
              >
                <ArrowLeft size={16} /> Back to categories
              </button>
            </>
          )}

          {/* STEP 3: CUSTOMER SELECTION */}
          {newQuoteStep === 'CUSTOMER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Search & Action Bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 260 }}>
                  <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: 14, top: 13 }} />
                  <input
                    type="text"
                    className="form-control"
                    style={{ paddingLeft: 40, height: 42, borderRadius: 10 }}
                    placeholder="Search saved customers by name, phone, address..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowManualForm(!showManualForm)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42 }}
                  >
                    <UserPlus size={16} />
                    {showManualForm ? 'Hide Manual Form' : 'Enter Details Manually'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #0875C9, #0284c7)',
                      borderColor: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      height: 42,
                      fontWeight: 700,
                    }}
                    onClick={() => {
                      // Skip or use current manual inputs
                      if (showManualForm && (manualName || manualPhone || manualAddress)) {
                        setSelectedCustomer({
                          id: '',
                          name: manualName.trim(),
                          mobile: manualPhone.trim(),
                          address: manualAddress.trim(),
                          email: manualEmail.trim(),
                        });
                      }
                      setNewQuoteStep('EDITOR');
                    }}
                  >
                    {selectedCustomer
                      ? `Continue with ${selectedCustomer.name || 'Selected Customer'} →`
                      : showManualForm && manualName
                      ? 'Continue with Manual Customer →'
                      : 'Skip & Open Editor →'}
                  </button>
                </div>
              </div>

              {/* Manual Form (Optional) */}
              {showManualForm && (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: 14,
                    padding: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#38bdf8' }}>
                      ✍️ Manual Customer Details (All fields completely optional)
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Will not create a permanent customer record</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Customer / Business Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Mr. Sekar / Jewelry Shop"
                        value={manualName}
                        onChange={(e) => {
                          setManualName(e.target.value);
                          setSelectedCustomer(null);
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Phone / Mobile Number</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 9876543210"
                        value={manualPhone}
                        onChange={(e) => {
                          setManualPhone(e.target.value);
                          setSelectedCustomer(null);
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Email Address</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="customer@example.com"
                        value={manualEmail}
                        onChange={(e) => {
                          setManualEmail(e.target.value);
                          setSelectedCustomer(null);
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Site / Billing Address</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Kangeyam, Tiruppur"
                        value={manualAddress}
                        onChange={(e) => {
                          setManualAddress(e.target.value);
                          setSelectedCustomer(null);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Saved Customers Cards */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)' }}>
                    SAVED CUSTOMERS ({customerList.length})
                  </div>
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => setSelectedCustomer(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        fontSize: 12,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Clear selected customer
                    </button>
                  )}
                </div>

                {customerLoading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading customer directory...
                  </div>
                ) : customerList.length === 0 ? (
                  <div
                    style={{
                      padding: 36,
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: 14,
                      border: '1px dashed var(--border-color, #29364d)',
                    }}
                  >
                    <Users size={32} color="var(--text-dim)" style={{ marginBottom: 12 }} />
                    <p style={{ margin: '0 0 12px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                      {customerSearch ? 'No customers found matching search.' : 'No saved customers found.'}
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setNewQuoteStep('EDITOR')}
                    >
                      Proceed to Editor without Customer →
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 16,
                      maxHeight: '440px',
                      overflowY: 'auto',
                      paddingRight: 6,
                    }}
                  >
                    {customerList.map((cust) => {
                      const isSelected = selectedCustomer?.id === cust.id;
                      return (
                        <div
                          key={cust.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCustomer(null);
                            } else {
                              setSelectedCustomer(cust);
                              setShowManualForm(false);
                            }
                          }}
                          style={{
                            padding: 16,
                            borderRadius: 14,
                            border: isSelected
                              ? '2px solid #38bdf8'
                              : '1px solid var(--border-color, #29364d)',
                            background: isSelected
                              ? 'rgba(56, 189, 248, 0.12)'
                              : 'var(--surface-2, #111d32)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 12,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <strong style={{ fontSize: 16, color: '#FFFFFF' }}>{cust.name || 'Unnamed Customer'}</strong>
                              {isSelected && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: '#38bdf8',
                                    background: 'rgba(56, 189, 248, 0.2)',
                                    padding: '2px 8px',
                                    borderRadius: 12,
                                  }}
                                >
                                  <Check size={12} /> Selected
                                </span>
                              )}
                            </div>

                            {cust.mobile && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#38bdf8', marginBottom: 4 }}>
                                <Phone size={13} /> {cust.mobile}
                              </div>
                            )}

                            {cust.address && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                                <MapPin size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>{cust.address}</span>
                              </div>
                            )}

                            {cust.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                                <Mail size={13} /> {cust.email}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                            <span style={{ color: 'var(--text-dim)' }}>Click card to select</span>
                            <span style={{ color: isSelected ? '#38bdf8' : 'var(--text-muted)', fontWeight: 700 }}>
                              {isSelected ? 'Ready to use' : 'Select'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step Navigation Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => setNewQuoteStep('TEMPLATE')}
                >
                  <ArrowLeft size={16} /> Back to Template
                </button>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setNewQuoteStep('EDITOR');
                    }}
                  >
                    Skip Customer (Empty Details)
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => {
                      if (showManualForm && (manualName || manualPhone || manualAddress)) {
                        setSelectedCustomer({
                          id: '',
                          name: manualName.trim(),
                          mobile: manualPhone.trim(),
                          address: manualAddress.trim(),
                          email: manualEmail.trim(),
                        });
                      }
                      setNewQuoteStep('EDITOR');
                    }}
                  >
                    Open Quotation Editor <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Editor View */}
      {activeTab === 'NEW_QUOTATION' && (editingQuotationId || newQuoteStep === 'EDITOR') && (
        selectedAcType === 'SPLIT' ? (
          <SplitQuotationEditor
            key={editingQuotationId || 'new-split'}
            editQuotationId={editingQuotationId}
            initialAcType={selectedAcType}
            initialQuotationType={selectedTemplate}
            initialCustomer={selectedCustomer}
            onBack={() => {
              if (!editingQuotationId) setNewQuoteStep('CUSTOMER');
            }}
            onSuccess={() => {
              setEditingQuotationId(null);
              setNewQuoteStep('CATEGORY');
              setActiveTab('QUOTATION_LIST');
              fetchQuotations();
            }}
          />
        ) : selectedAcType === 'CASSETTE' || selectedAcType === 'DUCT' || selectedAcType === 'VRV' ? (
          <ProposalQuotationEditor
            key={`${selectedAcType}-${editingQuotationId || 'new'}`}
            acType={selectedAcType}
            editQuotationId={editingQuotationId}
            initialAcType={selectedAcType}
            initialQuotationType={selectedTemplate}
            initialCustomer={selectedCustomer}
            onBack={() => {
              if (!editingQuotationId) setNewQuoteStep('CUSTOMER');
            }}
            onSuccess={() => {
              setEditingQuotationId(null);
              setNewQuoteStep('CATEGORY');
              setActiveTab('QUOTATION_LIST');
              fetchQuotations();
            }}
          />
        ) : (
        <QuotationEditor
          editQuotationId={editingQuotationId}
          initialAcType={selectedAcType}
          initialQuotationType={selectedTemplate}
          initialCustomer={selectedCustomer}
          onBack={() => {
            if (!editingQuotationId) setNewQuoteStep('CUSTOMER');
          }}
          onSuccess={() => {
            setEditingQuotationId(null);
            fetchQuotations();
          }}
        />
        )
      )}

      {/* Tab 2: All Quotations List */}
      {activeTab === 'QUOTATION_LIST' && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Quotation Register</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Commercial quotations, customer offers, and version histories
              </p>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingQuotationId(null);
                setNewQuoteStep('CATEGORY');
                setActiveTab('NEW_QUOTATION');
              }}
            >
              <FilePlus size={16} /> + New Quotation
            </button>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '36px' }}
                placeholder="Search quotation #, customer, address..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ width: '180px' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="FINAL">Final</option>
              <option value="SENT">Sent to Customer</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Quotation Table */}
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Quotation No</th>
                  <th>Customer Name & Address</th>
                  <th>Date</th>
                  <th>Sales Rep</th>
                  <th>Items</th>
                  <th>Grand Total (₹)</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                      No quotations found matching criteria.
                    </td>
                  </tr>
                ) : (
                  quotations.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--primary-400)', fontFamily: 'var(--font-mono)' }}>
                          {q.quotationNumber}
                        </div>
                        {q.revisionNumber > 1 && (
                          <span style={{ fontSize: '10px', color: 'var(--status-pending)', fontWeight: 700 }}>
                            Rev {q.revisionNumber}
                          </span>
                        )}
                      </td>
                      <td style={{ maxWidth: '260px' }}>
                        <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{q.customerName}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.customerAddress}
                        </div>
                      </td>
                      <td>{q.date}</td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{q.createdByName || 'Sales'}</td>
                      <td>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-dim)' }}>
                          {q.itemsCount || 1} Item(s) {q.hasLowSide && '+ Low-Side'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                        ₹{Number(q.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <select
                          className={`badge ${getStatusBadge(q.status)}`}
                          style={{ border: 'none', cursor: 'pointer', background: 'transparent' }}
                          value={q.status}
                          onChange={(e) => handleStatusChange(q.id, e.target.value)}
                        >
                          <option value="DRAFT" style={{ background: '#0D1527' }}>DRAFT</option>
                          <option value="FINAL" style={{ background: '#0D1527' }}>FINAL</option>
                          <option value="SENT" style={{ background: '#0D1527' }}>SENT</option>
                          <option value="ACCEPTED" style={{ background: '#0D1527' }}>ACCEPTED</option>
                          <option value="REJECTED" style={{ background: '#0D1527' }}>REJECTED</option>
                          <option value="EXPIRED" style={{ background: '#0D1527' }}>EXPIRED</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            title="Preview Quotation"
                            onClick={() => handleOpenPreview(q.id)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            title="Edit Quotation"
                            onClick={() => {
                              // the editor needs to know which kind of quotation this is
                              setSelectedAcType(((q as any).acType || 'SPLIT').toUpperCase());
                              setSelectedTemplate(resolveQuotationType(q));
                              setEditingQuotationId(q.id);
                              setNewQuoteStep('EDITOR');
                              setActiveTab('NEW_QUOTATION');
                            }}
                          >
                            <Edit size={14} />
                          </button>
                          {['SPLIT', 'CASSETTE', 'DUCT', 'VRV'].includes(String((q as any).acType || 'SPLIT').toUpperCase()) ? (
                            // Split and Cassette print from the shared A4 HTML templates (browser print -> Save as PDF)
                            <button
                              className="btn btn-primary btn-icon btn-sm"
                              title="Preview & Download PDF"
                              onClick={() => handleOpenPreview(q.id)}
                            >
                              <Download size={14} />
                            </button>
                          ) : (
                            <a
                              href={api.getPdfDownloadUrl(q.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-primary btn-icon btn-sm"
                              title="Download PDF"
                            >
                              <Download size={14} />
                            </a>
                          )}
                          <button
                            className="btn btn-secondary btn-icon btn-sm"
                            title="Delete Quotation"
                            style={{ color: '#F87171' }}
                            onClick={() => handleDeleteQuotation(q)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Product Catalogue Browser */}
      {activeTab === 'CATALOGUE' && (
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Product & Materials Catalogue</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Pre-configured AC equipment and installation materials for quotation speedups (values remain fully editable in quotes)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '36px' }}
                placeholder="Search catalogue..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ width: '180px' }}
              value={productCategory}
              onChange={(e) => setProductCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="MAIN_UNIT">Main AC Units</option>
              <option value="LOW_SIDE">Low-Side Materials</option>
            </select>
          </div>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product / Material</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Default Unit</th>
                  <th>Available Stock</th>
                  <th style={{ textAlign: 'right' }}>Catalogue Rate (₹)</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#FFFFFF' }}>{p.name}</div>
                      {p.model && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{p.model}</div>}
                    </td>
                    <td>
                      <span className={`badge ${p.category === 'MAIN_UNIT' ? 'badge-present' : 'badge-grey'}`}>
                        {p.category === 'MAIN_UNIT' ? 'Main Unit' : 'Low-Side'}
                      </span>
                    </td>
                    <td style={{ maxWidth: '300px', fontSize: '12px', color: 'var(--text-muted)' }}>{p.description}</td>
                    <td>{p.defaultUnit}</td>
                    <td>
                      <span style={{ color: p.availableStock <= 5 ? 'var(--status-pending)' : 'var(--status-present)', fontWeight: 600 }}>
                        {p.availableStock} {p.defaultUnit}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      ₹{p.defaultPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Quotation Templates & GST Configuration */}
      {activeTab === 'QUOTATION_CONFIG' && config && (
        <div className="glass-card" style={{ maxWidth: '800px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Settings size={22} color="var(--primary-400)" />
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Quotation Default Templates & Taxes</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Configure default GST percentages, payment milestones, and standard terms
              </p>
            </div>
          </div>

          {configMessage && (
            <div style={{ padding: '12px', background: 'rgba(16,185,129,0.15)', border: '1px solid var(--status-present)', color: 'var(--status-present)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13.5px' }}>
              ✓ {configMessage}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Default CGST (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={config.defaultCgstPercent}
                  onChange={(e) => setConfig({ ...config, defaultCgstPercent: parseFloat(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default SGST (%)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control"
                  value={config.defaultSgstPercent}
                  onChange={(e) => setConfig({ ...config, defaultSgstPercent: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Default Terms & Conditions Template</label>
              <textarea
                className="form-control"
                style={{ minHeight: '120px' }}
                value={config.defaultTerms}
                onChange={(e) => setConfig({ ...config, defaultTerms: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Default Payment Method Milestones</label>
              <textarea
                className="form-control"
                style={{ minHeight: '100px' }}
                value={config.defaultPaymentMethod}
                onChange={(e) => setConfig({ ...config, defaultPaymentMethod: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button className="btn btn-primary" onClick={handleSaveConfig} disabled={configSaving}>
                <Save size={15} /> {configSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewQuotation && ['SPLIT', 'CASSETTE', 'DUCT', 'VRV'].includes(String((previewQuotation as any).acType || 'SPLIT').toUpperCase()) ? (
        <SplitQuotationPreview
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          quotation={previewQuotation}
        />
      ) : previewQuotation ? (
        <QuotationPreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          quotation={previewQuotation}
          items={previewQuotation.items || []}
        />
      ) : null}
    </div>
  );
};

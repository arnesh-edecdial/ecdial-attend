import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Quotation, ProductItem } from '../types';
import { QuotationEditor } from '../components/quotation/QuotationEditor';
import { QuotationPreviewModal } from '../components/quotation/QuotationPreviewModal';
import {
  FileSpreadsheet,
  FilePlus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Layers,
  Settings,
  Plus,
  Save,
  CheckCircle,
  Clock,
  Send,
  XCircle,
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

  useEffect(() => {
    if (activeTab === 'QUOTATION_LIST') fetchQuotations();
    if (activeTab === 'CATALOGUE') fetchProducts();
    if (activeTab === 'QUOTATION_CONFIG') fetchConfig();
  }, [activeTab, statusFilter, searchFilter, productCategory, productSearch]);

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
      {/* Tab 1: New Quotation Fast Editor */}
      {activeTab === 'NEW_QUOTATION' && (
        <QuotationEditor
          editQuotationId={editingQuotationId}
          onSuccess={() => {
            setEditingQuotationId(null);
            fetchQuotations();
          }}
        />
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
                              setEditingQuotationId(q.id);
                              setActiveTab('NEW_QUOTATION');
                            }}
                          >
                            <Edit size={14} />
                          </button>
                          <a
                            href={api.getPdfDownloadUrl(q.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary btn-icon btn-sm"
                            title="Download PDF"
                          >
                            <Download size={14} />
                          </a>
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
      {previewQuotation && (
        <QuotationPreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          quotation={previewQuotation}
          items={previewQuotation.items || []}
        />
      )}
    </div>
  );
};

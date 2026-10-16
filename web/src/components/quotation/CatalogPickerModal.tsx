import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ProductItem } from '../../types';
import { X, Search, Plus, CheckSquare, Square, Package, Wrench, Check } from 'lucide-react';

interface CatalogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: 'MAIN_UNIT' | 'LOW_SIDE';
  acType?: 'SPLIT' | 'CASSETTE' | 'DUCT' | 'VRV';
  onSelectItem?: (item: {
    productId: string;
    description: string;
    unit: string;
    unitPrice: number;
    supplyRate?: number;
    installRate?: number;
    availableStock?: number;
  }) => void;
  onSelectItems?: (items: Array<{
    productId: string;
    description: string;
    unit: string;
    quantity?: number;
    unitPrice: number;
    supplyRate?: number;
    installRate?: number;
    availableStock?: number;
  }>) => void;
}

export const CatalogPickerModal: React.FC<CatalogPickerModalProps> = ({
  isOpen,
  onClose,
  section,
  acType = 'SPLIT',
  onSelectItem,
  onSelectItems,
}) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Add New Item State
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newUnit, setNewUnit] = useState('Nos');
  const [newSupplyRate, setNewSupplyRate] = useState('0');
  const [newInstallRate, setNewInstallRate] = useState('0');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [saveError, setSaveError] = useState('');

  const availableUnits = ['Nos', 'Mtr', 'RMT', 'Sq.Mt', 'Sqft', 'Kg', 'Set', 'Lot', 'Hour', 'Service', 'Roll', 'Piece'];

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setAdding(false);
      setSaveError('');
      loadProducts();
    }
  }, [isOpen, section, search, acType]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const res = await api.listProducts(section, search, acType);
      if (res.success) {
        setProducts(res.data);
      }
    } catch (err) {
      console.error('Failed to load catalogue', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const handleAddSelected = () => {
    const selectedItems = products.filter((p) => selectedIds.has(p.id));
    if (selectedItems.length === 0) return;

    if (onSelectItems) {
      onSelectItems(
        selectedItems.map((p) => ({
          productId: p.id,
          description: p.name,
          unit: p.defaultUnit || 'Nos',
          quantity: 1,
          unitPrice: p.defaultPrice || 0,
          supplyRate: p.defaultSupplyRate !== undefined ? p.defaultSupplyRate : p.defaultPrice,
          installRate: p.defaultInstallRate || 0,
          availableStock: p.availableStock,
        }))
      );
    } else if (onSelectItem && selectedItems.length > 0) {
      const p = selectedItems[0];
      onSelectItem({
        productId: p.id,
        description: p.name,
        unit: p.defaultUnit || 'Nos',
        unitPrice: p.defaultPrice || 0,
        supplyRate: p.defaultSupplyRate !== undefined ? p.defaultSupplyRate : p.defaultPrice,
        installRate: p.defaultInstallRate || 0,
        availableStock: p.availableStock,
      });
    }

    onClose();
  };

  const handleSaveNewItem = async () => {
    if (!newName.trim()) {
      setSaveError('Please enter an item name.');
      return;
    }

    setIsSubmittingNew(true);
    setSaveError('');

    try {
      const sup = Number(newSupplyRate) || 0;
      const inst = Number(newInstallRate) || 0;
      const total = sup + inst;

      const res = await api.createProduct({
        name: newName.trim(),
        description: newDescription.trim() || newName.trim(),
        category: section,
        acType,
        defaultUnit: newUnit,
        defaultPrice: total,
        defaultSupplyRate: sup,
        defaultInstallRate: inst,
        availableStock: 50,
      });

      if (!res.success) {
        throw new Error(res.message || 'Failed to save catalogue item.');
      }

      setAdding(false);
      setNewName('');
      setNewDescription('');
      setNewSupplyRate('0');
      setNewInstallRate('0');

      // Auto-select the newly added item
      if (res.data?.id) {
        setSelectedIds((prev) => new Set([...prev, res.data.id]));
      }

      await loadProducts();
    } catch (err: any) {
      setSaveError(err.message || 'Could not save catalogue item.');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  if (!isOpen) return null;

  const categoryTitle = {
    SPLIT: 'Split AC',
    CASSETTE: 'Cassette AC',
    DUCT: 'Duct AC',
    VRV: 'VRV / VRF',
  }[acType] || acType;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-container" style={{ maxWidth: '780px', width: '92%' }}>
        {/* Modal Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800 }}>
              {section === 'MAIN_UNIT' ? 'Select AC Equipment' : `Select ${categoryTitle} Low-Side Works & Materials`}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
              Catalogue items for <strong style={{ color: 'var(--primary-400)' }}>{categoryTitle}</strong>. Selected items are added to your quotation without changing the saved catalogue.
            </p>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh', overflowY: 'auto' }}>
          {/* Search & Top Action Bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '36px' }}
                placeholder={`Search ${categoryTitle} items...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setAdding((prev) => !prev)}
              style={{ whiteSpace: 'nowrap' }}
            >
              <Plus size={15} /> {adding ? 'Cancel' : `Add New to ${categoryTitle} Catalogue`}
            </button>
          </div>

          {/* Add New Item Inline Form */}
          {adding && (
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--primary-500)',
                background: 'rgba(0, 130, 200, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-400)' }}>
                Create New Persistent Catalogue Entry for {categoryTitle}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Item Name / Specification *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. GI ducting with insulation (supply & fixing)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Description (Optional)</label>
                  <input
                    className="form-control"
                    placeholder="Specification notes..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Default Unit</label>
                  <select
                    className="form-select"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                  >
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Supply Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    placeholder="0.00"
                    value={newSupplyRate}
                    onChange={(e) => setNewSupplyRate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Install Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    placeholder="0.00"
                    value={newInstallRate}
                    onChange={(e) => setNewInstallRate(e.target.value)}
                  />
                </div>

                <button
                  className="btn btn-primary"
                  onClick={handleSaveNewItem}
                  disabled={isSubmittingNew}
                  style={{ height: '38px', padding: '0 20px' }}
                >
                  {isSubmittingNew ? 'Saving...' : 'Save Item'}
                </button>
              </div>

              {saveError && (
                <div style={{ color: 'var(--status-absent)', fontSize: '12px' }}>
                  {saveError}
                </div>
              )}
            </div>
          )}

          {/* Quick Select All Header */}
          {products.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={selectAll}>
                {selectedIds.size === products.length ? (
                  <CheckSquare size={16} color="var(--primary-400)" />
                ) : (
                  <Square size={16} />
                )}
                <span>Select All ({products.length} items)</span>
              </div>
              <div>
                <strong>{selectedIds.size}</strong> item(s) selected
              </div>
            </div>
          )}

          {/* Items List */}
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading {categoryTitle} catalogue...
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>
              No catalogue items found for {categoryTitle}. Click "Add New" above to save one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
              {products.map((prod) => {
                const isSelected = selectedIds.has(prod.id);
                const supRate = prod.defaultSupplyRate !== undefined ? prod.defaultSupplyRate : prod.defaultPrice;
                const instRate = prod.defaultInstallRate || 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => toggleSelect(prod.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: isSelected ? 'rgba(0, 130, 200, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isSelected ? 'var(--primary-400)' : 'var(--border-color)'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, paddingRight: '12px' }}>
                      <div>
                        {isSelected ? (
                          <CheckSquare size={18} color="var(--primary-400)" />
                        ) : (
                          <Square size={18} color="var(--text-dim)" />
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '13.5px' }}>
                            {prod.name}
                          </span>
                          {prod.model && (
                            <span style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>
                              {prod.model}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: '16px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          <span>Unit: <strong style={{ color: '#FFFFFF' }}>{prod.defaultUnit}</strong></span>
                          {section === 'LOW_SIDE' ? (
                            <>
                              <span>Supply: <strong style={{ color: '#FFFFFF' }}>₹{supRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                              <span>Installation: <strong style={{ color: '#FFFFFF' }}>₹{instRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                            </>
                          ) : (
                            <span>Price: <strong style={{ color: '#FFFFFF' }}>₹{prod.defaultPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                        ₹{prod.defaultPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                        Default combined rate
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer with Add Selected Items Button */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            {selectedIds.size > 0 ? (
              <span><strong>{selectedIds.size}</strong> item(s) selected for inclusion in quotation</span>
            ) : (
              <span>Select one or more items to add to quotation</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddSelected}
              disabled={selectedIds.size === 0}
              style={{ minWidth: '160px' }}
            >
              <Check size={16} /> Add Selected Items ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

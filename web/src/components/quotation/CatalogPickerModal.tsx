import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ProductItem } from '../../types';
import { X, Search, Plus, Package, AlertCircle } from 'lucide-react';

interface CatalogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: 'MAIN_UNIT' | 'LOW_SIDE';
  onSelectItem: (item: {
    productId: string;
    description: string;
    unit: string;
    unitPrice: number;
    availableStock: number;
  }) => void;
}

export const CatalogPickerModal: React.FC<CatalogPickerModalProps> = ({
  isOpen,
  onClose,
  section,
  onSelectItem,
}) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
    }
  }, [isOpen, section, search]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const res = await api.listProducts(section, search);
      if (res.success) {
        setProducts(res.data);
      }
    } catch (err) {
      console.error('Failed to load catalogue', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700 }}>
              Select from Product Catalogue ({section === 'MAIN_UNIT' ? 'AC Equipment' : 'Low-Side Materials'})
            </h3>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Selecting an item prefills values as an editable template. Values can still be changed.
            </div>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '36px' }}
              placeholder="Search by AC brand, capacity, model, or material description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Product Items List */}
          {isLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Searching catalogue...
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
              No catalogue products found matching "{search}".
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
              {products.map((prod) => (
                <div
                  key={prod.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'border-color var(--transition-fast)',
                  }}
                >
                  <div style={{ flex: 1, paddingRight: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '14px' }}>
                        {prod.name}
                      </span>
                      {prod.model && (
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>
                          {prod.model}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {prod.description}
                    </div>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '11.5px' }}>
                      <span style={{ color: 'var(--primary-400)', fontWeight: 600 }}>
                        Default Unit: {prod.defaultUnit}
                      </span>
                      <span style={{ color: prod.availableStock <= 5 ? 'var(--status-pending)' : 'var(--status-present)' }}>
                        Stock: {prod.availableStock} {prod.defaultUnit} available
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                      ₹{prod.defaultPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onSelectItem({
                          productId: prod.id,
                          description: prod.name,
                          unit: prod.defaultUnit,
                          unitPrice: prod.defaultPrice,
                          availableStock: prod.availableStock,
                        });
                        onClose();
                      }}
                    >
                      <Plus size={14} /> Add to Quotation
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

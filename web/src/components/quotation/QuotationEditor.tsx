import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { QuotationItem, QuotationPreset, CustomerItem } from '../../types';
import { CatalogPickerModal } from './CatalogPickerModal';
import { QuotationPreviewModal } from './QuotationPreviewModal';
import {
  Plus,
  Trash2,
  BookOpen,
  Eye,
  FileDown,
  Save,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  Check,
  RotateCcw,
  UserCheck,
  FileText,
  DollarSign,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type AcType = 'SPLIT' | 'CASSETTE' | 'DUCT' | 'VRV';
type QuotationBrand = 'ECDIAL' | 'DAIKIN';

interface QuotationEditorProps {
  editQuotationId?: string | null;
  initialAcType?: AcType;
  initialQuotationType?: QuotationBrand;
  initialCustomer?: CustomerItem | null;
  onBack?: () => void;
  onSuccess?: () => void;
}

export const QuotationEditor: React.FC<QuotationEditorProps> = ({
  editQuotationId,
  initialAcType = 'SPLIT',
  initialQuotationType = 'DAIKIN',
  initialCustomer = null,
  onBack,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const [machinesList, setMachinesList] = useState<any[]>([]);
  const [acType, setAcType] = useState<AcType>(initialAcType);
  const quotationType = initialQuotationType;

  // 1. Customer Details (All Optional)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomer?.id || null);
  const [customerName, setCustomerName] = useState<string>(initialCustomer?.name || '');
  const [customerAddress, setCustomerAddress] = useState<string>(initialCustomer?.address || '');
  const [customerPhone, setCustomerPhone] = useState<string>(initialCustomer?.mobile || '');
  const [customerEmail, setCustomerEmail] = useState<string>(initialCustomer?.email || '');
  const [customerLocation, setCustomerLocation] = useState<string>(initialCustomer?.address || '');

  // 2. Proposal Metadata (Cassette / Commercial)
  const [systemDesignation, setSystemDesignation] = useState<string>(
    initialQuotationType === 'DAIKIN' ? `${initialAcType === 'CASSETTE' ? 'Daikin Cassette' : `${initialAcType} AC`}` : `ECDIAL ${initialAcType} Solutions`
  );
  const [totalCapacity, setTotalCapacity] = useState<string>('5 TR');
  const [offerType, setOfferType] = useState<string>('Supply and Installation');

  // 3. Main Units Table (High Side)
  const [mainItems, setMainItems] = useState<QuotationItem[]>([]);

  // 4. Low-Side Works Table
  const [hasLowSide, setHasLowSide] = useState<boolean>(true);
  const [lowSideItems, setLowSideItems] = useState<QuotationItem[]>([]);

  // 5. Commercial Terms & Presets
  const [terms, setTerms] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [scopeExclusions, setScopeExclusions] = useState<string>('');
  const [commissioningReqs, setCommissioningReqs] = useState<string>('');

  const [availablePresets, setAvailablePresets] = useState<QuotationPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [showPresetSaveModal, setShowPresetSaveModal] = useState<boolean>(false);
  const [newPresetTitle, setNewPresetTitle] = useState<string>('');
  const [newPresetType, setNewPresetType] = useState<'TERMS' | 'PAYMENT' | 'SCOPE' | 'REQUIREMENTS'>('TERMS');

  const [cgstPercent, setCgstPercent] = useState<number>(9.0);
  const [sgstPercent, setSgstPercent] = useState<number>(9.0);

  // 6. Modals & State
  const [catalogModalOpen, setCatalogModalOpen] = useState<boolean>(false);
  const [catalogSection, setCatalogSection] = useState<'MAIN_UNIT' | 'LOW_SIDE'>('MAIN_UNIT');
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [savedQuotation, setSavedQuotation] = useState<any>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [stockWarnings, setStockWarnings] = useState<string[] | null>(null);

  const availableUnits = ['Nos', 'Mtr', 'RMT', 'Sq.Mt', 'Sqft', 'Kg', 'Set', 'Lot', 'Hour', 'Service', 'Roll', 'Piece', 'Other'];

  // Initialize Defaults based on selected acType and brand
  useEffect(() => {
    const initializeQuotationData = async () => {
      try {
        const [configRes, productsRes, presetsRes] = await Promise.all([
          api.getQuotationConfig(),
          api.listProducts('MAIN_UNIT', undefined, acType),
          api.listPresets(undefined, acType, quotationType),
        ]);

        if (productsRes.success) {
          setMachinesList(productsRes.data);
        }

        if (presetsRes.success) {
          setAvailablePresets(presetsRes.data);
        }

        if (configRes.success) {
          setCgstPercent(configRes.data.defaultCgstPercent);
          setSgstPercent(configRes.data.defaultSgstPercent);
        }

        if (editQuotationId) {
          // Editing existing quotation
          const quoteRes = await api.getQuotationById(editQuotationId);
          if (quoteRes.success) {
            const q = quoteRes.data;
            setAcType((q.acType || 'SPLIT').toUpperCase());
            setSelectedCustomerId(q.customerId || null);
            setCustomerName(q.customerName || '');
            setCustomerAddress(q.customerAddress || '');
            setCustomerPhone(q.customerPhone || '');
            setCustomerEmail(q.customerEmail || '');
            setCustomerLocation(q.customerLocation || q.customerAddress || '');
            setSystemDesignation(q.systemDesignation || '');
            setTotalCapacity(q.totalCapacity || '');
            setOfferType(q.offerType || 'Supply and Installation');
            setHasLowSide(q.hasLowSide);
            setTerms(q.termsAndConditions || '');
            setPaymentMethod(q.paymentMethod || '');
            setScopeExclusions(q.scopeExclusions || '');
            setCommissioningReqs(q.commissioningReqs || '');
            setCgstPercent(q.cgstPercent);
            setSgstPercent(q.sgstPercent);

            const m = (q.items || []).filter((i: any) => i.section === 'MAIN_UNIT');
            const l = (q.items || []).filter((i: any) => i.section === 'LOW_SIDE');
            if (m.length > 0) setMainItems(m);
            if (l.length > 0) setLowSideItems(l);
          }
        } else {
          // Creating New Quotation - Load category starting entries
          if (acType === 'CASSETTE') {
            // Load Cassette reference starting high-side units
            setMainItems([
              {
                section: 'MAIN_UNIT',
                itemOrder: 1,
                description: 'Daikin 5 TR Cassette indoor unit (FCF125CV16)',
                quantity: 1,
                unit: 'Nos',
                unitPrice: 215000.0,
                supplyRate: 215000.0,
                amount: 215000.0,
              },
              {
                section: 'MAIN_UNIT',
                itemOrder: 2,
                description: 'Daikin 5 TR outdoor unit (RZQ125BY1E)',
                quantity: 1,
                unit: 'Nos',
                unitPrice: 312000.0,
                supplyRate: 312000.0,
                amount: 312000.0,
              },
              {
                section: 'MAIN_UNIT',
                itemOrder: 3,
                description: 'Wired remote controller (BRC1H52)',
                quantity: 1,
                unit: 'Nos',
                unitPrice: 18500.0,
                supplyRate: 18500.0,
                amount: 18500.0,
              },
              {
                section: 'MAIN_UNIT',
                itemOrder: 4,
                description: 'Standard installation kit & accessories',
                quantity: 1,
                unit: 'Lot',
                unitPrice: 25000.0,
                supplyRate: 25000.0,
                amount: 25000.0,
              },
            ]);

            // Load Cassette reference 10 low-side items with separate supply & installation rates
            setLowSideItems([
              {
                section: 'LOW_SIDE',
                itemOrder: 1,
                description: 'Cassette unit installation labour charges',
                quantity: 1,
                unit: 'Nos',
                unitPrice: 15000.0,
                supplyRate: 0,
                supplyAmount: 0,
                installRate: 15000.0,
                installAmount: 15000.0,
                amount: 15000.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 2,
                description: 'GI ducting with insulation (supply & fixing)',
                quantity: 40,
                unit: 'Sq.Mt',
                unitPrice: 3700.0,
                supplyRate: 2850.0,
                supplyAmount: 114000.0,
                installRate: 850.0,
                installAmount: 34000.0,
                amount: 148000.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 3,
                description: 'Supply air diffuser (4-way cassette type)',
                quantity: 4,
                unit: 'Nos',
                unitPrice: 5500.0,
                supplyRate: 4500.0,
                supplyAmount: 18000.0,
                installRate: 1000.0,
                installAmount: 4000.0,
                amount: 22000.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 4,
                description: 'Return air grille with filter',
                quantity: 2,
                unit: 'Nos',
                unitPrice: 4000.0,
                supplyRate: 3200.0,
                supplyAmount: 6400.0,
                installRate: 800.0,
                installAmount: 1600.0,
                amount: 8000.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 5,
                description: 'Fresh air ducting and motorized damper (if required)',
                quantity: 1,
                unit: 'Lot',
                unitPrice: 36000.0,
                supplyRate: 28000.0,
                supplyAmount: 28000.0,
                installRate: 8000.0,
                installAmount: 8000.0,
                amount: 36000.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 6,
                description: 'Refrigerant copper piping (insulated)',
                quantity: 50,
                unit: 'RMT',
                unitPrice: 1900.0,
                supplyRate: 1450.0,
                supplyAmount: 72500.0,
                installRate: 450.0,
                installAmount: 22500.0,
                amount: 95000.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 7,
                description: 'Drain piping (PVC 25 mm)',
                quantity: 40,
                unit: 'RMT',
                unitPrice: 540.0,
                supplyRate: 320.0,
                supplyAmount: 12800.0,
                installRate: 220.0,
                installAmount: 8800.0,
                amount: 21600.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 8,
                description: 'Electrical cabling and accessories',
                quantity: 1,
                unit: 'Lot',
                unitPrice: 25000.0,
                supplyRate: 18000.0,
                supplyAmount: 18000.0,
                installRate: 7000.0,
                installAmount: 7000.0,
                amount: 25000.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 9,
                description: 'Nitrogen pressure testing and vacuuming',
                quantity: 1,
                unit: 'Lot',
                unitPrice: 8000.0,
                supplyRate: 5500.0,
                supplyAmount: 5500.0,
                installRate: 2500.0,
                installAmount: 2500.0,
                amount: 8000.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 10,
                description: 'Testing and commissioning',
                quantity: 1,
                unit: 'Lot',
                unitPrice: 7000.0,
                supplyRate: 0,
                supplyAmount: 0,
                installRate: 7000.0,
                installAmount: 7000.0,
                amount: 7000.0,
              },
            ]);

            // Set default terms for Cassette
            setTerms(`AC price and labour charges are exclusive of GST and subject to 18% GST.\nFinal bill based on actual quantities used at site after measurement.\nThis quotation is valid for 10 days.`);
            setPaymentMethod(`• 100% advance with purchase order for machines.\n• 70% advance of total low-side value along with purchase order.\n• 25% after completion of erection works.\n• 5% payment after raising the final bill.\n• Final bill based on actual quantities used at site after measurement.`);
            setScopeExclusions(`01. All masonry/civil works: outdoor-unit supports, cutting and making good walls/floor slabs, trenches and scaffolding.
02. Main power supply to each outdoor unit (3-phase) with ELICB and near each indoor unit (single-phase).
03. False-ceiling, boxing, wooden framework and carpentry work.
04. MS angle support for indoor units, if necessary.
05. Provision of necessary drain points.
06. Any under-deck or false-ceiling insulation work.
07. Protected storage space at site.
08. Power for erection, testing and commissioning.
09. Any dismantling work.
10. Items not specifically mentioned in ECDIAL's scope of work are excluded.
11. ODU and AHU lifting to terrace.`);
            setCommissioningReqs(`1. Earth voltage must be maintained at a minimum of 0–3 V.
2. Commissioning power: outdoor units, 3-phase 420-440 V; indoor units, single-phase 220-240 V.
3. Electrical works must comply with issued specifications/drawings and electrical safety standards.`);
          } else {
            // Split AC defaults
            setMainItems([
              {
                section: 'MAIN_UNIT',
                itemOrder: 1,
                description: 'Daikin 1.5Tr 3Star Inverter Split Ac , 100% Copper (FTKC48XV16)',
                quantity: 1,
                unit: 'Nos',
                unitPrice: 30423.73,
                supplyRate: 30423.73,
                amount: 30423.73,
              },
            ]);

            setLowSideItems([
              {
                section: 'LOW_SIDE',
                itemOrder: 1,
                description: 'Installation and testing commissioning Charges of Split ac',
                quantity: 1,
                unit: 'Nos',
                unitPrice: 1500.0,
                supplyRate: 0,
                supplyAmount: 0,
                installRate: 1500.0,
                installAmount: 1500.0,
                amount: 1500.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 2,
                description: 'Supply and installation of Copper Pipe',
                quantity: 1,
                unit: 'Mtr',
                unitPrice: 1280.0,
                supplyRate: 1280.0,
                supplyAmount: 1280.0,
                installRate: 0,
                installAmount: 0,
                amount: 1280.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 3,
                description: 'Supply and installation of Communication Cable',
                quantity: 1,
                unit: 'Mtr',
                unitPrice: 290.0,
                supplyRate: 290.0,
                supplyAmount: 290.0,
                installRate: 0,
                installAmount: 0,
                amount: 290.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 4,
                description: 'Supply and installation of Supply Cable',
                quantity: 1,
                unit: 'Mtr',
                unitPrice: 190.0,
                supplyRate: 190.0,
                supplyAmount: 190.0,
                installRate: 0,
                installAmount: 0,
                amount: 190.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 5,
                description: 'Supply and installation of Outdoor Stand',
                quantity: 1,
                unit: 'Nos',
                unitPrice: 1450.0,
                supplyRate: 1450.0,
                supplyAmount: 1450.0,
                installRate: 0,
                installAmount: 0,
                amount: 1450.0,
              },
              {
                section: 'LOW_SIDE',
                itemOrder: 6,
                description: 'Supply And Installation Of White Packing Tape',
                quantity: 1,
                unit: 'Nos',
                unitPrice: 300.0,
                supplyRate: 300.0,
                supplyAmount: 300.0,
                installRate: 0,
                installAmount: 0,
                amount: 300.0,
              },
            ]);

            setTerms(`1. AC Price is inclusive of 18 % taxes. 18% Tax Additional for Lowside.
2. Electrical, Plumbing, civil work, Structural, core cutting, class cutting, scaffolding, Crane works, Aircurtains, IDU Room wall opening for customer scope.
3. We have given the quotation as per the bill of quantities If there is any variation in the quantities used in the site, it will be charged extra.
4. This Quotation Is Valid For 10 days.`);
            setPaymentMethod(`(i) 100% Payment advance with P.O for Machine.
(ii) 70% Advance of Total Lowside Value along with PO
(iii) 25% After completion of erection works.
(iv) 5% Payment after raising the final bill.`);
          }
        }
      } catch (err) {
        console.error('Failed to load defaults', err);
      }
    };

    initializeQuotationData();
  }, [editQuotationId, acType, quotationType]);

  // Handle Main Unit Row Edit
  const updateMainItem = (index: number, field: keyof QuotationItem, value: any) => {
    const next = [...mainItems];
    const item = { ...next[index] };

    if (field === 'quantity') {
      const q = parseFloat(value) || 0;
      item.quantity = q;
      item.amount = Math.round((q * item.unitPrice + Number.EPSILON) * 100) / 100;
      if (item.supplyRate !== undefined) item.supplyAmount = Math.round((q * item.supplyRate + Number.EPSILON) * 100) / 100;
    } else if (field === 'unitPrice') {
      const p = parseFloat(value) || 0;
      item.unitPrice = p;
      item.supplyRate = p;
      item.amount = Math.round((item.quantity * p + Number.EPSILON) * 100) / 100;
    } else if (field === 'description') {
      item.description = value;
    } else if (field === 'unit') {
      item.unit = value;
    }

    next[index] = item;
    setMainItems(next);
  };

  // When a machine is picked from Catalogue for Main Unit:
  // Update description, unit, default price, quantity, and amount consistently
  const handleSelectMachineProduct = (product: any, index: number) => {
    const next = [...mainItems];
    const current = next[index] || { quantity: 1 };
    const qty = current.quantity || 1;
    const price = product.defaultPrice || 0;

    next[index] = {
      section: 'MAIN_UNIT',
      productId: product.id,
      itemOrder: index + 1,
      description: product.name,
      quantity: qty,
      unit: product.defaultUnit || 'Nos',
      unitPrice: price,
      supplyRate: product.defaultSupplyRate !== undefined ? product.defaultSupplyRate : price,
      amount: Math.round((qty * price + Number.EPSILON) * 100) / 100,
    };

    setMainItems(next);
  };

  const addMainUnitRow = () => {
    setMainItems([
      ...mainItems,
      {
        section: 'MAIN_UNIT',
        itemOrder: mainItems.length + 1,
        description: 'New Equipment / Machine',
        quantity: 1,
        unit: 'Nos',
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };

  const removeMainUnitRow = (index: number) => {
    if (mainItems.length <= 1) return;
    setMainItems(mainItems.filter((_, i) => i !== index));
  };

  // Handle Low-Side Row Edit with Separate Supply and Installation Rates
  const updateLowSideItem = (index: number, field: keyof QuotationItem, value: any) => {
    const next = [...lowSideItems];
    const item = { ...next[index] };

    if (field === 'quantity') {
      const q = parseFloat(value) || 0;
      item.quantity = q;
      const sRate = Number(item.supplyRate) || 0;
      const iRate = Number(item.installRate) || 0;
      item.supplyAmount = Math.round((q * sRate + Number.EPSILON) * 100) / 100;
      item.installAmount = Math.round((q * iRate + Number.EPSILON) * 100) / 100;
      item.amount = Math.round(((item.supplyAmount || 0) + (item.installAmount || 0) + Number.EPSILON) * 100) / 100;
    } else if (field === 'supplyRate') {
      const sRate = parseFloat(value) || 0;
      item.supplyRate = sRate;
      item.supplyAmount = Math.round((item.quantity * sRate + Number.EPSILON) * 100) / 100;
      item.amount = Math.round(((item.supplyAmount || 0) + (Number(item.installAmount) || 0) + Number.EPSILON) * 100) / 100;
    } else if (field === 'installRate') {
      const iRate = parseFloat(value) || 0;
      item.installRate = iRate;
      item.installAmount = Math.round((item.quantity * iRate + Number.EPSILON) * 100) / 100;
      item.amount = Math.round(((Number(item.supplyAmount) || 0) + (item.installAmount || 0) + Number.EPSILON) * 100) / 100;
    } else if (field === 'description') {
      item.description = value;
    } else if (field === 'unit') {
      item.unit = value;
    }

    next[index] = item;
    setLowSideItems(next);
  };

  const addLowSideRow = () => {
    setLowSideItems([
      ...lowSideItems,
      {
        section: 'LOW_SIDE',
        itemOrder: lowSideItems.length + 1,
        description: 'Low-Side Work / Material Specification',
        quantity: 1,
        unit: 'Nos',
        supplyRate: 0,
        supplyAmount: 0,
        installRate: 0,
        installAmount: 0,
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };

  const removeLowSideRow = (index: number) => {
    setLowSideItems(lowSideItems.filter((_, i) => i !== index));
  };

  // Add multiple items from CatalogPickerModal
  const handleAddCatalogItems = (selectedCatalogItems: any[]) => {
    const newRows: QuotationItem[] = selectedCatalogItems.map((cat, idx) => {
      const qty = cat.quantity || 1;
      const sRate = Number(cat.supplyRate) || 0;
      const iRate = Number(cat.installRate) || 0;
      const sAmt = Math.round((qty * sRate + Number.EPSILON) * 100) / 100;
      const iAmt = Math.round((qty * iRate + Number.EPSILON) * 100) / 100;

      return {
        section: 'LOW_SIDE',
        productId: cat.productId,
        itemOrder: lowSideItems.length + idx + 1,
        description: cat.description,
        quantity: qty,
        unit: cat.unit || 'Nos',
        supplyRate: sRate,
        supplyAmount: sAmt,
        installRate: iRate,
        installAmount: iAmt,
        unitPrice: sRate + iRate,
        amount: Math.round((sAmt + iAmt + Number.EPSILON) * 100) / 100,
      };
    });

    setLowSideItems([...lowSideItems, ...newRows]);
  };

  // Calculations: Authoritative & Exact
  const mainUnitTotal = Math.round(
    (mainItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) + Number.EPSILON) * 100
  ) / 100;

  const lowSideSupplyTotal = hasLowSide
    ? Math.round(
        (lowSideItems.reduce((sum, item) => sum + (Number(item.supplyAmount) || 0), 0) + Number.EPSILON) * 100
      ) / 100
    : 0;

  const lowSideInstallTotal = hasLowSide
    ? Math.round(
        (lowSideItems.reduce((sum, item) => sum + (Number(item.installAmount) || 0), 0) + Number.EPSILON) * 100
      ) / 100
    : 0;

  const lowSideTotal = Math.round((lowSideSupplyTotal + lowSideInstallTotal + Number.EPSILON) * 100) / 100;
  const totalProjectCost = Math.round((mainUnitTotal + lowSideTotal + Number.EPSILON) * 100) / 100;

  // Split template: Sub Total (A) = mainUnitTotal
  const isSplit = acType === 'SPLIT';
  const displayedSubtotal = isSplit ? mainUnitTotal : totalProjectCost;
  const cgstAmount = Math.round(((displayedSubtotal * cgstPercent) / 100 + Number.EPSILON) * 100) / 100;
  const sgstAmount = Math.round(((displayedSubtotal * sgstPercent) / 100 + Number.EPSILON) * 100) / 100;
  const grandTotal = Math.round((displayedSubtotal + cgstAmount + sgstAmount + Number.EPSILON) * 100) / 100;

  // Save Quotation Handler
  const handleSaveQuotation = async (status: 'DRAFT' | 'FINAL') => {
    setIsSaving(true);
    setStatusMessage(null);
    setStockWarnings(null);

    const allItems = [
      ...mainItems.map((i, idx) => ({ ...i, section: 'MAIN_UNIT' as const, itemOrder: idx + 1 })),
      ...(hasLowSide ? lowSideItems.map((i, idx) => ({ ...i, section: 'LOW_SIDE' as const, itemOrder: idx + 1 })) : []),
    ];

    try {
      const payload = {
        customerId: selectedCustomerId || null,
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        customerPhone: customerPhone.trim() || null,
        customerEmail: customerEmail.trim() || null,
        customerLocation: customerLocation.trim() || customerAddress.trim() || null,
        systemDesignation,
        totalCapacity,
        offerType,
        acType,
        quotationType,
        hasLowSide,
        items: allItems,
        cgstPercent,
        sgstPercent,
        termsAndConditions: terms,
        paymentMethod,
        scopeExclusions,
        commissioningReqs,
        status,
      };

      let res;
      if (editQuotationId) {
        res = await api.updateQuotation(editQuotationId, payload);
      } else {
        res = await api.createQuotation(payload);
      }

      if (res.success) {
        setSavedQuotation(res.data);
        setStatusMessage(res.message);
        if (res.data?.stockWarnings) {
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
      setSavedQuotation(quote);
      setPreviewModalOpen(true);
    }
  };

  const handleGeneratePdf = async () => {
    const quote = await handleSaveQuotation('FINAL');
    if (quote) {
      await api.downloadQuotationPdf(quote.id);
    }
  };

  // Presets applying
  const applyPreset = (preset: QuotationPreset) => {
    if (preset.presetType === 'TERMS') {
      setTerms(preset.content);
    } else if (preset.presetType === 'PAYMENT') {
      setPaymentMethod(preset.content);
    } else if (preset.presetType === 'SCOPE') {
      setScopeExclusions(preset.content);
    } else if (preset.presetType === 'REQUIREMENTS') {
      setCommissioningReqs(preset.content);
    }
  };

  const handleSaveCurrentAsPreset = async () => {
    if (!newPresetTitle.trim()) {
      alert('Please enter a title for the new preset.');
      return;
    }

    let contentToSave = '';
    if (newPresetType === 'TERMS') contentToSave = terms;
    else if (newPresetType === 'PAYMENT') contentToSave = paymentMethod;
    else if (newPresetType === 'SCOPE') contentToSave = scopeExclusions;
    else if (newPresetType === 'REQUIREMENTS') contentToSave = commissioningReqs;

    try {
      const res = await api.createPreset({
        title: newPresetTitle.trim(),
        presetType: newPresetType,
        acType,
        quotationType,
        content: contentToSave,
      });

      if (res.success) {
        alert('Preset saved successfully.');
        setShowPresetSaveModal(false);
        setNewPresetTitle('');
        const updated = await api.listPresets(undefined, acType, quotationType);
        if (updated.success) setAvailablePresets(updated.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save preset.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Top Banner & Quick Actions */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 900,
                color: quotationType === 'DAIKIN' ? '#0082C8' : '#FF5722',
                background: quotationType === 'DAIKIN' ? 'rgba(0, 130, 200, 0.12)' : 'rgba(255, 87, 34, 0.12)',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.8px',
              }}
            >
              {quotationType} • {acType}
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
              {editQuotationId ? 'Edit Quotation' : 'Create Quotation'}
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            {acType === 'CASSETTE'
              ? '2-Page Commercial Proposal with separate supply & installation rates, customer scope, and commissioning specifications.'
              : 'Split AC Quotation with machine package and site extra materials schedule.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onBack && (
            <button className="btn btn-secondary" onClick={onBack}>
              ← Change Category
            </button>
          )}

          <button className="btn btn-secondary" onClick={() => handleSaveQuotation('DRAFT')} disabled={isSaving}>
            <Save size={15} /> Save Draft
          </button>

          <button className="btn btn-secondary" onClick={handleOpenPreview} disabled={isSaving}>
            <Eye size={15} /> Preview PDF
          </button>

          <button className="btn btn-primary" onClick={handleGeneratePdf} disabled={isSaving}>
            <FileDown size={15} /> {isSaving ? 'Processing...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{ padding: '12px 18px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#10b981', fontSize: '13px', fontWeight: 600 }}>
          {statusMessage}
        </div>
      )}

      {/* 1. Customer Information Panel (All fields optional) */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={16} color="var(--primary-400)" /> Customer & System Information
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              All customer fields are optional. Leave blank or enter details directly.
            </span>
          </div>

          {selectedCustomerId && (
            <span className="badge badge-present" style={{ fontSize: '11px' }}>
              Pre-filled from Saved Customer
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Customer / Company Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Mr. Sekar / Jewellery Shop"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Site / Delivery Address</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Kangeyam, Tiruppur"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Phone / Mobile</label>
            <input
              type="text"
              className="form-control"
              placeholder="+91 98765 43210"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>System Designation</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Daikin Cassette"
              value={systemDesignation}
              onChange={(e) => setSystemDesignation(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Total Capacity</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 5 TR / 1.5 TR"
              value={totalCapacity}
              onChange={(e) => setTotalCapacity(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Offer Type</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Supply and Installation"
              value={offerType}
              onChange={(e) => setOfferType(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 2. SECTION A: Main Units / High-Side Equipment */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: quotationType === 'DAIKIN' ? '#0082C8' : '#FF5722', color: '#FFFFFF', padding: '1px 8px', borderRadius: '4px', fontSize: '12px' }}>A</span>
              Main Units / High-Side Equipment
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Selecting a product from the catalogue updates model, description, unit, and prices consistently.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setCatalogSection('MAIN_UNIT');
                setCatalogModalOpen(true);
              }}
            >
              <BookOpen size={14} /> Browse {acType} Catalogue
            </button>
            <button className="btn btn-secondary btn-sm" onClick={addMainUnitRow}>
              <Plus size={14} /> Add Row
            </button>
          </div>
        </div>

        {/* High-Side Table */}
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ minWidth: '280px' }}>Equipment / Model Description</th>
                <th style={{ width: '110px' }}>Preconfigured</th>
                <th style={{ width: '100px' }}>Unit</th>
                <th style={{ width: '70px' }}>Qty</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Supply Rate (₹)</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ width: '50px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {mainItems.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={item.description}
                      onChange={(e) => updateMainItem(idx, 'description', e.target.value)}
                      placeholder="Equipment model and description..."
                    />
                  </td>
                  <td>
                    <select
                      className="form-select"
                      style={{ fontSize: '12px' }}
                      value={item.productId || ''}
                      onChange={(e) => {
                        const prod = machinesList.find((m) => m.id === e.target.value);
                        if (prod) handleSelectMachineProduct(prod, idx);
                      }}
                    >
                      <option value="">Catalogue select...</option>
                      {machinesList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="form-select"
                      value={item.unit}
                      onChange={(e) => updateMainItem(idx, 'unit', e.target.value)}
                    >
                      {availableUnits.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="form-control"
                      value={item.quantity}
                      onChange={(e) => updateMainItem(idx, 'quantity', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      style={{ textAlign: 'right' }}
                      className="form-control"
                      value={item.unitPrice}
                      onChange={(e) => updateMainItem(idx, 'unitPrice', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                    ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn btn-secondary btn-icon btn-sm"
                      onClick={() => removeMainUnitRow(idx)}
                      disabled={mainItems.length <= 1}
                      title="Remove Item"
                    >
                      <Trash2 size={13} color="var(--status-absent)" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ fontWeight: 800, color: 'var(--primary-400)', fontSize: '13px' }}>
                  TOTAL - HIGH-SIDE EQUIPMENT (A)
                </td>
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 800, fontSize: '15px', color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                  ₹{mainUnitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 3. SECTION B: Low-Side Works (Separate Supply & Installation Rates) */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: quotationType === 'DAIKIN' ? '#0082C8' : '#FF5722', color: '#FFFFFF', padding: '1px 8px', borderRadius: '4px', fontSize: '12px' }}>B</span>
              Low-Side Works & Materials
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Separate supply and installation rates are tracked for each low-side specification item.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setCatalogSection('LOW_SIDE');
                setCatalogModalOpen(true);
              }}
            >
              <BookOpen size={14} /> Add from {acType} Catalogue
            </button>
            <button className="btn btn-secondary btn-sm" onClick={addLowSideRow}>
              <Plus size={14} /> Add Custom Line
            </button>
          </div>
        </div>

        {/* Low-Side Table */}
        <div className="table-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '35px' }}>#</th>
                <th style={{ minWidth: '220px' }}>Work Description / Specification</th>
                <th style={{ width: '90px' }}>Unit</th>
                <th style={{ width: '65px' }}>Qty</th>
                <th style={{ width: '105px', textAlign: 'right' }}>Supply Rate (₹)</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Supply Amt (₹)</th>
                <th style={{ width: '105px', textAlign: 'right' }}>Install Rate (₹)</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Install Amt (₹)</th>
                <th style={{ width: '115px', textAlign: 'right' }}>Line Total (₹)</th>
                <th style={{ width: '40px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {lowSideItems.map((item, idx) => {
                const supRate = Number(item.supplyRate) || 0;
                const supAmt = item.supplyAmount !== undefined ? item.supplyAmount : (item.quantity * supRate);
                const instRate = Number(item.installRate) || 0;
                const instAmt = item.installAmount !== undefined ? item.installAmount : (item.quantity * instRate);
                const lineTotal = Math.round((supAmt + instAmt + Number.EPSILON) * 100) / 100;

                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        value={item.description}
                        onChange={(e) => updateLowSideItem(idx, 'description', e.target.value)}
                        placeholder="Work specification / extra material..."
                      />
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={item.unit}
                        onChange={(e) => updateLowSideItem(idx, 'unit', e.target.value)}
                      >
                        {availableUnits.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-control"
                        value={item.quantity}
                        onChange={(e) => updateLowSideItem(idx, 'quantity', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        style={{ textAlign: 'right' }}
                        className="form-control"
                        value={supRate}
                        onChange={(e) => updateLowSideItem(idx, 'supplyRate', e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      ₹{supAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        style={{ textAlign: 'right' }}
                        className="form-control"
                        value={instRate}
                        onChange={(e) => updateLowSideItem(idx, 'installRate', e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      ₹{instAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--primary-400)' }}>
                      ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-secondary btn-icon btn-sm"
                        onClick={() => removeLowSideRow(idx)}
                        title="Remove Line"
                      >
                        <Trash2 size={13} color="var(--status-absent)" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ fontWeight: 800, color: 'var(--primary-400)' }}>
                  TOTAL LOW-SIDE WORKS (B)
                </td>
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, fontSize: '13px', color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                  Supply: ₹{lowSideSupplyTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700, fontSize: '13px', color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
                  Install: ₹{lowSideInstallTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '14px', color: 'var(--primary-400)', fontFamily: 'var(--font-mono)' }}>
                  ₹{lowSideTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. Financial Summary Card */}
      <div
        className="glass-card"
        style={{
          padding: '24px',
          background: 'linear-gradient(135deg, rgba(11, 37, 69, 0.4) 0%, rgba(16, 29, 50, 0.6) 100%)',
          border: '1px solid var(--primary-500)',
          borderRadius: '12px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>High-Side Total (A)</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
              ₹{mainUnitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Low-Side Supply Total</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
              ₹{lowSideSupplyTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Low-Side Installation Total</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
              ₹{lowSideInstallTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              background: quotationType === 'DAIKIN' ? 'rgba(0, 130, 200, 0.2)' : 'rgba(255, 87, 34, 0.2)',
              border: `1px solid ${quotationType === 'DAIKIN' ? '#0082C8' : '#FF5722'}`,
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 700, color: quotationType === 'DAIKIN' ? '#0082C8' : '#FF5722' }}>
              TOTAL PROJECT COST (A + B)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#FFFFFF', fontFamily: 'var(--font-mono)' }}>
              ₹{totalProjectCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {isSplit && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '28px', fontSize: '13px' }}>
            <span>Sub Total (A): <strong>₹{displayedSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
            <span>CGST ({cgstPercent}%): <strong>₹{cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
            <span>SGST ({sgstPercent}%): <strong>₹{sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
            <span style={{ color: 'var(--status-present)' }}>Grand Total (A): <strong>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
          </div>
        )}
      </div>

      {/* 5. Reusable Presets, Scope & Commercial Terms */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="var(--primary-400)" /> Scope, Terms & Reusable Presets
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Select from saved presets or edit terms specifically for this quotation. Editing here does not alter saved presets.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {availablePresets.length > 0 && (
              <select
                className="form-select"
                style={{ width: '220px', fontSize: '12px' }}
                value={selectedPresetId}
                onChange={(e) => {
                  setSelectedPresetId(e.target.value);
                  const p = availablePresets.find((item) => item.id === e.target.value);
                  if (p) applyPreset(p);
                }}
              >
                <option value="">Apply Saved Preset...</option>
                {availablePresets.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.presetType}] {p.title}
                  </option>
                ))}
              </select>
            )}

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPresetSaveModal(true)}
            >
              <Save size={14} /> Save Current as New Preset
            </button>
          </div>
        </div>

        {/* Tabbed / Grid Layout for Sections */}
        <div style={{ display: 'grid', gridTemplateColumns: acType === 'CASSETTE' ? '1fr 1fr' : '1fr 1fr', gap: '16px' }}>
          {acType === 'CASSETTE' && (
            <>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-400)', display: 'block', marginBottom: '6px' }}>
                  Customer Scope / Exclusions (Section C)
                </label>
                <textarea
                  className="form-control"
                  rows={8}
                  style={{ fontSize: '12px', lineHeight: 1.5, fontFamily: 'monospace' }}
                  value={scopeExclusions}
                  onChange={(e) => setScopeExclusions(e.target.value)}
                  placeholder="01. Masonry and civil work...&#10;02. Main power supply..."
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-400)', display: 'block', marginBottom: '6px' }}>
                  Requirements Before Commissioning (Section D)
                </label>
                <textarea
                  className="form-control"
                  rows={8}
                  style={{ fontSize: '12px', lineHeight: 1.5, fontFamily: 'monospace' }}
                  value={commissioningReqs}
                  onChange={(e) => setCommissioningReqs(e.target.value)}
                  placeholder="1. Earth voltage must be maintained...&#10;2. Commissioning power..."
                />
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-400)', display: 'block', marginBottom: '6px' }}>
              Terms & Conditions {acType === 'CASSETTE' ? '(Section E: Tax & Billing)' : ''}
            </label>
            <textarea
              className="form-control"
              rows={6}
              style={{ fontSize: '12px', lineHeight: 1.5 }}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-400)', display: 'block', marginBottom: '6px' }}>
              Payment Schedule {acType === 'CASSETTE' ? '(Section E: Milestone Breakdown)' : ''}
            </label>
            <textarea
              className="form-control"
              rows={6}
              style={{ fontSize: '12px', lineHeight: 1.5 }}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Save Preset Modal */}
      {showPresetSaveModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Save as Reusable Preset</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowPresetSaveModal(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Preset Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Standard 5 TR Cassette Payment Schedule"
                  value={newPresetTitle}
                  onChange={(e) => setNewPresetTitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Content Type</label>
                <select
                  className="form-select"
                  value={newPresetType}
                  onChange={(e) => setNewPresetType(e.target.value as any)}
                >
                  <option value="TERMS">Terms & Conditions</option>
                  <option value="PAYMENT">Payment Schedule</option>
                  <option value="SCOPE">Customer Scope & Exclusions</option>
                  <option value="REQUIREMENTS">Commissioning Requirements</option>
                </select>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                This preset will be associated with <strong>{acType}</strong> ({quotationType}) and stored in the database for all future quotations.
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowPresetSaveModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveCurrentAsPreset}>Save Preset</button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Picker Modal for Equipment or Low-Side Items */}
      <CatalogPickerModal
        isOpen={catalogModalOpen}
        onClose={() => setCatalogModalOpen(false)}
        section={catalogSection}
        acType={acType}
        onSelectItem={(item) => {
          if (catalogSection === 'MAIN_UNIT') {
            handleSelectMachineProduct(item, mainItems.length - 1 >= 0 ? mainItems.length - 1 : 0);
          } else {
            handleAddCatalogItems([item]);
          }
        }}
        onSelectItems={(items) => {
          if (catalogSection === 'LOW_SIDE') {
            handleAddCatalogItems(items);
          }
        }}
      />

      {/* Preview Modal */}
      {previewModalOpen && savedQuotation && (
        <QuotationPreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          quotation={savedQuotation}
          items={[...mainItems, ...lowSideItems]}
        />
      )}
    </div>
  );
};

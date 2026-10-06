import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { mobileApi } from '../services/api';
import { QuotationItem } from '../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface QuotationCreateScreenProps {
  onClose: () => void;
  onSuccess: (quotation: any) => void;
  initialQuotationType?: 'DAIKIN' | 'ECDIAL';
  initialAcType?: 'SPLIT' | 'VRV' | 'DUCT';
  quotationToEdit?: any | null;
}

const DEFAULT_BRANDS = [
  'Daikin',
  'Mitsubishi',
  'LG',
  'Godrej',
  'Voltas',
  'Panasonic',
  'Carrier',
  'Blue Star',
  'Hitachi',
  'O General',
  'Lloyd',
  'Samsung',
];

const DEFAULT_LOW_SIDE_ITEMS: QuotationItem[] = [
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
];

export const QuotationCreateScreen: React.FC<QuotationCreateScreenProps> = ({
  onClose,
  onSuccess,
  initialQuotationType = 'ECDIAL',
  initialAcType = 'SPLIT',
  quotationToEdit = null,
}) => {
  const insets = useSafeAreaInsets();
  const [quotationType, setQuotationType] = useState<'DAIKIN' | 'ECDIAL'>(initialQuotationType);
  const [acType, setAcType] = useState<'SPLIT' | 'VRV' | 'DUCT'>(initialAcType);
  const [includeBankDetails, setIncludeBankDetails] = useState<boolean>(true);
  const [machinesList, setMachinesList] = useState<any[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [catalogueModalVisible, setCatalogueModalVisible] = useState<boolean>(false);
  const [activeItemIndexForPicker, setActiveItemIndexForPicker] = useState<number>(0);
  const [catalogueSearchQuery, setCatalogueSearchQuery] = useState<string>('');
  const [catalogueBrandFilter, setCatalogueBrandFilter] = useState<string>('ALL');

  // Customer Selection & Quick Inline Creation State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerModalVisible, setCustomerModalVisible] = useState<boolean>(false);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState<boolean>(false);
  const [isAddingCustomerInline, setIsAddingCustomerInline] = useState<boolean>(false);
  const [inlineName, setInlineName] = useState<string>('');
  const [inlineAddress, setInlineAddress] = useState<string>('');
  const [inlineMobile, setInlineMobile] = useState<string>('');
  const [isSavingCustomerInline, setIsSavingCustomerInline] = useState<boolean>(false);

  // 1. Customer Details & PDF Name (Clean initial state for production)
  const [customerName, setCustomerName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [pdfName, setPdfName] = useState<string>('');

  // 2. Section A: Main Units (Clean initial empty state; populated when editing existing quotation)
  const [mainItems, setMainItems] = useState<QuotationItem[]>([]);

  // 3. Section B: Low-Side Materials (Preserves standard low-side installation items)
  const [hasLowSide, setHasLowSide] = useState<boolean>(true);
  const [lowSideItems, setLowSideItems] = useState<QuotationItem[]>(DEFAULT_LOW_SIDE_ITEMS);

  const addDaysToDate = (dateString: string, days: number) => {
    const [y, m, d] = dateString.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const formatDisplayDate = (dateString: string) => {
    const [y, m, d] = dateString.split('-');
    return y && m && d ? `${d}-${m}-${y}` : dateString;
  };

  // Sync state when quotationToEdit is passed (or reset for new quotation)
  useEffect(() => {
    if (quotationToEdit) {
      setQuotationType(quotationToEdit.quotationType || initialQuotationType);
      setAcType((quotationToEdit.acType || initialAcType || 'SPLIT').toUpperCase());
      setIncludeBankDetails(quotationToEdit.includeBankDetails !== false);
      setSelectedCustomerId(quotationToEdit.customerId || null);
      setCustomerName(quotationToEdit.customerName || '');
      setCustomerAddress(quotationToEdit.customerAddress || '');
      setCustomerPhone(quotationToEdit.customerPhone || '');
      setPdfName(quotationToEdit.pdfName || '');
      setHasLowSide(Boolean(quotationToEdit.hasLowSide));

      const rawItems: QuotationItem[] = Array.isArray(quotationToEdit.items) ? quotationToEdit.items : [];
      const mItems = rawItems.filter((i) => i.section === 'MAIN_UNIT');
      const lItems = rawItems.filter((i) => i.section === 'LOW_SIDE');

      setMainItems(mItems);
      setLowSideItems(lItems.length > 0 ? lItems : (Boolean(quotationToEdit.hasLowSide) ? DEFAULT_LOW_SIDE_ITEMS : []));
    } else {
      setQuotationType(initialQuotationType);
      setAcType(initialAcType);
      setIncludeBankDetails(true);
      setSelectedCustomerId(null);
      setCustomerName('');
      setCustomerAddress('');
      setCustomerPhone('');
      setPdfName('');
      setHasLowSide(true);
      setMainItems([]);
      setLowSideItems(DEFAULT_LOW_SIDE_ITEMS);
    }
  }, [quotationToEdit, initialAcType, initialQuotationType]);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.listProducts('MAIN_UNIT');
        if (res.success) {
          setMachinesList(res.data);
          // Do not auto-select first item so wrong default item is not shown
          setSelectedMachineId(null);
        }
      } catch (err) {
        console.error('Failed to load catalogue', err);
      }
    })();
  }, []);

  const extractBrand = (item: any): string => {
    if (item.brand) return item.brand;
    const descMatch = item.description?.match(/\[Brand:\s*([^\]]+)\]/i);
    if (descMatch) return descMatch[1].trim();

    const fullText = `${item.name || ''} ${item.model || ''} ${item.description || ''}`.toLowerCase();
    for (const b of DEFAULT_BRANDS) {
      if (fullText.includes(b.toLowerCase())) {
        return b;
      }
    }
    return 'Other';
  };

  const allCatalogueBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    machinesList.forEach((m) => {
      brandsSet.add(extractBrand(m));
    });
    return ['ALL', ...Array.from(brandsSet).filter(Boolean)];
  }, [machinesList]);

  const filteredMachines = useMemo(() => {
    return machinesList.filter((m) => {
      // Brand filter
      if (catalogueBrandFilter !== 'ALL') {
        const b = extractBrand(m);
        if (b.toLowerCase() !== catalogueBrandFilter.toLowerCase()) return false;
      }
      // Search query filter
      if (catalogueSearchQuery.trim().length > 0) {
        const q = catalogueSearchQuery.toLowerCase().trim();
        const combined = `${m.name || ''} ${m.model || ''} ${m.description || ''} ${extractBrand(m)}`.toLowerCase();
        if (!combined.includes(q)) return false;
      }
      return true;
    });
  }, [machinesList, catalogueBrandFilter, catalogueSearchQuery]);

  const addMainItem = () => {
    setMainItems([
      ...mainItems,
      {
        section: 'MAIN_UNIT',
        itemOrder: mainItems.length + 1,
        description: '',
        quantity: 1,
        unit: 'Nos',
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };

  const addLowSideItem = () => {
    setLowSideItems([
      ...lowSideItems,
      {
        section: 'LOW_SIDE',
        itemOrder: lowSideItems.length + 1,
        description: '',
        quantity: 1,
        unit: 'Mtr',
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };

  const updateItem = (
    section: 'MAIN_UNIT' | 'LOW_SIDE',
    idx: number,
    field: keyof QuotationItem,
    val: any
  ) => {
    const list = section === 'MAIN_UNIT' ? [...mainItems] : [...lowSideItems];
    const item = { ...list[idx] };

    if (field === 'quantity') {
      const q = parseFloat(val) || 0;
      item.quantity = q;
      item.amount = Math.round((q * item.unitPrice + Number.EPSILON) * 100) / 100;
    } else if (field === 'unitPrice') {
      const p = parseFloat(val) || 0;
      item.unitPrice = p;
      item.amount = Math.round((item.quantity * p + Number.EPSILON) * 100) / 100;
    } else if (field === 'description') {
      item.description = val;
    } else if (field === 'unit') {
      item.unit = val;
    }

    list[idx] = item;
    if (section === 'MAIN_UNIT') setMainItems(list);
    else setLowSideItems(list);
  };

  // Dedicated interactive Machine Model selector (Rules 16, 17, 18, 19)
  const handleSelectMachineModel = (machine: any, targetIdx: number) => {
    setSelectedMachineId(machine.id);
    const updated = [...mainItems];
    if (updated.length === 0 || targetIdx >= updated.length) {
      updated.push({
        section: 'MAIN_UNIT',
        itemOrder: updated.length + 1,
        description: `${machine.name} (${machine.model || machine.name})`,
        quantity: 1,
        unit: machine.defaultUnit || 'Nos',
        unitPrice: Number(machine.defaultPrice) || 0,
        amount: Number(machine.defaultPrice) || 0,
      });
    } else {
      const item = { ...updated[targetIdx] };
      item.description = `${machine.name} (${machine.model || machine.name})`;
      item.unitPrice = Number(machine.defaultPrice) || 0;
      item.unit = machine.defaultUnit || 'Nos';
      item.amount = Math.round((item.quantity * item.unitPrice + Number.EPSILON) * 100) / 100;
      updated[targetIdx] = item;
    }
    setMainItems(updated);
    setCatalogueModalVisible(false);
  };

  const removeItem = (section: 'MAIN_UNIT' | 'LOW_SIDE', idx: number) => {
    if (section === 'MAIN_UNIT') {
      setMainItems(mainItems.filter((_, i) => i !== idx));
    } else {
      setLowSideItems(lowSideItems.filter((_, i) => i !== idx));
    }
  };

  // Live Authoritative Totals
  const mainTotal = mainItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  const lowSideTotal = hasLowSide ? lowSideItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0) : 0;
  const subtotal = Math.round((mainTotal + lowSideTotal + Number.EPSILON) * 100) / 100;
  const cgst = Math.round(((subtotal * 9) / 100 + Number.EPSILON) * 100) / 100;
  const sgst = Math.round(((subtotal * 9) / 100 + Number.EPSILON) * 100) / 100;
  const grandTotal = Math.round((subtotal + cgst + sgst + Number.EPSILON) * 100) / 100;

  const fetchCustomersForPicker = async (search?: string) => {
    try {
      setIsLoadingCustomers(true);
      const res = await mobileApi.listCustomers(search);
      if (res.success && res.data) {
        setCustomerList(res.data);
      }
    } catch (err) {
      console.error('[Fetch Customers Error]', err);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const handleSelectCustomer = (c: any) => {
    setSelectedCustomerId(c.id);
    setCustomerName(c.name || '');
    setCustomerAddress(c.address || '');
    setCustomerPhone(c.mobile || '');
    setCustomerModalVisible(false);
  };

  const handleCreateCustomerInline = async () => {
    try {
      setIsSavingCustomerInline(true);
      const res = await mobileApi.createCustomer({
        name: inlineName.trim() || undefined,
        address: inlineAddress.trim() || undefined,
        mobile: inlineMobile.trim() || undefined,
      });
      if (res.success && res.data) {
        handleSelectCustomer(res.data);
        setIsAddingCustomerInline(false);
        setInlineName('');
        setInlineAddress('');
        setInlineMobile('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    } finally {
      setIsSavingCustomerInline(false);
    }
  };

  const handleSave = async (status: 'DRAFT' | 'FINAL') => {
    setIsLoading(true);
    const allItems = [
      ...mainItems.map((i, idx) => ({ ...i, section: 'MAIN_UNIT', itemOrder: idx + 1 })),
      ...(hasLowSide ? lowSideItems.map((i, idx) => ({ ...i, section: 'LOW_SIDE', itemOrder: idx + 1 })) : []),
    ];

    const safeCustomer = customerName ? customerName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'Customer';
    const prefix = quotationType === 'ECDIAL' ? 'ECDIAL' : 'DAIKIN';
    const finalPdfName = pdfName.trim() || `${prefix}_Quotation_${safeCustomer}`;

    const payload = {
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim(),
      customerAddress: customerAddress.trim(),
      customerPhone: customerPhone.trim(),
      quotationType,
      acType,
      includeBankDetails,
      hasLowSide,
      items: allItems,
      cgstPercent: 9,
      sgstPercent: 9,
      status,
      pdfName: finalPdfName,
    };

    try {
      let res;
      if (quotationToEdit?.id) {
        res = await mobileApi.updateQuotation(quotationToEdit.id, payload);
      } else {
        res = await mobileApi.createQuotation(payload);
      }

      if (res.success) {
        onSuccess(res.data);
      } else {
        alert(res.message || 'Failed to save quotation');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save quotation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, 14), paddingBottom: Math.max(insets.bottom, 24) + 120 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Commercial Quotation</Text>
          <Text style={styles.subtitle}>All machine & lowside prices are 100% editable</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#F1F5F9',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#64748B' }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* TOP TEMPLATE TYPE SWITCHER */}
      <View style={styles.templateSwitcherCard}>
        <Text style={styles.templateSwitcherLabel}>QUOTATION TEMPLATE</Text>
        <View style={styles.templateSwitcherRow}>
          <TouchableOpacity
            style={[
              styles.templateTabBtn,
              quotationType === 'ECDIAL' && styles.templateTabBtnActiveEcDial,
            ]}
            onPress={() => setQuotationType('ECDIAL')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>⚡</Text>
            <Text
              style={[
                styles.templateTabText,
                quotationType === 'ECDIAL' && styles.templateTabTextActiveEcDial,
              ]}
            >
              Ec Dial Quotation
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.templateTabBtn,
              quotationType === 'DAIKIN' && styles.templateTabBtnActiveDaikin,
            ]}
            onPress={() => setQuotationType('DAIKIN')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16 }}>❄️</Text>
            <Text
              style={[
                styles.templateTabText,
                quotationType === 'DAIKIN' && styles.templateTabTextActiveDaikin,
              ]}
            >
              Daikin Quotation
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SELECTED AC TYPE */}
      <View style={styles.acTypeBanner}>
        <View>
          <Text style={styles.acTypeLabel}>AC TYPE</Text>
          <Text style={styles.acTypeValue}>{acType === 'VRV' ? 'VRV / VRF' : acType === 'DUCT' ? 'DUCT AC' : 'SPLIT AC'}</Text>
        </View>
        <View style={styles.acTypePill}>
          <Text style={styles.acTypePillText}>{acType === 'SPLIT' ? 'ACTIVE FLOW' : 'NEW PAGE'}</Text>
        </View>
      </View>

      {(acType === 'VRV' || acType === 'DUCT') ? (
        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonIcon}>{acType === 'VRV' ? '❄️' : '🏢'}</Text>
          <Text style={styles.comingSoonTitle}>{acType === 'VRV' ? 'VRV / VRF Quotation' : 'Duct AC Quotation'}</Text>
          <Text style={styles.comingSoonText}>This quotation type has its own page flow and is ready for the next module implementation. The Split AC quotation flow remains unchanged.</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {acType === 'SPLIT' && (
      <>
      {/* 1. CUSTOMER INFO (FLOW A WITH CUSTOMER / FLOW B WITHOUT CUSTOMER) */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardLabel}>CUSTOMER INFORMATION (To,)</Text>
          <TouchableOpacity
            style={styles.pickCustomerBtn}
            onPress={() => {
              fetchCustomersForPicker();
              setCustomerModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.pickCustomerBtnText}>👤 Select Customer</Text>
          </TouchableOpacity>
        </View>

        {selectedCustomerId && (
          <View style={styles.selectedCustomerBanner}>
            <Text style={styles.selectedCustomerText}>✓ Linked to Customer Profile</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedCustomerId(null);
                setCustomerName('');
                setCustomerAddress('');
                setCustomerPhone('');
              }}
            >
              <Text style={styles.clearCustomerText}>✕ Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.fieldLabel}>Customer / Client Name (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Customer Name (e.g. ABC Enterprises or Mr. Ramesh)"
          placeholderTextColor="#94A3B8"
          value={customerName}
          onChangeText={setCustomerName}
        />

        <Text style={styles.fieldLabel}>Customer Address / Location (Optional)</Text>
        <TextInput
          style={[styles.input, { height: 54, textAlignVertical: 'top' }]}
          placeholder="Customer Address / Location"
          placeholderTextColor="#94A3B8"
          value={customerAddress}
          onChangeText={setCustomerAddress}
          multiline
        />

        <Text style={styles.fieldLabel}>Phone Number (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Phone Number (e.g. +91 98765 43210)"
          placeholderTextColor="#94A3B8"
          value={customerPhone}
          onChangeText={setCustomerPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.fieldLabel}>Quotation PDF Filename (Saved & Reused Everywhere)</Text>
        <TextInput
          style={styles.input}
          placeholder={customerName ? `${customerName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}_Quotation` : 'Customer_Quotation'}
          placeholderTextColor="#94A3B8"
          value={pdfName}
          onChangeText={setPdfName}
          autoCapitalize="none"
        />
      </View>

      {/* 1A. QUOTATION VALIDITY + BANK DETAILS */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.fieldLabel}>VALIDITY</Text>
            <Text style={styles.validityValue}>{formatDisplayDate(quotationToEdit?.validTill || addDaysToDate(quotationToEdit?.date || new Date().toISOString().slice(0, 10), 10))}</Text>
            <Text style={styles.validityHint}>Default: 10 days from quotation date</Text>
          </View>
          <View style={styles.bankToggleBox}>
            <Text style={styles.bankToggleLabel}>Include Bank Details</Text>
            <Switch value={includeBankDetails} onValueChange={setIncludeBankDetails} trackColor={{ true: quotationType === 'ECDIAL' ? '#F2791E' : '#0B79D0', false: '#CBD5E1' }} />
          </View>
        </View>
      </View>

      {/* 2. SECTION A: MAIN UNIT WITH MACHINE SELECTOR (Rules 16, 17, 18, 19) */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.badgeLetter}><Text style={styles.badgeLetterText}>A</Text></View>
            <Text style={styles.cardLabel}>MAIN UNIT (MACHINE SELECTION)</Text>
          </View>
          <TouchableOpacity onPress={addMainItem}>
            <Text style={styles.addText}>+ ADD MACHINE</Text>
          </TouchableOpacity>
        </View>

        {mainItems.length === 0 ? (
          <View style={{ paddingVertical: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '500' }}>
              No machines added yet. Tap "+ ADD MACHINE" above to add.
            </Text>
          </View>
        ) : (
          mainItems.map((item, idx) => (
            <View key={idx} style={styles.itemBox}>
              <View style={styles.rowBetween}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#0066CC' }}>
                  Machine #{idx + 1}
                </Text>
                <TouchableOpacity onPress={() => removeItem('MAIN_UNIT', idx)}>
                  <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>Remove</Text>
                </TouchableOpacity>
              </View>

            {/* Tap to Pick Machine Model from Catalogue Modal */}
            <TouchableOpacity
              style={styles.selectModelBtn}
              onPress={() => {
                setActiveItemIndexForPicker(idx);
                const matching = machinesList.find(
                  (m) =>
                    item.description &&
                    (item.description.includes(m.name) || (m.model && item.description.includes(m.model)))
                );
                setSelectedMachineId(matching ? matching.id : null);
                setCatalogueModalVisible(true);
              }}
            >
              <Text style={{ fontSize: 16 }}>❄️</Text>
              <Text style={styles.selectModelBtnText} numberOfLines={1}>
                {item.description || 'Tap to select Machine Model from Catalogue'}
              </Text>
              <Text style={styles.selectModelArrow}>›</Text>
            </TouchableOpacity>

            {/* Quick Horizontal Machine Selector Chips */}
            {machinesList.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {machinesList.map((m) => {
                    const isSelected =
                      Boolean(item.description) &&
                      (item.description.includes(m.name) || (m.model && item.description.includes(m.model)));
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.machineChip, isSelected && styles.machineChipSelected]}
                        onPress={() => handleSelectMachineModel(m, idx)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.machineChipText, isSelected && styles.machineChipTextSelected]}>
                          {isSelected ? '✓ ' : ''}{m.model || m.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            <TextInput
              style={[styles.input, { marginVertical: 6, fontWeight: '600' }]}
              value={item.description}
              onChangeText={(v) => updateItem('MAIN_UNIT', idx, 'description', v)}
              placeholder="Machine Description"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Qty</Text>
                <TextInput
                  style={[styles.input, { textAlign: 'center' }]}
                  keyboardType="numeric"
                  value={String(item.quantity)}
                  onChangeText={(v) => updateItem('MAIN_UNIT', idx, 'quantity', v)}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Unit</Text>
                <TextInput
                  style={[styles.input, { textAlign: 'center' }]}
                  value={item.unit}
                  onChangeText={(v) => updateItem('MAIN_UNIT', idx, 'unit', v)}
                />
              </View>

              <View style={{ flex: 1.6 }}>
                <Text style={styles.fieldLabel}>Price (₹) [Editable]</Text>
                <TextInput
                  style={[styles.input, { textAlign: 'right', fontWeight: '700' }]}
                  keyboardType="numeric"
                  value={String(item.unitPrice)}
                  onChangeText={(v) => updateItem('MAIN_UNIT', idx, 'unitPrice', v)}
                />
              </View>
            </View>

            <Text style={styles.itemAmount}>
              Amount: ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        )))}
      </View>

      {/* 3. SECTION B: LOW-SIDE MATERIALS */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.badgeLetter}><Text style={styles.badgeLetterText}>B</Text></View>
            <Text style={styles.cardLabel}>LOW SIDE (B) EXTRA MATERIALS</Text>
          </View>
          <Switch value={hasLowSide} onValueChange={setHasLowSide} trackColor={{ true: '#0066CC', false: '#CBD5E1' }} />
        </View>

        {hasLowSide && (
          <View style={{ marginTop: 10 }}>
            {lowSideItems.length === 0 ? (
              <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#94A3B8' }}>
                  No extra materials added. Tap "+ ADD MATERIAL" below to add items.
                </Text>
              </View>
            ) : (
              lowSideItems.map((item, idx) => (
                <View key={idx} style={styles.itemBox}>
                  <View style={styles.rowBetween}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0066CC' }}>Material #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeItem('LOW_SIDE', idx)}>
                      <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>

                <TextInput
                  style={[styles.input, { marginVertical: 6 }]}
                  value={item.description}
                  onChangeText={(v) => updateItem('LOW_SIDE', idx, 'description', v)}
                  placeholder="Material Description"
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Qty</Text>
                    <TextInput
                      style={[styles.input, { textAlign: 'center' }]}
                      keyboardType="numeric"
                      value={String(item.quantity)}
                      onChangeText={(v) => updateItem('LOW_SIDE', idx, 'quantity', v)}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Unit</Text>
                    <TextInput
                      style={[styles.input, { textAlign: 'center' }]}
                      value={item.unit}
                      onChangeText={(v) => updateItem('LOW_SIDE', idx, 'unit', v)}
                    />
                  </View>

                  <View style={{ flex: 1.6 }}>
                    <Text style={styles.fieldLabel}>Price (₹) [Editable]</Text>
                    <TextInput
                      style={[styles.input, { textAlign: 'right', fontWeight: '700' }]}
                      keyboardType="numeric"
                      value={String(item.unitPrice)}
                      onChangeText={(v) => updateItem('LOW_SIDE', idx, 'unitPrice', v)}
                    />
                  </View>
                </View>

                <Text style={styles.itemAmount}>
                  Amount: ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )))}

            <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: 8 }} onPress={addLowSideItem}>
              <Text style={styles.addText}>+ ADD MATERIAL</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 4. TOTALS (Matching Image 2) */}
      <View style={styles.totalsCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.totalsLabel}>Sub Total (A):</Text>
          <Text style={styles.totalsVal}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.totalsSub}>CGST 9%:</Text>
          <Text style={styles.totalsSub}>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.totalsSub}>SGST 9%:</Text>
          <Text style={styles.totalsSub}>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#0066CC' }]}>
          <Text style={styles.grandTotalLabel}>TOTAL (A):</Text>
          <Text style={styles.grandTotalVal}>₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => handleSave('FINAL')}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>[ PREVIEW & GENERATE PDF ]</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>

      </>
      )}

      {/* MACHINE MODEL CATALOGUE PICKER MODAL (Rule 17, 18) */}
      <Modal
        visible={catalogueModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCatalogueModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Machine Model</Text>
                <Text style={styles.modalSubtitle}>Filter by brand or search to add into quotation</Text>
              </View>
              <TouchableOpacity onPress={() => setCatalogueModalVisible(false)}>
                <Text style={{ fontSize: 18, color: '#64748B', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Search Bar */}
            <View style={styles.modalSearchBox}>
              <Text style={{ fontSize: 15 }}>🔍</Text>
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search by brand, model (e.g. Daikin, FTKM)..."
                placeholderTextColor="#94A3B8"
                value={catalogueSearchQuery}
                onChangeText={setCatalogueSearchQuery}
              />
              {catalogueSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setCatalogueSearchQuery('')}>
                  <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Modal Brand Filter Chips */}
            <View style={styles.modalBrandFilterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
                {allCatalogueBrands.map((brand) => {
                  const isActive = catalogueBrandFilter.toLowerCase() === brand.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={brand}
                      style={[styles.modalFilterChip, isActive && styles.modalFilterChipActive]}
                      onPress={() => setCatalogueBrandFilter(brand)}
                    >
                      <Text style={[styles.modalFilterChipText, isActive && styles.modalFilterChipTextActive]}>
                        {brand === 'ALL' ? 'All Brands' : brand}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
              {filteredMachines.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, marginBottom: 6 }}>🔍</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>No matching machines found</Text>
                  <Text style={{ fontSize: 11.5, color: '#64748B', textAlign: 'center', marginTop: 2 }}>
                    Try clearing the search or choosing 'All Brands'.
                  </Text>
                </View>
              ) : (
                filteredMachines.map((m) => {
                  const currentItem = mainItems[activeItemIndexForPicker];
                  const isSelected =
                    (selectedMachineId === m.id) ||
                    Boolean(
                      currentItem &&
                        currentItem.description &&
                        (currentItem.description.includes(m.name) ||
                          (m.model && currentItem.description.includes(m.model)))
                    );
                  const brand = extractBrand(m);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.modalMachineCard, isSelected && styles.modalMachineCardSelected]}
                      onPress={() => handleSelectMachineModel(m, activeItemIndexForPicker)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={styles.modalCardBrandTag}>
                              <Text style={styles.modalCardBrandTagText}>{brand}</Text>
                            </View>
                            <Text style={styles.modalMachineName} numberOfLines={1}>{m.name}</Text>
                          </View>
                          <Text style={styles.modalMachineDetails}>
                            Model: {m.model || 'Standard'} • Capacity: {m.capacity || '1.5 Ton'}
                          </Text>
                        </View>
                        {isSelected ? (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>✓ SELECTED</Text>
                          </View>
                        ) : (
                          <View style={styles.selectBadge}>
                            <Text style={styles.selectBadgeText}>TAP TO SELECT</Text>
                          </View>
                        )}
                      </View>

                      <View style={[styles.rowBetween, { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderColor: '#F1F5F9' }]}>
                        <Text style={styles.modalMachinePrice}>
                          Price: ₹{Number(m.defaultPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                        <Text style={styles.modalMachineStock}>Available: {m.availableStock || 10} Units</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CUSTOMER PICKER & QUICK INLINE CREATION MODAL (FLOW A / FLOW B) */}
      <Modal
        visible={customerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Customer</Text>
                <Text style={styles.modalSubtitle}>Pick existing customer or add inline without losing quote draft</Text>
              </View>
              <TouchableOpacity onPress={() => setCustomerModalVisible(false)}>
                <Text style={{ fontSize: 18, color: '#64748B', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {isAddingCustomerInline ? (
              /* Inline Customer Add Form */
              <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>Quick Add New Customer</Text>
                <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600' }}>* All fields are optional. Entered quotation items will be preserved.</Text>

                <Text style={styles.fieldLabel}>Customer / Company Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. ABC Enterprises or Mr. Ramesh"
                  placeholderTextColor="#94A3B8"
                  value={inlineName}
                  onChangeText={setInlineName}
                />

                <Text style={styles.fieldLabel}>Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#94A3B8"
                  value={inlineMobile}
                  onChangeText={setInlineMobile}
                  keyboardType="phone-pad"
                />

                <Text style={styles.fieldLabel}>Address / Location</Text>
                <TextInput
                  style={[styles.input, { height: 50, textAlignVertical: 'top' }]}
                  placeholder="e.g. 42 Cross Street, Coimbatore"
                  placeholderTextColor="#94A3B8"
                  value={inlineAddress}
                  onChangeText={setInlineAddress}
                  multiline
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleCreateCustomerInline}
                  disabled={isSavingCustomerInline}
                >
                  {isSavingCustomerInline ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save & Select Customer</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsAddingCustomerInline(false)}
                >
                  <Text style={styles.cancelBtnText}>Back to Customer List</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* Customer List & Search */
              <>
                {/* Search Bar & Quick Add Button */}
                <View style={{ flexDirection: 'row', paddingHorizontal: 14, gap: 8, marginTop: 10 }}>
                  <View style={[styles.modalSearchBox, { flex: 1, marginHorizontal: 0, marginTop: 0 }]}>
                    <Text style={{ fontSize: 15 }}>🔍</Text>
                    <TextInput
                      style={styles.modalSearchInput}
                      placeholder="Search name, phone, address..."
                      placeholderTextColor="#94A3B8"
                      value={customerSearchQuery}
                      onChangeText={(t) => {
                        setCustomerSearchQuery(t);
                        fetchCustomersForPicker(t);
                      }}
                    />
                    {customerSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => {
                        setCustomerSearchQuery('');
                        fetchCustomersForPicker('');
                      }}>
                        <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '700' }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={{
                      backgroundColor: '#0066CC',
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => setIsAddingCustomerInline(true)}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Flow B Quick Button: Create Without Customer */}
                <TouchableOpacity
                  style={{
                    backgroundColor: '#F1F5F9',
                    marginHorizontal: 14,
                    marginTop: 8,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setSelectedCustomerId(null);
                    setCustomerModalVisible(false);
                  }}
                >
                  <Text style={{ color: '#475569', fontSize: 11.5, fontWeight: '700' }}>
                    ⚡ Skip / Create Without Customer Profile
                  </Text>
                </TouchableOpacity>

                <ScrollView contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 40 }}>
                  {isLoadingCustomers ? (
                    <ActivityIndicator size="small" color="#0066CC" style={{ marginTop: 20 }} />
                  ) : customerList.length === 0 ? (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                      <Text style={{ fontSize: 24, marginBottom: 6 }}>👥</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>No customers found</Text>
                      <TouchableOpacity
                        style={{ marginTop: 10, backgroundColor: '#0066CC', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
                        onPress={() => setIsAddingCustomerInline(true)}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>+ Add New Customer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    customerList.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={{
                          backgroundColor: selectedCustomerId === c.id ? '#EFF6FF' : '#FFFFFF',
                          borderRadius: 10,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: selectedCustomerId === c.id ? '#0066CC' : '#E2E8F0',
                        }}
                        onPress={() => handleSelectCustomer(c)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.rowBetween}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                            {c.name || 'Unnamed Client'}
                          </Text>
                          {c.mobile && (
                            <Text style={{ fontSize: 11, color: '#0066CC', fontWeight: '700' }}>
                              📞 {c.mobile}
                            </Text>
                          )}
                        </View>
                        {c.address && (
                          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                            📍 {c.address}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 130,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  templateSwitcherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  templateSwitcherLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  templateSwitcherRow: {
    flexDirection: 'row',
    gap: 8,
  },
  templateTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  templateTabBtnActiveEcDial: {
    backgroundColor: '#FFF7ED',
    borderColor: '#EA580C',
  },
  templateTabBtnActiveDaikin: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066CC',
  },
  templateTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  templateTabTextActiveEcDial: {
    color: '#EA580C',
    fontWeight: '900',
  },
  templateTabTextActiveDaikin: {
    color: '#0066CC',
    fontWeight: '900',
  },
  acTypeBanner: {
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  acTypeLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.8 },
  acTypeValue: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  acTypePill: { backgroundColor: '#EEF2FF', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  acTypePillText: { fontSize: 9, fontWeight: '900', color: '#4338CA' },
  comingSoonCard: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 28, alignItems: 'center', marginBottom: 16 },
  comingSoonIcon: { fontSize: 42, marginBottom: 10 },
  comingSoonTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', textAlign: 'center' },
  comingSoonText: { fontSize: 12, lineHeight: 18, color: '#64748B', textAlign: 'center', marginTop: 8, marginBottom: 16 },
  validityValue: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  validityHint: { fontSize: 10, color: '#64748B', marginTop: 2 },
  bankToggleBox: { alignItems: 'flex-end' },
  bankToggleLabel: { fontSize: 10, fontWeight: '800', color: '#334155', marginBottom: 3 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066CC',
  },
  pickCustomerBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  pickCustomerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066CC',
  },
  selectedCustomerBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: 8,
    marginBottom: 4,
  },
  selectedCustomerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  clearCustomerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  badgeLetter: {
    backgroundColor: '#0052A3',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  badgeLetterText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
    marginBottom: 2,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 8,
    color: '#0F172A',
    fontSize: 13,
  },
  selectModelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#0066CC',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  selectModelBtnText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0066CC',
  },
  selectModelArrow: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0066CC',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addText: {
    color: '#0066CC',
    fontWeight: '800',
    fontSize: 11,
  },
  machineChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  machineChipSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066CC',
    borderWidth: 1.5,
  },
  machineChipText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  machineChipTextSelected: {
    color: '#0066CC',
    fontWeight: '800',
  },
  itemBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  itemAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066CC',
    textAlign: 'right',
    marginTop: 6,
  },
  totalsCard: {
    backgroundColor: '#0A1E3F',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  totalsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalsVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalsSub: {
    fontSize: 11.5,
    color: '#CBD5E1',
    marginTop: 3,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  grandTotalVal: {
    fontSize: 17,
    fontWeight: '900',
    color: '#60A5FA',
  },
  primaryButton: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  modalMachineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  modalMachineCardSelected: {
    borderColor: '#0066CC',
    backgroundColor: '#EFF6FF',
  },
  modalMachineName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalMachineDetails: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  selectedBadge: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  selectBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectBadgeText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
  },
  modalMachinePrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066CC',
  },
  modalMachineStock: {
    fontSize: 11,
    color: '#64748B',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 40,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: '#0F172A',
    marginLeft: 6,
  },
  modalBrandFilterRow: {
    marginTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  modalFilterChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalFilterChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  modalFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  modalFilterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalCardBrandTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  modalCardBrandTagText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0066CC',
  },
});

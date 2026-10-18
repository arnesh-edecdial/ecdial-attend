import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi } from '../services/api';
import { QuotationItem } from '../types';
import { C, extractBrand } from './catalogueShared';
import { LowSideLibraryScreen } from './LowSideLibraryScreen';
import { LowSideItem, fetchLowSide, sameLine, toQuoteItem } from './lowSideLibrary';
import { CustomerPickerSheet, LowSidePickerSheet, MachinePickerSheet } from './QuotationPickers';
import { resolveQuotationType } from './quotationType';

interface QuotationCreateScreenProps {
  onClose: () => void;
  onSuccess: (quotation: any) => void;
  initialQuotationType?: 'DAIKIN' | 'ECDIAL';
  initialAcType?: 'SPLIT' | 'VRV' | 'DUCT';
  quotationToEdit?: any | null;
}

type Section = 'MAIN_UNIT' | 'LOW_SIDE';

const money = (n: number) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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

/* ------------------------------------------------------------------ */
/* One line item. Memoised: typing in one card never re-renders others. */
/* ------------------------------------------------------------------ */
interface CardProps {
  section: Section;
  idx: number;
  item: QuotationItem;
  onChange: (section: Section, idx: number, field: keyof QuotationItem, val: any) => void;
  onRemove: (section: Section, idx: number) => void;
  onPickModel?: (idx: number) => void;
}

const ItemCard = memo(({ section, idx, item, onChange, onRemove, onPickModel }: CardProps) => {
  // local text so decimals like "1280." can be typed; synced if the value changes from outside
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unitPrice));
  useEffect(() => {
    if ((parseFloat(qty) || 0) !== item.quantity) setQty(String(item.quantity));
  }, [item.quantity]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if ((parseFloat(price) || 0) !== item.unitPrice) setPrice(String(item.unitPrice));
  }, [item.unitPrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const main = section === 'MAIN_UNIT';
  return (
    <View style={s.itemCard}>
      <View style={s.itemHead}>
        <Text style={s.itemTag}>{main ? `Machine ${idx + 1}` : `Item ${idx + 1}`}</Text>
        <Pressable onPress={() => onRemove(section, idx)} hitSlop={8}>
          <Text style={s.remove}>Remove</Text>
        </Pressable>
      </View>

      {main && onPickModel && (
        <Pressable style={({ pressed }) => [s.modelBtn, pressed && { opacity: 0.6 }]} onPress={() => onPickModel(idx)}>
          <Text style={s.modelLabel}>Model</Text>
          <Text style={[s.modelValue, !item.description && { color: C.sub }]} numberOfLines={1}>
            {item.description || 'Choose from catalogue'}
          </Text>
          <Text style={s.chev}>›</Text>
        </Pressable>
      )}

      <TextInput
        style={s.descInput}
        value={item.description}
        onChangeText={(v) => onChange(section, idx, 'description', v)}
        placeholder={main ? 'Machine description' : 'Material description'}
        placeholderTextColor={C.sub}
        multiline
      />

      <View style={s.numRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.cap}>Qty</Text>
          <TextInput
            style={[s.numInput, { textAlign: 'center' }]}
            keyboardType="decimal-pad"
            value={qty}
            onChangeText={(v) => {
              setQty(v);
              onChange(section, idx, 'quantity', v);
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cap}>Unit</Text>
          <TextInput
            style={[s.numInput, { textAlign: 'center' }]}
            value={item.unit}
            onChangeText={(v) => onChange(section, idx, 'unit', v)}
          />
        </View>
        <View style={{ flex: 1.7 }}>
          <Text style={s.cap}>Price (₹)</Text>
          <TextInput
            style={[s.numInput, { textAlign: 'right', fontWeight: '600' }]}
            keyboardType="decimal-pad"
            value={price}
            onChangeText={(v) => {
              setPrice(v);
              onChange(section, idx, 'unitPrice', v);
            }}
          />
        </View>
      </View>

      <View style={s.amountRow}>
        <Text style={s.amountLabel}>Amount</Text>
        <Text style={s.amountValue}>₹{money(item.amount)}</Text>
      </View>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */
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

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [pdfName, setPdfName] = useState<string>('');

  const [mainItems, setMainItems] = useState<QuotationItem[]>([]);
  const [hasLowSide, setHasLowSide] = useState<boolean>(true);
  const [lowSideItems, setLowSideItems] = useState<QuotationItem[]>([]);

  const [machines, setMachines] = useState<any[]>([]);
  const [library, setLibrary] = useState<LowSideItem[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [customerOpen, setCustomerOpen] = useState(false);
  const [machineOpen, setMachineOpen] = useState(false);
  const [activeMachineIdx, setActiveMachineIdx] = useState(0);
  const [lowPickerOpen, setLowPickerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const lowTouched = useRef<boolean>(false);

  // Sync state when quotationToEdit is passed (or reset for a new quotation)
  useEffect(() => {
    if (quotationToEdit) {
      setQuotationType(resolveQuotationType(quotationToEdit) || initialQuotationType);
      setAcType((quotationToEdit.acType || initialAcType || 'SPLIT').toUpperCase());
      setIncludeBankDetails(quotationToEdit.includeBankDetails !== false);
      setSelectedCustomerId(quotationToEdit.customerId || null);
      setCustomerName(quotationToEdit.customerName || '');
      setCustomerAddress(quotationToEdit.customerAddress || '');
      setCustomerPhone(quotationToEdit.customerPhone || '');
      setPdfName(quotationToEdit.pdfName || '');
      setHasLowSide(Boolean(quotationToEdit.hasLowSide));
      const rawItems: QuotationItem[] = Array.isArray(quotationToEdit.items) ? quotationToEdit.items : [];
      setMainItems(rawItems.filter((i) => i.section === 'MAIN_UNIT'));
      setLowSideItems(rawItems.filter((i) => i.section === 'LOW_SIDE'));
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
      setLowSideItems([]); // low side starts empty; pick items from your saved list
    }
  }, [quotationToEdit, initialAcType, initialQuotationType]);

  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.listProducts('MAIN_UNIT');
        if (res.success) setMachines(res.data);
      } catch (err) {
        console.error('Failed to load catalogue', err);
      }
    })();
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      setLibrary(await fetchLowSide());
    } catch (err) {
      console.warn('[Low side library]', err);
      setLibrary([]);
    }
  }, []);
  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    lowTouched.current = false;
  }, [quotationToEdit]);

  // Only items you explicitly flagged "Add to every new quotation" are pre-filled (none by default).
  useEffect(() => {
    if (quotationToEdit || lowTouched.current || !library) return;
    const defs = library.filter((i) => i.isDefault);
    if (defs.length) setLowSideItems(defs.map((i, k) => toQuoteItem(i, k + 1)) as QuotationItem[]);
  }, [library, quotationToEdit]);

  /* ---- item handlers (stable identities so ItemCard memo works) ---- */
  const updateItem = useCallback((section: Section, idx: number, field: keyof QuotationItem, val: any) => {
    const apply = (list: QuotationItem[]) => {
      const next = [...list];
      const item = { ...next[idx] };
      if (field === 'quantity') {
        const q = parseFloat(val) || 0;
        item.quantity = q;
        item.amount = round2(q * item.unitPrice);
      } else if (field === 'unitPrice') {
        const p = parseFloat(val) || 0;
        item.unitPrice = p;
        item.amount = round2(item.quantity * p);
      } else if (field === 'description') {
        item.description = val;
      } else if (field === 'unit') {
        item.unit = val;
      }
      next[idx] = item;
      return next;
    };
    if (section === 'LOW_SIDE') {
      lowTouched.current = true;
      setLowSideItems(apply);
    } else {
      setMainItems(apply);
    }
  }, []);

  const removeItem = useCallback((section: Section, idx: number) => {
    if (section === 'LOW_SIDE') {
      lowTouched.current = true;
      setLowSideItems((cur) => cur.filter((_, i) => i !== idx));
    } else {
      setMainItems((cur) => cur.filter((_, i) => i !== idx));
    }
  }, []);

  const addMainItem = () =>
    setMainItems((cur) => [
      ...cur,
      { section: 'MAIN_UNIT', itemOrder: cur.length + 1, description: '', quantity: 1, unit: 'Nos', unitPrice: 0, amount: 0 } as QuotationItem,
    ]);

  const addCustomLowSide = () => {
    lowTouched.current = true;
    setLowSideItems((cur) => [
      ...cur,
      { section: 'LOW_SIDE', itemOrder: cur.length + 1, description: '', quantity: 1, unit: 'Mtr', unitPrice: 0, amount: 0 } as QuotationItem,
    ]);
  };

  const openMachinePicker = useCallback((idx: number) => {
    setActiveMachineIdx(idx);
    setMachineOpen(true);
  }, []);

  const handleSelectMachineModel = (machine: any) => {
    const description = `${machine.name} (${machine.model || machine.name})`;
    const price = Number(machine.defaultPrice) || 0;
    const unit = machine.defaultUnit || 'Nos';
    const brand = extractBrand(machine);
    setMainItems((cur) => {
      const list = [...cur];
      if (activeMachineIdx >= list.length) {
        list.push({ section: 'MAIN_UNIT', itemOrder: list.length + 1, description, quantity: 1, unit, unitPrice: price, amount: price, brand } as any);
      } else {
        const item: any = { ...list[activeMachineIdx], description, unitPrice: price, unit, brand };
        item.amount = round2(item.quantity * price);
        list[activeMachineIdx] = item;
      }
      return list;
    });
    setMachineOpen(false);
  };

  const applyLowSide = (add: LowSideItem[], removeNames: string[]) => {
    lowTouched.current = true;
    setLowSideItems((cur) =>
      [...cur.filter((x) => !removeNames.some((n) => sameLine(n, x.description))), ...(add.map((it) => toQuoteItem(it, 0)) as QuotationItem[])].map(
        (x, i) => ({ ...x, itemOrder: i + 1 })
      )
    );
    setLowPickerOpen(false);
  };

  const onSelectCustomer = (c: any) => {
    setCustomerOpen(false);
    if (!c) {
      setSelectedCustomerId(null);
      return;
    }
    setSelectedCustomerId(c.id);
    setCustomerName(c.name || '');
    setCustomerAddress(c.address || '');
    setCustomerPhone(c.mobile || '');
  };

  /* ---- totals ---- */
  const mainTotal = mainItems.reduce((a, i) => a + (Number(i.amount) || 0), 0);
  const lowSideTotal = hasLowSide ? lowSideItems.reduce((a, i) => a + (Number(i.amount) || 0), 0) : 0;
  const subtotal = round2(mainTotal + lowSideTotal);
  const cgst = round2((subtotal * 9) / 100);
  const sgst = round2((subtotal * 9) / 100);
  const grandTotal = round2(subtotal + cgst + sgst);

  const handleSave = async (status: 'DRAFT' | 'FINAL') => {
    setIsLoading(true);
    const allItems = [
      ...mainItems.map((i, idx) => ({ ...i, section: 'MAIN_UNIT', itemOrder: idx + 1 })),
      ...(hasLowSide ? lowSideItems.map((i, idx) => ({ ...i, section: 'LOW_SIDE', itemOrder: idx + 1 })) : []),
    ];
    const safeCustomer = customerName ? customerName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'Customer';
    // keep the name's template prefix in step with the template chosen now
    const typed = pdfName.trim().replace(/^(ECDIAL|DAIKIN)(?=_)/i, quotationType);
    const finalPdfName = typed || `${quotationType}_Quotation_${safeCustomer}`;

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
      const res = quotationToEdit?.id
        ? await mobileApi.updateQuotation(quotationToEdit.id, payload)
        : await mobileApi.createQuotation(payload);
      if (res.success) {
        const saved = res.data?.quotationType;
        if (saved && saved !== quotationType) {
          // the app sent one template and the server stored another: a backend issue, not a form issue
          console.warn(`[Quotation] sent quotationType=${quotationType} but the server saved ${saved}`);
        }
        onSuccess(res.data);
      } else {
        Alert.alert('Could not save', res.message || 'Failed to save quotation');
      }
    } catch (err: any) {
      Alert.alert('Could not save', err.message || 'Failed to save quotation');
    } finally {
      setIsLoading(false);
    }
  };

  const isSplit = acType === 'SPLIT';
  const validTill = formatDisplayDate(
    quotationToEdit?.validTill || addDaysToDate(quotationToEdit?.date || new Date().toISOString().slice(0, 10), 10)
  );
  const currentLowNames = useMemo(() => lowSideItems.map((i) => i.description), [lowSideItems]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.nav, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable onPress={onClose} hitSlop={10} style={s.navSide}>
          <Text style={s.navBlue}>Cancel</Text>
        </Pressable>
        <Text style={s.navTitle}>{quotationToEdit ? 'Edit Quotation' : 'New Quotation'}</Text>
        <View style={s.navSide} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          {/* Template */}
          <View style={s.segment}>
            {(['ECDIAL', 'DAIKIN'] as const).map((t) => (
              <Pressable key={t} style={[s.seg, quotationType === t && s.segOn]} onPress={() => setQuotationType(t)}>
                <Text style={[s.segText, quotationType === t && s.segTextOn]}>{t === 'ECDIAL' ? 'Ec Dial' : 'Daikin'}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.segHint}>{acType === 'VRV' ? 'VRV / VRF' : acType === 'DUCT' ? 'Duct AC' : 'Split AC'} quotation</Text>

          {!isSplit ? (
            <View style={[s.group, { padding: 22, alignItems: 'center', marginTop: 18 }]}>
              <Text style={s.soonTitle}>{acType === 'VRV' ? 'VRV / VRF Quotation' : 'Duct AC Quotation'}</Text>
              <Text style={s.soonText}>This quotation type has its own page flow and is coming in the next module. The Split AC flow is unchanged.</Text>
              <Pressable style={[s.secondary, { marginTop: 16, alignSelf: 'stretch' }]} onPress={onClose}>
                <Text style={s.secondaryText}>Back</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Customer */}
              <Text style={s.sec}>Customer</Text>
              <View style={s.group}>
                <Pressable style={({ pressed }) => [s.rowBtn, pressed && s.rowOn]} onPress={() => setCustomerOpen(true)}>
                  <Text style={s.rowBtnLabel}>Customer profile</Text>
                  <Text style={[s.rowBtnValue, !!selectedCustomerId && { color: '#34C759' }]}>
                    {selectedCustomerId ? '✓ Linked' : 'Select'}
                  </Text>
                  <Text style={s.chev}>›</Text>
                </Pressable>
                {!!selectedCustomerId && (
                  <>
                    <View style={s.hair} />
                    <Pressable
                      style={s.rowBtn}
                      onPress={() => {
                        setSelectedCustomerId(null);
                        setCustomerName('');
                        setCustomerAddress('');
                        setCustomerPhone('');
                      }}
                    >
                      <Text style={[s.rowBtnLabel, { color: C.red }]}>Clear customer</Text>
                    </Pressable>
                  </>
                )}
                <View style={s.hair} />
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Name</Text>
                  <TextInput style={s.fieldInput} placeholder="Optional" placeholderTextColor={C.sub} value={customerName} onChangeText={setCustomerName} />
                </View>
                <View style={s.hair} />
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Phone</Text>
                  <TextInput style={s.fieldInput} placeholder="Optional" placeholderTextColor={C.sub} value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
                </View>
                <View style={s.hair} />
                <View style={[s.field, { alignItems: 'flex-start', minHeight: 64 }]}>
                  <Text style={[s.fieldLabel, { paddingTop: 14 }]}>Address</Text>
                  <TextInput style={[s.fieldInput, { height: 64, paddingTop: 12, textAlignVertical: 'top' }]} placeholder="Optional" placeholderTextColor={C.sub} value={customerAddress} onChangeText={setCustomerAddress} multiline />
                </View>
                <View style={s.hair} />
                <View style={s.field}>
                  <Text style={s.fieldLabel}>PDF name</Text>
                  <TextInput
                    style={s.fieldInput}
                    placeholder={customerName ? `${customerName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}_Quotation` : 'Customer_Quotation'}
                    placeholderTextColor={C.sub}
                    value={pdfName}
                    onChangeText={setPdfName}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <Text style={s.footnote}>The PDF name is saved and reused every time you download or share.</Text>

              {/* Options */}
              <Text style={s.sec}>Options</Text>
              <View style={s.group}>
                <View style={s.rowBtn}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowBtnLabel}>Valid till</Text>
                    <Text style={s.rowHint}>10 days from the quotation date</Text>
                  </View>
                  <Text style={s.rowBtnValue}>{validTill}</Text>
                </View>
                <View style={s.hair} />
                <View style={s.rowBtn}>
                  <Text style={[s.rowBtnLabel, { flex: 1 }]}>Include bank details</Text>
                  <Switch value={includeBankDetails} onValueChange={setIncludeBankDetails} trackColor={{ true: '#34C759', false: undefined }} />
                </View>
              </View>

              {/* A: Main unit */}
              <View style={s.secRow}>
                <View style={s.letter}><Text style={s.letterText}>A</Text></View>
                <Text style={[s.sec, s.secInline]}>Main unit</Text>
                <Pressable onPress={addMainItem} hitSlop={8}>
                  <Text style={s.link}>＋ Add machine</Text>
                </Pressable>
              </View>
              {mainItems.length === 0 ? (
                <View style={[s.group, s.emptyBox]}>
                  <Text style={s.emptyText}>No machines yet. Tap “Add machine”.</Text>
                </View>
              ) : (
                mainItems.map((item, idx) => (
                  <ItemCard key={idx} section="MAIN_UNIT" idx={idx} item={item} onChange={updateItem} onRemove={removeItem} onPickModel={openMachinePicker} />
                ))
              )}

              {/* B: Low side */}
              <View style={s.secRow}>
                <View style={s.letter}><Text style={s.letterText}>B</Text></View>
                <Text style={[s.sec, s.secInline]}>Low side</Text>
                <Switch value={hasLowSide} onValueChange={setHasLowSide} trackColor={{ true: '#34C759', false: undefined }} />
              </View>
              {hasLowSide && (
                <>
                  {lowSideItems.length === 0 ? (
                    <View style={[s.group, s.emptyBox]}>
                      <Text style={s.emptyText}>No low side items. Add from your saved list.</Text>
                    </View>
                  ) : (
                    lowSideItems.map((item, idx) => (
                      <ItemCard key={idx} section="LOW_SIDE" idx={idx} item={item} onChange={updateItem} onRemove={removeItem} />
                    ))
                  )}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Pressable style={[s.primarySoft, { flex: 1.5 }]} onPress={() => setLowPickerOpen(true)}>
                      <Text style={s.primarySoftText}>＋ From saved items</Text>
                    </Pressable>
                    <Pressable style={[s.secondary, { flex: 1 }]} onPress={addCustomLowSide}>
                      <Text style={[s.secondaryText, { color: C.label }]}>Custom line</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {/* Totals */}
              <Text style={s.sec}>Summary</Text>
              <View style={s.group}>
                <View style={s.sumRow}><Text style={s.sumLabel}>Sub total</Text><Text style={s.sumVal}>₹{money(subtotal)}</Text></View>
                <View style={s.hair} />
                <View style={s.sumRow}><Text style={s.sumLabel}>CGST 9%</Text><Text style={s.sumVal}>₹{money(cgst)}</Text></View>
                <View style={s.hair} />
                <View style={s.sumRow}><Text style={s.sumLabel}>SGST 9%</Text><Text style={s.sumVal}>₹{money(sgst)}</Text></View>
                <View style={s.hair} />
                <View style={s.sumRow}><Text style={s.grandLabel}>Total</Text><Text style={s.grandVal}>₹{money(grandTotal)}</Text></View>
              </View>
            </>
          )}
        </ScrollView>

        {isSplit && (
          <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.bottomCap}>Total incl. GST</Text>
              <Text style={s.bottomTotal}>₹{money(grandTotal)}</Text>
            </View>
            <Pressable style={[s.cta, isLoading && { opacity: 0.6 }]} onPress={() => handleSave('FINAL')} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaText}>Preview & PDF</Text>}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      <CustomerPickerSheet visible={customerOpen} onSelect={onSelectCustomer} onClose={() => setCustomerOpen(false)} />
      <MachinePickerSheet
        visible={machineOpen}
        machines={machines}
        currentDescription={mainItems[activeMachineIdx]?.description || ''}
        onSelect={handleSelectMachineModel}
        onClose={() => setMachineOpen(false)}
      />
      <LowSidePickerSheet
        visible={lowPickerOpen}
        library={library}
        currentDescriptions={currentLowNames}
        onApply={applyLowSide}
        onManage={() => {
          setLowPickerOpen(false);
          setTimeout(() => setManageOpen(true), 350);
        }}
        onClose={() => setLowPickerOpen(false)}
      />
      {manageOpen && (
        <LowSideLibraryScreen
          onClose={() => {
            setManageOpen(false);
            loadLibrary();
          }}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: C.bg },
  navSide: { width: 70 },
  navTitle: { fontSize: 17, fontWeight: '600', color: C.label },
  navBlue: { fontSize: 17, color: C.blue },

  segment: { flexDirection: 'row', padding: 2, borderRadius: 10, backgroundColor: '#7676801F' },
  seg: { flex: 1, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segText: { fontSize: 14, color: C.label },
  segTextOn: { fontWeight: '700' },
  segHint: { textAlign: 'center', fontSize: 12, color: C.sub, marginTop: 6 },

  sec: { fontSize: 13, fontWeight: '600', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 },
  secInline: { marginTop: 0, marginBottom: 0, marginLeft: 0, flex: 1 },
  letter: { width: 22, height: 22, borderRadius: 6, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  letterText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  link: { color: C.blue, fontSize: 15, fontWeight: '600' },
  footnote: { fontSize: 12, color: C.sub, marginTop: 6, marginLeft: 4 },

  group: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 16 },
  rowOn: { backgroundColor: '#F2F2F7' },
  rowBtn: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 16, gap: 8 },
  rowBtnLabel: { fontSize: 16, color: C.label },
  rowBtnValue: { fontSize: 16, color: C.sub, marginLeft: 'auto' },
  rowHint: { fontSize: 12, color: C.sub, marginTop: 1 },
  chev: { fontSize: 24, color: '#C7C7CC', marginTop: -3 },
  field: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingLeft: 16 },
  fieldLabel: { width: 82, fontSize: 16, color: C.label },
  fieldInput: { flex: 1, height: 48, fontSize: 16, color: C.label, paddingRight: 16 },

  emptyBox: { padding: 18, alignItems: 'center' },
  emptyText: { color: C.sub, fontSize: 14, textAlign: 'center' },

  itemCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTag: { fontSize: 12, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4 },
  remove: { fontSize: 14, color: C.red },
  modelBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 10, paddingHorizontal: 12, backgroundColor: C.blueSoft, marginBottom: 8 },
  modelLabel: { fontSize: 13, fontWeight: '700', color: C.blue },
  modelValue: { flex: 1, fontSize: 14, color: C.label },
  descInput: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 11, backgroundColor: C.bg, fontSize: 15, color: C.label, textAlignVertical: 'top' },
  numRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cap: { fontSize: 11, color: C.sub, marginBottom: 4, marginLeft: 2 },
  numInput: { height: 42, borderRadius: 10, paddingHorizontal: 10, backgroundColor: C.bg, fontSize: 15, color: C.label },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  amountLabel: { fontSize: 13, color: C.sub },
  amountValue: { fontSize: 16, fontWeight: '700', color: C.label },

  primarySoft: { height: 46, borderRadius: 12, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  primarySoftText: { color: C.blue, fontSize: 16, fontWeight: '600' },
  secondary: { height: 46, borderRadius: 12, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: C.blue, fontSize: 16, fontWeight: '600' },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, paddingHorizontal: 16 },
  sumLabel: { fontSize: 16, color: C.label },
  sumVal: { fontSize: 16, color: C.label },
  grandLabel: { fontSize: 17, fontWeight: '700', color: C.label },
  grandVal: { fontSize: 19, fontWeight: '800', color: C.label },

  bottom: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  bottomCap: { fontSize: 12, color: C.sub },
  bottomTotal: { fontSize: 20, fontWeight: '800', color: C.label },
  cta: { height: 48, paddingHorizontal: 22, borderRadius: 14, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', minWidth: 150 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  soonTitle: { fontSize: 18, fontWeight: '700', color: C.label },
  soonText: { fontSize: 14, color: C.sub, textAlign: 'center', marginTop: 6 },
});

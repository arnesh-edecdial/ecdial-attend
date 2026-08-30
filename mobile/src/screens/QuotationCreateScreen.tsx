import React, { useState, useEffect } from 'react';
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

interface QuotationCreateScreenProps {
  onClose: () => void;
  onSuccess: (quotation: any) => void;
}

export const QuotationCreateScreen: React.FC<QuotationCreateScreenProps> = ({
  onClose,
  onSuccess,
}) => {
  const [machinesList, setMachinesList] = useState<any[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [catalogueModalVisible, setCatalogueModalVisible] = useState<boolean>(false);
  const [activeItemIndexForPicker, setActiveItemIndexForPicker] = useState<number>(0);

  // 1. Customer Details (Initialized empty for real data entry)
  const [customerName, setCustomerName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // 2. Section A: Main Units matching Image 2
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

  // 3. Section B: Low-Side Materials matching Image 2
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

  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await mobileApi.listProducts('MAIN_UNIT');
        if (res.success) {
          setMachinesList(res.data);
          if (res.data.length > 0) {
            setSelectedMachineId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load catalogue', err);
      }
    })();
  }, []);

  const addMainItem = () => {
    setMainItems([
      ...mainItems,
      {
        section: 'MAIN_UNIT',
        itemOrder: mainItems.length + 1,
        description: 'Daikin AC Unit',
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
        description: 'Low-Side Material / Service',
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
    const item = { ...updated[targetIdx] };
    item.description = `${machine.name} (${machine.model || machine.name})`;
    item.unitPrice = Number(machine.defaultPrice) || 0;
    item.unit = machine.defaultUnit || 'Nos';
    item.amount = Math.round((item.quantity * item.unitPrice + Number.EPSILON) * 100) / 100;
    updated[targetIdx] = item;
    setMainItems(updated);
    setCatalogueModalVisible(false);
  };

  const removeItem = (section: 'MAIN_UNIT' | 'LOW_SIDE', idx: number) => {
    if (section === 'MAIN_UNIT') {
      if (mainItems.length > 1) setMainItems(mainItems.filter((_, i) => i !== idx));
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

  const handleSave = async (status: 'DRAFT' | 'FINAL') => {
    setIsLoading(true);
    const allItems = [
      ...mainItems.map((i, idx) => ({ ...i, section: 'MAIN_UNIT', itemOrder: idx + 1 })),
      ...(hasLowSide ? lowSideItems.map((i, idx) => ({ ...i, section: 'LOW_SIDE', itemOrder: idx + 1 })) : []),
    ];

    try {
      const res = await mobileApi.createQuotation({
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        customerPhone: customerPhone.trim(),
        hasLowSide,
        items: allItems,
        cgstPercent: 9,
        sgstPercent: 9,
        status,
      });

      if (res.success) {
        onSuccess(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save quotation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Commercial Quotation</Text>
        <Text style={styles.subtitle}>All machine & lowside prices are 100% editable</Text>
      </View>

      {/* 1. CUSTOMER INFO */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>CUSTOMER INFORMATION (To,)</Text>

        <Text style={styles.fieldLabel}>Customer Name (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Customer Name"
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
        />
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

        {mainItems.map((item, idx) => (
          <View key={idx} style={styles.itemBox}>
            <View style={styles.rowBetween}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#0066CC' }}>
                Machine #{idx + 1}
              </Text>
              {mainItems.length > 1 && (
                <TouchableOpacity onPress={() => removeItem('MAIN_UNIT', idx)}>
                  <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Tap to Pick Machine Model from Catalogue Modal */}
            <TouchableOpacity
              style={styles.selectModelBtn}
              onPress={() => {
                setActiveItemIndexForPicker(idx);
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
                    const isSelected = selectedMachineId === m.id;
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
        ))}
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
            {lowSideItems.map((item, idx) => (
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
            ))}

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
                <Text style={styles.modalSubtitle}>Tap any machine to add into quotation</Text>
              </View>
              <TouchableOpacity onPress={() => setCatalogueModalVisible(false)}>
                <Text style={{ fontSize: 18, color: '#64748B', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
              {machinesList.map((m) => {
                const isSelected = selectedMachineId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.modalMachineCard, isSelected && styles.modalMachineCardSelected]}
                    onPress={() => handleSelectMachineModel(m, activeItemIndexForPicker)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalMachineName}>{m.name}</Text>
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
              })}
            </ScrollView>
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
});

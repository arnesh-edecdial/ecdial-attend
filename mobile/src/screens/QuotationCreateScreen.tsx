import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
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
  // 1. Customer
  const [customerName, setCustomerName] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // 2. Main Units
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

  // 3. Low-Side
  const [hasLowSide, setHasLowSide] = useState<boolean>(false);
  const [lowSideItems, setLowSideItems] = useState<QuotationItem[]>([
    {
      section: 'LOW_SIDE',
      itemOrder: 1,
      description: 'Installation and testing commissioning charges',
      quantity: 1,
      unit: 'Service',
      unitPrice: 1500.0,
      amount: 1500.0,
    },
  ]);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const addMainItem = () => {
    setMainItems([
      ...mainItems,
      {
        section: 'MAIN_UNIT',
        itemOrder: mainItems.length + 1,
        description: 'New AC Unit',
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
        description: 'Supply & Install Copper Pipe',
        quantity: 1,
        unit: 'Mtr',
        unitPrice: 1280,
        amount: 1280,
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

  const removeItem = (section: 'MAIN_UNIT' | 'LOW_SIDE', idx: number) => {
    if (section === 'MAIN_UNIT') {
      if (mainItems.length > 1) setMainItems(mainItems.filter((_, i) => i !== idx));
    } else {
      setLowSideItems(lowSideItems.filter((_, i) => i !== idx));
    }
  };

  // Live Totals
  const mainTotal = mainItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
  const lowSideTotal = hasLowSide ? lowSideItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0) : 0;
  const subtotal = Math.round((mainTotal + lowSideTotal + Number.EPSILON) * 100) / 100;
  const cgst = Math.round(((subtotal * 9) / 100 + Number.EPSILON) * 100) / 100;
  const sgst = Math.round(((subtotal * 9) / 100 + Number.EPSILON) * 100) / 100;
  const grandTotal = Math.round((subtotal + cgst + sgst + Number.EPSILON) * 100) / 100;

  const handleSave = async (status: 'DRAFT' | 'FINAL') => {
    if (!customerName.trim()) {
      alert('Please enter Customer Name');
      return;
    }
    if (!customerAddress.trim()) {
      alert('Please enter Customer Address');
      return;
    }

    setIsLoading(true);
    const allItems = [
      ...mainItems.map((i, idx) => ({ ...i, section: 'MAIN_UNIT', itemOrder: idx + 1 })),
      ...(hasLowSide ? lowSideItems.map((i, idx) => ({ ...i, section: 'LOW_SIDE', itemOrder: idx + 1 })) : []),
    ];

    try {
      const res = await mobileApi.createQuotation({
        customerName,
        customerAddress,
        customerPhone,
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
        <Text style={styles.title}>New Fast Quotation</Text>
        <Text style={styles.subtitle}>No customer selection step required</Text>
      </View>

      {/* WHO */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>CUSTOMER INFORMATION</Text>

        <Text style={styles.fieldLabel}>Customer Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Mr. Rajesh / Nexus Tech"
          placeholderTextColor="#64748B"
          value={customerName}
          onChangeText={setCustomerName}
        />

        <Text style={styles.fieldLabel}>Customer Address *</Text>
        <TextInput
          style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
          placeholder="e.g. 4th Floor, OMR, Chennai"
          placeholderTextColor="#64748B"
          value={customerAddress}
          onChangeText={setCustomerAddress}
          multiline
        />

        <Text style={styles.fieldLabel}>Phone (Optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="+91 98765 43210"
          placeholderTextColor="#64748B"
          value={customerPhone}
          onChangeText={setCustomerPhone}
        />
      </View>

      {/* WHAT: MAIN UNIT */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardLabel}>MAIN UNIT ITEMS</Text>
          <TouchableOpacity onPress={addMainItem}>
            <Text style={styles.addText}>+ ADD ITEM</Text>
          </TouchableOpacity>
        </View>

        {mainItems.map((item, idx) => (
          <View key={idx} style={styles.itemBox}>
            <View style={styles.rowBetween}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0066CC' }}>Item #{idx + 1}</Text>
              {mainItems.length > 1 && (
                <TouchableOpacity onPress={() => removeItem('MAIN_UNIT', idx)}>
                  <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={[styles.input, { marginVertical: 6 }]}
              value={item.description}
              onChangeText={(v) => updateItem('MAIN_UNIT', idx, 'description', v)}
              placeholder="Description"
              placeholderTextColor="#64748B"
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Qty</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(item.quantity)}
                  onChangeText={(v) => updateItem('MAIN_UNIT', idx, 'quantity', v)}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={item.unit}
                  onChangeText={(v) => updateItem('MAIN_UNIT', idx, 'unit', v)}
                />
              </View>

              <View style={{ flex: 1.5 }}>
                <Text style={styles.fieldLabel}>Rate (₹)</Text>
                <TextInput
                  style={styles.input}
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

      {/* LOW-SIDE MATERIALS */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardLabel}>LOW-SIDE MATERIALS</Text>
          <Switch value={hasLowSide} onValueChange={setHasLowSide} trackColor={{ true: '#0066CC', false: '#334155' }} />
        </View>

        {hasLowSide && (
          <View style={{ marginTop: 12 }}>
            {lowSideItems.map((item, idx) => (
              <View key={idx} style={styles.itemBox}>
                <View style={styles.rowBetween}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0066CC' }}>Material #{idx + 1}</Text>
                  <TouchableOpacity onPress={() => removeItem('LOW_SIDE', idx)}>
                    <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={[styles.input, { marginVertical: 6 }]}
                  value={item.description}
                  onChangeText={(v) => updateItem('LOW_SIDE', idx, 'description', v)}
                  placeholder="Material Description"
                  placeholderTextColor="#64748B"
                />

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Qty</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={String(item.quantity)}
                      onChangeText={(v) => updateItem('LOW_SIDE', idx, 'quantity', v)}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Unit</Text>
                    <TextInput
                      style={styles.input}
                      value={item.unit}
                      onChangeText={(v) => updateItem('LOW_SIDE', idx, 'unit', v)}
                    />
                  </View>

                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.fieldLabel}>Rate (₹)</Text>
                    <TextInput
                      style={styles.input}
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

      {/* TOTALS & ACTIONS */}
      <View style={styles.totalsCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.totalsLabel}>Subtotal:</Text>
          <Text style={styles.totalsVal}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.totalsSub}>CGST (9%):</Text>
          <Text style={styles.totalsSub}>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.totalsSub}>SGST (9%):</Text>
          <Text style={styles.totalsSub}>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={[styles.rowBetween, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#0066CC' }]}>
          <Text style={styles.grandTotalLabel}>TOTAL (INR):</Text>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12.5,
    color: '#94A3B8',
  },
  card: {
    backgroundColor: 'rgba(18, 27, 48, 0.9)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066CC',
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#152238',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 8,
    color: '#FFFFFF',
    fontSize: 13.5,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addText: {
    color: '#0066CC',
    fontWeight: '700',
    fontSize: 12,
  },
  itemBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  itemAmount: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
    marginTop: 6,
  },
  totalsCard: {
    backgroundColor: '#0F2A4A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalsLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalsVal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  totalsSub: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  grandTotalVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
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
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 13,
  },
});

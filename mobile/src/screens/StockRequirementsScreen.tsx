import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi } from '../services/api';
import { dataCache } from '../services/dataCache';
import { calculateRequirementUrgency } from '../utils/urgency';
import { CustomerPickerSheet } from './QuotationPickers';

interface StockRequirementsScreenProps {
  userRole?: string;
  userName?: string;
  onClose?: () => void;
}

const ADMIN_MANAGEMENT_ROLES = ['ADMIN', 'MANAGER', 'IT_ADMIN', 'SERVICE_MANAGER'];

// Tentative date is a date-only value stored at UTC midnight: always render it in UTC so it never shifts a day.
const formatTentativeDate = (v: string) =>
  new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Auto-insert hyphens while typing: 20261125 -> 2026-11-25 */
const maskDateInput = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 8);
  return d.length > 6 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
};

const isValidDateInput = (v: string) => {
  if (!v) return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};

export const StockRequirementsScreen: React.FC<StockRequirementsScreenProps> = ({
  userRole = 'SALES',
  userName = '',
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const isAdmin = ADMIN_MANAGEMENT_ROLES.includes(userRole.toUpperCase());

  // Data states - cache-first
  const [requirements, setRequirements] = useState<any[]>(() => {
    return dataCache.get<any>(`stock_req:${isAdmin ? 'ADMIN' : 'STAFF'}:PENDING:ALL:`)?.data || [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => requirements.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'ALL' | 'MY'>('PENDING');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'NORMAL' | 'URGENT' | 'EMERGENCY'>('ALL');

  // Create Requirement Modal
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [customerPickerVisible, setCustomerPickerVisible] = useState<boolean>(false);

  // Products
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productSearch, setProductSearch] = useState<string>('');
  const [productPickerVisible, setProductPickerVisible] = useState<boolean>(false);

  const [quantity, setQuantity] = useState<string>('1');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT' | 'EMERGENCY'>('NORMAL');
  const [note, setNote] = useState<string>('');
  const [tentativeDate, setTentativeDate] = useState<string>(''); // YYYY-MM-DD, optional
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Admin Edit / Status Modal
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [selectedRequirement, setSelectedRequirement] = useState<any | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>('1');
  const [editPriority, setEditPriority] = useState<string>('NORMAL');
  const [editStatus, setEditStatus] = useState<string>('PENDING');
  const [editNote, setEditNote] = useState<string>('');
  const [editTentativeDate, setEditTentativeDate] = useState<string>('');

  const fetchRequirements = async (forceRefresh: boolean = false) => {
    try {
      if (forceRefresh && requirements.length === 0) setIsLoading(true);
      const res = await mobileApi.getCachedStockRequirements(
        isAdmin,
        activeTab,
        priorityFilter === 'ALL' ? undefined : priorityFilter,
        searchQuery || undefined,
        {
          forceRefresh,
          onBackgroundUpdate: (fresh) => {
            if (fresh && fresh.success && Array.isArray(fresh.data)) {
              setRequirements(fresh.data);
            }
          },
        }
      );

      if (res && res.success && Array.isArray(res.data)) {
        setRequirements(res.data);
      }
    } catch (err) {
      console.error('[Fetch Requirements Error]', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequirements(false);
  }, [activeTab, priorityFilter]);

  // Load Customers & Products for creation
  const loadPickerData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        mobileApi.listCustomers(),
        mobileApi.listProducts('MAIN_UNIT'),
      ]);
      if (cRes.success && cRes.data) setCustomers(cRes.data);
      if (pRes.success && pRes.data) setProducts(pRes.data);
    } catch (err) {
      console.error('[Load Picker Data Error]', err);
    }
  };

  const handleOpenCreateModal = () => {
    setSelectedCustomer(null);
    setSelectedProduct(null);
    setQuantity('1');
    setPriority('NORMAL');
    setNote('');
    setTentativeDate('');
    loadPickerData();
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async () => {
    if (!selectedCustomer) {
      Alert.alert('Required', 'Please select a customer.');
      return;
    }
    if (!selectedProduct) {
      Alert.alert('Required', 'Please select an AC unit / machine model.');
      return;
    }
    const qNum = parseInt(quantity, 10);
    if (isNaN(qNum) || qNum <= 0) {
      Alert.alert('Required', 'Please enter a valid quantity greater than 0.');
      return;
    }

    if (!isValidDateInput(tentativeDate)) {
      Alert.alert('Invalid date', 'Enter the tentative date as YYYY-MM-DD, or leave it empty.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await mobileApi.createStockRequirement({
        customerId: selectedCustomer.id,
        productId: selectedProduct.id,
        quantity: qNum,
        priority,
        note: note.trim() || undefined,
        tentativeDate: tentativeDate || undefined,
      });

      if (res.success) {
        Alert.alert('Success', 'Stock requirement created successfully.');
        setCreateModalVisible(false);
        fetchRequirements();
      } else {
        Alert.alert('Error', res.message || 'Failed to create stock requirement.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit requirement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status change by Admin
  const handleQuickStatusChange = async (item: any, newStatus: string) => {
    try {
      const res = await mobileApi.changeStockRequirementStatus(item.id, newStatus);
      if (res.success) {
        fetchRequirements();
      } else {
        Alert.alert('Error', res.message || 'Failed to update status.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update status.');
    }
  };

  // Open Edit / Details Modal
  const handleOpenEditModal = (item: any) => {
    setSelectedRequirement(item);
    setEditQuantity(String(item.quantity));
    setEditPriority(item.priority || 'NORMAL');
    setEditStatus(item.status || 'PENDING');
    setEditNote(item.note || '');
    setEditTentativeDate(item.tentativeDate ? String(item.tentativeDate).slice(0, 10) : '');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRequirement) return;
    const qNum = parseInt(editQuantity, 10);
    if (isNaN(qNum) || qNum <= 0) {
      Alert.alert('Required', 'Quantity must be greater than 0.');
      return;
    }
    if (!isValidDateInput(editTentativeDate)) {
      Alert.alert('Invalid date', 'Enter the tentative date as YYYY-MM-DD, or leave it empty.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Update details
      const updateRes = await mobileApi.updateStockRequirement(selectedRequirement.id, {
        quantity: qNum,
        priority: editPriority,
        note: editNote.trim() || undefined,
        tentativeDate: editTentativeDate || null,
      });

      // Update status if changed and user is Admin
      if (isAdmin && editStatus !== selectedRequirement.status) {
        await mobileApi.changeStockRequirementStatus(selectedRequirement.id, editStatus);
      }

      if (updateRes.success) {
        setEditModalVisible(false);
        fetchRequirements();
      } else {
        Alert.alert('Error', updateRes.message || 'Failed to save changes.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update requirement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRequirement = (item: any) => {
    if (!item) return;
    Alert.alert(
      'Delete Stock Request',
      `Are you sure you want to delete this stock request for ${item.customer?.name || 'Customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await mobileApi.deleteStockRequirement(item.id);
              if (res.success) {
                setRequirements((prev) => prev.filter((r) => r.id !== item.id));
                Alert.alert('Deleted', 'Stock request deleted successfully.');
              } else {
                Alert.alert('Error', res.message || 'Failed to delete request.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete request.');
            }
          },
        },
      ]
    );
  };

  // Filtered requirements in UI
  const filteredRequirements = useMemo(() => {
    return requirements.filter((item) => {
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const cName = (item.customer?.name || '').toLowerCase();
        const pName = (item.product?.name || '').toLowerCase();
        const pModel = (item.product?.model || '').toLowerCase();
        const sName = (item.salesUser?.name || '').toLowerCase();
        if (!cName.includes(q) && !pName.includes(q) && !pModel.includes(q) && !sName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [requirements, searchQuery]);

  const renderStatusBadge = (status: string) => {
    let bg = '#FEF3C7';
    let text = '#B45309';
    let icon = '⏳';

    switch (status) {
      case 'ORDERED':
        bg = '#E0F2FE';
        text = '#0369A1';
        icon = '📦';
        break;
      case 'RECEIVED':
        bg = '#EDE9FE';
        text = '#6D28D9';
        icon = '📥';
        break;
      case 'COMPLETED':
        bg = '#D1FAE5';
        text = '#047857';
        icon = '✓';
        break;
      default:
        bg = '#FEF3C7';
        text = '#B45309';
        icon = '⏳';
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusBadgeText, { color: text }]}>
          {icon} {status}
        </Text>
      </View>
    );
  };

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Stock Requirements</Text>
          <Text style={styles.headerSub}>
            {isAdmin ? 'Manage AC order requests for customers' : 'My AC order requests'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.newRequestBtn}
            onPress={handleOpenCreateModal}
            activeOpacity={0.85}
          >
            <Text style={styles.newRequestBtnText}>+ New Request</Text>
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ADMIN TABS */}
      {isAdmin && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'PENDING' && styles.tabBtnActive]}
            onPress={() => setActiveTab('PENDING')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'PENDING' && styles.tabBtnTextActive]}>
              Pending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'ALL' && styles.tabBtnActive]}
            onPress={() => setActiveTab('ALL')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'ALL' && styles.tabBtnTextActive]}>
              All Requirements
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'MY' && styles.tabBtnActive]}
            onPress={() => setActiveTab('MY')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'MY' && styles.tabBtnTextActive]}>
              My Requests
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* SEARCH BAR */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputBox}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search customer, machine, or sales..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: '#94A3B8', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* REQUIREMENTS LIST */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading stock requirements...</Text>
        </View>
      ) : filteredRequirements.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>📦</Text>
          <Text style={styles.emptyTitle}>No stock requirements yet.</Text>
          <Text style={styles.emptySub}>
            {isAdmin
              ? 'When sales representatives request AC units for customers, they will appear here.'
              : 'Tap "+ New Request" to request AC units for your customer.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 80 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchRequirements();
              }}
            />
          }
        >
          {filteredRequirements.map((item) => {
            const urgency = calculateRequirementUrgency(item.requestedAt, item.priority);

            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  urgency.cardBorder ? { borderColor: urgency.cardBorder, borderWidth: 1.5 } : null,
                ]}
              >
                {/* TOP ROW: Customer & Status */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.customerName}>
                      {item.customer?.name || 'Customer'}
                    </Text>
                    <Text style={styles.salesSub}>
                      Requested by <Text style={styles.salesBold}>{item.salesUser?.name || 'Sales'}</Text>
                    </Text>
                  </View>

                  {renderStatusBadge(item.status)}
                </View>

                {/* MACHINE DETAILS */}
                <View style={styles.machineRow}>
                  <View style={styles.machineIconBox}>
                    <Text style={{ fontSize: 20 }}>❄️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.machineTitle}>{item.product?.name || 'AC Unit'}</Text>
                    {item.product?.model && (
                      <Text style={styles.machineModel}>Model: {item.product.model}</Text>
                    )}
                  </View>
                  <View style={styles.qtyBox}>
                    <Text style={styles.qtyLabel}>QTY</Text>
                    <Text style={styles.qtyValue}>{item.quantity}</Text>
                  </View>
                </View>

                {/* NOTE IF PRESENT */}
                {Boolean(item.note) && (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteText}>"{item.note}"</Text>
                  </View>
                )}

                {/* CARD FOOTER: Requested Date & Age Urgency */}
                <View style={styles.cardFooter}>
                  <View style={styles.dateCol}>
                    <Text style={styles.dateLabel}>Requested</Text>
                    <Text style={styles.dateValue}>{formatDateShort(item.requestedAt)}</Text>
                  </View>

                  {Boolean(item.tentativeDate) && (
                    <View style={styles.dateCol}>
                      <Text style={styles.dateLabel}>Tentative</Text>
                      <Text style={styles.dateValue}>{formatTentativeDate(item.tentativeDate)}</Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.urgencyBadge,
                      { backgroundColor: urgency.badgeBg, borderColor: urgency.borderColor },
                    ]}
                  >
                    <Text style={[styles.urgencyBadgeText, { color: urgency.badgeText }]}>
                      {urgency.label}
                    </Text>
                  </View>
                </View>

                {/* ACTION BAR */}
                <View style={styles.cardActions}>
                  {/* Admin Quick Status Steppers */}
                  {isAdmin && item.status === 'PENDING' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#0284C7' }]}
                      onPress={() => handleQuickStatusChange(item, 'ORDERED')}
                    >
                      <Text style={styles.actionBtnText}>Mark Ordered</Text>
                    </TouchableOpacity>
                  )}

                  {isAdmin && item.status === 'ORDERED' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]}
                      onPress={() => handleQuickStatusChange(item, 'RECEIVED')}
                    >
                      <Text style={styles.actionBtnText}>Mark Received</Text>
                    </TouchableOpacity>
                  )}

                  {isAdmin && item.status === 'RECEIVED' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                      onPress={() => handleQuickStatusChange(item, 'COMPLETED')}
                    >
                      <Text style={styles.actionBtnText}>Mark Completed</Text>
                    </TouchableOpacity>
                  )}

                  {/* Edit Button for Admin or Pending Owner */}
                  {(isAdmin || item.status === 'PENDING') && (
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => handleOpenEditModal(item)}
                    >
                      <Text style={styles.editBtnText}>
                        {isAdmin ? 'Manage' : 'Edit'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Delete Button for Admin or Pending Owner */}
                  {(isAdmin || item.status === 'PENDING') && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteRequirement(item)}
                    >
                      <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* CREATE STOCK REQUIREMENT MODAL */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Stock Requirement</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* 1. CUSTOMER SELECTION */}
              <Text style={styles.inputLabel}>1. SELECT CUSTOMER *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setCustomerPickerVisible(true)}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    !selectedCustomer && { color: '#94A3B8' },
                  ]}
                  numberOfLines={1}
                >
                  {selectedCustomer ? `👤 ${selectedCustomer.name}` : 'Select a customer...'}
                </Text>
                <Text style={{ color: '#0066CC', fontWeight: '700' }}>Change ›</Text>
              </TouchableOpacity>

              {/* 2. AC UNIT / MACHINE MODEL */}
              <Text style={styles.inputLabel}>2. SELECT AC UNIT / MODEL *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setProductPickerVisible(true)}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    !selectedProduct && { color: '#94A3B8' },
                  ]}
                  numberOfLines={1}
                >
                  {selectedProduct
                    ? `❄️ ${selectedProduct.name}${selectedProduct.model ? ` (${selectedProduct.model})` : ''}`
                    : 'Select AC unit / model...'}
                </Text>
                <Text style={{ color: '#0066CC', fontWeight: '700' }}>Change ›</Text>
              </TouchableOpacity>

              {/* 3. QUANTITY */}
              <Text style={styles.inputLabel}>3. QUANTITY REQUIRED *</Text>
              <View style={styles.qtyInputRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => {
                    const cur = parseInt(quantity, 10) || 1;
                    if (cur > 1) setQuantity(String(cur - 1));
                  }}
                >
                  <Text style={styles.stepperText}>−</Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.qtyInput}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                />

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => {
                    const cur = parseInt(quantity, 10) || 0;
                    setQuantity(String(cur + 1));
                  }}
                >
                  <Text style={styles.stepperText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* 4. PRIORITY */}
              <Text style={styles.inputLabel}>4. PRIORITY LEVEL</Text>
              <View style={styles.prioritySelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.priorityBtn,
                    priority === 'NORMAL' && styles.priorityBtnActiveNormal,
                  ]}
                  onPress={() => setPriority('NORMAL')}
                >
                  <Text
                    style={[
                      styles.priorityBtnText,
                      priority === 'NORMAL' && styles.priorityBtnTextActive,
                    ]}
                  >
                    Normal
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.priorityBtn,
                    priority === 'URGENT' && styles.priorityBtnActiveUrgent,
                  ]}
                  onPress={() => setPriority('URGENT')}
                >
                  <Text
                    style={[
                      styles.priorityBtnText,
                      priority === 'URGENT' && styles.priorityBtnTextActive,
                    ]}
                  >
                    Urgent
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.priorityBtn,
                    priority === 'EMERGENCY' && styles.priorityBtnActiveEmergency,
                  ]}
                  onPress={() => setPriority('EMERGENCY')}
                >
                  <Text
                    style={[
                      styles.priorityBtnText,
                      priority === 'EMERGENCY' && styles.priorityBtnTextActive,
                    ]}
                  >
                    🚨 Emergency
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 5. TENTATIVE DATE */}
              <Text style={styles.inputLabel}>5. TENTATIVE DATE (OPTIONAL)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                value={tentativeDate}
                onChangeText={(t) => setTentativeDate(maskDateInput(t))}
              />

              {/* 6. OPTIONAL NOTE */}
              <Text style={styles.inputLabel}>6. OPTIONAL NOTE</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="e.g. Required for installation next week."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={note}
                onChangeText={setNote}
              />

              {/* SUBMIT BUTTON */}
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleCreateSubmit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? 'Submitting...' : 'Submit Stock Requirement'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomerPickerSheet
        visible={customerPickerVisible}
        onClose={() => setCustomerPickerVisible(false)}
        onSelect={(c) => {
          if (c) {
            setSelectedCustomer(c);
            setCustomers((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
          }
          setCustomerPickerVisible(false);
        }}
      />

      {/* PRODUCT PICKER SUB-MODAL */}
      <Modal
        visible={productPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProductPickerVisible(false)}
      >
        <View style={styles.subModalOverlay}>
          <View style={styles.subModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select AC Unit</Text>
              <TouchableOpacity onPress={() => setProductPickerVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.subModalSearch}
              placeholder="Search AC model or brand..."
              placeholderTextColor="#94A3B8"
              value={productSearch}
              onChangeText={setProductSearch}
            />

            <ScrollView style={{ maxHeight: 380 }}>
              {products
                .filter((p) =>
                  productSearch.trim().length === 0
                    ? true
                    : (p.name || '').toLowerCase().includes(productSearch.toLowerCase()) ||
                    (p.model || '').toLowerCase().includes(productSearch.toLowerCase())
                )
                .map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      setSelectedProduct(p);
                      setProductPickerVisible(false);
                    }}
                  >
                    <Text style={styles.pickerItemTitle}>{p.name}</Text>
                    {p.model && <Text style={styles.pickerItemSub}>Model: {p.model}</Text>}
                    <Text style={[styles.pickerItemSub, { color: '#0066CC' }]}>
                      Available Stock: {p.availableStock ?? 0}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ADMIN EDIT / MANAGE MODAL */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAdmin ? 'Manage Requirement' : 'Edit Requirement'}
              </Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedRequirement && (
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryLabel}>Customer</Text>
                  <Text style={styles.summaryValue}>
                    {selectedRequirement.customer?.name || 'Customer'}
                  </Text>

                  <Text style={[styles.summaryLabel, { marginTop: 6 }]}>AC Unit</Text>
                  <Text style={styles.summaryValue}>
                    {selectedRequirement.product?.name || 'AC Unit'}
                  </Text>

                  <Text style={[styles.summaryLabel, { marginTop: 6 }]}>Sales Person</Text>
                  <Text style={styles.summaryValue}>
                    {selectedRequirement.salesUser?.name || 'Sales'}
                  </Text>

                  {Boolean(selectedRequirement.tentativeDate) && (
                    <>
                      <Text style={[styles.summaryLabel, { marginTop: 6 }]}>Tentative Date</Text>
                      <Text style={styles.summaryValue}>{formatTentativeDate(selectedRequirement.tentativeDate)}</Text>
                    </>
                  )}
                </View>
              )}

              {/* STATUS (ADMIN ONLY) */}
              {isAdmin && (
                <>
                  <Text style={styles.inputLabel}>STATUS</Text>
                  <View style={styles.statusSelectRow}>
                    {['PENDING', 'ORDERED', 'RECEIVED', 'COMPLETED'].map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.statusSelectBtn,
                          editStatus === st && styles.statusSelectBtnActive,
                        ]}
                        onPress={() => setEditStatus(st)}
                      >
                        <Text
                          style={[
                            styles.statusSelectBtnText,
                            editStatus === st && styles.statusSelectBtnTextActive,
                          ]}
                        >
                          {st}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* QUANTITY */}
              <Text style={styles.inputLabel}>QUANTITY</Text>
              <TextInput
                style={styles.inputField}
                keyboardType="numeric"
                value={editQuantity}
                onChangeText={setEditQuantity}
              />

              {/* PRIORITY */}
              <Text style={styles.inputLabel}>PRIORITY</Text>
              <View style={styles.prioritySelectorRow}>
                {['NORMAL', 'URGENT', 'EMERGENCY'].map((pr) => (
                  <TouchableOpacity
                    key={pr}
                    style={[
                      styles.priorityBtn,
                      editPriority === pr && styles.priorityBtnActiveNormal,
                    ]}
                    onPress={() => setEditPriority(pr)}
                  >
                    <Text
                      style={[
                        styles.priorityBtnText,
                        editPriority === pr && styles.priorityBtnTextActive,
                      ]}
                    >
                      {pr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* TENTATIVE DATE */}
              <Text style={styles.inputLabel}>TENTATIVE DATE</Text>
              <TextInput
                style={styles.inputField}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                value={editTentativeDate}
                onChangeText={(t) => setEditTentativeDate(maskDateInput(t))}
              />

              {/* NOTE */}
              <Text style={styles.inputLabel}>NOTE</Text>
              <TextInput
                style={styles.noteInput}
                multiline
                numberOfLines={3}
                value={editNote}
                onChangeText={setEditNote}
              />

              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
                onPress={handleSaveEdit}
                disabled={isSubmitting}
              >
                <Text style={styles.submitBtnText}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>

              {(isAdmin || selectedRequirement?.status === 'PENDING') && (
                <TouchableOpacity
                  style={[styles.modalDeleteBtn, isSubmitting && { opacity: 0.6 }]}
                  onPress={() => {
                    const toDelete = selectedRequirement;
                    setEditModalVisible(false);
                    handleDeleteRequirement(toDelete);
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalDeleteBtnText}>🗑 Delete Stock Request</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  newRequestBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  newRequestBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  tabBtnActive: {
    backgroundColor: '#0066CC',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  salesSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  salesBold: {
    fontWeight: '700',
    color: '#334155',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  machineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  machineIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  machineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  machineModel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  qtyBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qtyLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0066CC',
  },
  noteBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  noteText: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dateCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  dateValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  urgencyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  editBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  modalDeleteBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  modalDeleteBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  // MODALS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  selectorBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorBtnText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
  },
  qtyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  qtyInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  prioritySelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  priorityBtnActiveNormal: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  priorityBtnActiveUrgent: {
    backgroundColor: '#EA580C',
    borderColor: '#EA580C',
  },
  priorityBtnActiveEmergency: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  priorityBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  priorityBtnTextActive: {
    color: '#FFFFFF',
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  // SUB MODAL
  subModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  subModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
  },
  subModalSearch: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 12,
    color: '#0F172A',
  },
  pickerItem: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 1,
  },
  statusSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusSelectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  statusSelectBtnActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  statusSelectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  statusSelectBtnTextActive: {
    color: '#FFFFFF',
  },
  inputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
  },
});

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi, getAuthToken, getActiveEmployeeId } from '../services/api';
import { dataCache } from '../services/dataCache';
import { downloadAndSaveFile, shareDocument } from '../services/fileDownloader';
import { CataloguePreviewModal } from './CataloguePreviewModal';

interface CataloguesScreenProps {
  userRole?: string;
  onClose?: () => void;
}

const ADMIN_MANAGEMENT_ROLES = ['ADMIN', 'MANAGER', 'IT_ADMIN'];

type CategoryFilter = 'ALL' | 'CATALOGUE' | 'BROCHURE' | 'PRODUCT_GUIDE';

export const CataloguesScreen: React.FC<CataloguesScreenProps> = ({
  userRole = 'TECHNICIAN',
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const isAdmin = ADMIN_MANAGEMENT_ROLES.includes(userRole.toUpperCase());

  // Cache-first: initialize with cached data for instant 0ms rendering
  const [catalogues, setCatalogues] = useState<any[]>(() => {
    return dataCache.get<any>('catalogues:ALL:')?.data || [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => catalogues.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeDownloadingId, setActiveDownloadingId] = useState<string | null>(null);
  const [activeSharingId, setActiveSharingId] = useState<string | null>(null);

  // Preview Modal
  const [previewModalVisible, setPreviewModalVisible] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<any | null>(null);

  // Rename Modal (Admin Only)
  const [renameModalVisible, setRenameModalVisible] = useState<boolean>(false);
  const [selectedCatalogue, setSelectedCatalogue] = useState<any | null>(null);
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  const fetchCatalogues = async (forceRefresh: boolean = false) => {
    try {
      if (forceRefresh && catalogues.length === 0) setIsLoading(true);
      const res = await mobileApi.getCachedCatalogues(
        selectedCategory,
        searchQuery || undefined,
        {
          forceRefresh,
          onBackgroundUpdate: (fresh) => {
            if (fresh && fresh.success && Array.isArray(fresh.data)) {
              setCatalogues(fresh.data);
            }
          },
        }
      );
      if (res && res.success && Array.isArray(res.data)) {
        setCatalogues(res.data);
      }
    } catch (err) {
      console.error('[Fetch Catalogues Error]', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCatalogues(false);
  }, [selectedCategory]);

  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getHeaders = (): Record<string, string> => {
    const token = getAuthToken();
    const empId = getActiveEmployeeId();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(empId ? { 'x-employee-id': empId } : {}),
    };
  };

  // Download PDF
  const handleDownload = async (item: any) => {
    const cleanName = item.displayName || 'AC_Catalogue';
    const pdfUrl = mobileApi.getCataloguePdfUrl(item.id, cleanName);

    try {
      setActiveDownloadingId(item.id);
      const res = await downloadAndSaveFile({
        url: pdfUrl,
        rawFilename: cleanName,
        extension: 'pdf',
        mimeType: 'application/pdf',
        headers: getHeaders(),
        dialogTitle: `Save ${cleanName}`,
        showShareFallbackOnAndroid: true,
      });

      if (!res.success && res.error) {
        Alert.alert('Download Error', res.error);
      } else if (res.success) {
        Alert.alert('Success', `Catalogue PDF has been downloaded successfully.`);
      }
    } catch (err: any) {
      console.error('[Download Catalogue Error]', err);
      Alert.alert('Download Error', err.message || 'Failed to download PDF.');
    } finally {
      setActiveDownloadingId(null);
    }
  };

  // Share PDF
  const handleShare = async (item: any) => {
    const cleanName = item.displayName || 'AC_Catalogue';
    const pdfUrl = mobileApi.getCataloguePdfUrl(item.id, cleanName);

    try {
      setActiveSharingId(item.id);
      const res = await shareDocument({
        url: pdfUrl,
        rawFilename: cleanName,
        extension: 'pdf',
        mimeType: 'application/pdf',
        headers: getHeaders(),
      });

      if (!res.success && res.error) {
        Alert.alert('Share Error', res.error);
      }
    } catch (err: any) {
      console.error('[Share Catalogue Error]', err);
      Alert.alert('Share Error', err.message || 'Failed to open share sheet.');
    } finally {
      setActiveSharingId(null);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (item: any) => {
    setPreviewItem(item);
    setPreviewModalVisible(true);
  };

  // Admin Rename
  const handleOpenRename = (item: any) => {
    setSelectedCatalogue(item);
    setNewDisplayName(item.displayName || '');
    setRenameModalVisible(true);
  };

  const handleSaveRename = async () => {
    if (!selectedCatalogue) return;
    const trimmed = newDisplayName.trim();
    if (trimmed.length === 0) {
      Alert.alert('Required', 'Please enter a valid catalogue name.');
      return;
    }

    try {
      setIsRenaming(true);
      const res = await mobileApi.renameCatalogue(selectedCatalogue.id, {
        displayName: trimmed,
      });

      if (res.success) {
        Alert.alert('Success', 'Catalogue renamed successfully.');
        setRenameModalVisible(false);
        fetchCatalogues();
      } else {
        Alert.alert('Error', res.message || 'Failed to rename catalogue.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to rename catalogue.');
    } finally {
      setIsRenaming(false);
    }
  };

  // Admin Delete Document
  const handleDeleteCatalogue = (item: any) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to permanently delete "${item.displayName || 'this document'}"? It will be removed from all employee devices.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await mobileApi.deleteCatalogue(item.id);
              if (res.success) {
                setCatalogues((prev) => prev.filter((c) => c.id !== item.id));
                if (previewItem?.id === item.id) {
                  setPreviewModalVisible(false);
                }
                Alert.alert('Deleted', 'Document deleted successfully.');
              } else {
                Alert.alert('Error', res.message || 'Failed to delete document.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete document.');
            }
          },
        },
      ]
    );
  };

  const filteredCatalogues = catalogues.filter((item) => {
    if (searchQuery.trim().length === 0) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (item.displayName || '').toLowerCase().includes(q);
    const modelMatch = (item.model || '').toLowerCase().includes(q);
    const fileMatch = (item.fileName || '').toLowerCase().includes(q);
    const descMatch = (item.description || '').toLowerCase().includes(q);
    return nameMatch || modelMatch || fileMatch || descMatch;
  });

  const getCategoryBadgeStyle = (cat: string) => {
    const c = (cat || 'CATALOGUE').toUpperCase();
    if (c === 'BROCHURE') {
      return { bg: '#F3E8FF', text: '#7E22CE', border: '#D8B4FE' };
    }
    if (c === 'PRODUCT_GUIDE' || c === 'PRODUCT DOCUMENT') {
      return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' };
    }
    return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Catalogues & Brochures</Text>
          <Text style={styles.headerSub}>
            Product specifications, catalogues & technical guides
          </Text>
        </View>

        <View style={styles.headerActions}>

          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CATEGORY TABS */}
      <View style={styles.categoryScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          <TouchableOpacity
            style={[styles.categoryTab, selectedCategory === 'ALL' && styles.categoryTabActive]}
            onPress={() => setSelectedCategory('ALL')}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategory === 'ALL' && styles.categoryTabTextActive,
              ]}
            >
              All Documents
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryTab,
              selectedCategory === 'CATALOGUE' && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory('CATALOGUE')}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategory === 'CATALOGUE' && styles.categoryTabTextActive,
              ]}
            >
              📖 Catalogues
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryTab,
              selectedCategory === 'BROCHURE' && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory('BROCHURE')}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategory === 'BROCHURE' && styles.categoryTabTextActive,
              ]}
            >
              📰 Brochures
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.categoryTab,
              selectedCategory === 'PRODUCT_GUIDE' && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory('PRODUCT_GUIDE')}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategory === 'PRODUCT_GUIDE' && styles.categoryTabTextActive,
              ]}
            >
              ⚙️ Product Guides
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputBox}>
          <Text style={{ fontSize: 16, marginRight: 6 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, model, or description..."
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

      {/* CATALOGUES LIST */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      ) : filteredCatalogues.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>📚</Text>
          <Text style={styles.emptyTitle}>No documents found.</Text>
          <Text style={styles.emptySub}>
            {searchQuery.length > 0
              ? 'No documents match your search query.'
              : 'Product catalogues will appear here once uploaded by Admin.'}
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
                fetchCatalogues();
              }}
            />
          }
        >
          {filteredCatalogues.map((item) => {
            const isDownloading = activeDownloadingId === item.id;
            const isSharing = activeSharingId === item.id;
            const sizeStr = formatFileSize(item.fileSize);
            const badgeTheme = getCategoryBadgeStyle(item.category);

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => handleOpenPreview(item)}
                activeOpacity={0.88}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.pdfIconBox}>
                    <Text style={{ fontSize: 24 }}>📄</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.catalogueTitle} numberOfLines={2}>
                      {item.displayName || 'AC Document'}
                    </Text>

                    <View style={styles.metaRow}>
                      <View
                        style={[
                          styles.catBadgeSmall,
                          { backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border },
                        ]}
                      >
                        <Text style={[styles.catBadgeSmallText, { color: badgeTheme.text }]}>
                          {(item.category || 'CATALOGUE').replace('_', ' ')}
                        </Text>
                      </View>

                      {item.model && (
                        <View style={styles.modelTag}>
                          <Text style={styles.modelTagText}>{item.model}</Text>
                        </View>
                      )}
                      {sizeStr.length > 0 && (
                        <Text style={styles.sizeText}>{sizeStr}</Text>
                      )}
                    </View>
                  </View>
                </View>

                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                {/* ACTION BUTTONS */}
                <View style={styles.cardActions}>
                  {/* Download */}
                  <TouchableOpacity
                    style={[styles.btn, styles.downloadBtn]}
                    onPress={() => handleDownload(item)}
                    disabled={isDownloading || isSharing}
                    activeOpacity={0.8}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#0066CC" />
                    ) : (
                      <>
                        <Text style={{ fontSize: 13, marginRight: 4 }}>⬇️</Text>
                        <Text style={styles.downloadBtnText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Share */}
                  <TouchableOpacity
                    style={[styles.btn, styles.shareBtn]}
                    onPress={() => handleShare(item)}
                    disabled={isDownloading || isSharing}
                    activeOpacity={0.8}
                  >
                    {isSharing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={{ fontSize: 13, marginRight: 4 }}>↗️</Text>
                        <Text style={styles.shareBtnText}>Share</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Admin Rename */}
                  {isAdmin && (
                    <TouchableOpacity
                      style={[styles.btn, styles.renameBtn]}
                      onPress={() => handleOpenRename(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 13, marginRight: 4 }}>✏️</Text>
                      <Text style={styles.renameBtnText}>Rename</Text>
                    </TouchableOpacity>
                  )}

                  {/* Admin Delete */}
                  {isAdmin && (
                    <TouchableOpacity
                      style={[styles.btn, styles.deleteBtn]}
                      onPress={() => handleDeleteCatalogue(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 13, marginRight: 4 }}>🗑</Text>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* DEDICATED PREVIEW MODAL */}
      <CataloguePreviewModal
        visible={previewModalVisible}
        catalogue={previewItem}
        onClose={() => setPreviewModalVisible(false)}
        onDownload={handleDownload}
        onShare={handleShare}
        isDownloading={previewItem ? activeDownloadingId === previewItem.id : false}
        isSharing={previewItem ? activeSharingId === previewItem.id : false}
      />

      {/* ADMIN RENAME MODAL */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rename Catalogue</Text>
              <TouchableOpacity onPress={() => setRenameModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalNotice}>
              This name is stored centrally in the database and will update for all employees across the application.
            </Text>

            <Text style={styles.inputLabel}>CATALOGUE DISPLAY NAME</Text>
            <TextInput
              style={styles.modalInput}
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              placeholder="e.g. Daikin 1.5 Ton Inverter Catalogue"
              placeholderTextColor="#94A3B8"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, isRenaming && { opacity: 0.6 }]}
                onPress={handleSaveRename}
                disabled={isRenaming}
              >
                <Text style={styles.saveBtnText}>
                  {isRenaming ? 'Saving...' : 'Save Name'}
                </Text>
              </TouchableOpacity>
            </View>
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
  categoryScrollContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  categoryTabActive: {
    backgroundColor: '#0066CC',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
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
    alignItems: 'flex-start',
    gap: 12,
  },
  pdfIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  catalogueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  catBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  catBadgeSmallText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modelTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modelTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  sizeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    lineHeight: 16,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  downloadBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  downloadBtnText: {
    color: '#0066CC',
    fontSize: 12,
    fontWeight: '700',
  },
  shareBtn: {
    backgroundColor: '#0066CC',
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  renameBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  renameBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  modalNotice: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // FILE PICKER BOX
  filePickerBox: {
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  filePickerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    textAlign: 'center',
  },
  filePickerSize: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 4,
    fontWeight: '600',
  },
  filePickerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  catSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  catOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  catOptionBtnActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  catOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  catOptionTextActive: {
    color: '#FFFFFF',
  },
});

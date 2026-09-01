import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Quotation } from '../types';
import { mobileApi, getAuthToken, getActiveEmployeeId } from '../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { downloadAndSaveFile, shareDocument } from '../services/fileDownloader';

interface QuotationPreviewScreenProps {
  quotation: Quotation | null;
  onClose: () => void;
  onEdit?: () => void;
}

export const QuotationPreviewScreen: React.FC<QuotationPreviewScreenProps> = ({
  quotation,
  onClose,
  onEdit,
}) => {
  const insets = useSafeAreaInsets();
  const [currentQuote, setCurrentQuote] = useState<Quotation | null>(quotation);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

  // Filename Customization Modal State (Requirement 2)
  const [filenameModalVisible, setFilenameModalVisible] = useState<boolean>(false);
  const [filenameModalMode, setFilenameModalMode] = useState<'DOWNLOAD' | 'SHARE'>('DOWNLOAD');
  const [customFilename, setCustomFilename] = useState<string>('');

  useEffect(() => {
    setCurrentQuote(quotation);
    if (quotation && (!quotation.items || quotation.items.length === 0)) {
      setIsLoadingDetails(true);
      mobileApi
        .getQuotation(quotation.id)
        .then((res) => {
          if (res.success && res.data) {
            setCurrentQuote(res.data);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingDetails(false));
    }
  }, [quotation?.id]);

  if (!currentQuote) return null;

  const getDefaultFilename = () => {
    const safeQuoteNum = (currentQuote.quotationNumber || 'quote').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanCust = currentQuote.customerName ? currentQuote.customerName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : '';
    return cleanCust ? `ECDIAL_${cleanCust}_${safeQuoteNum}` : `ECDIAL_Quotation_${safeQuoteNum}`;
  };

  const sanitizeFilename = (name: string) => {
    let clean = (name || '').trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\.pdf$/i, '');
    clean = clean.replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!clean || clean.toLowerCase() === 'undefined' || clean.toLowerCase() === 'null') {
      return getDefaultFilename();
    }
    return clean;
  };

  const handleOpenDownloadModal = () => {
    setCustomFilename(getDefaultFilename());
    setFilenameModalMode('DOWNLOAD');
    setFilenameModalVisible(true);
  };

  const handleOpenShareModal = () => {
    setCustomFilename(getDefaultFilename());
    setFilenameModalMode('SHARE');
    setFilenameModalVisible(true);
  };

  const handleConfirmFilenameAction = async () => {
    const rawName = customFilename.trim();
    const cleanName = sanitizeFilename(rawName);
    setFilenameModalVisible(false);

    const pdfUrl = mobileApi.getPdfUrl(currentQuote.id);
    const token = getAuthToken();
    const empId = getActiveEmployeeId();
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(empId ? { 'x-employee-id': empId } : {}),
    };

    if (filenameModalMode === 'DOWNLOAD') {
      setIsDownloading(true);
      try {
        const result = await downloadAndSaveFile({
          url: pdfUrl,
          rawFilename: cleanName,
          extension: 'pdf',
          mimeType: 'application/pdf',
          headers,
          dialogTitle: `Save Quotation (${cleanName}.pdf)`,
          showShareFallbackOnAndroid: true,
        });

        if (result.success && result.uri) {
          Alert.alert(
            '✓ Quotation downloaded',
            `${result.filename} is saved on your device.`,
            [
              {
                text: 'Open / View PDF',
                onPress: async () => {
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(result.uri!, {
                      mimeType: 'application/pdf',
                      dialogTitle: `${result.filename}`,
                      UTI: 'com.adobe.pdf',
                    });
                  }
                },
              },
              { text: 'OK', style: 'cancel' },
            ]
          );
        } else {
          Alert.alert('Download Failed', result.error || 'Unable to download quotation. Please check server connection.');
        }
      } catch (err: any) {
        Alert.alert('Download Error', err.message || 'Unable to download quotation PDF.');
      } finally {
        setIsDownloading(false);
      }
    } else {
      // SHARE mode
      setIsSharing(true);
      try {
        const shareResult = await shareDocument({
          url: pdfUrl,
          rawFilename: cleanName,
          extension: 'pdf',
          mimeType: 'application/pdf',
          headers,
        });

        if (!shareResult.success && shareResult.error) {
          Alert.alert('Share Failed', shareResult.error);
        }
      } catch (err: any) {
        console.error('[Share Error]', err);
        if (err.message && !err.message.includes('dismissed') && !err.message.includes('cancel')) {
          Alert.alert('Share Error', err.message || 'Sharing error');
        }
      } finally {
        setIsSharing(false);
      }
    }
  };

  const handleDeleteQuotation = () => {
    Alert.alert(
      'Delete quotation?',
      `Are you sure you want to delete quotation ${currentQuote.quotationNumber}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await mobileApi.deleteQuotation(currentQuote.id);
              if (res.success) {
                Alert.alert('Success', 'Quotation deleted successfully.');
                onClose();
              } else {
                Alert.alert('Error', res.message || 'Failed to delete quotation.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete quotation.');
            }
          },
        },
      ]
    );
  };

  const mainItems = currentQuote.items?.filter((i) => i.section === 'MAIN_UNIT') || [];
  const lowSideItems = currentQuote.items?.filter((i) => i.section === 'LOW_SIDE') || [];

  return (
    <View style={styles.container}>
      {/* Top Header with Safe Top Inset */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Quotation Offer</Text>
          <Text style={styles.subtitle}>{currentQuote.quotationNumber} • {currentQuote.date}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onEdit && (
            <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
              <Text style={styles.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteHeaderBtn} onPress={handleDeleteQuotation}>
            <Text style={styles.deleteHeaderBtnText}>🗑️ Delete</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={styles.closeIconBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingDetails && (
          <ActivityIndicator size="small" color="#0066CC" style={{ marginBottom: 10 }} />
        )}

        {/* Official Printable Sheet (Preserving Daikin ECDIAL Design) */}
        <View style={styles.previewSheet}>
          {/* 1. FIXED HEADER IMAGE ASSET */}
          <View style={styles.fixedHeaderContainer}>
            <Image
              source={require('../../assets/quotation_header.png')}
              style={styles.fixedHeaderImg}
              resizeMode="contain"
            />
          </View>

          {/* 2. DYNAMIC CUSTOMER & QUOTATION SUMMARY ROW */}
          <View style={styles.customerSummaryRow}>
            {/* Customer Box (Omitted if no customer name) */}
            {currentQuote.customerName && currentQuote.customerName.trim().length > 0 ? (
              <View style={styles.toBox}>
                <Text style={styles.toLabel}>To,</Text>
                <Text style={styles.customerNameText}>{currentQuote.customerName}</Text>
                {currentQuote.customerAddress && currentQuote.customerAddress.trim().length > 0 ? (
                  <Text style={styles.customerAddressText}>📍 {currentQuote.customerAddress}</Text>
                ) : null}
                {currentQuote.customerPhone ? (
                  <Text style={styles.customerPhoneText}>Phone: {currentQuote.customerPhone}</Text>
                ) : null}
                {currentQuote.customerEmail ? (
                  <Text style={styles.customerPhoneText}>Email: {currentQuote.customerEmail}</Text>
                ) : null}
              </View>
            ) : (
              <View style={[styles.toBox, { backgroundColor: 'transparent', borderColor: 'transparent' }]} />
            )}

            {/* Quotation Details Card */}
            <View style={styles.quoteCard}>
              <View style={styles.quoteCardHeader}>
                <Text style={styles.quoteCardHeaderText}>QUOTATION</Text>
              </View>
              <View style={styles.quoteCardMeta}>
                <Text style={styles.quoteCardDate}>Date: {currentQuote.date}</Text>
                <Text style={styles.quoteCardNum}>{currentQuote.quotationNumber}</Text>
              </View>

              <View style={styles.quoteCardBody}>
                <View style={styles.rowBetween}>
                  <Text style={styles.quoteCardLabel}>Sub Total (A)</Text>
                  <Text style={styles.quoteCardVal}>
                    ₹{Number(currentQuote.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.quoteCardLabel}>CGST {currentQuote.cgstPercent}%</Text>
                  <Text style={styles.quoteCardVal}>
                    ₹{Number(currentQuote.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.quoteCardLabel}>SGST {currentQuote.sgstPercent}%</Text>
                  <Text style={styles.quoteCardVal}>
                    ₹{Number(currentQuote.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              <View style={styles.quoteCardFooter}>
                <Text style={styles.quoteTotalLabel}>TOTAL (A)</Text>
                <Text style={styles.quoteTotalVal}>
                  ₹{Number(currentQuote.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          {/* 3. DYNAMIC SECTION A: MAIN UNIT TABLE */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>A</Text></View>
            <Text style={styles.sectionTitle}>MAIN UNITS</Text>
            {mainItems.length > 0 && (
              <Text style={styles.itemCountBadgeText}> ( {mainItems.length} ITEMS )</Text>
            )}
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.tableBox}>
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, { width: 28, textAlign: 'center' }]}>SL.No</Text>
              <Text style={[styles.thText, { flex: 1 }]}>Description</Text>
              <Text style={[styles.thText, { width: 32, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.thText, { width: 34, textAlign: 'center' }]}>Unit</Text>
              <Text style={[styles.thText, { width: 68, textAlign: 'right' }]}>Price (₹)</Text>
              <Text style={[styles.thText, { width: 72, textAlign: 'right' }]}>Amount (₹)</Text>
            </View>

            {mainItems.length === 0 ? (
              <View style={{ padding: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#64748B' }}>No main units specified.</Text>
              </View>
            ) : (
              mainItems.map((item, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#F9FBFC' }]}>
                  <Text style={[styles.tdText, { width: 28, textAlign: 'center', color: '#64748B' }]}>{idx + 1}</Text>
                  <Text style={[styles.tdText, { flex: 1, fontWeight: '700', color: '#0A1E3F' }]}>{item.description}</Text>
                  <Text style={[styles.tdText, { width: 32, textAlign: 'center' }]}>{item.quantity}</Text>
                  <Text style={[styles.tdText, { width: 34, textAlign: 'center' }]}>{item.unit}</Text>
                  <Text style={[styles.tdText, { width: 68, textAlign: 'right', color: '#334155' }]}>
                    {Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.tdText, { width: 72, textAlign: 'right', fontWeight: '800', color: '#0F172A' }]}>
                    {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))
            )}

            {/* Total (A) Subtotal Row */}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Total (A)</Text>
              <Text style={styles.subtotalVal}>
                ₹{Number(currentQuote.mainUnitTotal || mainItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* 4. DYNAMIC SECTION B: LOW SIDE EXTRA MATERIALS */}
          {currentQuote.hasLowSide && lowSideItems.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>B</Text></View>
                <Text style={styles.sectionTitle}>LOW SIDE (B) IF NEED EXTRA MATERIALS</Text>
                <Text style={styles.itemCountBadgeText}> ( {lowSideItems.length} ITEMS )</Text>
                <View style={styles.sectionLine} />
              </View>

              <View style={styles.tableBox}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.thText, { width: 28, textAlign: 'center' }]}>SL.No</Text>
                  <Text style={[styles.thText, { flex: 1 }]}>Description</Text>
                  <Text style={[styles.thText, { width: 32, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.thText, { width: 34, textAlign: 'center' }]}>Unit</Text>
                  <Text style={[styles.thText, { width: 68, textAlign: 'right' }]}>Price (₹)</Text>
                  <Text style={[styles.thText, { width: 72, textAlign: 'right' }]}>Amount (₹)</Text>
                </View>

                {lowSideItems.map((item, idx) => (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#F9FBFC' }]}>
                    <Text style={[styles.tdText, { width: 28, textAlign: 'center', color: '#64748B' }]}>{idx + 1}</Text>
                    <Text style={[styles.tdText, { flex: 1, color: '#334155' }]}>{item.description}</Text>
                    <Text style={[styles.tdText, { width: 32, textAlign: 'center' }]}>{item.quantity}</Text>
                    <Text style={[styles.tdText, { width: 34, textAlign: 'center' }]}>{item.unit}</Text>
                    <Text style={[styles.tdText, { width: 68, textAlign: 'right', color: '#334155' }]}>
                      {Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.tdText, { width: 72, textAlign: 'right', fontWeight: '800', color: '#0F172A' }]}>
                      {Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}

                {/* Total (B) Subtotal Row */}
                <View style={styles.subtotalRow}>
                  <Text style={styles.subtotalLabel}>Total (B)</Text>
                  <Text style={styles.subtotalVal}>
                    ₹{Number(currentQuote.lowSideTotal || lowSideItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 5. MULTI-PAGE NOTE OR CONTINUATION (If large quotation) */}
          {mainItems.length >= 4 && (
            <View style={styles.continuationNoteBox}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.noteTag}>NOTE:</Text>
                <Text style={styles.noteText} numberOfLines={2}>
                  Low side / additional materials (If added), Terms & Conditions, Payment Method & Other details on next page.
                </Text>
              </View>
              <Text style={styles.continuationText}>Continued on next page →</Text>
            </View>
          )}

          {/* 6. FIXED TERMS & CONDITIONS + PAYMENT METHOD IMAGE ASSET */}
          <View style={styles.fixedTermsContainer}>
            <Image
              source={require('../../assets/quotation_terms_payment.png')}
              style={styles.fixedTermsPaymentImg}
              resizeMode="contain"
            />
          </View>

          {/* 7. FIXED FOOTER IMAGE ASSET */}
          <View style={styles.fixedFooterContainer}>
            <Image
              source={require('../../assets/quotation_footer.png')}
              style={styles.fixedFooterImg}
              resizeMode="contain"
            />
          </View>
        </View>
      </ScrollView>

      {/* Fixed Sticky Action Bar at Bottom with Safe Bottom Inset */}
      <View style={[styles.stickyFooterBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity
          style={[styles.downloadBtn, isDownloading && { opacity: 0.7 }]}
          onPress={handleOpenDownloadModal}
          disabled={isDownloading || isSharing}
        >
          {isDownloading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.btnTextWhite}>📥 Download PDF</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shareBtn, isSharing && { opacity: 0.7 }]}
          onPress={handleOpenShareModal}
          disabled={isDownloading || isSharing}
        >
          {isSharing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.btnTextWhite}>📤 Share PDF</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Filename Customization Modal */}
      <Modal visible={filenameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {filenameModalMode === 'DOWNLOAD' ? 'SAVE QUOTATION AS' : 'SHARE QUOTATION AS'}
              </Text>
              <TouchableOpacity onPress={() => setFilenameModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Specify filename for this PDF export. The .pdf extension is added automatically.
            </Text>

            <Text style={styles.inputLabel}>Filename</Text>
            <View style={styles.filenameInputContainer}>
              <TextInput
                style={styles.filenameInput}
                value={customFilename}
                onChangeText={setCustomFilename}
                placeholder="ECDIAL_Quotation_001"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.extensionBadge}>
                <Text style={styles.extensionBadgeText}>.pdf</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setFilenameModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, (isDownloading || isSharing) && { opacity: 0.7 }]}
                onPress={handleConfirmFilenameAction}
                disabled={isDownloading || isSharing}
              >
                {isDownloading || isSharing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>
                    {filenameModalMode === 'DOWNLOAD' ? 'Download' : 'Share'}
                  </Text>
                )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  editBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editBtnText: {
    color: '#0066CC',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteHeaderBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteHeaderBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 110,
  },
  stickyFooterBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  previewSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  fixedHeaderContainer: {
    width: '100%',
    aspectRatio: 637 / 119,
    marginBottom: 12,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fixedHeaderImg: {
    width: '100%',
    height: '100%',
  },
  fixedTermsContainer: {
    width: '100%',
    aspectRatio: 572 / 176,
    marginTop: 14,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fixedTermsPaymentImg: {
    width: '100%',
    height: '100%',
  },
  fixedFooterContainer: {
    width: '100%',
    aspectRatio: 1024 / 106,
    marginTop: 12,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fixedFooterImg: {
    width: '100%',
    height: '100%',
  },
  customerSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  toBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toLabel: {
    fontSize: 11,
    color: '#0072BC',
    fontWeight: '700',
  },
  customerNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E2A3C',
    marginTop: 2,
  },
  customerAddressText: {
    fontSize: 10.5,
    color: '#5B6B84',
    marginTop: 2,
  },
  customerPhoneText: {
    fontSize: 10,
    color: '#5B6B84',
    marginTop: 2,
  },
  quoteCard: {
    width: 165,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCE6EF',
  },
  quoteCardHeader: {
    backgroundColor: '#005A96',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  quoteCardHeaderText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  quoteCardMeta: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#DCE6EF',
  },
  quoteCardDate: {
    color: '#5B6B84',
    fontSize: 8,
    fontWeight: '600',
  },
  quoteCardNum: {
    color: '#5B6B84',
    fontSize: 8,
    fontWeight: '600',
  },
  quoteCardBody: {
    backgroundColor: '#FFFFFF',
    padding: 6,
    gap: 3,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteCardLabel: {
    fontSize: 9,
    color: '#5B6B84',
  },
  quoteCardVal: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1E2A3C',
  },
  quoteCardFooter: {
    backgroundColor: '#0072BC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  quoteTotalLabel: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  quoteTotalVal: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionBadge: {
    backgroundColor: '#0072BC',
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#005A96',
  },
  itemCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EA580C',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#DCE6EF',
  },
  tableBox: {
    borderWidth: 1,
    borderColor: '#DCE6EF',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0A1E3F',
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  thText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  tdText: {
    fontSize: 9.5,
    color: '#0F172A',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderColor: '#CBD5E1',
  },
  subtotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtotalVal: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  continuationNoteBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 6,
    padding: 8,
    marginTop: 12,
    gap: 8,
  },
  noteTag: {
    fontSize: 9,
    fontWeight: '900',
    color: '#EA580C',
  },
  noteText: {
    fontSize: 8.5,
    color: '#7C2D12',
    flex: 1,
  },
  continuationText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0A1E3F',
  },
  termsPaymentCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  boxTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  boxBody: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 14,
  },
  shieldBadge: {
    backgroundColor: '#EFF6FF',
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  shieldText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0066CC',
  },
  footerBanner: {
    backgroundColor: '#0A1E3F',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  footerBannerText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  downloadBtn: {
    flex: 1,
    backgroundColor: '#0066CC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    flex: 1,
    backgroundColor: '#0A1E3F',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  modalClose: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  filenameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0066CC',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  filenameInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  extensionBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderLeftWidth: 1,
    borderColor: '#BAE6FD',
  },
  extensionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flex: 1.5,
    backgroundColor: '#0066CC',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

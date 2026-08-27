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
  Platform,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Quotation } from '../types';
import { mobileApi } from '../services/api';

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
  const [currentQuote, setCurrentQuote] = useState<Quotation | null>(quotation);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState<boolean>(false);

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

  const downloadPdfFile = async (): Promise<string | null> => {
    try {
      const pdfUrl = mobileApi.getPdfUrl(currentQuote.id);
      const docDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const localFileUri = `${docDir}Quotation_${currentQuote.quotationNumber}.pdf`;

      // Download file using supported Expo legacy filesystem API
      const result = await FileSystem.downloadAsync(pdfUrl, localFileUri);
      if (result && result.uri) {
        // Verify that the file genuinely exists on disk
        const info = await FileSystem.getInfoAsync(result.uri);
        if (info.exists) {
          return result.uri;
        }
      }
      return null;
    } catch (err: any) {
      console.error('[Download PDF Error]', err);
      return null;
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const localUri = await downloadPdfFile();
      if (localUri) {
        alert(`✓ PDF Generated & Saved successfully!\nFile: Quotation_${currentQuote.quotationNumber}.pdf`);
      } else {
        alert('Failed to generate PDF. Please ensure backend server is accessible.');
      }
    } catch (err: any) {
      alert(err.message || 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSharePdf = async () => {
    setIsSharing(true);
    try {
      const localUri = await downloadPdfFile();

      if (localUri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(localUri, {
          mimeType: 'application/pdf',
          dialogTitle: `ECDIAL Quotation - ${currentQuote.quotationNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback to text summary share
        await Share.share({
          title: `ECDIAL Quotation - ${currentQuote.quotationNumber}`,
          message: `ECDIAL Commercial Offer for ${currentQuote.customerName}\nQuote: ${currentQuote.quotationNumber}\nTotal: ₹${Number(currentQuote.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${currentQuote.date}`,
        });
      }
    } catch (err: any) {
      console.error('[Share Error]', err);
      alert(err.message || 'Sharing error');
    } finally {
      setIsSharing(false);
    }
  };

  const mainItems = currentQuote.items?.filter((i) => i.section === 'MAIN_UNIT') || [];
  const lowSideItems = currentQuote.items?.filter((i) => i.section === 'LOW_SIDE') || [];

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Quotation Offer</Text>
          <Text style={styles.subtitle}>{currentQuote.quotationNumber} • {currentQuote.date}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onEdit && (
            <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
              <Text style={styles.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoadingDetails && (
          <ActivityIndicator size="small" color="#0066CC" style={{ marginBottom: 10 }} />
        )}

        {/* Official Printable Sheet (Preserving Daikin ECDIAL Design) */}
        <View style={styles.previewSheet}>
          {/* Header Brand Bar */}
          <View style={styles.topHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandTitle}>DAIKIN</Text>
              <Text style={styles.brandSub}>AIR CONDITIONERS</Text>
              <Text style={styles.brandDealer}>ECDIAL ENGINEERING SOLUTIONS</Text>
            </View>

            <View style={styles.dealerInfoBox}>
              <Text style={styles.dealerTitle}>Authorized Sales & Service Dealer</Text>
              <Text style={styles.dealerText}>Coimbatore, Tamil Nadu</Text>
              <Text style={styles.dealerText}>+91 98765 43210</Text>
              <Text style={styles.dealerEmail}>sales@daikincoimbatore.in</Text>
            </View>
          </View>

          {/* Decorative Divider */}
          <View style={styles.brandDivider} />

          {/* Customer & Quotation Summary Row */}
          <View style={styles.customerSummaryRow}>
            {/* Customer Box */}
            <View style={styles.toBox}>
              <Text style={styles.toLabel}>To,</Text>
              <Text style={styles.customerNameText}>{currentQuote.customerName}</Text>
              <Text style={styles.customerAddressText}>📍 {currentQuote.customerAddress}</Text>
              {currentQuote.customerPhone && (
                <Text style={styles.customerPhoneText}>Phone: {currentQuote.customerPhone}</Text>
              )}
              {currentQuote.customerEmail && (
                <Text style={styles.customerPhoneText}>Email: {currentQuote.customerEmail}</Text>
              )}
            </View>

            {/* Quotation Details Card */}
            <View style={styles.quoteCard}>
              <View style={styles.quoteCardHeader}>
                <Text style={styles.quoteCardHeaderText}>QUOTATION</Text>
                <Text style={styles.quoteCardDate}>📅 {currentQuote.date}</Text>
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

          {/* Section A: Main Unit */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>A</Text></View>
            <Text style={styles.sectionTitle}>MAIN UNIT</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.tableBox}>
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, { width: 26, textAlign: 'center' }]}>#</Text>
              <Text style={[styles.thText, { flex: 1 }]}>Description</Text>
              <Text style={[styles.thText, { width: 32, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.thText, { width: 36, textAlign: 'center' }]}>Unit</Text>
              <Text style={[styles.thText, { width: 75, textAlign: 'right' }]}>Amount</Text>
            </View>

            {mainItems.length === 0 ? (
              <View style={{ padding: 10, alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: '#64748B' }}>No main units specified.</Text>
              </View>
            ) : (
              mainItems.map((item, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                  <Text style={[styles.tdText, { width: 26, textAlign: 'center', color: '#64748B' }]}>{idx + 1}</Text>
                  <Text style={[styles.tdText, { flex: 1, fontWeight: '700', color: '#0A1E3F' }]}>{item.description}</Text>
                  <Text style={[styles.tdText, { width: 32, textAlign: 'center' }]}>{item.quantity}</Text>
                  <Text style={[styles.tdText, { width: 36, textAlign: 'center' }]}>{item.unit}</Text>
                  <Text style={[styles.tdText, { width: 75, textAlign: 'right', fontWeight: '800' }]}>
                    ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Section B: Low Side */}
          {currentQuote.hasLowSide && lowSideItems.length > 0 && (
            <View style={{ marginTop: 14 }}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>B</Text></View>
                <Text style={styles.sectionTitle}>LOW SIDE (B) EXTRA MATERIALS</Text>
                <View style={styles.sectionLine} />
              </View>

              <View style={styles.tableBox}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.thText, { width: 26, textAlign: 'center' }]}>#</Text>
                  <Text style={[styles.thText, { flex: 1 }]}>Description</Text>
                  <Text style={[styles.thText, { width: 32, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.thText, { width: 36, textAlign: 'center' }]}>Unit</Text>
                  <Text style={[styles.thText, { width: 75, textAlign: 'right' }]}>Amount</Text>
                </View>

                {lowSideItems.map((item, idx) => (
                  <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                    <Text style={[styles.tdText, { width: 26, textAlign: 'center', color: '#64748B' }]}>{idx + 1}</Text>
                    <Text style={[styles.tdText, { flex: 1, color: '#334155' }]}>{item.description}</Text>
                    <Text style={[styles.tdText, { width: 32, textAlign: 'center' }]}>{item.quantity}</Text>
                    <Text style={[styles.tdText, { width: 36, textAlign: 'center' }]}>{item.unit}</Text>
                    <Text style={[styles.tdText, { width: 75, textAlign: 'right', fontWeight: '800' }]}>
                      ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Terms & Payment Method */}
          <View style={styles.termsPaymentCard}>
            <Text style={styles.boxTitle}>📝 TERMS & CONDITIONS</Text>
            <Text style={styles.boxBody}>
              {currentQuote.termsAndConditions || (
                `1. AC Price is inclusive of 18% taxes. 18% Tax Additional for Lowside.\n2. Electrical, civil, core cutting, scaffolding for customer scope.\n3. Any variation in site quantities will be charged extra.\n4. Payment: ${currentQuote.paymentMethod || '100% Machine with PO'}.\n5. Final bill on actual measured quantities at site.\n6. Quotation valid for 10 days.`
              )}
            </Text>

            <View style={styles.shieldBadge}>
              <Text style={styles.shieldText}>🛡️ Quality Cooling. Trusted Service. Every Time.</Text>
            </View>
          </View>

          {/* Footer Banner */}
          <View style={styles.footerBanner}>
            <Text style={styles.footerBannerText}>🤝 Thanking you and assure our best service always.</Text>
          </View>
        </View>

        {/* Action Buttons: Download & Share */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.downloadBtn, isDownloading && { opacity: 0.7 }]}
            onPress={handleDownloadPdf}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnTextWhite}>📥 Download PDF</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shareBtn, isSharing && { opacity: 0.7 }]}
            onPress={handleSharePdf}
            disabled={isSharing}
          >
            {isSharing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnTextWhite}>📤 Share PDF</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  closeBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 100,
  },
  previewSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0066CC',
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1.5,
  },
  brandDealer: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  dealerInfoBox: {
    alignItems: 'flex-end',
    flex: 1,
    paddingLeft: 10,
  },
  dealerTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0A1E3F',
    textAlign: 'right',
  },
  dealerText: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'right',
  },
  dealerEmail: {
    fontSize: 9,
    color: '#0066CC',
    fontWeight: '600',
    textAlign: 'right',
  },
  brandDivider: {
    height: 2.5,
    backgroundColor: '#0066CC',
    marginVertical: 10,
    borderRadius: 2,
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
    color: '#64748B',
    fontWeight: '600',
  },
  customerNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  customerAddressText: {
    fontSize: 10.5,
    color: '#475569',
    marginTop: 2,
  },
  customerPhoneText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  quoteCard: {
    width: 155,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#0066CC',
  },
  quoteCardHeader: {
    backgroundColor: '#0066CC',
    paddingVertical: 5,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteCardHeaderText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  quoteCardDate: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '700',
  },
  quoteCardBody: {
    backgroundColor: '#F8FAFC',
    padding: 6,
    gap: 3,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quoteCardLabel: {
    fontSize: 9.5,
    color: '#64748B',
  },
  quoteCardVal: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  quoteCardFooter: {
    backgroundColor: '#0A1E3F',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  quoteTotalLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  quoteTotalVal: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionBadge: {
    backgroundColor: '#0066CC',
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
    fontSize: 11.5,
    fontWeight: '900',
    color: '#0F172A',
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  tableBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0052A3',
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  thText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  tdText: {
    fontSize: 10,
    color: '#0F172A',
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
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
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
});

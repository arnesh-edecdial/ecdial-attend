import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
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
  const [isSharing, setIsSharing] = useState<boolean>(false);

  if (!quotation) return null;

  const handleSharePdf = async () => {
    setIsSharing(true);
    try {
      const pdfUrl = mobileApi.getPdfUrl(quotation.id);
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const localFileUri = `${docDir}Quotation_${quotation.quotationNumber}.pdf`;

      // Download temporary PDF on device for sharing
      const downloadResult = await FileSystem.downloadAsync(pdfUrl, localFileUri);

      if (downloadResult && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `ECDIAL Quotation - ${quotation.quotationNumber}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback to text share
        await Share.share({
          title: `ECDIAL Quotation - ${quotation.quotationNumber}`,
          message: `ECDIAL Quotation for ${quotation.customerName}\nQuote: ${quotation.quotationNumber}\nTotal (A): ₹${Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${quotation.date}`,
        });
      }
    } catch (err: any) {
      console.error(err);
      alert('Sharing: ' + (err.message || 'Share complete'));
    } finally {
      setIsSharing(false);
    }
  };

  const mainItems = quotation.items?.filter((i) => i.section === 'MAIN_UNIT') || [];
  const lowSideItems = quotation.items?.filter((i) => i.section === 'LOW_SIDE') || [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Quotation Offer</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {onEdit && (
            <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Official Printable Sheet matching Image 2 */}
      <View style={styles.previewSheet}>
        {/* Header */}
        <View style={styles.topHeader}>
          <View>
            <Text style={styles.brandTitle}>DAIKIN</Text>
            <Text style={styles.brandSub}>AIR CONDITIONERS</Text>
            <Text style={styles.brandDealer}>ECDIAL ENGINEERING SOLUTIONS</Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.dealerTitle}>Authorized Sales & Service Dealer</Text>
            <Text style={styles.dealerText}>Coimbatore, Tamil Nadu</Text>
            <Text style={styles.dealerText}>+91 98765 43210</Text>
            <Text style={styles.dealerEmail}>sales@daikincoimbatore.in</Text>
          </View>
        </View>

        {/* Customer & Quotation Card */}
        <View style={styles.customerSummaryRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toLabel}>To,</Text>
            <Text style={styles.customerNameText}>{quotation.customerName}</Text>
            <Text style={styles.customerAddressText}>📍 {quotation.customerAddress}</Text>
            {quotation.customerPhone && (
              <Text style={styles.customerPhoneText}>Phone: {quotation.customerPhone}</Text>
            )}
          </View>

          <View style={styles.quoteCard}>
            <View style={styles.quoteCardHeader}>
              <Text style={styles.quoteCardHeaderText}>QUOTATION</Text>
              <Text style={styles.quoteCardDate}>📅 {quotation.date}</Text>
            </View>

            <View style={styles.quoteCardBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.quoteCardLabel}>Sub Total (A)</Text>
                <Text style={styles.quoteCardVal}>₹{Number(quotation.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.quoteCardLabel}>CGST 9%</Text>
                <Text style={styles.quoteCardVal}>₹{Number(quotation.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={styles.quoteCardLabel}>SGST 9%</Text>
                <Text style={styles.quoteCardVal}>₹{Number(quotation.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>

            <View style={styles.quoteCardFooter}>
              <Text style={styles.quoteTotalLabel}>TOTAL (A)</Text>
              <Text style={styles.quoteTotalVal}>₹{Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
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
            <Text style={[styles.thText, { width: 25, textAlign: 'center' }]}>#</Text>
            <Text style={[styles.thText, { flex: 1 }]}>Description</Text>
            <Text style={[styles.thText, { width: 30, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.thText, { width: 35, textAlign: 'center' }]}>Unit</Text>
            <Text style={[styles.thText, { width: 65, textAlign: 'right' }]}>Amount</Text>
          </View>

          {mainItems.map((item, idx) => (
            <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
              <Text style={[styles.tdText, { width: 25, textAlign: 'center', color: '#64748B' }]}>{idx + 1}</Text>
              <Text style={[styles.tdText, { flex: 1, fontWeight: '700', color: '#0A1E3F' }]}>{item.description}</Text>
              <Text style={[styles.tdText, { width: 30, textAlign: 'center' }]}>{item.quantity}</Text>
              <Text style={[styles.tdText, { width: 35, textAlign: 'center' }]}>{item.unit}</Text>
              <Text style={[styles.tdText, { width: 65, textAlign: 'right', fontWeight: '800' }]}>
                ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ))}
        </View>

        {/* Section B: Low Side */}
        {quotation.hasLowSide && lowSideItems.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>B</Text></View>
              <Text style={styles.sectionTitle}>LOW SIDE (B) EXTRA MATERIALS</Text>
              <View style={styles.sectionLine} />
            </View>

            <View style={styles.tableBox}>
              <View style={styles.tableHeader}>
                <Text style={[styles.thText, { width: 25, textAlign: 'center' }]}>#</Text>
                <Text style={[styles.thText, { flex: 1 }]}>Description</Text>
                <Text style={[styles.thText, { width: 30, textAlign: 'center' }]}>Qty</Text>
                <Text style={[styles.thText, { width: 35, textAlign: 'center' }]}>Unit</Text>
                <Text style={[styles.thText, { width: 65, textAlign: 'right' }]}>Amount</Text>
              </View>

              {lowSideItems.map((item, idx) => (
                <View key={idx} style={[styles.tableRow, idx % 2 === 1 && { backgroundColor: '#F8FAFC' }]}>
                  <Text style={[styles.tdText, { width: 25, textAlign: 'center', color: '#64748B' }]}>{idx + 1}</Text>
                  <Text style={[styles.tdText, { flex: 1, color: '#334155' }]}>{item.description}</Text>
                  <Text style={[styles.tdText, { width: 30, textAlign: 'center' }]}>{item.quantity}</Text>
                  <Text style={[styles.tdText, { width: 35, textAlign: 'center' }]}>{item.unit}</Text>
                  <Text style={[styles.tdText, { width: 65, textAlign: 'right', fontWeight: '800' }]}>
                    ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Terms & Payment Method matching Image 2 */}
        <View style={styles.termsPaymentCard}>
          <Text style={styles.boxTitle}>📝 TERMS & CONDITIONS</Text>
          <Text style={styles.boxBody}>
            1. AC Price is inclusive of 18 % taxes. 18% Tax Additional for Lowside.{'\n'}
            2. Electrical, civil, core cutting, scaffolding for customer scope.{'\n'}
            3. Any variation in site quantities will be charged extra.{'\n'}
            4. Payment: 100% Machine with PO, 70% Lowside with PO, 25% on erection, 5% on final bill.{'\n'}
            5. Final bill on actual measured quantities at site.{'\n'}
            6. Quotation valid for 10 days.
          </Text>

          <View style={styles.shieldBadge}>
            <Text style={styles.shieldText}>🛡️ Quality Cooling. Trusted Service. Every Time.</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerBanner}>
          <Text style={styles.footerBannerText}>🤝 Thanking you and assure our best service always.</Text>
        </View>
      </View>

      {/* DIRECT NATIVE SHARE & DOWNLOAD ACTION (Rule 18) */}
      <TouchableOpacity
        style={[styles.shareBtn, isSharing && { opacity: 0.7 }]}
        onPress={handleSharePdf}
        disabled={isSharing}
      >
        {isSharing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.shareBtnText}>[ DIRECT SHARE PDF / DOWNLOAD ]</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 14,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  editBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  editBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  previewSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderColor: '#0066CC',
    paddingBottom: 10,
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0066CC',
  },
  brandSub: {
    fontSize: 8,
    fontWeight: '800',
    color: '#0A1E3F',
    letterSpacing: 1,
  },
  brandDealer: {
    fontSize: 7.5,
    color: '#64748B',
  },
  dealerTitle: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#0A1E3F',
  },
  dealerText: {
    fontSize: 8,
    color: '#475569',
  },
  dealerEmail: {
    fontSize: 8,
    color: '#0066CC',
  },
  customerSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  toLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0A1E3F',
  },
  customerNameText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0A1E3F',
    marginTop: 2,
  },
  customerAddressText: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  customerPhoneText: {
    fontSize: 9.5,
    color: '#64748B',
    marginTop: 2,
  },
  quoteCard: {
    width: 155,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    overflow: 'hidden',
  },
  quoteCardHeader: {
    backgroundColor: '#0066CC',
    padding: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quoteCardHeaderText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  quoteCardDate: {
    color: '#FFFFFF',
    fontSize: 8,
  },
  quoteCardBody: {
    padding: 6,
    backgroundColor: '#F8FAFC',
    gap: 2,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quoteCardLabel: {
    fontSize: 8.5,
    color: '#64748B',
  },
  quoteCardVal: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#0A1E3F',
  },
  quoteCardFooter: {
    backgroundColor: '#0A1E3F',
    padding: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quoteTotalLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  quoteTotalVal: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '900',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sectionBadge: {
    backgroundColor: '#0052A3',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 3,
  },
  sectionBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0A1E3F',
  },
  sectionLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#0052A3',
  },
  tableBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: '#0052A3',
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  thText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  tdText: {
    fontSize: 8.5,
    color: '#1E293B',
  },
  termsPaymentCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#F8FAFC',
  },
  boxTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0A1E3F',
    marginBottom: 3,
  },
  boxBody: {
    fontSize: 7.5,
    color: '#475569',
    lineHeight: 11,
  },
  shieldBadge: {
    marginTop: 6,
    backgroundColor: '#EBF3FC',
    padding: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  shieldText: {
    color: '#0066CC',
    fontSize: 8,
    fontWeight: '800',
  },
  footerBanner: {
    backgroundColor: '#0A1E3F',
    padding: 6,
    borderRadius: 4,
    marginTop: 8,
    alignItems: 'center',
  },
  footerBannerText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  shareBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

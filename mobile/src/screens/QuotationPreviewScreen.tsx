import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import { Quotation } from '../types';

interface QuotationPreviewScreenProps {
  quotation: Quotation | null;
  onClose: () => void;
}

export const QuotationPreviewScreen: React.FC<QuotationPreviewScreenProps> = ({
  quotation,
  onClose,
}) => {
  if (!quotation) return null;

  const handleShare = async () => {
    try {
      await Share.share({
        title: `ECDIAL Quotation - ${quotation.quotationNumber}`,
        message: `ECDIAL Quotation for ${quotation.customerName}\nQuote No: ${quotation.quotationNumber}\nTotal: ₹${Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDate: ${quotation.date}`,
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Quotation Summary</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Official Offer Preview Card */}
      <View style={styles.previewSheet}>
        {/* Banner */}
        <View style={styles.banner}>
          <Text style={styles.companyName}>ECDIAL</Text>
          <Text style={styles.companySub}>AIR CONDITIONING & ENGINEERING SOLUTIONS</Text>
          <Text style={styles.quoteTitle}>COMMERCIAL QUOTATION</Text>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>CUSTOMER:</Text>
            <Text style={styles.metaCustomerName}>{quotation.customerName}</Text>
            <Text style={styles.metaAddress}>{quotation.customerAddress}</Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaLabel}>QUOTE NO:</Text>
            <Text style={styles.metaQuoteNo}>{quotation.quotationNumber}</Text>
            <Text style={styles.metaDate}>Date: {quotation.date}</Text>
          </View>
        </View>

        {/* Financial Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.rowBetween}>
            <Text style={styles.sumLabel}>Main Units:</Text>
            <Text style={styles.sumVal}>₹{Number(quotation.mainUnitTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>

          {quotation.hasLowSide && (
            <View style={styles.rowBetween}>
              <Text style={styles.sumLabel}>Low-Side Materials:</Text>
              <Text style={styles.sumVal}>₹{Number(quotation.lowSideTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
            </View>
          )}

          <View style={[styles.rowBetween, { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderColor: '#CBD5E1' }]}>
            <Text style={[styles.sumLabel, { fontWeight: '700' }]}>Subtotal:</Text>
            <Text style={[styles.sumVal, { fontWeight: '700' }]}>₹{Number(quotation.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.taxLabel}>CGST ({quotation.cgstPercent}%):</Text>
            <Text style={styles.taxVal}>₹{Number(quotation.cgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.taxLabel}>SGST ({quotation.sgstPercent}%):</Text>
            <Text style={styles.taxVal}>₹{Number(quotation.sgstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>

          <View style={[styles.rowBetween, styles.grandTotalRow]}>
            <Text style={styles.grandTotalText}>GRAND TOTAL:</Text>
            <Text style={styles.grandTotalText}>₹{Number(quotation.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.termsBox}>
          <Text style={styles.termsHeading}>Payment Milestones & Terms:</Text>
          <Text style={styles.termsBody}>{quotation.paymentMethod || '100% advance with Purchase Order.'}</Text>
        </View>
      </View>

      {/* Share / PDF action buttons */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>[ SHARE QUOTATION OFFER ]</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  previewSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 18,
    marginBottom: 20,
  },
  banner: {
    backgroundColor: '#0F2A4A',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 14,
  },
  companyName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  companySub: {
    fontSize: 8.5,
    color: '#CBD5E1',
    marginTop: 2,
  },
  quoteTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066CC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  metaCustomerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F2A4A',
  },
  metaAddress: {
    fontSize: 11,
    color: '#475569',
    maxWidth: 160,
  },
  metaQuoteNo: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066CC',
  },
  metaDate: {
    fontSize: 11,
    color: '#64748B',
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sumLabel: {
    fontSize: 12,
    color: '#334155',
  },
  sumVal: {
    fontSize: 12,
    color: '#0F2A4A',
  },
  taxLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  taxVal: {
    fontSize: 11,
    color: '#64748B',
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderColor: '#0F2A4A',
  },
  grandTotalText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F2A4A',
  },
  termsBox: {
    padding: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  termsHeading: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F2A4A',
    marginBottom: 4,
  },
  termsBody: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 14,
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

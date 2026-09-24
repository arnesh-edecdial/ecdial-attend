import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface CataloguePreviewModalProps {
  visible: boolean;
  catalogue: any | null;
  onClose: () => void;
  onDownload: (item: any) => void;
  onShare: (item: any) => void;
  isDownloading?: boolean;
  isSharing?: boolean;
}

export const CataloguePreviewModal: React.FC<CataloguePreviewModalProps> = ({
  visible,
  catalogue,
  onClose,
  onDownload,
  onShare,
  isDownloading = false,
  isSharing = false,
}) => {
  const insets = useSafeAreaInsets();

  if (!catalogue) return null;

  const formatFileSize = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0) return 'Standard PDF';
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const categoryLabel = (catalogue.category || 'CATALOGUE').toUpperCase();

  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'BROCHURE':
        return { bg: '#F3E8FF', text: '#7E22CE', border: '#D8B4FE' };
      case 'PRODUCT_GUIDE':
      case 'PRODUCT DOCUMENT':
        return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' };
      default:
        return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
    }
  };

  const badgeTheme = getCategoryBadgeColor(categoryLabel);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* DRAG HANDLE / CLOSE BAR */}
          <View style={styles.topBar}>
            <View style={styles.handleBar} />
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* DOCUMENT CATEGORY & STATUS */}
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border },
                ]}
              >
                <Text style={[styles.categoryBadgeText, { color: badgeTheme.text }]}>
                  {categoryLabel.replace('_', ' ')}
                </Text>
              </View>

              <View style={styles.sizeBadge}>
                <Text style={styles.sizeBadgeText}>{formatFileSize(catalogue.fileSize)}</Text>
              </View>
            </View>

            {/* TITLE & MODEL */}
            <Text style={styles.title}>{catalogue.displayName || 'AC Document'}</Text>
            {catalogue.model && (
              <View style={styles.modelTag}>
                <Text style={styles.modelTagText}>Model: {catalogue.model}</Text>
              </View>
            )}

            {/* PREVIEW HERO CARD */}
            <View style={styles.previewHero}>
              <View style={styles.pdfHeroIconBox}>
                <Text style={{ fontSize: 44 }}>📑</Text>
              </View>
              <Text style={styles.heroDocumentName} numberOfLines={1}>
                {catalogue.fileName || `${catalogue.displayName || 'document'}.pdf`}
              </Text>
              <Text style={styles.heroSubText}>Official ECDIAL Product Specification</Text>

              <View style={styles.specFeaturesRow}>
                <View style={styles.specChip}>
                  <Text style={styles.specChipText}>✓ Verified Spec Sheet</Text>
                </View>
                <View style={styles.specChip}>
                  <Text style={styles.specChipText}>✓ Print Ready</Text>
                </View>
              </View>
            </View>

            {/* DESCRIPTION */}
            {catalogue.description && catalogue.description.trim().length > 0 && (
              <View style={styles.descSection}>
                <Text style={styles.sectionHeader}>Overview & Notes</Text>
                <Text style={styles.descText}>{catalogue.description}</Text>
              </View>
            )}

            {/* METADATA INFO */}
            <View style={styles.metaCard}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Document Type</Text>
                <Text style={styles.metaValue}>PDF</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>File Size</Text>
                <Text style={styles.metaValue}>{formatFileSize(catalogue.fileSize)}</Text>
              </View>
              {catalogue.updatedAt && (
                <>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Last Updated</Text>
                    <Text style={styles.metaValue}>
                      {new Date(catalogue.updatedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.actionSection}>
              <TouchableOpacity
                style={[styles.downloadBtn, isDownloading && { opacity: 0.7 }]}
                onPress={() => onDownload(catalogue)}
                disabled={isDownloading || isSharing}
                activeOpacity={0.85}
              >
                {isDownloading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.btnIcon}>⬇️</Text>
                    <Text style={styles.downloadBtnText}>Save / Download PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareBtn, isSharing && { opacity: 0.7 }]}
                onPress={() => onShare(catalogue)}
                disabled={isDownloading || isSharing}
                activeOpacity={0.85}
              >
                {isSharing ? (
                  <ActivityIndicator color="#0066CC" size="small" />
                ) : (
                  <>
                    <Text style={styles.btnIcon}>↗️</Text>
                    <Text style={styles.shareBtnText}>Share Document with Customer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  topBar: {
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  handleBar: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    top: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sizeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sizeBadgeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    lineHeight: 26,
  },
  modelTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 16,
  },
  modelTagText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },
  previewHero: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
  },
  pdfHeroIconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  heroDocumentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  heroSubText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  specFeaturesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  specChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  specChipText: {
    fontSize: 11,
    color: '#0066CC',
    fontWeight: '600',
  },
  descSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  descText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  metaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 10,
  },
  actionSection: {
    gap: 10,
  },
  downloadBtn: {
    backgroundColor: '#0066CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 6,
  },
  shareBtn: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareBtnText: {
    color: '#0066CC',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 6,
  },
  btnIcon: {
    fontSize: 16,
  },
});

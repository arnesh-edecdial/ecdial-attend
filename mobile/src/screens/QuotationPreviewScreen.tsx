import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Quotation } from '../types';
import { mobileApi } from '../services/api';
import { makeQuotationPdf, previewHtml, savePdfToDevice, sharePdf } from './quotationPdf';
import { resolveQuotationType } from './quotationType';

interface QuotationPreviewScreenProps {
  quotation: Quotation | null;
  onClose: () => void;
  onEdit?: (quotation?: Quotation | null) => void;
}

export const QuotationPreviewScreen: React.FC<QuotationPreviewScreenProps> = ({
  quotation,
  onClose,
  onEdit,
}) => {
  const insets = useSafeAreaInsets();
  const [currentQuote, setCurrentQuote] = useState<Quotation | null>(quotation);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [busy, setBusy] = useState<'dl' | 'share' | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [newPdfName, setNewPdfName] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState<boolean>(false);
  const [html, setHtml] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string>('');
  const pdfCache = useRef<{ key: string; uri: string } | null>(null);

  useEffect(() => {
    setCurrentQuote(quotation);
    if (quotation && (!quotation.items || quotation.items.length === 0)) {
      setIsLoadingDetails(true);
      mobileApi
        .getQuotation(quotation.id)
        .then((res: any) => {
          if (res.success && res.data) setCurrentQuote(res.data);
        })
        .catch(console.error)
        .finally(() => setIsLoadingDetails(false));
    }
  }, [quotation?.id]);

  // The preview is the same HTML that becomes the PDF.
  useEffect(() => {
    if (!currentQuote) return;
    let alive = true;
    setRenderError('');
    previewHtml(currentQuote as any)
      .then((h) => alive && setHtml(h))
      .catch((e) => alive && setRenderError(e?.message || 'Could not render the quotation.'));
    return () => {
      alive = false;
    };
  }, [currentQuote]);

  if (!currentQuote) return null;

  const isEcDial = resolveQuotationType(currentQuote) === 'ECDIAL';

  const getDefaultFilename = () => {
    const safeQuoteNum = (currentQuote.quotationNumber || 'quote').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanCust = currentQuote.customerName ? currentQuote.customerName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : '';
    const prefix = isEcDial ? 'ECDIAL' : 'DAIKIN';
    return cleanCust ? `${prefix}_${cleanCust}_${safeQuoteNum}` : `${prefix}_Quotation_${safeQuoteNum}`;
  };

  const sanitizeFilename = (name: string) => {
    let clean = (name || '').trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\.pdf$/i, '');
    clean = clean.replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!clean || clean.toLowerCase() === 'undefined' || clean.toLowerCase() === 'null') {
      return getDefaultFilename();
    }
    return clean;
  };

  const getResolvedFilename = () => {
    if (currentQuote.pdfName && currentQuote.pdfName.trim().length > 0) {
      return sanitizeFilename(currentQuote.pdfName);
    }
    return getDefaultFilename();
  };

  const handleSavePdfName = async () => {
    if (!newPdfName.trim()) {
      Alert.alert('Invalid Name', 'Quotation name cannot be empty.');
      return;
    }
    try {
      setIsSavingName(true);
      const clean = newPdfName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
      const res = await mobileApi.updateQuotation(currentQuote.id, { pdfName: clean });
      if (res.success) {
        setCurrentQuote((prev: any) => ({ ...prev, pdfName: clean }));
        setIsRenaming(false);
        Alert.alert('✓ Saved', `Quotation PDF name updated to "${clean}".`);
      } else {
        Alert.alert('Error', res.message || 'Failed to update quotation name.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update quotation name.');
    } finally {
      setIsSavingName(false);
    }
  };

  /** Builds the PDF on the device; re-uses the last file while nothing has changed. */
  const ensurePdf = async () => {
    const name = getResolvedFilename();
    const key = JSON.stringify([name, currentQuote]);
    if (pdfCache.current?.key === key) {
      const info = await FileSystem.getInfoAsync(pdfCache.current.uri);
      if (info.exists) return { uri: pdfCache.current.uri, name };
    }
    const uri = await makeQuotationPdf(currentQuote as any, name);
    pdfCache.current = { key, uri };
    return { uri, name };
  };

  const runPdf = async (mode: 'dl' | 'share') => {
    if (busy) return;
    setBusy(mode);
    try {
      const { uri, name } = await ensurePdf();
      if (mode === 'dl') {
        const r = await savePdfToDevice(uri, name);
        if (r === 'saved') Alert.alert('Saved', `${name}.pdf was saved.`);
      } else {
        await sharePdf(uri, name);
      }
    } catch (err: any) {
      console.error('[Quotation PDF]', err);
      Alert.alert(mode === 'dl' ? 'Download Error' : 'Share Error', err?.message || 'Failed to create the PDF.');
    } finally {
      setBusy(null);
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

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.title}>Quotation Offer</Text>
            <View style={[styles.previewTypeTag, isEcDial ? styles.previewTypeTagEcDial : styles.previewTypeTagDaikin]}>
              <Text style={[styles.previewTypeTagText, isEcDial ? styles.previewTypeTagEcDialText : styles.previewTypeTagDaikinText]}>
                {isEcDial ? 'EC DIAL' : 'DAIKIN'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.quoteNameRow}
            onPress={() => {
              setNewPdfName(currentQuote.pdfName || getDefaultFilename());
              setIsRenaming(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.quoteNameText} numberOfLines={1}>
              📄 {currentQuote.pdfName || getDefaultFilename()}
            </Text>
            <View style={styles.editPencilBadge}>
              <Text style={{ fontSize: 10 }}>✏️</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.subtitle}>{currentQuote.quotationNumber} • {currentQuote.date}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onEdit && (
            <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(currentQuote)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.deleteHeaderBtn} onPress={handleDeleteQuotation}>
            <Text style={styles.deleteHeaderBtnText}>Delete</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={styles.closeIconBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.webWrap, { marginBottom: 72 + Math.max(insets.bottom, 14) - 14 }]}>
        {html ? (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={{ flex: 1, backgroundColor: '#E6E9F0' }}
            bounces={false}
            scalesPageToFit
            showsVerticalScrollIndicator={false}
          />
        ) : renderError ? (
          <View style={styles.centerMsg}>
            <Text style={styles.errText}>{renderError}</Text>
          </View>
        ) : (
          <View style={styles.centerMsg}>
            <ActivityIndicator color="#0066CC" />
          </View>
        )}
        {isLoadingDetails && (
          <ActivityIndicator size="small" color="#0066CC" style={{ position: 'absolute', top: 10, alignSelf: 'center' }} />
        )}
      </View>

      <View style={[styles.stickyFooterBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <TouchableOpacity
          style={[styles.downloadBtn, busy === 'dl' && { opacity: 0.7 }]}
          onPress={() => runPdf('dl')}
          disabled={!!busy || !html}
        >
          {busy === 'dl' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnTextWhite}>Download PDF</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shareBtn, busy === 'share' && { opacity: 0.7 }]}
          onPress={() => runPdf('share')}
          disabled={!!busy || !html}
        >
          {busy === 'share' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnTextWhite}>Share PDF</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={isRenaming} transparent animationType="fade" onRequestClose={() => setIsRenaming(false)}>
        <View style={styles.renameOverlay}>
          <View style={styles.renameCard}>
            <View style={styles.renameHeader}>
              <Text style={styles.renameTitle}>Rename Quotation PDF</Text>
              <TouchableOpacity onPress={() => setIsRenaming(false)} disabled={isSavingName}>
                <Text style={{ fontSize: 18, color: '#64748B', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.renameSubtitle}>
              This filename will be saved and reused for all PDF downloads and shares.
            </Text>

            <TextInput
              style={styles.renameInput}
              value={newPdfName}
              onChangeText={setNewPdfName}
              placeholder="e.g. ECDIAL_Quotation_Arun"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoFocus
            />

            <View style={styles.renameActions}>
              <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setIsRenaming(false)} disabled={isSavingName}>
                <Text style={styles.renameCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.renameSaveBtn} onPress={handleSavePdfName} disabled={isSavingName}>
                {isSavingName ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.renameSaveText}>Save Name</Text>}
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
  quoteNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  quoteNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  editPencilBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  renameCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  renameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  renameTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  renameSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
  },
  renameInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#0066CC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 18,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  renameCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  renameCancelText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  renameSaveBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  renameSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
  previewTypeTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  previewTypeTagEcDial: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  previewTypeTagDaikin: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  previewTypeTagText: {
    fontSize: 9,
    fontWeight: '900',
  },
  previewTypeTagEcDialText: {
    color: '#EA580C',
  },
  previewTypeTagDaikinText: {
    color: '#0066CC',
  },
  webWrap: {
    flex: 1,
    backgroundColor: '#E6E9F0',
  },
  centerMsg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errText: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
  },
});

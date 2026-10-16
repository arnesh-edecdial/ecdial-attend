import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { mobileApi } from '../services/api';
import { dataCache } from '../services/dataCache';
import { downloadAndSaveFile, shareDocument } from '../services/fileDownloader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductCatalogueScreenProps {
  userRole?: string;
  onClose?: () => void;
  onOpenStockRequirements?: () => void;
}

const ADMIN_MANAGEMENT_ROLES = ['ADMIN', 'MANAGER', 'IT_ADMIN', 'SALES'];

const DEFAULT_BRANDS = [
  'Daikin',
  'Mitsubishi',
  'LG',
  'Godrej',
  'Voltas',
  'Panasonic',
  'Carrier',
  'Blue Star',
  'Hitachi',
  'O General',
  'Lloyd',
  'Samsung',
];

const AC_TYPES = ['SPLIT', 'CASSETTE', 'DUCT', 'VRV'];

export interface SpecRow {
  id: string;
  attribute: string;
  unit: string;
  value: string;
}

export interface IduOduCombination {
  id: string;
  iduModel: string;
  oduModel: string;
  coolingCapacity: string;
  iseerRating: string;
  annualPowerConsumption: string;
  iduColour: string;
  specRows: SpecRow[];
}

export interface ProductImageItem {
  id: string;
  storageFileName: string;
  imageUrl?: string;
  signedUrl?: string;
  fileSize?: number;
  uploading?: boolean;
}

const DEFAULT_SPEC_ATTRIBUTES = [
  { attribute: 'Power Supply', unit: 'V / Hz / Ph', defaultValue: '230 V / 50 Hz / 1 Ph' },
  { attribute: 'Running Current', unit: 'A', defaultValue: '3.8 A' },
  { attribute: 'Airflow Rate (IDU)', unit: 'CFM', defaultValue: '510 CFM' },
  { attribute: 'Sound Level (IDU)', unit: 'dB(A)', defaultValue: '42 / 34 / 26 dB(A)' },
  { attribute: 'Sound Level (ODU)', unit: 'dB(A)', defaultValue: '50 dB(A)' },
  { attribute: 'Refrigerant Type', unit: '', defaultValue: 'R-32' },
  { attribute: 'Piping Length (Max)', unit: 'm', defaultValue: '30 m' },
  { attribute: 'Piping Elevation (Max)', unit: 'm', defaultValue: '15 m' },
  { attribute: 'Operating Weight (IDU)', unit: 'kg', defaultValue: '11.5 kg' },
  { attribute: 'Operating Weight (ODU)', unit: 'kg', defaultValue: '34 kg' },
  { attribute: 'Dimensions IDU (HxWxD)', unit: 'mm', defaultValue: '298 x 885 x 229 mm' },
  { attribute: 'Dimensions ODU (HxWxD)', unit: 'mm', defaultValue: '595 x 845 x 300 mm' },
];

export const ProductCatalogueScreen: React.FC<ProductCatalogueScreenProps> = ({
  userRole = 'SALES',
  onClose,
  onOpenStockRequirements,
}) => {
  const insets = useSafeAreaInsets();
  const canEdit = ADMIN_MANAGEMENT_ROLES.includes((userRole || '').toUpperCase());

  // Main Product Catalog state
  const [products, setProducts] = useState<any[]>(() => {
    return dataCache.get<any>('products:ALL:ALL:')?.data || [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => products.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('ALL');
  const [selectedAcTypeFilter, setSelectedAcTypeFilter] = useState<string>('ALL');

  // Full-Screen Image Viewer Modal State
  const [viewerVisible, setViewerVisible] = useState<boolean>(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number>(0);

  // Catalogue Preview Modal State
  const [previewModalVisible, setPreviewModalVisible] = useState<boolean>(false);
  const [previewProduct, setPreviewProduct] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  // Create / Edit Catalogue Entry State
  const [editorVisible, setEditorVisible] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formModel, setFormModel] = useState<string>('');
  const [formBrand, setFormBrand] = useState<string>('Daikin');
  const [formCustomBrand, setFormCustomBrand] = useState<string>('');
  const [isAddingNewBrand, setIsAddingNewBrand] = useState<boolean>(false);
  const [formAcType, setFormAcType] = useState<string>('SPLIT');
  const [formCategory, setFormCategory] = useState<'MAIN_UNIT' | 'LOW_SIDE'>('MAIN_UNIT');
  const [formStock, setFormStock] = useState<string>('10');
  const [formPrice, setFormPrice] = useState<string>('35000');
  const [formUnit, setFormUnit] = useState<string>('Nos');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formImages, setFormImages] = useState<ProductImageItem[]>([]);
  const [formCombinations, setFormCombinations] = useState<IduOduCombination[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [uploadingImageCount, setUploadingImageCount] = useState<number>(0);

  // Helper to extract brand
  const extractBrand = (item: any): string => {
    if (item.brand) return item.brand;
    const descMatch = item.description?.match(/\[Brand:\s*([^\]]+)\]/i);
    if (descMatch) return descMatch[1].trim();
    const fullText = `${item.name || ''} ${item.model || ''} ${item.description || ''}`.toLowerCase();
    for (const b of DEFAULT_BRANDS) {
      if (fullText.includes(b.toLowerCase())) return b;
    }
    return item.category === 'LOW_SIDE' ? 'Universal' : 'Other';
  };

  const fetchProducts = async (forceRefresh: boolean = false) => {
    try {
      if (forceRefresh && products.length === 0) setIsLoading(true);
      const res = await mobileApi.getCachedProducts(
        undefined,
        searchQuery || undefined,
        {
          forceRefresh,
          brand: selectedBrandFilter === 'ALL' ? undefined : selectedBrandFilter,
          onBackgroundUpdate: (fresh) => {
            if (fresh && fresh.success && Array.isArray(fresh.data)) {
              setProducts(fresh.data);
            }
          },
        }
      );
      if (res && res.success && Array.isArray(res.data)) {
        setProducts(res.data);
      }
    } catch (err) {
      console.error('[Fetch Products Error]', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProducts(false);
  }, [selectedBrandFilter]);

  // Distinct Brands
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_BRANDS.forEach((b) => set.add(b));
    products.forEach((p) => {
      const b = extractBrand(p);
      if (b && b !== 'Other' && b !== 'Universal') set.add(b);
    });
    return ['ALL', ...Array.from(set)];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedBrandFilter !== 'ALL') {
        const b = extractBrand(p);
        if (b.toLowerCase() !== selectedBrandFilter.toLowerCase()) return false;
      }
      if (selectedAcTypeFilter !== 'ALL') {
        const type = (p.acType || 'SPLIT').toUpperCase();
        if (type !== selectedAcTypeFilter.toUpperCase()) return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const modelMatch = (p.model || '').toLowerCase().includes(q);
        const brandMatch = (extractBrand(p) || '').toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);

        // Also search in IDU/ODU specification combinations
        const specs = Array.isArray(p.specifications) ? p.specifications : [];
        const specMatch = specs.some(
          (s: any) =>
            (s.iduModel || '').toLowerCase().includes(q) ||
            (s.oduModel || '').toLowerCase().includes(q)
        );

        if (!nameMatch && !modelMatch && !brandMatch && !descMatch && !specMatch) {
          return false;
        }
      }
      return true;
    });
  }, [products, selectedBrandFilter, selectedAcTypeFilter, searchQuery]);

  // --- FULL SCREEN IMAGE VIEWER HANDLERS ---
  const openImageViewer = (images: string[], initialIndex: number = 0) => {
    if (!images || images.length === 0) return;
    setViewerImages(images);
    setViewerIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
    setViewerVisible(true);
  };

  const closeImageViewer = () => {
    setViewerVisible(false);
    setViewerImages([]);
    setViewerIndex(0);
  };

  // --- CATALOGUE PREVIEW HANDLERS ---
  const openCataloguePreview = async (product: any) => {
    setPreviewProduct(product);
    setPreviewModalVisible(true);
    // Fetch latest fresh product details in background
    try {
      const res = await mobileApi.getProduct(product.id);
      if (res && res.success && res.data) {
        setPreviewProduct(res.data);
      }
    } catch {
      // preview uses current product as fallback
    }
  };

  // --- PDF DOWNLOAD & SHARING ---
  const handleDownloadPdf = async (product: any) => {
    const rawName = `Catalogue_${product.brand || 'AC'}_${product.model || product.name}`;
    const url = mobileApi.getProductCataloguePdfUrl(product.id, `${rawName}.pdf`);
    setDownloadingId(product.id);

    try {
      const result = await downloadAndSaveFile({
        url,
        rawFilename: rawName,
        extension: 'pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Save ${product.name} Catalogue`,
        showShareFallbackOnAndroid: true,
        forceRefresh: true,
      });

      if (result.success) {
        Alert.alert('Download Complete', `${result.filename} saved successfully.`);
      } else if (!result.userCancelled) {
        Alert.alert('Download Notice', result.error || 'Could not save PDF file.');
      }
    } catch (err: any) {
      Alert.alert('Download Error', err.message || 'Failed to download catalogue.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShareCatalogue = async (product: any) => {
    const rawName = `Catalogue_${product.brand || 'AC'}_${product.model || product.name}`;
    const url = mobileApi.getProductCataloguePdfUrl(product.id, `${rawName}.pdf`);
    setSharingId(product.id);

    try {
      const res = await shareDocument({
        url,
        rawFilename: rawName,
        extension: 'pdf',
        mimeType: 'application/pdf',
      });
      if (!res.success && res.error) {
        Alert.alert('Sharing Notice', res.error);
      }
    } catch (err: any) {
      Alert.alert('Share Error', err.message || 'Failed to share catalogue.');
    } finally {
      setSharingId(null);
    }
  };

  // --- EDITOR / CREATION FLOW ---
  const openCreateModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormModel('');
    setFormBrand('Daikin');
    setFormCustomBrand('');
    setIsAddingNewBrand(false);
    setFormAcType('SPLIT');
    setFormCategory('MAIN_UNIT');
    setFormStock('10');
    setFormPrice('35000');
    setFormUnit('Nos');
    setFormDescription('');
    setFormImages([]);

    // Default initial IDU + ODU combination table
    const initialCombination: IduOduCombination = {
      id: `comb_${Date.now()}`,
      iduModel: 'FTKM35TV16U',
      oduModel: 'RKM35TV16U',
      coolingCapacity: '3.52 kW',
      iseerRating: '5.20 Wh/Wh',
      annualPowerConsumption: '523.5 kWh',
      iduColour: 'White',
      specRows: DEFAULT_SPEC_ATTRIBUTES.map((a, idx) => ({
        id: `row_${Date.now()}_${idx}`,
        attribute: a.attribute,
        unit: a.unit,
        value: a.defaultValue,
      })),
    };
    setFormCombinations([initialCombination]);
    setEditorVisible(true);
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setFormName(product.name || '');
    setFormModel(product.model || '');
    const currentBrand = extractBrand(product);
    if (DEFAULT_BRANDS.includes(currentBrand)) {
      setFormBrand(currentBrand);
      setIsAddingNewBrand(false);
    } else {
      setFormBrand('OTHER');
      setFormCustomBrand(currentBrand);
      setIsAddingNewBrand(true);
    }
    setFormAcType(product.acType || 'SPLIT');
    setFormCategory(product.category || 'MAIN_UNIT');
    setFormStock(String(product.availableStock ?? 10));
    setFormPrice(String(product.defaultPrice ?? 0));
    setFormUnit(product.defaultUnit || 'Nos');
    setFormDescription(product.description || '');

    // Existing product images
    const existingImgs: ProductImageItem[] = Array.isArray(product.images)
      ? product.images.map((img: any) => ({
          id: img.id || img.storageFileName,
          storageFileName: img.storageFileName,
          imageUrl: img.imageUrl,
          signedUrl: img.signedUrl,
        }))
      : product.imageUrl
      ? [
          {
            id: 'legacy_img',
            storageFileName: '',
            imageUrl: product.imageUrl,
            signedUrl: product.imageUrl,
          },
        ]
      : [];
    setFormImages(existingImgs);

    // Existing specification combinations or generate initial from model
    let parsedCombinations: IduOduCombination[] = [];
    if (Array.isArray(product.specifications) && product.specifications.length > 0) {
      parsedCombinations = product.specifications.map((c: any, cIdx: number) => ({
        id: c.id || `comb_${cIdx}`,
        iduModel: c.iduModel || '',
        oduModel: c.oduModel || '',
        coolingCapacity: c.coolingCapacity || '',
        iseerRating: c.iseerRating || '',
        annualPowerConsumption: c.annualPowerConsumption || '',
        iduColour: c.iduColour || 'White',
        specRows: Array.isArray(c.specRows)
          ? c.specRows.map((r: any, rIdx: number) => ({
              id: r.id || `row_${cIdx}_${rIdx}`,
              attribute: r.attribute || '',
              unit: r.unit || '',
              value: r.value || '',
            }))
          : [],
      }));
    } else {
      parsedCombinations = [
        {
          id: `comb_${Date.now()}`,
          iduModel: product.model ? `${product.model}-IDU` : 'IDU Model',
          oduModel: product.model ? `${product.model}-ODU` : 'ODU Model',
          coolingCapacity: '3.50 kW',
          iseerRating: '5.20 Wh/Wh',
          annualPowerConsumption: '580 kWh',
          iduColour: 'White',
          specRows: DEFAULT_SPEC_ATTRIBUTES.map((a, idx) => ({
            id: `row_${Date.now()}_${idx}`,
            attribute: a.attribute,
            unit: a.unit,
            value: a.defaultValue,
          })),
        },
      ];
    }
    setFormCombinations(parsedCombinations);
    setEditorVisible(true);
  };

  // --- IMAGE UPLOAD LOGIC ---
  const handlePickPhotos = async (source: 'camera' | 'gallery') => {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
          allowsEditing: false,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Photo library permission is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.7,
          allowsMultipleSelection: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const selectedAssets = result.assets;
      setUploadingImageCount((prev) => prev + selectedAssets.length);

      // If already editing an existing product, upload immediately to B2
      if (editingProduct && editingProduct.id) {
        for (const asset of selectedAssets) {
          try {
            const uploadRes = await mobileApi.uploadProductImage(
              editingProduct.id,
              asset.uri,
              'image/jpeg'
            );
            if (uploadRes && uploadRes.success && uploadRes.data) {
              setFormImages((cur) => [
                ...cur,
                {
                  id: uploadRes.data.id || uploadRes.data.storageFileName,
                  storageFileName: uploadRes.data.storageFileName,
                  imageUrl: uploadRes.data.imageUrl,
                  signedUrl: uploadRes.data.signedUrl || asset.uri,
                },
              ]);
            }
          } catch (uploadErr: any) {
            Alert.alert('Upload Failed', uploadErr.message || 'Could not upload image.');
          } finally {
            setUploadingImageCount((prev) => Math.max(0, prev - 1));
          }
        }
      } else {
        // Pending upload for new product before creation
        const pendingItems: ProductImageItem[] = selectedAssets.map((a, i) => ({
          id: `pending_${Date.now()}_${i}`,
          storageFileName: '',
          imageUrl: a.uri,
          signedUrl: a.uri,
        }));
        setFormImages((cur) => [...cur, ...pendingItems]);
        setUploadingImageCount(0);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to select photos.');
      setUploadingImageCount(0);
    }
  };

  const handleRemoveImage = (img: ProductImageItem) => {
    Alert.alert(
      'Remove Product Photo',
      'Are you sure you want to remove this photo from the product catalogue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (editingProduct && editingProduct.id && img.storageFileName) {
              try {
                await mobileApi.deleteProductImage(editingProduct.id, img.storageFileName);
              } catch (delErr) {
                console.warn('[Delete photo error]', delErr);
              }
            }
            setFormImages((cur) => cur.filter((item) => item.id !== img.id));
          },
        },
      ]
    );
  };

  // --- COMBINATION TABLE MANAGEMENT ---
  const handleAddCombination = () => {
    const nextIdx = formCombinations.length + 1;
    const newCombination: IduOduCombination = {
      id: `comb_${Date.now()}`,
      iduModel: `${formModel || 'AC'}-IDU-${nextIdx}`,
      oduModel: `${formModel || 'AC'}-ODU-${nextIdx}`,
      coolingCapacity: nextIdx === 1 ? '3.50 kW' : nextIdx === 2 ? '5.00 kW' : '6.00 kW',
      iseerRating: '5.20 Wh/Wh',
      annualPowerConsumption: '650 kWh',
      iduColour: 'White',
      specRows: DEFAULT_SPEC_ATTRIBUTES.map((a, idx) => ({
        id: `row_${Date.now()}_${idx}`,
        attribute: a.attribute,
        unit: a.unit,
        value: a.defaultValue,
      })),
    };
    setFormCombinations((cur) => [...cur, newCombination]);
  };

  const handleRemoveCombination = (combId: string, iduName: string) => {
    Alert.alert(
      'Delete Specification Table',
      `Are you sure you want to delete the complete specification table for IDU model "${iduName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Table',
          style: 'destructive',
          onPress: () => {
            setFormCombinations((cur) => cur.filter((c) => c.id !== combId));
          },
        },
      ]
    );
  };

  const handleAddSpecRow = (combId: string) => {
    const newRow: SpecRow = {
      id: `row_${Date.now()}`,
      attribute: 'New Attribute',
      unit: '',
      value: 'Specification value',
    };
    setFormCombinations((cur) =>
      cur.map((c) => (c.id === combId ? { ...c, specRows: [...c.specRows, newRow] } : c))
    );
  };

  const handleRemoveSpecRow = (combId: string, rowId: string, attrName: string) => {
    Alert.alert(
      'Delete Specification Row',
      `Delete technical attribute "${attrName}" from this table?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setFormCombinations((cur) =>
              cur.map((c) =>
                c.id === combId
                  ? { ...c, specRows: c.specRows.filter((r) => r.id !== rowId) }
                  : c
              )
            );
          },
        },
      ]
    );
  };

  const handleUpdateCombinationField = (
    combId: string,
    field: keyof Omit<IduOduCombination, 'specRows' | 'id'>,
    val: string
  ) => {
    setFormCombinations((cur) =>
      cur.map((c) => (c.id === combId ? { ...c, [field]: val } : c))
    );
  };

  const handleUpdateSpecRow = (
    combId: string,
    rowId: string,
    field: 'attribute' | 'unit' | 'value',
    val: string
  ) => {
    setFormCombinations((cur) =>
      cur.map((c) =>
        c.id === combId
          ? {
              ...c,
              specRows: c.specRows.map((r) => (r.id === rowId ? { ...r, [field]: val } : r)),
            }
          : c
      )
    );
  };

  // --- SAVE PRODUCT CATALOGUE ---
  const handleSaveProduct = async () => {
    if (!formName.trim()) {
      Alert.alert('Required Field', 'Please enter a product or model name.');
      return;
    }

    const finalBrand = isAddingNewBrand
      ? formCustomBrand.trim() || 'Other'
      : formBrand;

    const priceNum = parseFloat(formPrice) || 0;
    const stockNum = parseInt(formStock, 10) || 0;

    setIsSaving(true);
    try {
      const payload: any = {
        name: formName.trim(),
        model: formModel.trim() || null,
        brand: finalBrand,
        category: formCategory,
        acType: formAcType,
        description: formDescription.trim(),
        defaultPrice: priceNum,
        availableStock: stockNum,
        defaultUnit: formUnit.trim() || 'Nos',
        specifications: formCombinations,
        images: formImages.filter((img) => !img.id.startsWith('pending_')),
      };

      if (editingProduct && editingProduct.id) {
        // UPDATE EXISTING
        const res = await mobileApi.updateProduct(editingProduct.id, payload);
        if (res && res.success) {
          Alert.alert('Saved', `Product catalogue '${formName}' updated successfully.`);
          setEditorVisible(false);
          await fetchProducts(true);
        } else {
          throw new Error(res?.message || 'Failed to update catalogue entry.');
        }
      } else {
        // CREATE NEW PRODUCT
        const res = await mobileApi.createProduct(payload);
        if (res && res.success && res.data) {
          const newId = res.data.id;

          // If pending photos were chosen before creation, upload them now
          const pendingPhotos = formImages.filter((img) => img.id.startsWith('pending_'));
          for (const pending of pendingPhotos) {
            try {
              await mobileApi.uploadProductImage(newId, pending.signedUrl || pending.imageUrl!, 'image/jpeg');
            } catch (upErr) {
              console.warn('[Pending photo upload error]', upErr);
            }
          }

          Alert.alert('Created', `Product catalogue '${formName}' created successfully.`);
          setEditorVisible(false);
          await fetchProducts(true);
        } else {
          throw new Error(res?.message || 'Failed to create product catalogue.');
        }
      }
    } catch (saveErr: any) {
      Alert.alert('Save Error', saveErr.message || 'Could not save catalogue entry.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- DELETE COMPLETE CATALOGUE ---
  const handleDeleteProduct = (product: any) => {
    Alert.alert(
      'Delete Product Catalogue',
      `Are you sure you want to permanently delete "${product.name}"?\n\nThis will remove the product catalogue, its stock records, all specification tables, and clean up all associated product photos from storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await mobileApi.deleteProduct(product.id);
              if (res && res.success) {
                Alert.alert('Deleted', `Catalogue '${product.name}' was removed.`);
                await fetchProducts(true);
              } else {
                throw new Error(res?.message || 'Failed to delete product.');
              }
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message || 'Could not delete product.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      {/* 1. TOP HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>AC Product Catalogue</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{filteredProducts.length}</Text>
            </View>
          </View>
          <Text style={styles.headerSub}>
            Stock & Inventory • Technical Specifications • Multi-Image Catalogue
          </Text>
        </View>

        {canEdit && (
          <TouchableOpacity style={styles.addBtn} onPress={openCreateModal} activeOpacity={0.85}>
            <Text style={styles.addBtnIcon}>＋</Text>
            <Text style={styles.addBtnText}>New AC</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. SEARCH & BRAND FILTER BAR */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search model, brand, IDU/ODU code..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AC Type Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
        >
          {['ALL', ...AC_TYPES].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typePill,
                selectedAcTypeFilter === type && styles.typePillActive,
              ]}
              onPress={() => setSelectedAcTypeFilter(type)}
            >
              <Text
                style={[
                  styles.typePillText,
                  selectedAcTypeFilter === type && styles.typePillTextActive,
                ]}
              >
                {type === 'ALL' ? 'All Types' : type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Brand Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.brandPillsScroll}
        >
          {allBrands.map((b) => (
            <TouchableOpacity
              key={b}
              style={[
                styles.brandPill,
                selectedBrandFilter === b && styles.brandPillActive,
              ]}
              onPress={() => setSelectedBrandFilter(b)}
            >
              <Text
                style={[
                  styles.brandPillText,
                  selectedBrandFilter === b && styles.brandPillTextActive,
                ]}
              >
                {b === 'ALL' ? 'All Brands' : b}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 3. PRODUCT CATALOGUE LIST */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading AC Product Catalogue…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 24) + 60 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                fetchProducts(true);
              }}
              colors={['#0066CC']}
            />
          }
        >
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>❄️</Text>
              <Text style={styles.emptyTitle}>No AC Models Found</Text>
              <Text style={styles.emptySub}>
                {searchQuery || selectedBrandFilter !== 'ALL'
                  ? 'Try clearing the search query or changing the brand filter.'
                  : 'Get started by creating your first AC product catalogue entry.'}
              </Text>
              {canEdit && (
                <TouchableOpacity style={styles.emptyActionBtn} onPress={openCreateModal}>
                  <Text style={styles.emptyActionText}>+ Create AC Product Catalogue</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredProducts.map((p) => {
              const brand = extractBrand(p);
              const combinations = Array.isArray(p.specifications) ? p.specifications : [];
              const images: any[] = Array.isArray(p.images) ? p.images : [];
              const mainThumb =
                images.length > 0
                  ? images[0].signedUrl || images[0].imageUrl || mobileApi.getProductImageUrl(images[0].storageFileName)
                  : p.imageUrl;

              const inStock = (p.availableStock ?? 0) > 0;
              const isDownloading = downloadingId === p.id;
              const isSharing = sharingId === p.id;

              return (
                <View key={p.id} style={styles.productCard}>
                  {/* Card Header & Brand Tags */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.brandRow}>
                      <View style={styles.brandBadge}>
                        <Text style={styles.brandBadgeText}>{brand}</Text>
                      </View>
                      <View style={styles.acTypeBadge}>
                        <Text style={styles.acTypeBadgeText}>{p.acType || 'SPLIT'}</Text>
                      </View>
                    </View>

                    {/* Stock pill */}
                    <View style={[styles.stockPill, inStock ? styles.stockPillIn : styles.stockPillOut]}>
                      <View style={[styles.stockDot, inStock ? styles.stockDotIn : styles.stockDotOut]} />
                      <Text style={[styles.stockText, inStock ? styles.stockTextIn : styles.stockTextOut]}>
                        {p.availableStock ?? 0} {p.defaultUnit || 'Nos'} in stock
                      </Text>
                    </View>
                  </View>

                  {/* Body: Thumbnail + Info */}
                  <View style={styles.cardBody}>
                    {/* Thumbnail with zoom/click to view full screen */}
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={styles.thumbWrapper}
                      onPress={() => {
                        const imgUrls = images.length > 0
                          ? images.map((img) => img.signedUrl || img.imageUrl || mobileApi.getProductImageUrl(img.storageFileName))
                          : mainThumb ? [mainThumb] : [];
                        if (imgUrls.length > 0) openImageViewer(imgUrls, 0);
                        else openCataloguePreview(p);
                      }}
                    >
                      {mainThumb ? (
                        <Image source={{ uri: mainThumb }} style={styles.thumbImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.thumbPlaceholder}>
                          <Text style={{ fontSize: 28 }}>❄️</Text>
                          <Text style={styles.thumbPlaceholderText}>No Photo</Text>
                        </View>
                      )}

                      {/* Photo count indicator */}
                      {images.length > 1 && (
                        <View style={styles.photoCountBadge}>
                          <Text style={styles.photoCountText}>📷 {images.length}</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Product Name, Model, Rates */}
                    <View style={styles.cardInfo}>
                      <Text style={styles.productTitle} numberOfLines={2}>
                        {p.name}
                      </Text>
                      {p.model && (
                        <Text style={styles.productModel} numberOfLines={1}>
                          Model: {p.model}
                        </Text>
                      )}

                      <View style={styles.rateRow}>
                        <Text style={styles.priceLabel}>Catalogue Rate:</Text>
                        <Text style={styles.priceValue}>
                          ₹{(p.defaultPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </Text>
                      </View>

                      {/* Combinations count pill */}
                      <View style={styles.combCountRow}>
                        <Text style={styles.combCountText}>
                          📊 {combinations.length > 0 ? `${combinations.length} IDU/ODU Combination${combinations.length > 1 ? 's' : ''}` : 'Specifications Ready'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Card Actions: Preview, Download, Share, Edit, Delete */}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={styles.previewBtn}
                      onPress={() => openCataloguePreview(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.previewBtnText}>👁️ View Specs</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleDownloadPdf(p)}
                      disabled={isDownloading || isSharing}
                      activeOpacity={0.8}
                    >
                      {isDownloading ? (
                        <ActivityIndicator size="small" color="#0066CC" />
                      ) : (
                        <Text style={styles.iconActionText}>⬇️ PDF</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => handleShareCatalogue(p)}
                      disabled={isDownloading || isSharing}
                      activeOpacity={0.8}
                    >
                      {isSharing ? (
                        <ActivityIndicator size="small" color="#0066CC" />
                      ) : (
                        <Text style={styles.iconActionText}>↗️ Share</Text>
                      )}
                    </TouchableOpacity>

                    {canEdit && (
                      <>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => openEditModal(p)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.editBtnText}>✏️ Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDeleteProduct(p)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.deleteBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* 4. FULL-SCREEN IMAGE VIEWER MODAL (With close, nav, and zoom)            */}
      {/* ========================================================================= */}
      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeImageViewer}
      >
        <View style={styles.viewerOverlay}>
          {/* Top Bar with Close and Counter */}
          <View style={[styles.viewerTopBar, { paddingTop: Math.max(insets.top, 16) }]}>
            <View style={styles.viewerCounterBox}>
              <Text style={styles.viewerCounterText}>
                {viewerIndex + 1} / {viewerImages.length}
              </Text>
            </View>
            <TouchableOpacity style={styles.viewerCloseBtn} onPress={closeImageViewer}>
              <Text style={styles.viewerCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Zoomable Image Container */}
          <ScrollView
            style={styles.viewerScrollView}
            contentContainerStyle={styles.viewerScrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {viewerImages.length > 0 && (
              <Image
                source={{ uri: viewerImages[viewerIndex] }}
                style={styles.viewerMainImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>

          {/* Left / Right Navigation Buttons */}
          {viewerImages.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.viewerNavArrow, styles.viewerNavArrowLeft, viewerIndex === 0 && styles.viewerNavDisabled]}
                disabled={viewerIndex === 0}
                onPress={() => setViewerIndex((i) => Math.max(0, i - 1))}
              >
                <Text style={styles.viewerNavText}>‹</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewerNavArrow, styles.viewerNavArrowRight, viewerIndex === viewerImages.length - 1 && styles.viewerNavDisabled]}
                disabled={viewerIndex === viewerImages.length - 1}
                onPress={() => setViewerIndex((i) => Math.min(viewerImages.length - 1, i + 1))}
              >
                <Text style={styles.viewerNavText}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 5. COMPLETE CATALOGUE PREVIEW MODAL                                      */}
      {/* ========================================================================= */}
      <Modal
        visible={previewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.previewSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Sheet Handle & Close */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => setPreviewModalVisible(false)}
              >
                <Text style={styles.sheetCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {previewProduct && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.previewContent}>
                {/* Header details */}
                <View style={styles.previewTopRow}>
                  <View style={styles.brandBadge}>
                    <Text style={styles.brandBadgeText}>{extractBrand(previewProduct)}</Text>
                  </View>
                  <View style={styles.acTypeBadge}>
                    <Text style={styles.acTypeBadgeText}>{previewProduct.acType || 'SPLIT'}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.previewStockBadge}>
                    Stock: {previewProduct.availableStock ?? 0} {previewProduct.defaultUnit || 'Nos'}
                  </Text>
                </View>

                <Text style={styles.previewTitle}>{previewProduct.name}</Text>
                {previewProduct.model && (
                  <Text style={styles.previewModelText}>Series / Model: {previewProduct.model}</Text>
                )}

                {/* Product Images Gallery Carousel in Preview */}
                {Array.isArray(previewProduct.images) && previewProduct.images.length > 0 && (
                  <View style={styles.previewGallerySection}>
                    <Text style={styles.previewSectionHeader}>Product Photographs</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewGalleryScroll}>
                      {previewProduct.images.map((img: any, idx: number) => {
                        const uri = img.signedUrl || img.imageUrl || mobileApi.getProductImageUrl(img.storageFileName);
                        return (
                          <TouchableOpacity
                            key={img.id || idx}
                            activeOpacity={0.85}
                            onPress={() => {
                              const allUrls = previewProduct.images.map((x: any) =>
                                x.signedUrl || x.imageUrl || mobileApi.getProductImageUrl(x.storageFileName)
                              );
                              openImageViewer(allUrls, idx);
                            }}
                            style={styles.previewGalleryThumb}
                          >
                            <Image source={{ uri }} style={styles.previewGalleryImg} resizeMode="cover" />
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Description */}
                {previewProduct.description && (
                  <View style={styles.previewDescBox}>
                    <Text style={styles.previewDescText}>{previewProduct.description}</Text>
                  </View>
                )}

                {/* Separate IDU & ODU Specification Tables */}
                <View style={styles.previewTablesSection}>
                  <Text style={styles.previewSectionHeader}>
                    Technical Specifications (Separate IDU + ODU Tables)
                  </Text>

                  {(Array.isArray(previewProduct.specifications) && previewProduct.specifications.length > 0
                    ? previewProduct.specifications
                    : [
                        {
                          id: 'def',
                          iduModel: previewProduct.model ? `${previewProduct.model}-IDU` : 'IDU',
                          oduModel: previewProduct.model ? `${previewProduct.model}-ODU` : 'ODU',
                          coolingCapacity: '3.50 kW',
                          iseerRating: '5.20 Wh/Wh',
                          annualPowerConsumption: '580 kWh',
                          iduColour: 'White',
                          specRows: DEFAULT_SPEC_ATTRIBUTES.map((a, i) => ({
                            id: `r_${i}`,
                            attribute: a.attribute,
                            unit: a.unit,
                            value: a.defaultValue,
                          })),
                        },
                      ]
                  ).map((comb: any, cIdx: number) => (
                    <View key={comb.id || cIdx} style={styles.specTableCard}>
                      {/* Table Header */}
                      <View style={styles.specTableHeader}>
                        <Text style={styles.specTableTitle}>
                          Table {cIdx + 1}: IDU [{comb.iduModel || '—'}] + ODU [{comb.oduModel || '—'}]
                        </Text>
                      </View>

                      {/* 4 Metric Highlights */}
                      <View style={styles.metricsGrid}>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>Cooling Capacity</Text>
                          <Text style={styles.metricValue}>{comb.coolingCapacity || '—'}</Text>
                        </View>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>ISEER Rating</Text>
                          <Text style={styles.metricValue}>{comb.iseerRating || '—'}</Text>
                        </View>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>Annual Power</Text>
                          <Text style={styles.metricValue}>{comb.annualPowerConsumption || '—'}</Text>
                        </View>
                        <View style={styles.metricCell}>
                          <Text style={styles.metricLabel}>IDU Colour</Text>
                          <Text style={styles.metricValue}>{comb.iduColour || '—'}</Text>
                        </View>
                      </View>

                      {/* Specification Rows */}
                      {Array.isArray(comb.specRows) && comb.specRows.length > 0 && (
                        <View style={styles.tableRowsContainer}>
                          <View style={styles.tableRowHeader}>
                            <Text style={[styles.colAttr, styles.tableHeaderCellText]}>Attribute</Text>
                            <Text style={[styles.colUnit, styles.tableHeaderCellText]}>Unit</Text>
                            <Text style={[styles.colVal, styles.tableHeaderCellText]}>Value</Text>
                          </View>
                          {comb.specRows.map((r: any, rIdx: number) => (
                            <View
                              key={r.id || rIdx}
                              style={[styles.tableDataRow, rIdx % 2 === 1 && styles.tableDataRowAlt]}
                            >
                              <Text style={[styles.colAttr, styles.tableDataText]}>{r.attribute}</Text>
                              <Text style={[styles.colUnit, styles.tableDataUnit]}>{r.unit || '—'}</Text>
                              <Text style={[styles.colVal, styles.tableDataValue]}>{r.value}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>

                {/* Action Buttons */}
                <View style={styles.previewActionRow}>
                  <TouchableOpacity
                    style={styles.modalDownloadBtn}
                    onPress={() => handleDownloadPdf(previewProduct)}
                    disabled={downloadingId === previewProduct.id}
                  >
                    {downloadingId === previewProduct.id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Text style={{ fontSize: 16, marginRight: 6 }}>⬇️</Text>
                        <Text style={styles.modalDownloadText}>Save / Download PDF</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalShareBtn}
                    onPress={() => handleShareCatalogue(previewProduct)}
                    disabled={sharingId === previewProduct.id}
                  >
                    {sharingId === previewProduct.id ? (
                      <ActivityIndicator color="#0066CC" size="small" />
                    ) : (
                      <>
                        <Text style={{ fontSize: 16, marginRight: 6 }}>↗️</Text>
                        <Text style={styles.modalShareText}>Share with Customer</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 6. CREATE / EDIT COMPLETE CATALOGUE ENTRY MODAL                          */}
      {/* ========================================================================= */}
      <Modal
        visible={editorVisible}
        animationType="slide"
        onRequestClose={() => {
          if (!isSaving) setEditorVisible(false);
        }}
      >
        <View style={[styles.editorPage, { paddingTop: Math.max(insets.top, 8) }]}>
          {/* Header */}
          <View style={styles.editorHeader}>
            <TouchableOpacity
              style={styles.editorBackBtn}
              onPress={() => setEditorVisible(false)}
              disabled={isSaving}
            >
              <Text style={styles.editorBackText}>✕</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.editorHeaderTitle}>
                {editingProduct ? 'Edit AC Product Catalogue' : 'New AC Product Catalogue'}
              </Text>
              <Text style={styles.editorHeaderSub}>
                Maintain specifications, photos, and stock details
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.editorSaveBtn, isSaving && { opacity: 0.6 }]}
              onPress={handleSaveProduct}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.editorSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[styles.editorContent, { paddingBottom: Math.max(insets.bottom, 24) + 60 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* SECTION 1: PRODUCT CORE DETAILS */}
            <View style={styles.editorSectionCard}>
              <Text style={styles.editorSectionTitle}>1. Product Information</Text>

              {/* Brand Selector */}
              <Text style={styles.inputLabel}>Brand</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                {DEFAULT_BRANDS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[
                      styles.editorBrandChip,
                      formBrand === b && !isAddingNewBrand && styles.editorBrandChipActive,
                    ]}
                    onPress={() => {
                      setFormBrand(b);
                      setIsAddingNewBrand(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.editorBrandChipText,
                        formBrand === b && !isAddingNewBrand && styles.editorBrandChipTextActive,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.editorBrandChip, isAddingNewBrand && styles.editorBrandChipActive]}
                  onPress={() => setIsAddingNewBrand(true)}
                >
                  <Text style={[styles.editorBrandChipText, isAddingNewBrand && styles.editorBrandChipTextActive]}>
                    + Custom Brand
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {isAddingNewBrand && (
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter brand name..."
                  value={formCustomBrand}
                  onChangeText={setFormCustomBrand}
                />
              )}

              {/* Product Name */}
              <Text style={styles.inputLabel}>Product Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. FTKM Series Inverter Split AC"
                value={formName}
                onChangeText={setFormName}
              />

              {/* Model Number / Code */}
              <Text style={styles.inputLabel}>Model Code / Series</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. FTKM Series / FTKF35"
                value={formModel}
                onChangeText={setFormModel}
              />

              {/* AC Type */}
              <Text style={styles.inputLabel}>AC Type</Text>
              <View style={styles.chipRow}>
                {AC_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.editorTypeChip, formAcType === t && styles.editorTypeChipActive]}
                    onPress={() => setFormAcType(t)}
                  >
                    <Text
                      style={[
                        styles.editorTypeChipText,
                        formAcType === t && styles.editorTypeChipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Price & Stock in 2 columns */}
              <View style={styles.twoColRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Catalogue Rate (₹)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="35000"
                    value={formPrice}
                    onChangeText={setFormPrice}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.inputLabel}>Available Stock</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    placeholder="10"
                    value={formStock}
                    onChangeText={setFormStock}
                  />
                </View>
              </View>

              {/* Description */}
              <Text style={styles.inputLabel}>Overview Description</Text>
              <TextInput
                style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Key features, series overview, customer highlights..."
                multiline
                value={formDescription}
                onChangeText={setFormDescription}
              />
            </View>

            {/* SECTION 2: MULTIPLE PRODUCT IMAGES */}
            <View style={styles.editorSectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.editorSectionTitle}>2. Product Photographs</Text>
                  <Text style={styles.sectionSubtitle}>
                    Upload multiple images (IDU, ODU, appearance) to Backblaze B2 storage
                  </Text>
                </View>
                {uploadingImageCount > 0 && (
                  <ActivityIndicator size="small" color="#0066CC" />
                )}
              </View>

              {/* Upload actions row */}
              <View style={styles.imageActionButtons}>
                <TouchableOpacity
                  style={styles.pickPhotoBtn}
                  onPress={() => handlePickPhotos('camera')}
                >
                  <Text style={styles.pickPhotoText}>📷 Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickPhotoBtn}
                  onPress={() => handlePickPhotos('gallery')}
                >
                  <Text style={styles.pickPhotoText}>🖼️ Choose Photos</Text>
                </TouchableOpacity>
              </View>

              {/* Photos Grid */}
              <View style={styles.photoGrid}>
                {formImages.map((img, idx) => {
                  const uri = img.signedUrl || img.imageUrl || mobileApi.getProductImageUrl(img.storageFileName);
                  return (
                    <View key={img.id || idx} style={styles.photoThumbCard}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          const allUris = formImages.map(
                            (x) => x.signedUrl || x.imageUrl || mobileApi.getProductImageUrl(x.storageFileName)
                          );
                          openImageViewer(allUris, idx);
                        }}
                      >
                        <Image source={{ uri }} style={styles.photoGridImg} resizeMode="cover" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.photoDeleteBtn}
                        onPress={() => handleRemoveImage(img)}
                      >
                        <Text style={styles.photoDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {formImages.length === 0 && (
                  <Text style={styles.noPhotosText}>
                    No images uploaded yet. Select 2 to 4 or more photos for this AC catalogue.
                  </Text>
                )}
              </View>
            </View>

            {/* SECTION 3: SEPARATE IDU + ODU SPECIFICATION TABLES */}
            <View style={styles.editorSectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editorSectionTitle}>
                    3. Technical Specifications (IDU + ODU Tables)
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Each IDU + ODU model combination has its own separate specification table
                  </Text>
                </View>

                <TouchableOpacity style={styles.addCombBtn} onPress={handleAddCombination}>
                  <Text style={styles.addCombBtnText}>+ Table</Text>
                </TouchableOpacity>
              </View>

              {formCombinations.map((comb, cIdx) => (
                <View key={comb.id} style={styles.combCard}>
                  {/* Combination Header */}
                  <View style={styles.combHeader}>
                    <Text style={styles.combTitle}>Table {cIdx + 1} Combination</Text>
                    {formCombinations.length > 1 && (
                      <TouchableOpacity
                        onPress={() => handleRemoveCombination(comb.id, comb.iduModel)}
                        style={styles.combDeleteBtn}
                      >
                        <Text style={styles.combDeleteText}>Delete Table</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* IDU and ODU Model inputs */}
                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.smallInputLabel}>IDU Model No. *</Text>
                      <TextInput
                        style={styles.smallTextInput}
                        value={comb.iduModel}
                        placeholder="FTKM35TV16U"
                        onChangeText={(t) => handleUpdateCombinationField(comb.id, 'iduModel', t)}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.smallInputLabel}>ODU Model No. *</Text>
                      <TextInput
                        style={styles.smallTextInput}
                        value={comb.oduModel}
                        placeholder="RKM35TV16U"
                        onChangeText={(t) => handleUpdateCombinationField(comb.id, 'oduModel', t)}
                      />
                    </View>
                  </View>

                  {/* 4 Core Rating Inputs */}
                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.smallInputLabel}>Rated Cooling Capacity</Text>
                      <TextInput
                        style={styles.smallTextInput}
                        value={comb.coolingCapacity}
                        placeholder="3.52 kW"
                        onChangeText={(t) => handleUpdateCombinationField(comb.id, 'coolingCapacity', t)}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.smallInputLabel}>ISEER Rating</Text>
                      <TextInput
                        style={styles.smallTextInput}
                        value={comb.iseerRating}
                        placeholder="5.20 Wh/Wh"
                        onChangeText={(t) => handleUpdateCombinationField(comb.id, 'iseerRating', t)}
                      />
                    </View>
                  </View>

                  <View style={styles.twoColRow}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.smallInputLabel}>Annual Power Consumption</Text>
                      <TextInput
                        style={styles.smallTextInput}
                        value={comb.annualPowerConsumption}
                        placeholder="523.5 kWh"
                        onChangeText={(t) => handleUpdateCombinationField(comb.id, 'annualPowerConsumption', t)}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.smallInputLabel}>IDU Colour</Text>
                      <TextInput
                        style={styles.smallTextInput}
                        value={comb.iduColour}
                        placeholder="White"
                        onChangeText={(t) => handleUpdateCombinationField(comb.id, 'iduColour', t)}
                      />
                    </View>
                  </View>

                  {/* Specification Rows Table Editor */}
                  <View style={styles.specRowsSection}>
                    <View style={styles.specRowsHeaderRow}>
                      <Text style={styles.specRowsTitle}>Technical Attributes</Text>
                      <TouchableOpacity
                        style={styles.addRowBtn}
                        onPress={() => handleAddSpecRow(comb.id)}
                      >
                        <Text style={styles.addRowBtnText}>+ Add Row</Text>
                      </TouchableOpacity>
                    </View>

                    {comb.specRows.map((r, rIdx) => (
                      <View key={r.id} style={styles.rowEditBox}>
                        <TextInput
                          style={[styles.smallTextInput, { flex: 2, marginRight: 4 }]}
                          value={r.attribute}
                          placeholder="Attribute"
                          onChangeText={(t) => handleUpdateSpecRow(comb.id, r.id, 'attribute', t)}
                        />
                        <TextInput
                          style={[styles.smallTextInput, { flex: 1, marginRight: 4 }]}
                          value={r.unit}
                          placeholder="Unit"
                          onChangeText={(t) => handleUpdateSpecRow(comb.id, r.id, 'unit', t)}
                        />
                        <TextInput
                          style={[styles.smallTextInput, { flex: 2, marginRight: 4 }]}
                          value={r.value}
                          placeholder="Value"
                          onChangeText={(t) => handleUpdateSpecRow(comb.id, r.id, 'value', t)}
                        />
                        <TouchableOpacity
                          style={styles.rowDeleteBtn}
                          onPress={() => handleRemoveSpecRow(comb.id, r.id, r.attribute)}
                        >
                          <Text style={styles.rowDeleteText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            {/* SAVE BUTTON */}
            <TouchableOpacity
              style={[styles.bottomSaveBtn, isSaving && { opacity: 0.6 }]}
              onPress={handleSaveProduct}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.bottomSaveText}>Save AC Product Catalogue</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
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
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066CC',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0066CC',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addBtnIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  typePillActive: {
    backgroundColor: '#0066CC',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475467',
  },
  typePillTextActive: {
    color: '#FFFFFF',
  },
  filterPillsScroll: {
    paddingVertical: 4,
  },
  brandPillsScroll: {
    paddingVertical: 4,
  },
  brandPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  brandPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  brandPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475467',
  },
  brandPillTextActive: {
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
  },
  listContent: {
    padding: 16,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    gap: 6,
  },
  brandBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0066CC',
  },
  acTypeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  acTypeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475467',
  },
  stockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  stockPillIn: {
    backgroundColor: '#ECFDF5',
  },
  stockPillOut: {
    backgroundColor: '#FEF2F2',
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  stockDotIn: {
    backgroundColor: '#10B981',
  },
  stockDotOut: {
    backgroundColor: '#EF4444',
  },
  stockText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stockTextIn: {
    color: '#065F46',
  },
  stockTextOut: {
    color: '#991B1B',
  },
  cardBody: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  thumbWrapper: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    position: 'relative',
    marginRight: 12,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  photoCountBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 20,
  },
  productModel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  priceLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  combCountRow: {
    marginTop: 4,
  },
  combCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0066CC',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  previewBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  previewBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  editBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0066CC',
  },
  deleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFF1F2',
  },
  deleteBtnText: {
    fontSize: 12,
  },

  // --- FULL SCREEN VIEWER STYLES ---
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  viewerCounterBox: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  viewerCounterText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewerCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerCloseText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  viewerScrollView: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  viewerScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerMainImage: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  viewerNavArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  viewerNavArrowLeft: {
    left: 16,
  },
  viewerNavArrowRight: {
    right: 16,
  },
  viewerNavDisabled: {
    opacity: 0.2,
  },
  viewerNavText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 34,
  },

  // --- PREVIEW MODAL STYLES ---
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'flex-end',
  },
  previewSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  sheetCloseBtn: {
    position: 'absolute',
    right: 16,
    top: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCloseText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  previewContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  previewStockBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  previewModelText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  previewGallerySection: {
    marginBottom: 14,
  },
  previewSectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewGalleryScroll: {
    flexDirection: 'row',
  },
  previewGalleryThumb: {
    width: 100,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginRight: 10,
  },
  previewGalleryImg: {
    width: '100%',
    height: '100%',
  },
  previewDescBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewDescText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  previewTablesSection: {
    marginBottom: 16,
  },
  specTableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 16,
    overflow: 'hidden',
  },
  specTableHeader: {
    backgroundColor: '#0066CC',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  specTableTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricCell: {
    width: '50%',
    padding: 10,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  tableRowsContainer: {
    padding: 8,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  tableHeaderCellText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  colAttr: {
    flex: 4,
  },
  colUnit: {
    flex: 2,
    textAlign: 'center',
  },
  colVal: {
    flex: 4,
    textAlign: 'right',
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  tableDataRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  tableDataText: {
    fontSize: 11,
    color: '#334155',
  },
  tableDataUnit: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  tableDataValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
  },
  previewActionRow: {
    gap: 10,
    marginTop: 10,
  },
  modalDownloadBtn: {
    backgroundColor: '#0066CC',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  modalDownloadText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalShareBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  modalShareText: {
    color: '#0066CC',
    fontSize: 15,
    fontWeight: '800',
  },

  // --- EDITOR MODAL STYLES ---
  editorPage: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  editorBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editorBackText: {
    fontSize: 16,
    color: '#475467',
    fontWeight: '700',
  },
  editorHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  editorHeaderSub: {
    fontSize: 11,
    color: '#64748B',
  },
  editorSaveBtn: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 64,
    alignItems: 'center',
  },
  editorSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  editorContent: {
    padding: 16,
  },
  editorSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  editorSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475467',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  editorBrandChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  editorBrandChipActive: {
    backgroundColor: '#0066CC',
  },
  editorBrandChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475467',
  },
  editorBrandChipTextActive: {
    color: '#FFFFFF',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  editorTypeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editorTypeChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  editorTypeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475467',
  },
  editorTypeChipTextActive: {
    color: '#FFFFFF',
  },
  twoColRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  imageActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  pickPhotoBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickPhotoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumbCard: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  photoGridImg: {
    width: '100%',
    height: '100%',
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,23,42,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoDeleteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  noPhotosText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  addCombBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addCombBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0066CC',
  },
  combCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    marginBottom: 14,
  },
  combHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  combTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066CC',
  },
  combDeleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFF1F2',
  },
  combDeleteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E11D48',
  },
  smallInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475467',
    marginBottom: 3,
    marginTop: 6,
  },
  smallTextInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  specRowsSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  specRowsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  specRowsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  addRowBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  addRowBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0066CC',
  },
  rowEditBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowDeleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowDeleteText: {
    color: '#E11D48',
    fontSize: 11,
    fontWeight: '800',
  },
  bottomSaveBtn: {
    backgroundColor: '#0066CC',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  bottomSaveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

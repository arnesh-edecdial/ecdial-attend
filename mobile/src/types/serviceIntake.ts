// Service Intake — mobile types. Import alongside the project's existing ../types.

export type ServiceStatus = 'NOT_STARTED' | 'ONGOING' | 'SENT_FOR_REPAIR' | 'REPAIRED' | 'NOT_REPAIRED';
export type TakingTo = 'SHOWROOM' | 'OFFICE' | 'SERVICE_CENTER';
export type UnitType = 'INDOOR_UNIT' | 'OUTDOOR_UNIT' | 'MOTOR' | 'PCB_BOARD' | 'FAN' | 'COMPRESSOR' | 'CAPACITOR' | 'OTHER';

export const ITEM_TYPE_LABELS: Record<UnitType, string> = {
  INDOOR_UNIT: 'Indoor Unit', OUTDOOR_UNIT: 'Outdoor Unit', MOTOR: 'Motor',
  PCB_BOARD: 'PCB Board', FAN: 'Fan', COMPRESSOR: 'Compressor', CAPACITOR: 'Capacitor', OTHER: 'Other / Custom',
};
export const ITEM_TYPE_OPTIONS: UnitType[] = ['INDOOR_UNIT','OUTDOOR_UNIT','MOTOR','PCB_BOARD','FAN','COMPRESSOR','CAPACITOR','OTHER'];

export const STATUS_LABELS: Record<ServiceStatus, string> = {
  NOT_STARTED: 'Not Yet Processed',
  ONGOING: 'Ongoing',
  SENT_FOR_REPAIR: 'Sent for Repair',
  REPAIRED: 'Repaired',
  NOT_REPAIRED: 'Not Repaired',
};
export const STATUS_ORDER: ServiceStatus[] = ['NOT_STARTED', 'ONGOING', 'SENT_FOR_REPAIR', 'REPAIRED', 'NOT_REPAIRED'];
export const STATUS_COLORS: Record<ServiceStatus, { bg: string; text: string; border: string }> = {
  NOT_STARTED: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  ONGOING: { bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A' },
  SENT_FOR_REPAIR: { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' },
  REPAIRED: { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  NOT_REPAIRED: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
};

export const TAKING_TO_LABELS: Record<TakingTo, string> = {
  SHOWROOM: 'ECDIAL Showroom',
  OFFICE: 'ECDIAL Office',
  SERVICE_CENTER: 'Service Center',
};

export const UNIT_TYPE_LABELS = ITEM_TYPE_LABELS;

export interface ServiceIntakeCustomer {
  id: string;
  name: string | null;
  mobile: string | null;
  address?: string | null;
}

export interface ServiceIntakeImage {
  id: string;
  itemId: string | null;
  storageFileName: string;
  createdAt: string;
  uploadedById?: string | null;
}

export interface ServiceIntakeItem {
  id: string;
  intakeId: string;
  itemType: UnitType;
  itemTypeLabel: string;
  itemName: string | null;
  problems: string[];
  identifierType: string | null;
  identifierValue: string | null;
  productId: string | null;
  productModel: string | null;
  serialNumber: string | null;
  status: ServiceStatus;
  responsibleEmployeeId: string | null;
  responsibleEmployeeName: string | null;
  notes: string | null;
  createdAt: string;
  images?: ServiceIntakeImage[];
}

export interface ServiceIntakeEvent {
  id: string;
  itemId: string | null;
  eventType: string;
  title: string;
  description: string | null;
  performedByName: string;
  createdAt: string;
}

export interface ServiceIntake {
  id: string;
  intakeNumber: string;
  customerId: string | null;
  customer: ServiceIntakeCustomer | null;
  customerName: string | null; // legacy fallback
  siteName: string | null;
  problems: string[];
  takingTo: TakingTo | null;
  status: ServiceStatus;
  lifecycleStatus?: 'OPEN' | 'CLOSED' | 'ARCHIVED';
  notes: string | null;
  receivedAt: string;
  closedAt: string | null;
  ageDays: number;
  createdBy: { id: string; name: string; employeeCode?: string };
  items: ServiceIntakeItem[];
  images?: ServiceIntakeImage[];
  events?: ServiceIntakeEvent[];
}

export interface ServiceIntakeOptions {
  sites: string[];
  problems: string[];
  takingTo: { key: TakingTo; label: string }[];
  statuses: { key: ServiceStatus; label: string }[];
  unknownProblem: string;
}

export interface NewUnitInput {
  itemType: UnitType;
  itemName?: string;
  productId?: string | null;
  identifierType?: string;
  identifierValue?: string;
  serialNumber?: string;
  notes?: string;
  /** local-only until the intake is created */
  localImages: { uri: string }[];
}

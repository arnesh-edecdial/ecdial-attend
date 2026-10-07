export type ServiceStatus = 'NOT_STARTED' | 'ONGOING' | 'SENT_FOR_REPAIR' | 'REPAIRED' | 'NOT_REPAIRED';
export type TakingTo = 'SHOWROOM' | 'OFFICE' | 'SERVICE_CENTER';
export type ItemType = 'INDOOR_UNIT' | 'OUTDOOR_UNIT' | 'MOTOR' | 'PCB_BOARD' | 'OTHER';
export type UnitType = ItemType;

export const STATUS_LABELS: Record<ServiceStatus, string> = {
  NOT_STARTED: 'Not Yet Processed',
  ONGOING: 'Ongoing',
  SENT_FOR_REPAIR: 'Sent for Repair',
  REPAIRED: 'Repaired',
  NOT_REPAIRED: 'Not Repaired',
};
export const STATUS_ORDER: ServiceStatus[] = ['NOT_STARTED', 'ONGOING', 'SENT_FOR_REPAIR', 'REPAIRED', 'NOT_REPAIRED'];
export const STATUS_COLORS: Record<ServiceStatus, { bg: string; text: string; border: string }> = {
  NOT_STARTED: { bg: '#F2F4F7', text: '#475467', border: '#D0D5DD' },
  ONGOING: { bg: '#FFF8E1', text: '#9A6700', border: '#F2D37A' },
  SENT_FOR_REPAIR: { bg: '#F4EEFF', text: '#6B46C1', border: '#D9C6FF' },
  REPAIRED: { bg: '#ECFDF3', text: '#067647', border: '#A6F4C5' },
  NOT_REPAIRED: { bg: '#FEF3F2', text: '#B42318', border: '#FECACA' },
};
export const TAKING_TO_LABELS: Record<TakingTo, string> = {
  SHOWROOM: 'ECDIAL Showroom', OFFICE: 'ECDIAL Office', SERVICE_CENTER: 'Service Center',
};
export const UNIT_TYPE_LABELS: Record<ItemType, string> = {
  INDOOR_UNIT: 'Indoor Unit', OUTDOOR_UNIT: 'Outdoor Unit', MOTOR: 'Motor', PCB_BOARD: 'PCB Board', OTHER: 'Other',
};
export const ITEM_TYPE_OPTIONS: ItemType[] = ['INDOOR_UNIT', 'OUTDOOR_UNIT', 'MOTOR', 'PCB_BOARD', 'OTHER'];

export interface ServiceIntakeCustomer { id: string; name: string | null; mobile: string | null; address?: string | null; }
export interface ServiceIntakeImage {
  id: string; itemId: string | null; storageFileName: string; createdAt: string; uploadedById?: string | null;
  signedUrl?: string | null;
}
export interface ServiceIntakeItem {
  id: string; intakeId: string; itemType: ItemType; itemTypeLabel: string | null; itemName?: string | null;
  identifierType?: string | null; identifierValue?: string | null;
  productId: string | null; productModel: string | null; serialNumber: string | null;
  problems?: string[]; status: ServiceStatus; responsibleEmployeeId: string | null; responsibleEmployeeName: string | null;
  notes: string | null; createdAt: string; images?: ServiceIntakeImage[];
}
export interface ServiceIntakeEvent { id: string; itemId: string | null; eventType: string; title: string; description: string | null; performedByName: string; createdAt: string; }
export interface ServiceIntake {
  id: string; intakeNumber: string; customerId: string | null; customer: ServiceIntakeCustomer | null; customerName: string | null;
  siteName: string | null; problems: string[]; takingTo: TakingTo | null; status: ServiceStatus; lifecycleStatus?: string | null;
  notes: string | null; receivedAt: string; closedAt: string | null; ageDays: number;
  createdBy: { id: string; name: string; employeeCode?: string }; items: ServiceIntakeItem[]; images?: ServiceIntakeImage[]; events?: ServiceIntakeEvent[];
}
export interface ServiceIntakeOptions {
  sites: string[]; problems: string[]; takingTo: { key: TakingTo; label: string }[]; statuses: { key: ServiceStatus; label: string }[]; unknownProblem: string;
}
export interface NewUnitInput { itemType: ItemType; itemName?: string; productId?: string | null; identifierType?: string; identifierValue?: string; serialNumber?: string; notes?: string; localImages: { uri: string }[]; }

/**
 * Service Intake — central configuration.
 * Change defaults here; custom sites/problems added by users are stored in the
 * ServiceIntakeOption table and merged with these at read time.
 */

export const STATUSES = ['NOT_STARTED', 'ONGOING', 'SENT_FOR_REPAIR', 'REPAIRED', 'NOT_REPAIRED'] as const;
export type ServiceStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<ServiceStatus, string> = {
  NOT_STARTED: 'Not Yet Processed',
  ONGOING: 'Ongoing',
  SENT_FOR_REPAIR: 'Sent for Repair',
  REPAIRED: 'Repaired',
  NOT_REPAIRED: 'Not Repaired',
};

/** Statuses that end the service (aging stops at closedAt). */
export const TERMINAL_STATUSES: ServiceStatus[] = ['REPAIRED', 'NOT_REPAIRED'];

export const TAKING_TO = [
  { key: 'SHOWROOM', label: 'ECDIAL Office' },
  { key: 'OFFICE', label: 'DAIKIN Ofiice' },
  { key: 'SERVICE_CENTER', label: 'Service Center' },
] as const;
export const TAKING_TO_KEYS: string[] = TAKING_TO.map((t) => t.key);
export const takingToLabel = (key?: string | null) => TAKING_TO.find((t) => t.key === key)?.label ?? null;

/** Generic service-item types. Legacy rows remain supported. */
export const ITEM_TYPE_LABELS: Record<string, string> = {
  INDOOR_UNIT: 'Indoor Unit',
  OUTDOOR_UNIT: 'Outdoor Unit',
  MOTOR: 'Motor',
  PCB_BOARD: 'PCB Board',
  FAN: 'Fan',
  COMPRESSOR: 'Compressor',
  CAPACITOR: 'Capacitor',
  OTHER: 'Other',
};

export const DEFAULT_SITES = ['Home', 'Office', 'Showroom', 'Shop', 'Warehouse', 'Project Site', 'Customer Site'];

export const DEFAULT_PROBLEMS = [
  'PCB Board Problem',
  'Cooling Problem',
  'No Power',
  'Water Leakage',
  'Noise Problem',
  'Compressor Problem',
  'Fan/Motor Problem',
  'Display Problem',
  'Remote Problem',
  'Gas/Leak Problem',
  'Other',
  'Unknown Problem',
];
export const UNKNOWN_PROBLEM = 'Unknown Problem';

/** Roles allowed to change the customer, remove other people's photos, or archive. */
export const PRIVILEGED_ROLES = ['ADMIN', 'SERVICE_MANAGER', 'IT_ADMIN', 'MANAGER'];

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const LIMITS = { label: 60, site: 80, serial: 80, identifier: 120, notes: 2000, maxProblems: 10, itemName: 80 };
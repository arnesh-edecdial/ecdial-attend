export type UserRole =
  | 'ADMIN'
  | 'TECHNICIAN'
  | 'SALES'
  | 'SERVICE_MANAGER'
  | 'CRM'
  | 'ACCOUNTANT'
  | 'HR'
  | 'IT_ADMIN'
  | 'MANAGER';

/**
 * ADMIN is the ONLY role that skips attendance.
 * All other working roles MUST mark attendance.
 */
export const canSkipAttendance = (role?: string | null): boolean => {
  if (!role) return false;
  return role.toUpperCase() === 'ADMIN';
};

/**
 * Normalizes any database or legacy role string to a valid UserRole.
 */
export const normalizeRole = (role?: string | null): UserRole => {
  if (!role) return 'TECHNICIAN';
  const upper = role.toUpperCase();
  const validRoles: UserRole[] = [
    'ADMIN',
    'TECHNICIAN',
    'SALES',
    'SERVICE_MANAGER',
    'CRM',
    'ACCOUNTANT',
    'HR',
    'IT_ADMIN',
    'MANAGER',
  ];
  return validRoles.includes(upper as UserRole) ? (upper as UserRole) : 'TECHNICIAN';
};

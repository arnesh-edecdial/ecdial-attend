export interface UrgencyBadge {
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  cardBorder?: string;
  isUrgent: boolean;
}

/**
 * Calculates human-readable waiting age and visual urgency colors.
 * - Today: neutral / low urgency (e.g. gray / soft blue)
 * - 1 Day: normal warning indication (Amber)
 * - 2 Days: stronger warning indication (Orange)
 * - 3+ Days: high urgency (Red)
 * - Emergency priority: Prominently highlighted immediately regardless of creation date.
 */
export function calculateRequirementUrgency(requestedAt: string | Date, priority: string = 'NORMAL'): UrgencyBadge {
  const reqDate = new Date(requestedAt);
  const now = new Date();

  // Calendar day difference
  const diffMs = Math.max(0, now.getTime() - reqDate.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let ageLabel = 'Today';
  if (diffDays === 1) ageLabel = '1 day';
  else if (diffDays === 2) ageLabel = '2 days';
  else if (diffDays >= 3) ageLabel = `${diffDays} days`;

  const isEmergency = priority?.toUpperCase() === 'EMERGENCY';
  const isUrgent = priority?.toUpperCase() === 'URGENT';

  // 1. Emergency priority is immediately visually prominent
  if (isEmergency) {
    return {
      label: `🚨 ${ageLabel} • EMERGENCY`,
      badgeBg: '#FEE2E2',
      badgeText: '#B91C1C',
      borderColor: '#F87171',
      cardBorder: '#FCA5A5',
      isUrgent: true,
    };
  }

  // 2. High urgency: 3+ days old
  if (diffDays >= 3) {
    return {
      label: `⚠️ ${ageLabel} waiting`,
      badgeBg: '#FEE2E2',
      badgeText: '#B91C1C',
      borderColor: '#FCA5A5',
      cardBorder: '#FECACA',
      isUrgent: true,
    };
  }

  // 3. Stronger warning: 2 days old or marked Urgent
  if (diffDays === 2 || isUrgent) {
    return {
      label: isUrgent ? `⚡ ${ageLabel} • URGENT` : `⏳ 2 days waiting`,
      badgeBg: '#FFEDD5',
      badgeText: '#C2410C',
      borderColor: '#FDBA74',
      isUrgent: true,
    };
  }

  // 4. Normal warning: 1 day old
  if (diffDays === 1) {
    return {
      label: `⏱️ 1 day waiting`,
      badgeBg: '#FEF3C7',
      badgeText: '#B45309',
      borderColor: '#FDE68A',
      isUrgent: false,
    };
  }

  // 5. Today: Neutral / low urgency
  return {
    label: `⏱️ Today`,
    badgeBg: '#F1F5F9',
    badgeText: '#475569',
    borderColor: '#E2E8F0',
    isUrgent: false,
  };
}

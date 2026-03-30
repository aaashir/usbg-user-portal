// Client-safe utilities shared between grant components

export function halfMonthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const half = d.getUTCDate() <= 15 ? 'H1' : 'H2';
  return `${y}-${m}-${half}`;
}

const abbrToName: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

export function normalizeState(state: string): string {
  const raw = state.trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const cleaned = raw.replace(/\(.*?\)/g, '').trim();
  const upper = cleaned.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return abbrToName[upper] ?? upper;
  const lower = cleaned.toLowerCase();
  for (const v of Object.values(abbrToName)) {
    if (v.toLowerCase() === lower) return v;
  }
  return cleaned;
}

/** Returns the Firestore doc ID and localStorage key for state matches cache */
export function matchesCacheKeys(rawState: string) {
  const normalized = normalizeState(rawState);
  const mk = halfMonthKey();
  const safeState = normalized.toLowerCase().replace(/\s+/g, '_');
  return {
    firestoreDocId: `matches_${safeState}_${mk}`,
    localStorageKey: `grants_matches_${safeState}_${mk}`,
    normalizedState: normalized,
  };
}

/** Returns the Firestore doc ID and localStorage key for deadlines cache */
export function deadlinesCacheKeys() {
  const mk = halfMonthKey();
  return {
    firestoreDocId: `deadlines_${mk}`,
    localStorageKey: `grants_deadlines_${mk}`,
  };
}

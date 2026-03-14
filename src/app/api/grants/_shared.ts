import { createHash } from 'crypto';

export type GrantItem = {
  id: string;
  name: string;
  summary: string;
  agency?: string;
  amount?: string;
  deadline?: string;
  url?: string;
  type: 'state_match' | 'upcoming_deadline';
  state?: string;
};

export function monthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function halfMonthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const half = d.getUTCDate() <= 15 ? 'H1' : 'H2';
  return `${y}-${m}-${half}`;
}

export function normalizeState(state: string) {
  const raw = state.trim().replace(/\s+/g, ' ');
  if (!raw) return '';

  const cleaned = raw.replace(/\(.*?\)/g, '').trim();
  const upper = cleaned.toUpperCase();

  const abbrToName: Record<string, string> = {
    AL: 'Alabama',
    AK: 'Alaska',
    AZ: 'Arizona',
    AR: 'Arkansas',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DE: 'Delaware',
    FL: 'Florida',
    GA: 'Georgia',
    HI: 'Hawaii',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    IA: 'Iowa',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    ME: 'Maine',
    MD: 'Maryland',
    MA: 'Massachusetts',
    MI: 'Michigan',
    MN: 'Minnesota',
    MS: 'Mississippi',
    MO: 'Missouri',
    MT: 'Montana',
    NE: 'Nebraska',
    NV: 'Nevada',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NY: 'New York',
    NC: 'North Carolina',
    ND: 'North Dakota',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VT: 'Vermont',
    VA: 'Virginia',
    WA: 'Washington',
    WV: 'West Virginia',
    WI: 'Wisconsin',
    WY: 'Wyoming',
    DC: 'District of Columbia',
  };

  if (/^[A-Z]{2}$/.test(upper)) return abbrToName[upper] ?? upper;

  const lower = cleaned.toLowerCase();
  for (const v of Object.values(abbrToName)) {
    if (v.toLowerCase() === lower) return v;
  }

  return cleaned;
}

export function makeGrantId(input: string) {
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 12);
  return hash;
}

export function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  const startObj = trimmed.indexOf('{');
  const startArr = trimmed.indexOf('[');
  const start = startArr === -1 ? startObj : startObj === -1 ? startArr : Math.min(startObj, startArr);
  if (start === -1) return '';
  return trimmed.slice(start);
}

export function openAiKey() {
  return process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY || '';
}

'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type HubspotContact = {
  createdAt?: string;
  properties?: Record<string, unknown>;
};

type AuthContextValue = {
  user: HubspotContact | null;
  isLoading: boolean;
  loginWithEmailZip: (email: string, zipCode: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'usbg:hubspotUser';

function normalizeZip(zip: string) {
  return zip.trim().slice(0, 5);
}

async function verifyHubspotContact(email: string, zipCode: string): Promise<HubspotContact | null> {
  // Auth is handled entirely via Firestore crm_contacts
  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, zipCode }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { found?: boolean; contact?: HubspotContact; zipMismatch?: boolean; noAccess?: boolean };
    if (data.found && data.contact)    return data.contact;
    if (data.found && data.noAccess)   return { properties: { pr: '' } }; // exists but no subscription
    return null;
  } catch {
    return null;
  }
}

function hasAccess(contact: HubspotContact | null) {
  const pr = String(contact?.properties?.['pr'] ?? '');
  return pr === 'SF' || pr === 'EF' || pr === 'UF' || pr === 'TRUE'
      || pr === 'starter' || pr === 'growth' || pr === 'pro';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<HubspotContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as HubspotContact;
        // If cached session is missing state, clear it so user re-authenticates
        const state = String(cached?.properties?.state ?? '').trim();
        if (!state) {
          window.localStorage.removeItem(STORAGE_KEY);
        } else {
          setUser(cached);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginWithEmailZip = useCallback(async (email: string, zipCode: string) => {
    try {
      const contact = await verifyHubspotContact(email.trim(), normalizeZip(zipCode));
      if (!contact) {
        return { ok: false as const, message: 'Sorry, the information you entered does not match our records.' };
      }

      if (!hasAccess(contact)) {
        return { ok: false as const, message: 'No permission to access file. Reason: Non-payment.' };
      }

      setUser(contact);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contact));
      return { ok: true as const };
    } catch {
      return { ok: false as const, message: 'Unable to verify user right now.' };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, loginWithEmailZip, logout }),
    [user, isLoading, loginWithEmailZip, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

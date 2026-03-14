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
const DEFAULT_VERIFY_URL = 'https://us-central1-usbg-database.cloudfunctions.net/checkStatusVerify';

function normalizeZip(zip: string) {
  return zip.trim().slice(0, 5);
}

async function verifyHubspotContact(email: string, zipCode: string): Promise<HubspotContact | null> {
  const verifyUrl = process.env.NEXT_PUBLIC_USBG_VERIFY_URL || DEFAULT_VERIFY_URL;
  const res = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, zipCode }),
  });

  if (!res.ok) {
    throw new Error('Unable to verify user right now.');
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data) || data.length === 0) return null;

  const first = data[0] as HubspotContact;
  return first ?? null;
}

function hasAccess(contact: HubspotContact | null) {
  const pr = String(contact?.properties?.['pr'] ?? '');
  return pr === 'SF' || pr === 'EF' || pr === 'TRUE';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<HubspotContact | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as HubspotContact);
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

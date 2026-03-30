export const runtime = 'nodejs';

export function getEnvString(key: string) {
  const v = process.env[key];
  return typeof v === 'string' ? v : '';
}

/** Initialise (or re-use) the Firebase Admin app and return Firestore */
export async function getAdminFirebase() {
  const projectId     = getEnvString('FIREBASE_ADMIN_PROJECT_ID') || getEnvString('NEXT_PUBLIC_FIREBASE_PROJECT_ID') || '';
  const clientEmail   = getEnvString('FIREBASE_ADMIN_CLIENT_EMAIL') || '';
  const privateKeyRaw = getEnvString('FIREBASE_ADMIN_PRIVATE_KEY') || '';
  const privateKey    = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : '';

  if (!projectId || !clientEmail || !privateKey) return null;

  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  const { getFirestore }                  = await import('firebase-admin/firestore');

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

/** Get Firebase Admin Auth instance */
async function getAdminAuth() {
  const projectId     = getEnvString('FIREBASE_ADMIN_PROJECT_ID') || getEnvString('NEXT_PUBLIC_FIREBASE_PROJECT_ID') || '';
  const clientEmail   = getEnvString('FIREBASE_ADMIN_CLIENT_EMAIL') || '';
  const privateKeyRaw = getEnvString('FIREBASE_ADMIN_PRIVATE_KEY') || '';
  const privateKey    = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, '\n') : '';

  if (!projectId || !clientEmail || !privateKey) return null;

  const { getApps, initializeApp, cert } = await import('firebase-admin/app');
  const { getAuth }                       = await import('firebase-admin/auth');

  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getAuth();
}

export type AdminUser = {
  uid:         string;
  email:       string;
  displayName: string;
  role:        'super_admin' | 'admin' | 'editor';
};

/**
 * Verify the Bearer token from the request.
 * Tries Firebase ID token first; falls back to ADMIN_PASSWORD env var for
 * backward compatibility during the migration period.
 *
 * Returns the AdminUser if authenticated, or null.
 */
export async function verifyAdminToken(req: Request): Promise<AdminUser | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  // ── 1. Try Firebase ID token ─────────────────────────────────────────────
  try {
    const adminAuth = await getAdminAuth();
    if (adminAuth) {
      const decoded = await adminAuth.verifyIdToken(token);
      const db      = await getAdminFirebase();
      if (db) {
        const snap = await db.collection('admin_users').doc(decoded.uid).get();
        if (snap.exists) {
          const data = snap.data() as { email?: string; displayName?: string; role?: string; isActive?: boolean };
          if (data.isActive === false) return null;
          return {
            uid:         decoded.uid,
            email:       data.email       ?? decoded.email ?? '',
            displayName: data.displayName ?? decoded.name  ?? '',
            role:        (data.role as AdminUser['role']) ?? 'editor',
          };
        }
      }
    }
  } catch { /* not a valid Firebase token */ }

  // ── 2. Fall back to ADMIN_PASSWORD (legacy) ──────────────────────────────
  const password = getEnvString('ADMIN_PASSWORD');
  if (password && token === password) {
    return { uid: 'legacy', email: 'admin', displayName: 'Admin', role: 'super_admin' };
  }

  return null;
}

/** Returns true if the request has any valid admin token (any role). */
export async function checkAdminAuth(req: Request): Promise<boolean> {
  const user = await verifyAdminToken(req);
  return user !== null;
}

/** Returns true only for super_admin role. */
export async function checkSuperAdmin(req: Request): Promise<boolean> {
  const user = await verifyAdminToken(req);
  return user?.role === 'super_admin';
}

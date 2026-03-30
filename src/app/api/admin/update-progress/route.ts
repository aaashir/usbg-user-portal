import { NextResponse } from 'next/server';
import { checkAdminAuth, getAdminFirebase } from '../_shared';
import { sendProgressUpdateEmail } from '../_email';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });

  const { email, progressStep, financeWarning } = (await req.json()) as {
    email?: string;
    progressStep?: number;
    financeWarning?: boolean;
  };

  if (!email) return NextResponse.json({ message: 'Missing email.' }, { status: 400 });

  const db = await getAdminFirebase();
  if (!db) return NextResponse.json({ message: 'Firebase not configured.' }, { status: 500 });

  // Fetch previous state so we only email when something actually changed
  const settingsRef = db
    .collection('check_status_app')
    .doc(email)
    .collection('admin')
    .doc('settings');

  const prevSnap = await settingsRef.get();
  const prev = prevSnap.exists ? (prevSnap.data() as { progressStep?: number; financeWarning?: boolean }) : {};

  const newStep    = progressStep    ?? null;
  const newWarning = financeWarning  ?? false;
  const prevStep   = prev.progressStep    ?? null;
  const prevWarn   = prev.financeWarning  ?? false;

  const stepChanged    = newStep    !== prevStep;
  const warningChanged = newWarning !== prevWarn;

  // Save to Firestore
  await settingsRef.set({ progressStep: newStep, financeWarning: newWarning }, { merge: true });

  // Send email only when there's a meaningful change and a valid step is set
  if ((stepChanged || warningChanged) && typeof newStep === 'number' && newStep >= 0) {
    // Look up the contact's name from crm_contacts
    let name = 'Applicant';
    try {
      const contactSnap = await db.collection('crm_contacts').doc(email).get();
      if (contactSnap.exists) {
        const data = contactSnap.data() as Record<string, unknown>;
        const first = String(data.firstName ?? data.firstname ?? '').trim();
        const last  = String(data.lastName  ?? data.lastname  ?? '').trim();
        name = [first, last].filter(Boolean).join(' ') || String(data.businessName ?? data.company ?? '').trim() || name;
      }
    } catch { /* non-fatal */ }

    await sendProgressUpdateEmail({
      to:             email,
      name,
      progressStep:   newStep,
      financeWarning: newWarning,
    }).catch(err => {
      console.error('[update-progress] email failed:', err);
    });
  }

  return NextResponse.json({ ok: true });
}

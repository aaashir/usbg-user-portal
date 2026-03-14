import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { arrayUnion, doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const authDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "usbg-database.firebaseapp.com";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "usbg-database";
const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "usbg-database.appspot.com";
const messagingSenderId =
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

async function getDocData<T>(path: string): Promise<T | null> {
  const ref = doc(db, path);
  const snap = await getDoc(ref);
  return (snap.data() as T | undefined) ?? null;
}

export async function getDeskId(userEmail: string) {
  const data = await getDocData<{ deskId?: string }>(`/check_status_app/${userEmail}`);
  return data?.deskId ?? null;
}

export async function assignDeskId(userEmail: string, id: string) {
  const ref = doc(db, `/check_status_app/${userEmail}`);
  await setDoc(ref, { deskId: id }, { merge: true });
}

export async function getLogActivity(userEmail: string) {
  const data = await getDocData<{
    viewed_file?: string[];
    downloaded_summary?: string[];
  }>(`/check_status_app/${userEmail}`);

  const lastViewed = data?.viewed_file ?? [];
  const lastDownloaded = data?.downloaded_summary ?? [];

  return {
    lastViewed: lastViewed[lastViewed.length - 1] ?? null,
    lastDownloaded: lastDownloaded[lastDownloaded.length - 1] ?? null,
  };
}

export async function logUserActivity(userEmail: string, type: string, nowText?: string) {
  const now =
    nowText ??
    `${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} EST`;

  const ref = doc(db, `/check_status_app/${userEmail}`);
  await setDoc(
    ref,
    {
      email: userEmail,
      [type]: arrayUnion(now),
    },
    { merge: true }
  );
}

export { app, auth, db, storage };

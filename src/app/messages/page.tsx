'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import Spinner from '@/components/ui/Spinner';
import { MessageSquare } from 'lucide-react';

type Message = {
  id: string;
  subject: string;
  body: string;
  sentAt: unknown;
  read: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function formatDate(ts: unknown): string {
  if (!ts) return '';
  let ms: number | null = null;
  if (isRecord(ts) && typeof ts.toMillis === 'function') ms = (ts.toMillis as () => number)();
  else if (isRecord(ts) && typeof ts.seconds === 'number') ms = (ts.seconds as number) * 1000;
  else if (typeof ts === 'string' || typeof ts === 'number') { const t = new Date(ts).getTime(); ms = Number.isFinite(t) ? t : null; }
  if (ms === null) return '';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function MessagesPage() {
  const { user } = useAuth();
  const email = useMemo(() => String(user?.properties?.email ?? '').trim(), [user]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    (async () => {
      try {
        const q = query(collection(db, 'check_status_app', email, 'messages'), orderBy('sentAt', 'desc'));
        const snap = await getDocs(q);
        const msgs: Message[] = [];
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          msgs.push({
            id: d.id,
            subject: typeof data.subject === 'string' ? data.subject : 'Message',
            body: typeof data.body === 'string' ? data.body : '',
            sentAt: data.sentAt,
            read: data.read === true,
          });
        });
        setMessages(msgs);
      } finally {
        setLoading(false);
      }
    })();
  }, [email]);

  async function markRead(id: string) {
    if (!email) return;
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, read: true } : m));
    try {
      await updateDoc(doc(db, 'check_status_app', email, 'messages', id), { read: true });
    } catch { /* ignore */ }
  }

  function toggle(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
    const msg = messages.find((m) => m.id === id);
    if (msg && !msg.read) void markRead(id);
  }

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">Messages</h1>
        <p className="text-slate-500 text-sm font-medium">Updates and communications from your grant advisor.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={36} /></div>
      ) : messages.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-lg">
          <MessageSquare size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium text-sm">No messages yet.</p>
        </div>
      ) : (
        <div className="space-y-2 max-w-2xl">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`bg-white border rounded-xl shadow-sm transition-colors cursor-pointer ${m.read ? 'border-slate-200' : 'border-blue-300'}`}
              onClick={() => toggle(m.id)}
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                {!m.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                {m.read && <span className="mt-1.5 w-2 h-2 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm leading-tight ${m.read ? 'font-semibold text-slate-700' : 'font-bold text-[#1F315C]'}`}>{m.subject}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{formatDate(m.sentAt)}</div>
                </div>
              </div>
              {expanded === m.id && (
                <div className="px-4 pb-4 pt-0">
                  <div className="border-t border-slate-100 pt-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {m.body}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

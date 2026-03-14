import React from 'react';

export default function HelpPage() {
  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight mb-0.5">Get Help</h1>
        <p className="text-slate-500 text-sm font-medium">Support resources.</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-[640px]">
        <p className="text-sm text-slate-700">
          For announcements and updates, visit{' '}
          <a
            href="https://usbusinessgrants.org/announcements.html"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline text-blue-700"
          >
            Grant Announcements
          </a>
          .
        </p>
      </div>
    </div>
  );
}


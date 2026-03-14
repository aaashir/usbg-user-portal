'use client';

import React from 'react';
import Link from 'next/link';

const AIAssistant = () => {
  const actions = [
    'Improve Answer',
    'Generate Mission Statement',
    'Write Impact Summary',
    'Reduce Word Count',
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-[#D4DEEF] h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-[#1F315C] leading-tight">AI Writing Assistant</h2>
      <div className="space-y-3 flex-1">
        {actions.map((action, index) => (
          <div
            key={index}
            className="w-full text-left px-4 py-2.5 bg-[#F4F8FF] rounded-md border border-[#D5E2F7] text-[#1450B6] text-base font-bold leading-tight"
          >
            {action}
          </div>
        ))}
      </div>

      <Link href="/ai-assistant" className="mt-4 ml-auto w-40 bg-gradient-to-r from-[#2F72D8] to-[#235FB7] text-white py-2 rounded-md text-sm font-bold shadow-sm text-center">
        Assist Me
      </Link>
    </div>
  );
};

export default AIAssistant;

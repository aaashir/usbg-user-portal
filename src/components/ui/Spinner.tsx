import React from 'react';

export default function Spinner({ size = 20 }: { size?: number }) {
  const r = 9;
  const circ = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      style={{ animationDuration: '0.75s', animationTimingFunction: 'linear' }}
      aria-label="Loading"
    >
      <circle cx="12" cy="12" r={r} stroke="#D4DEEF" strokeWidth="2.5" />
      <circle
        cx="12" cy="12" r={r}
        stroke="#3A8CF6"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * 0.28}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
    </svg>
  );
}

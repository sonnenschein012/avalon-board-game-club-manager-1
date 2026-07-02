import React from 'react';

export default function RookSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M20 110 L80 110 L80 120 L20 120 Z" fill="#3b82f6" />
      <path d="M25 100 L75 100 L80 110 L20 110 Z" fill="#60a5fa" />
      <path d="M35 50 L65 50 L75 100 L25 100 Z" fill="#93c5fd" />
      <path d="M30 40 L70 40 L65 50 L35 50 Z" fill="#bfdbfe" />
      <path d="M20 20 L35 20 L40 40 L60 40 L65 20 L80 20 L75 50 L25 50 Z" fill="#e0f2fe" />
    </svg>
  );
}

import React from 'react';

export default function DiamondSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M5 40 L50 40 L50 95 Z" fill="#3b82f6" />
      <path d="M95 40 L50 40 L50 95 Z" fill="#93c5fd" />
      <path d="M35 20 L65 20 L50 40 Z" fill="#bfdbfe" />
      <path d="M25 20 L35 20 L50 40 L5 40 Z" fill="#93c5fd" />
      <path d="M75 20 L65 20 L50 40 L95 40 Z" fill="#e0f2fe" />
    </svg>
  );
}

import React from 'react';

interface BoardMemberBadgeProps {
  className?: string;
}

/** Matches the crown marker used beside officers' names in member management. */
export default function BoardMemberBadge({ className = '' }: BoardMemberBadgeProps) {
  return (
    <span
      aria-label="임원"
      title="임원"
      className={`inline-flex shrink-0 text-xs leading-none text-gold ${className}`}
    >
      👑
    </span>
  );
}

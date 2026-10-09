import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface AttendanceNoticeProps {
  children: ReactNode;
  severity?: 'warning' | 'error';
  role?: 'status' | 'alert';
  className?: string;
  onClick?: () => void;
}

/** Shared inline notice style for the daily attendance screen and its dialogs. */
export default function AttendanceNotice({ children, severity = 'warning', role, className, onClick }: AttendanceNoticeProps) {
  const Container = onClick ? 'button' : 'div';
  const Content = onClick ? 'span' : 'div';
  return <Container {...(onClick ? { type: 'button' as const, onClick } : { role })} className={cn(
    'flex min-w-0 items-start gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-bold leading-relaxed',
    severity === 'error' ? 'border-red-100/50 bg-red-50 text-red-700' : 'border-orange-100/50 bg-orange-50 text-orange-600',
    onClick && 'w-full cursor-pointer text-left hover:bg-orange-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600',
    className,
  )}>
    <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
    <Content className="min-w-0 break-words">{children}</Content>
  </Container>;
}

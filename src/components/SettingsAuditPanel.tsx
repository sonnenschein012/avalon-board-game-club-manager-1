import { useState } from 'react';
import { ChevronDown, ChevronUp, History, Loader2 } from 'lucide-react';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_CATEGORY_LABELS,
  type AuditCategory,
  type AuditEvent,
} from '../domain/audit/auditEvent';
import { useAuditEvents } from '../hooks/useAuditEvents';
import { formatDateTime } from '../lib/utils';

function AuditRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = Boolean(event.detail || event.changes?.length);
  return (
    <article className="border-b border-slate-100 px-4 py-4 last:border-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
              {AUDIT_CATEGORY_LABELS[event.category]}
            </span>
            {event.count !== undefined && (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">{event.count}건</span>
            )}
            <time className="text-[11px] font-bold text-slate-400">{formatDateTime(event.occurredAt)}</time>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            <strong className="text-navy">{event.targetLabel}</strong>{' '}
            {AUDIT_ACTION_LABELS[event.action] ?? event.action}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-400">{event.actorEmail}</p>
        </div>
        {hasDetail && (
          <button
            type="button"
            onClick={() => setExpanded(current => !current)}
            className="flex shrink-0 items-center gap-1 self-start rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-black text-navy"
          >
            상세 {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>
      {expanded && hasDetail && (
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
          {event.detail && <p className="whitespace-pre-wrap text-xs font-medium leading-5 text-slate-600">{event.detail}</p>}
          {event.changes?.map(change => (
            <div key={change.field} className="grid gap-1 border-t border-slate-200 pt-2 text-xs first:border-0 first:pt-0 sm:grid-cols-[120px_1fr]">
              <strong className="text-slate-500">{change.label}</strong>
              <p className="min-w-0 break-words text-slate-600">
                <span className="whitespace-pre-wrap line-through decoration-red-300">{change.before}</span>
                <span className="px-2 text-slate-300">→</span>
                <span className="whitespace-pre-wrap font-bold text-navy">{change.after}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function SettingsAuditPanel() {
  const audit = useAuditEvents();
  return (
    <section className="glass-panel p-6">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy"><History size={18} className="text-gold" />변경 이력</h2>
          <p className="mt-1 text-xs text-slate-500">운영자가 저장·삭제·확정한 주요 작업을 최근 200건까지 표시합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="변경 이력 분류"
            value={audit.category}
            onChange={event => audit.setCategory(event.target.value as AuditCategory | 'all')}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
          >
            <option value="all">전체 분류</option>
            {Object.entries(AUDIT_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            aria-label="변경 이력 수정자"
            value={audit.actorEmail}
            onChange={event => audit.setActorEmail(event.target.value)}
            className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
          >
            <option value="all">전체 수정자</option>
            {audit.actors.map(email => <option key={email} value={email}>{email}</option>)}
          </select>
        </div>
      </div>
      <div className="max-h-[720px] overflow-y-auto rounded-xl border border-slate-100 bg-white">
        {audit.loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm font-bold text-slate-400"><Loader2 className="animate-spin" size={18} />불러오는 중</div>
        ) : audit.error ? (
          <p role="alert" className="p-8 text-center text-sm font-bold text-red-600">{audit.error}</p>
        ) : audit.events.length === 0 ? (
          <p className="p-10 text-center text-sm font-bold text-slate-400">표시할 변경 이력이 없습니다.</p>
        ) : audit.events.map(event => <AuditRow key={event.id} event={event} />)}
      </div>
    </section>
  );
}

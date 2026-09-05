import { useEffect, useMemo, useState } from 'react';
import type { AuditCategory, AuditEvent } from '../domain/audit/auditEvent';
import { subscribeAuditEvents } from '../services/auditService';

export function useAuditEvents() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<AuditCategory | 'all'>('all');
  const [actorEmail, setActorEmail] = useState('all');

  useEffect(() => subscribeAuditEvents(
    value => {
      setEvents(value);
      setLoading(false);
      setError(null);
    },
    () => {
      setLoading(false);
      setError('변경 이력을 불러오지 못했습니다.');
    },
  ), []);

  const actors = useMemo(() => [...new Set(events.map(event => event.actorEmail))].sort(), [events]);
  const filteredEvents = useMemo(() => events.filter(event => (
    (category === 'all' || event.category === category)
    && (actorEmail === 'all' || event.actorEmail === actorEmail)
  )), [actorEmail, category, events]);

  return {
    events: filteredEvents,
    actors,
    loading,
    error,
    category,
    setCategory,
    actorEmail,
    setActorEmail,
  };
}

import { describe, expect, it, vi } from 'vitest';
import { createAuditEventOperation } from './auditService';

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { email: 'Admin.Case@Example.com' } },
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ path: 'auditEvents' })),
  doc: vi.fn(() => ({ id: 'audit-id', path: 'auditEvents/audit-id' })),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIME'),
  writeBatch: vi.fn(),
}));

describe('auditService event construction', () => {
  it('keeps the exact authenticated email and bounds human-readable payloads', () => {
    const operation = createAuditEventOperation({
      category: 'member',
      action: 'member.updated',
      targetLabel: '   ',
      detail: '가'.repeat(12_000),
      changes: Array.from({ length: 120 }, (_, index) => ({
        field: `field-${index}`,
        label: `항목 ${index}`,
        before: '이전'.repeat(2_000),
        after: '이후'.repeat(2_000),
      })),
    });

    expect(operation.data).toMatchObject({
      actorEmail: 'Admin.Case@Example.com',
      occurredAt: 'SERVER_TIME',
      targetLabel: '대상 정보 없음',
      schemaVersion: 1,
    });
    expect(operation.data.changes).toHaveLength(100);
    expect(operation.data.changes[0].before).toContain('일부 생략');
    expect(operation.data.detail).toContain('일부 생략');
  });
});

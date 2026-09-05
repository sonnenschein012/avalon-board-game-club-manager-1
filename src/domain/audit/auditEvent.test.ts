import { describe, expect, it } from 'vitest';
import { collectAuditChanges, formatAuditValue } from './auditEvent';

describe('audit event formatting', () => {
  it('keeps only fields that actually changed', () => {
    const changes = collectAuditChanges(
      { name: '김철수', phone: '010-1111', active: true },
      { name: '김철수', phone: '010-2222', active: true },
      [
        { key: 'name', label: '이름' },
        { key: 'phone', label: '연락처' },
        { key: 'active', label: '활동 여부' },
      ],
    );
    expect(changes).toEqual([{ field: 'phone', label: '연락처', before: '010-1111', after: '010-2222' }]);
  });

  it('formats empty, list, and boolean values for a generic detail view', () => {
    expect(formatAuditValue('')).toBe('없음');
    expect(formatAuditValue([])).toBe('없음');
    expect(formatAuditValue(['전략', '파티'])).toBe('전략, 파티');
    expect(formatAuditValue(false)).toBe('아니오');
  });
});

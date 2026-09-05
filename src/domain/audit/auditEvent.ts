export const AUDIT_CATEGORY_LABELS = {
  admin: '관리자',
  member: '동아리원',
  game: '게임',
  session: '모임 기록',
  attendance: '출석',
  interview: '면접',
} as const;

export type AuditCategory = keyof typeof AUDIT_CATEGORY_LABELS;

/**
 * Allow-list of human actions that are worth preserving. A new audited write
 * must add a Korean sentence here, so the viewer never depends on AI to
 * explain a raw Firestore field name. Public responses, note autosaves,
 * filter/copy/export clicks, and derived helper documents are intentionally
 * absent from this list.
 */
export const AUDIT_ACTION_LABELS = {
  'admin.added': '관리자 권한을 추가했습니다.',
  'admin.removed': '관리자 권한을 삭제했습니다.',
  'member.created': '동아리원을 등록했습니다.',
  'member.updated': '동아리원 정보를 수정했습니다.',
  'member.deleted': '동아리원을 삭제했습니다.',
  'member.imported': '동아리원 CSV를 등록했습니다.',
  'member.bulk_dormant': '동아리원을 휴면 처리했습니다.',
  'member.bulk_dormant_semester': '동아리원의 휴면 학기를 변경했습니다.',
  'member.bulk_active': '동아리원을 활동 상태로 복원했습니다.',
  'member.created_from_attendance': '출석 명단에서 동아리원을 등록했습니다.',
  'member.created_from_applicant': '지원자를 동아리원으로 등록했습니다.',
  'member.linked_to_applicant': '지원자와 기존 동아리원을 연결했습니다.',
  'member.unlinked_from_applicant': '지원자와 동아리원 연결을 해제했습니다.',
  'game.created': '게임을 등록했습니다.',
  'game.updated': '게임 정보를 수정했습니다.',
  'game.deleted': '게임을 삭제했습니다.',
  'game.imported': '게임 CSV를 등록했습니다.',
  'game.deleted_all': '모든 게임을 삭제했습니다.',
  'session.created': '모임 기록을 만들었습니다.',
  'session.updated': '모임 기록을 수정했습니다.',
  'session.deleted': '모임 기록을 삭제했습니다.',
  'session.imported': '모임 기록 CSV를 등록했습니다.',
  'session.group_games_updated': '조의 플레이 게임을 수정했습니다.',
  'session.group_renamed': '조 이름을 변경했습니다.',
  'session.meeting_started': '오늘의 모임을 시작했습니다.',
  'attendance.imported': '출석 명단을 CSV로 교체했습니다.',
  'attendance.cleared': '출석 명단을 초기화했습니다.',
  'interview.round_created': '면접 회차를 만들었습니다.',
  'interview.round_updated': '면접 회차 설정을 수정했습니다.',
  'interview.round_deleted': '면접 회차를 삭제했습니다.',
  'interview.schedule_created': '면접 일정을 만들었습니다.',
  'interview.schedule_updated': '면접 일정을 수정했습니다.',
  'interview.schedule_deleted': '면접 일정을 삭제했습니다.',
  'interview.schedule_applicants_assigned': '지원자를 면접 일정에 지정했습니다.',
  'interview.legacy_applicants_migrated': '기존 지원자를 면접 일정으로 옮겼습니다.',
  'interview.applicants_imported': '지원자 CSV를 등록했습니다.',
  'interview.applicant_created': '지원자를 추가했습니다.',
  'interview.applicant_updated': '지원자 정보를 수정했습니다.',
  'interview.applicant_archived': '지원자를 보관했습니다.',
  'interview.applicant_restored': '지원자를 복원했습니다.',
  'interview.applicant_withdrawn': '지원 철회 처리했습니다.',
  'interview.applicant_withdrawal_restored': '지원 철회를 취소했습니다.',
  'interview.applicant_schedule_reset': '지원자의 일정을 초기화했습니다.',
  'interview.interviewer_added': '면접관을 추가했습니다.',
  'interview.interviewer_reactivated': '면접관을 다시 추가했습니다.',
  'interview.interviewer_updated': '면접관 정보를 수정했습니다.',
  'interview.interviewer_availability_updated': '면접관 가능시간을 수정했습니다.',
  'interview.interviewer_removed': '면접관을 제외했습니다.',
  'interview.interviewer_schedule_assigned': '면접관을 일정에 배정했습니다.',
  'interview.change_request_resolved': '일정 변경 요청을 처리했습니다.',
  'interview.change_request_dismissed': '일정 변경 요청을 기각했습니다.',
  'interview.assignment_saved': '면접 시간을 배정하거나 변경했습니다.',
  'interview.assignment_cleared': '면접 배정을 해제했습니다.',
  'interview.auto_assignment_applied': '자동 배정 결과를 반영했습니다.',
  'interview.assignment_state_updated': '면접 배정 상태를 변경했습니다.',
  'interview.action_needed': '지원자를 조치 필요 상태로 변경했습니다.',
  'interview.restored_to_scheduled': '지원자를 면접 예정 상태로 복원했습니다.',
  'interview.completed': '면접을 완료했습니다.',
  'interview.reopened': '면접 완료를 취소했습니다.',
  'interview.rating_updated': '종합평가를 수정했습니다.',
  'interview.selection_updated': '선발 상태를 변경했습니다.',
  'interview.message_marked': '문자 발송 완료로 표시했습니다.',
  'interview.message_unmarked': '문자 발송 표시를 취소했습니다.',
} as const;

export type AuditActionCode = keyof typeof AUDIT_ACTION_LABELS;

export interface AuditChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface AuditEventInput {
  category: AuditCategory;
  action: AuditActionCode;
  targetId?: string;
  targetLabel: string;
  changes?: AuditChange[];
  detail?: string;
  count?: number;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  actorEmail: string;
  occurredAt: { toDate?: () => Date } | null;
  schemaVersion: 1;
}

export interface AuditFieldDefinition<T> {
  key: keyof T;
  label: string;
  format?: (value: T[keyof T]) => string;
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '없음';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (Array.isArray(value)) return value.length > 0 ? value.map(formatAuditValue).join(', ') : '없음';
  if (value instanceof Date) return value.toLocaleString('ko-KR');
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toLocaleString('ko-KR');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function collectAuditChanges<T extends object>(
  before: T,
  after: T,
  fields: ReadonlyArray<AuditFieldDefinition<T>>,
): AuditChange[] {
  return fields.flatMap(({ key, label, format }) => {
    const beforeValue = before[key];
    const afterValue = after[key];
    const formatValue = format ?? formatAuditValue;
    const formattedBefore = formatValue(beforeValue);
    const formattedAfter = formatValue(afterValue);
    return formattedBefore === formattedAfter ? [] : [{
      field: String(key),
      label,
      before: formattedBefore,
      after: formattedAfter,
    }];
  });
}

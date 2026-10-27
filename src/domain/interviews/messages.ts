export type InterviewMessagePlaceholder =
  | 'name'
  | 'link'
  | 'deadline'
  | 'interviewDate'
  | 'interviewTime'
  | 'oldInterviewDate'
  | 'oldInterviewTime'
  | 'interviewerName'
  | 'interviewerPhone'
  | 'roundName';

export type InterviewMessagePlaceholders = Partial<Record<InterviewMessagePlaceholder, string>>;

export type InterviewMessageTemplateKind =
  | 'availability'
  | 'reminder'
  | 'confirmation'
  | 'reschedule'
  | 'selected'
  | 'rejected';

export const DEFAULT_INTERVIEW_MESSAGE_TEMPLATES: Readonly<Record<InterviewMessageTemplateKind, string>> = {
  availability: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 아발론에 지원해 주셔서 감사합니다!\n전화 면접 일정 조율을 위해 아래 링크에서 가능한 시간을 선택 후 저장해 주세요.\n\n{link}\n\n선택해 주신 시간을 바탕으로 면접 일정을 확정해 다시 안내드리겠습니다.',
  reminder: '{name} 님, 아직 면접 가능 시간이 선택되지 않아 다시 한번 안내드립니다.\n\n{deadline}까지 아래 링크에서 가능한 시간을 모두 선택해 주세요!\n\n{link}\n\n선택해 주신 시간을 바탕으로 면접 일정을 확정해 안내드리겠습니다.',
  confirmation: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님의 면접 일정이 확정되어 안내드립니다.\n\n📅 {interviewDate} {interviewTime}\n☎️ {interviewerPhone}\n\n위 번호로 전화드릴 예정이니 편하게 받아주세요!\n감사합니다.',
  reschedule: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 요청하신 일정 조정에 따라 면접 일정이 변경되어 안내드립니다.\n\n기존: {oldInterviewDate} {oldInterviewTime}\n변경: {interviewDate} {interviewTime}\n\n☎️ {interviewerPhone}\n위 번호로 전화드릴 예정입니다. 확인 부탁드립니다!',
  selected: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님의 [모집 기수] 신입부원 선발이 확정되어 안내드립니다. 축하드립니다!\n아발론 활동을 위한 회비 납부를 부탁드립니다.\n\n💰 회비: 20,000원\n🏦 입금 계좌: [은행명 및 계좌번호]\n👤 예금주: [예금주]\n\n입금자명은 지원자 본인 이름으로 부탁드리며, 다른 이름으로 입금하신 경우 알려주세요.\n회비 납부가 확인되면 아발론 카카오톡 공지방으로 초대드릴 예정입니다.\n\n지원해 주셔서 감사드리며, 앞으로 잘 부탁드립니다! 🎲',
  rejected: '안녕하세요! 동국대학교 보드게임 동아리 아발론입니다🎲\n\n{name} 님, 이번 [모집 기수] 신입부원 모집에 지원해 주셔서 감사합니다.\n아쉽게도 이번 모집에서는 함께하지 못하게 되었습니다.\n\n아발론에 관심을 가지고 지원해 주신 점 다시 한번 감사드립니다.',
};

export function resolveInterviewMessageTemplates(
  templates?: Partial<Record<InterviewMessageTemplateKind, string>> | null,
): Record<InterviewMessageTemplateKind, string> {
  return { ...DEFAULT_INTERVIEW_MESSAGE_TEMPLATES, ...templates };
}

const SUPPORTED_PLACEHOLDERS = new Set<InterviewMessagePlaceholder>([
  'name',
  'link',
  'deadline',
  'interviewDate',
  'interviewTime',
  'oldInterviewDate',
  'oldInterviewTime',
  'interviewerName',
  'interviewerPhone',
  'roundName',
]);

/** Replaces supported placeholders and leaves unknown or missing values untouched. */
export function renderInterviewMessage(
  template: string,
  placeholders: Readonly<InterviewMessagePlaceholders>,
): string {
  return template.replace(/\{([^{}]+)\}/g, (original, rawKey: string) => {
    if (!SUPPORTED_PLACEHOLDERS.has(rawKey as InterviewMessagePlaceholder)) return original;

    const key = rawKey as InterviewMessagePlaceholder;
    if (!Object.prototype.hasOwnProperty.call(placeholders, key)) return original;
    return placeholders[key] ?? original;
  });
}

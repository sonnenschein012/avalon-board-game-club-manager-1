import { describe, expect, it } from 'vitest';
import { DEFAULT_INTERVIEW_MESSAGE_TEMPLATES, renderInterviewMessage } from './messages';

describe('renderInterviewMessage', () => {
  it('renders automatic values while preserving manually editable recruitment details', () => {
    const placeholders = {
      name: '홍길동',
      link: 'https://example.test/interview/token',
      deadline: '2026. 10. 30. 오후 6:00',
      interviewDate: '2026-11-01',
      interviewTime: '19:10',
      oldInterviewDate: '2026-10-31',
      oldInterviewTime: '18:20',
      interviewerPhone: '010-1234-5678',
    };
    const messages = Object.fromEntries(Object.entries(DEFAULT_INTERVIEW_MESSAGE_TEMPLATES)
      .map(([kind, template]) => [kind, renderInterviewMessage(template, placeholders)]));

    for (const message of Object.values(messages)) {
      expect(message).toContain('홍길동 님');
      expect(message).not.toMatch(/\{[^{}]+\}/);
    }
    expect(messages.availability).toContain(`\n\n${placeholders.link}\n\n`);
    expect(messages.reminder).toContain(`${placeholders.deadline}까지`);
    expect(messages.confirmation).toContain('📅 2026-11-01 19:10\n☎️ 010-1234-5678');
    expect(messages.reschedule).toContain('기존: 2026-10-31 18:20\n변경: 2026-11-01 19:10');
    expect(messages.selected).toContain('[모집 기수] 신입부원');
    expect(messages.rejected).toContain('[모집 기수] 신입부원');
    expect(messages.selected).toContain('💰 회비: 20,000원\n🏦 입금 계좌: [은행명 및 계좌번호]\n👤 예금주: [예금주]');
  });

  it('renders every supported placeholder wherever it appears', () => {
    expect(renderInterviewMessage(
      '{roundName}: {name} / {name}\n{deadline}\n{interviewDate} {interviewTime}\n{interviewerName} {interviewerPhone}\n{link}',
      {
        roundName: '2026-2 Avalon recruitment',
        name: 'Kim Applicant',
        deadline: 'August 20, 18:00',
        interviewDate: 'August 27',
        interviewTime: '19:15',
        interviewerName: 'Park Interviewer',
        interviewerPhone: '010-1234-5678',
        link: 'https://example.test/interview/token',
      },
    )).toBe(
      '2026-2 Avalon recruitment: Kim Applicant / Kim Applicant\n' +
      'August 20, 18:00\nAugust 27 19:15\nPark Interviewer 010-1234-5678\nhttps://example.test/interview/token',
    );
  });

  it('does not corrupt unknown placeholders or supported placeholders with no supplied value', () => {
    expect(renderInterviewMessage(
      'Hello {name}. Keep {customField} and {deadline}.',
      { name: 'Lee Applicant' },
    )).toBe('Hello Lee Applicant. Keep {customField} and {deadline}.');
  });

  it('inserts replacement text literally even when it contains dollar signs or braces', () => {
    expect(renderInterviewMessage('{name}: {link}', {
      name: '$& Applicant',
      link: 'https://example.test/{safe}',
    })).toBe('$& Applicant: https://example.test/{safe}');
  });
});

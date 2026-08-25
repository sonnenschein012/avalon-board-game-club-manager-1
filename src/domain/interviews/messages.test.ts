import { describe, expect, it } from 'vitest';
import { renderInterviewMessage } from './messages';

describe('renderInterviewMessage', () => {
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

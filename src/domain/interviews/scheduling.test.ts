import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  aggregateAvailability,
  assignmentsOverlap,
  availabilityToAssignmentCandidates,
  createSlotId,
  generateAvailabilitySlots,
  generateAvailabilitySlotsForSchedules,
  getAssignmentScheduleImpact,
  getScheduleChangeImpact,
  getSurveyPhase,
  parseSlotId,
  validateAvailability,
} from './scheduling';

describe('interview scheduling domain', () => {
  it('creates and parses canonical local slot IDs', () => {
    const slotId = createSlotId('2026-08-27', '19:15');

    expect(slotId).toBe('2026-08-27|19:15');
    expect(parseSlotId(slotId)).toEqual({ date: '2026-08-27', time: '19:15' });
    expect(parseSlotId('2026-02-30|19:15')).toBeNull();
    expect(parseSlotId('2026-08-27T19:15')).toBeNull();
  });

  it('generates availability cells for each date with an exclusive end time', () => {
    expect(generateAvailabilitySlots(
      ['2026-08-27', '2026-08-28'],
      '19:00',
      '20:00',
      30,
    )).toEqual([
      '2026-08-27|19:00',
      '2026-08-27|19:30',
      '2026-08-28|19:00',
      '2026-08-28|19:30',
    ]);
  });

  it('rejects a time range that would create a partial availability cell', () => {
    expect(() => generateAvailabilitySlots(['2026-08-27'], '19:00', '19:45', 30)).toThrow(RangeError);
  });

  it('generates a different time range for each interview date', () => {
    expect(generateAvailabilitySlotsForSchedules([
      { date: '2026-08-28', startTime: '10:00', endTime: '11:00' },
      { date: '2026-08-27', startTime: '18:00', endTime: '19:30' },
    ], 30)).toEqual([
      '2026-08-27|18:00',
      '2026-08-27|18:30',
      '2026-08-27|19:00',
      '2026-08-28|10:00',
      '2026-08-28|10:30',
    ]);
  });

  it('expands a 30-minute availability cell into 5-minute candidates', () => {
    expect(availabilityToAssignmentCandidates(['2026-08-27|19:00'], 30, 5)).toEqual([
      '2026-08-27|19:00',
      '2026-08-27|19:05',
      '2026-08-27|19:10',
      '2026-08-27|19:15',
      '2026-08-27|19:20',
      '2026-08-27|19:25',
    ]);
  });

  it('uses a different assignment interval and removes candidates duplicated by overlapping cells', () => {
    expect(availabilityToAssignmentCandidates([
      '2026-08-27|19:30',
      '2026-08-27|19:00',
      '2026-08-27|19:00',
    ], 30, 10)).toEqual([
      '2026-08-27|19:00',
      '2026-08-27|19:10',
      '2026-08-27|19:20',
      '2026-08-27|19:30',
      '2026-08-27|19:40',
      '2026-08-27|19:50',
    ]);
    expect(() => availabilityToAssignmentCandidates(['2026-08-27|19:00'], 30, 7)).toThrow(RangeError);
  });

  it('determines survey phases using an included opening and excluded closing boundary', () => {
    const opensAt = new Date('2026-08-20T09:00:00.000Z');
    const closesAt = new Date('2026-08-21T09:00:00.000Z');

    expect(getSurveyPhase(new Date('2026-08-20T08:59:59.999Z'), opensAt, closesAt)).toBe('before');
    expect(getSurveyPhase(opensAt, opensAt, closesAt)).toBe('open');
    expect(getSurveyPhase(new Date('2026-08-21T08:59:59.999Z'), opensAt, closesAt)).toBe('open');
    expect(getSurveyPhase(closesAt, opensAt, closesAt)).toBe('closed');
  });

  it('validates that a selection is a duplicate-free subset of allowed slots', () => {
    const allowed = ['2026-08-27|19:00', '2026-08-27|19:30'];

    expect(validateAvailability(['2026-08-27|19:00'], allowed)).toEqual({
      valid: true,
      invalidSlots: [],
      duplicateSlots: [],
    });
    expect(validateAvailability([
      '2026-08-27|19:00',
      '2026-08-27|19:00',
      '2026-08-28|19:00',
    ], allowed)).toEqual({
      valid: false,
      invalidSlots: ['2026-08-28|19:00'],
      duplicateSlots: ['2026-08-27|19:00'],
    });
  });

  it('aggregates each applicant once per availability cell', () => {
    expect(aggregateAvailability([
      { applicantId: 'a1', availability: ['2026-08-27|19:00', '2026-08-27|19:00'] },
      { applicantId: 'a2', availability: ['2026-08-27|19:00', '2026-08-27|19:30'] },
      { applicantId: 'a3', availability: ['2026-08-27|19:30'] },
    ])).toEqual([
      { slotId: '2026-08-27|19:00', count: 2, applicantIds: ['a1', 'a2'] },
      { slotId: '2026-08-27|19:30', count: 2, applicantIds: ['a2', 'a3'] },
    ]);
  });

  it('previews exactly which saved selections a schedule change would remove', () => {
    const oldAllowed = [
      '2026-08-27|19:00',
      '2026-08-27|19:30',
      '2026-08-28|19:00',
    ];
    const newAllowed = [
      '2026-08-27|19:30',
      '2026-08-28|19:00',
      '2026-08-28|19:30',
    ];

    expect(getScheduleChangeImpact(oldAllowed, newAllowed, [
      { applicantId: 'a1', availability: ['2026-08-27|19:00', '2026-08-27|19:30'] },
      { applicantId: 'a2', availability: ['2026-08-28|19:00'] },
      { applicantId: 'a3', availability: ['2026-08-27|19:00'] },
    ])).toEqual({
      addedAllowedSlots: ['2026-08-28|19:30'],
      removedAllowedSlots: ['2026-08-27|19:00'],
      affectedResponseCount: 2,
      removedSelectionCount: 2,
      affectedResponses: [
        {
          applicantId: 'a1',
          removedSlots: ['2026-08-27|19:00'],
          retainedSlots: ['2026-08-27|19:30'],
        },
        {
          applicantId: 'a3',
          removedSlots: ['2026-08-27|19:00'],
          retainedSlots: [],
        },
      ],
    });
  });

  it('detects overlapping intervals only for the same individual interviewer', () => {
    const assignment = (iso: string, durationMinutes: number, interviewerId: string) => ({
      startsAt: Timestamp.fromDate(new Date(iso)),
      durationMinutes,
      interviewerId,
      interviewerName: interviewerId,
      status: 'scheduled' as const,
      locked: false,
      source: 'manual' as const,
    });

    expect(assignmentsOverlap(
      assignment('2026-08-27T10:00:00.000Z', 30, 'default'),
      assignment('2026-08-27T10:15:00.000Z', 20, 'default'),
    )).toBe(true);
    expect(assignmentsOverlap(
      assignment('2026-08-27T10:00:00.000Z', 30, 'default'),
      assignment('2026-08-27T10:30:00.000Z', 20, 'default'),
    )).toBe(false);
    expect(assignmentsOverlap(
      assignment('2026-08-27T10:00:00.000Z', 30, 'interviewer-1'),
      assignment('2026-08-27T10:00:00.000Z', 30, 'interviewer-2'),
    )).toBe(false);
  });

  it('finds assignments invalidated by a proposed schedule or duration change', () => {
    const assigned = (slotId: string, durationMinutes = 5) => ({
      slotId,
      startsAt: Timestamp.fromDate(new Date('2026-08-27T10:00:00.000Z')),
      durationMinutes,
      interviewerId: 'default',
      interviewerName: 'default',
      status: 'scheduled' as const,
      locked: false,
      source: 'manual' as const,
    });
    expect(getAssignmentScheduleImpact(
      ['2026-08-27|19:00'],
      30,
      5,
      [
        { applicantId: 'kept', assignment: assigned('2026-08-27|19:10') },
        { applicantId: 'outside', assignment: assigned('2026-08-27|20:00') },
        { applicantId: 'duration', assignment: assigned('2026-08-27|19:15', 10) },
      ],
    )).toEqual({
      affectedAssignmentCount: 2,
      affectedAssignments: [
        { applicantId: 'outside', slotId: '2026-08-27|20:00', reason: 'outside-schedule' },
        { applicantId: 'duration', slotId: '2026-08-27|19:15', reason: 'duration-changed' },
      ],
    });
  });
});

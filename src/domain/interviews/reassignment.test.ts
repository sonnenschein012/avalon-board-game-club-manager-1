import { describe, expect, it } from 'vitest';
import { candidatesForVacatedSlot, recommendReassignment } from './reassignment';

describe('partial reassignment recommendations', () => {
  it('recommends only free intersections without moving another applicant', () => {
    const result = recommendReassignment(
      { id: 'a1', availability: ['2026-08-27|19:00', '2026-08-27|19:30'], current: { slotId: '2026-08-27|19:00', interviewerId: 'i1' } },
      [{ id: 'i1', name: '면접관', availability: ['2026-08-27|19:00', '2026-08-27|19:30'] }],
      new Set(['i1|2026-08-27|19:00']), 30, 30,
    );
    expect(result[0]).toMatchObject({ slotId: '2026-08-27|19:30', changesOtherAssignments: false });
  });

  it('finds applicants who could use a vacated slot without changing them automatically', () => {
    expect(candidatesForVacatedSlot('2026-08-27|19:00', 'i1', [
      { id: 'current', availability: ['2026-08-27|19:00'], current: { slotId: '2026-08-27|19:00', interviewerId: 'i1' } },
      { id: 'candidate', availability: ['2026-08-27|19:00'], current: { slotId: '2026-08-27|19:30', interviewerId: 'i1' } },
      { id: 'unavailable', availability: ['2026-08-27|20:00'] },
    ], 30, 30)).toEqual(['candidate']);
  });
});

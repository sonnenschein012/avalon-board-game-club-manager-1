import { describe, expect, it } from 'vitest';
import { getAvailableArchiveSemesters } from './semesterSelection';

describe('getAvailableArchiveSemesters', () => {
  it('includes the current semester and excludes the overall option', () => {
    expect(getAvailableArchiveSemesters(['2025-04-10', 'invalid'], new Date(2026, 7, 20))).toEqual(['2026-1', '2025-1']);
  });

  it('uses the previous second semester in January and February', () => {
    expect(getAvailableArchiveSemesters([], new Date(2026, 0, 10))).toEqual(['2025-2']);
  });
});

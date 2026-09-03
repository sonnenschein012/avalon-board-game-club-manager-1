import type { InterviewAccess,InterviewAssignment,InterviewDaySchedule } from '../../types';
export type { InterviewDaySchedule } from '../../types';

const SLOT_ID_SEPARATOR = '|';
const MINUTES_PER_DAY = 24 * 60;
const MILLISECONDS_PER_MINUTE = 60_000;

export interface ParsedSlotId {
  date: string;
  time: string;
}

export type SurveyPhase = 'before' | 'open' | 'closed';

export type DateTimeLike = number | Date | { toMillis(): number };

export interface AvailabilityValidationResult {
  valid: boolean;
  invalidSlots: string[];
  duplicateSlots: string[];
}

export type AvailabilityResponse = Pick<InterviewAccess, 'applicantId' | 'availability'>;

export function isAssignmentOutsideAvailability(
  availability: readonly string[],
  assignmentSlotId: string | undefined,
  availabilitySlotMinutes: number,
  assignmentSlotMinutes: number,
): boolean {
  if (!assignmentSlotId) return false;
  return !availabilityToAssignmentCandidates(
    [...availability],
    availabilitySlotMinutes,
    assignmentSlotMinutes,
  ).includes(assignmentSlotId);
}

export interface AffectedScheduleResponse {
  applicantId: string;
  removedSlots: string[];
  retainedSlots: string[];
}

export interface ScheduleChangeImpact {
  addedAllowedSlots: string[];
  removedAllowedSlots: string[];
  affectedResponseCount: number;
  removedSelectionCount: number;
  affectedResponses: AffectedScheduleResponse[];
}

export interface AssignmentScheduleImpactItem {
  applicantId: string;
  slotId: string | null;
  reason: 'outside-schedule' | 'duration-changed' | 'legacy-missing-slot';
}

export interface AssignmentScheduleImpact {
  affectedAssignmentCount: number;
  affectedAssignments: AssignmentScheduleImpactItem[];
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidDate(date: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return false;

  const yearText = match[1];
  const monthText = match[2];
  const dayText = match[3];
  if (!yearText || !monthText || !dayText) return false;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const daysInMonth = daysByMonth[month - 1];

  return month >= 1 && month <= 12 && daysInMonth !== undefined && day >= 1 && day <= daysInMonth;
}

function timeToMinutes(time: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;

  const hourText = match[1];
  const minuteText = match[2];
  if (!hourText || !minuteText) return null;

  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour > 23 || minute > 59) return null;

  return hour * 60 + minute;
}

function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function addDays(date: string, days: number): string {
  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day + days);
  result.setUTCHours(0, 0, 0, 0);

  return [
    String(result.getUTCFullYear()).padStart(4, '0'),
    String(result.getUTCMonth() + 1).padStart(2, '0'),
    String(result.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function addMinutesToSlot(slotId: string, minutesToAdd: number): string {
  const parsed = parseSlotId(slotId);
  if (!parsed) {
    throw new RangeError(`Invalid availability slot ID: ${slotId}`);
  }

  const startMinutes = timeToMinutes(parsed.time);
  if (startMinutes === null) {
    throw new RangeError(`Invalid availability slot ID: ${slotId}`);
  }

  const totalMinutes = startMinutes + minutesToAdd;
  const dayOffset = Math.floor(totalMinutes / MINUTES_PER_DAY);
  const minutesWithinDay = totalMinutes % MINUTES_PER_DAY;
  return createSlotId(addDays(parsed.date, dayOffset), minutesToTime(minutesWithinDay));
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function compareSlotIds(left: string, right: string): number {
  return left.localeCompare(right);
}

function toMillis(value: DateTimeLike): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return value.toMillis();
}

/** Creates a stable, timezone-free ID for a local interview slot. */
export function createSlotId(date: string, time: string): string {
  if (!isValidDate(date)) {
    throw new RangeError(`Invalid interview date: ${date}`);
  }
  if (timeToMinutes(time) === null) {
    throw new RangeError(`Invalid interview time: ${time}`);
  }

  return `${date}${SLOT_ID_SEPARATOR}${time}`;
}

/** Parses a canonical slot ID, returning null for untrusted or malformed input. */
export function parseSlotId(slotId: string): ParsedSlotId | null {
  const separatorIndex = slotId.indexOf(SLOT_ID_SEPARATOR);
  if (separatorIndex < 0 || separatorIndex !== slotId.lastIndexOf(SLOT_ID_SEPARATOR)) return null;

  const date = slotId.slice(0, separatorIndex);
  const time = slotId.slice(separatorIndex + SLOT_ID_SEPARATOR.length);
  if (!isValidDate(date) || timeToMinutes(time) === null) return null;

  return { date, time };
}

/** Generates full availability cells between startTime (inclusive) and endTime (exclusive). */
export function generateAvailabilitySlots(
  dates: readonly string[],
  startTime: string,
  endTime: string,
  slotMinutes: number,
): string[] {
  assertPositiveInteger(slotMinutes, 'slotMinutes');
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    throw new RangeError('startTime and endTime must use HH:mm format.');
  }
  if (endMinutes <= startMinutes) {
    throw new RangeError('endTime must be later than startTime on the same day.');
  }
  if ((endMinutes - startMinutes) % slotMinutes !== 0) {
    throw new RangeError('The time range must be evenly divisible by slotMinutes.');
  }

  const result: string[] = [];
  for (const date of unique(dates)) {
    if (!isValidDate(date)) {
      throw new RangeError(`Invalid interview date: ${date}`);
    }
    for (let minutes = startMinutes; minutes < endMinutes; minutes += slotMinutes) {
      result.push(createSlotId(date, minutesToTime(minutes)));
    }
  }
  return result;
}

/** Generates availability cells while allowing each interview date to use its own time range. */
export function generateAvailabilitySlotsForSchedules(
  schedules: readonly InterviewDaySchedule[],
  slotMinutes: number,
): string[] {
  assertPositiveInteger(slotMinutes, 'slotMinutes');
  const seenDates = new Set<string>();

  return [...schedules]
    .sort((left, right) => left.date.localeCompare(right.date))
    .flatMap(schedule => {
      if (seenDates.has(schedule.date)) {
        throw new RangeError(`Duplicate interview date: ${schedule.date}`);
      }
      seenDates.add(schedule.date);
      return generateAvailabilitySlots(
        [schedule.date],
        schedule.startTime,
        schedule.endTime,
        slotMinutes,
      );
    });
}

/** Expands coarse availability cells into possible assignment start slots. */
export function availabilityToAssignmentCandidates(
  availabilitySlots: readonly string[],
  availabilitySlotMinutes: number,
  assignmentSlotMinutes: number,
): string[] {
  assertPositiveInteger(availabilitySlotMinutes, 'availabilitySlotMinutes');
  assertPositiveInteger(assignmentSlotMinutes, 'assignmentSlotMinutes');
  if (availabilitySlotMinutes % assignmentSlotMinutes !== 0) {
    throw new RangeError('assignmentSlotMinutes must evenly divide availabilitySlotMinutes.');
  }

  const candidates = new Set<string>();
  for (const slotId of availabilitySlots) {
    if (!parseSlotId(slotId)) {
      throw new RangeError(`Invalid availability slot ID: ${slotId}`);
    }
    for (let offset = 0; offset < availabilitySlotMinutes; offset += assignmentSlotMinutes) {
      candidates.add(addMinutesToSlot(slotId, offset));
    }
  }

  return [...candidates].sort(compareSlotIds);
}

/** Uses a half-open survey window: opensAt is included and closesAt is excluded. */
export function getSurveyPhase(now: DateTimeLike, opensAt: DateTimeLike, closesAt: DateTimeLike): SurveyPhase {
  const nowMillis = toMillis(now);
  const opensAtMillis = toMillis(opensAt);
  const closesAtMillis = toMillis(closesAt);

  if (![nowMillis, opensAtMillis, closesAtMillis].every(Number.isFinite)) {
    throw new RangeError('Survey times must be valid finite timestamps.');
  }
  if (closesAtMillis <= opensAtMillis) {
    throw new RangeError('closesAt must be later than opensAt.');
  }
  if (nowMillis < opensAtMillis) return 'before';
  if (nowMillis < closesAtMillis) return 'open';
  return 'closed';
}

export function validateAvailability(
  selection: readonly string[],
  allowedSlots: readonly string[],
): AvailabilityValidationResult {
  const allowed = new Set(allowedSlots);
  const seen = new Set<string>();
  const invalidSlots: string[] = [];
  const duplicateSlots: string[] = [];

  for (const slotId of selection) {
    if (!allowed.has(slotId) && !invalidSlots.includes(slotId)) invalidSlots.push(slotId);
    if (seen.has(slotId) && !duplicateSlots.includes(slotId)) duplicateSlots.push(slotId);
    seen.add(slotId);
  }

  return {
    valid: invalidSlots.length === 0 && duplicateSlots.length === 0,
    invalidSlots,
    duplicateSlots,
  };
}

export function getScheduleChangeImpact(
  oldAllowed: readonly string[],
  newAllowed: readonly string[],
  responses: readonly AvailabilityResponse[],
): ScheduleChangeImpact {
  const oldAllowedSet = new Set(oldAllowed);
  const newAllowedSet = new Set(newAllowed);
  const removedAllowedSlots = unique(oldAllowed)
    .filter((slotId) => !newAllowedSet.has(slotId))
    .sort(compareSlotIds);
  const addedAllowedSlots = unique(newAllowed)
    .filter((slotId) => !oldAllowedSet.has(slotId))
    .sort(compareSlotIds);
  const removedSet = new Set(removedAllowedSlots);

  const affectedResponses = responses.flatMap<AffectedScheduleResponse>((response) => {
    const responseSlots = unique(response.availability);
    const removedSlots = responseSlots.filter((slotId) => removedSet.has(slotId)).sort(compareSlotIds);
    if (removedSlots.length === 0) return [];

    return [{
      applicantId: response.applicantId,
      removedSlots,
      retainedSlots: responseSlots.filter((slotId) => newAllowedSet.has(slotId)).sort(compareSlotIds),
    }];
  });

  return {
    addedAllowedSlots,
    removedAllowedSlots,
    affectedResponseCount: affectedResponses.length,
    removedSelectionCount: affectedResponses.reduce((total, response) => total + response.removedSlots.length, 0),
    affectedResponses,
  };
}

/** Finds assignments that cannot remain valid under a proposed round schedule. */
export function getAssignmentScheduleImpact(
  newAllowedSlots: readonly string[],
  availabilitySlotMinutes: number,
  assignmentSlotMinutes: number,
  records: ReadonlyArray<{ applicantId: string; assignment: InterviewAssignment | null }>,
): AssignmentScheduleImpact {
  const candidates = new Set(availabilityToAssignmentCandidates(
    newAllowedSlots,
    availabilitySlotMinutes,
    assignmentSlotMinutes,
  ));
  const affectedAssignments = records.flatMap<AssignmentScheduleImpactItem>(record => {
    const assignment = record.assignment;
    if (!assignment) return [];
    if (!assignment.slotId) {
      return [{ applicantId: record.applicantId, slotId: null, reason: 'legacy-missing-slot' }];
    }
    if (!candidates.has(assignment.slotId)) {
      return [{ applicantId: record.applicantId, slotId: assignment.slotId, reason: 'outside-schedule' }];
    }
    if (assignment.durationMinutes !== assignmentSlotMinutes) {
      return [{ applicantId: record.applicantId, slotId: assignment.slotId, reason: 'duration-changed' }];
    }
    return [];
  });
  return { affectedAssignmentCount: affectedAssignments.length, affectedAssignments };
}

/** Treats assignments as half-open intervals, so adjacent interviews do not conflict. */
export function assignmentsOverlap(
  first: Readonly<InterviewAssignment>,
  second: Readonly<InterviewAssignment>,
): boolean {
  if (first.interviewerId !== second.interviewerId) return false;
  assertPositiveInteger(first.durationMinutes, 'first.durationMinutes');
  assertPositiveInteger(second.durationMinutes, 'second.durationMinutes');

  const firstStart = first.startsAt.toMillis();
  const secondStart = second.startsAt.toMillis();
  const firstEnd = firstStart + first.durationMinutes * MILLISECONDS_PER_MINUTE;
  const secondEnd = secondStart + second.durationMinutes * MILLISECONDS_PER_MINUTE;

  return firstStart < secondEnd && secondStart < firstEnd;
}

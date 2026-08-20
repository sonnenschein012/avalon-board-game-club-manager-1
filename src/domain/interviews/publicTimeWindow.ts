/**
 * The public availability window is based on the calendar date (in KST) on
 * which a persisted first access occurred.  It deliberately does not use the
 * browser's local timezone: a visitor opening a link at 23:30 UTC is already
 * on the following calendar date in Korea.
 */

const KST_TIME_ZONE = 'Asia/Seoul';
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PublicTimeWindowResult {
  startDate: string;
  endDate: string;
  activeSlots: string[];
  formattedRange: string;
}

function isValidDateString(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;
}

function isValidTimeString(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/** Returns a canonical KST calendar date for a valid Date value. */
export function getKstDateString(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError('firstAccessedAt must be a valid Date.');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) throw new RangeError('Could not determine the KST calendar date.');
  return `${year}-${month}-${day}`;
}

/** Adds whole calendar days without allowing the host timezone to intervene. */
export function addDaysToDateString(dateString: string, daysToAdd: number): string {
  if (!isValidDateString(dateString)) throw new RangeError(`Invalid date: ${dateString}`);
  if (!Number.isInteger(daysToAdd)) throw new RangeError('daysToAdd must be an integer.');

  const [yearText, monthText, dayText] = dateString.split('-');
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return [
    String(date.getUTCFullYear()).padStart(4, '0'),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function formatKoreanDate(dateString: string): string {
  if (!isValidDateString(dateString)) return '';
  const [yearText, monthText, dayText] = dateString.split('-');
  const date = new Date(`${yearText}-${monthText}-${dayText}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: KST_TIME_ZONE,
  }).format(date);
}

function getSlotDate(slotId: unknown): string | null {
  if (typeof slotId !== 'string') return null;
  const separatorIndex = slotId.indexOf('|');
  if (separatorIndex < 0 || separatorIndex !== slotId.lastIndexOf('|')) return null;
  const date = slotId.slice(0, separatorIndex);
  const time = slotId.slice(separatorIndex + 1);
  return isValidDateString(date) && isValidTimeString(time) ? date : null;
}

/**
 * Calculates the slots visible to a public applicant.
 *
 * `firstAccessedAt` must be the persisted first access value.  Passing it on
 * every calculation makes re-access stable; the current clock is intentionally
 * not consulted here.  Before the first access has been persisted, all valid
 * round slots are returned so the caller can render the initial page and then
 * persist the access atomically.
 */
export function calculateApplicantTimeWindow(
  firstAccessedAt: Date | null,
  allowedSlots: readonly string[],
): PublicTimeWindowResult {
  const validSlots = allowedSlots.filter((slot) => getSlotDate(slot) !== null);
  if (!firstAccessedAt) {
    return { startDate: '', endDate: '', activeSlots: validSlots, formattedRange: '' };
  }

  const accessDateKst = getKstDateString(firstAccessedAt);
  const startDate = addDaysToDateString(accessDateKst, 1);
  const endDate = addDaysToDateString(startDate, 3);
  const activeSlots = validSlots.filter((slot) => {
    const date = getSlotDate(slot);
    return date !== null && date >= startDate && date <= endDate;
  });

  return {
    startDate,
    endDate,
    activeSlots,
    formattedRange: `${formatKoreanDate(startDate)} ~ ${formatKoreanDate(endDate)}`,
  };
}

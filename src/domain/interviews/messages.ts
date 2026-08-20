export type InterviewMessagePlaceholder =
  | 'name'
  | 'link'
  | 'deadline'
  | 'interviewDate'
  | 'interviewTime'
  | 'oldInterviewDate'
  | 'oldInterviewTime'
  | 'roundName';

export type InterviewMessagePlaceholders = Partial<Record<InterviewMessagePlaceholder, string>>;

const SUPPORTED_PLACEHOLDERS = new Set<InterviewMessagePlaceholder>([
  'name',
  'link',
  'deadline',
  'interviewDate',
  'interviewTime',
  'oldInterviewDate',
  'oldInterviewTime',
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

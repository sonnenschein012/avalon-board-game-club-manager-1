export function normalizeMemberName(value: string) {
  return value.trim().replace(/\s+/g, '');
}

export function normalizeStudentYear(value: string) {
  const digits = value.replace(/\D/g, '');
  if (/^20\d{2}/.test(digits)) return digits.slice(2, 4);
  return digits.slice(0, 2);
}

export function formatMemberPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10 && digits.startsWith('02')) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value.trim();
}

export function defaultMemberNickname(name: string, studentYear: string) {
  return `${studentYear} ${name.trim()}`.trim();
}

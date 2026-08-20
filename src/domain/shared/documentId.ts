/** Returns true when a value can be used as one Firestore document path segment. */
export function isSingleDocumentId(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 && normalized !== '.' && normalized !== '..' && !normalized.includes('/');
}

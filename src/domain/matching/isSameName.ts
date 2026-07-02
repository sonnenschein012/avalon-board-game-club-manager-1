/**
 * 두 이름이 동일한지 판단합니다. (공백, 앞 2자리 학번, 대소문자 무시)
 * @param n1 - 첫 번째 이름
 * @param n2 - 두 번째 이름
 * @returns 두 이름이 동일하면 true
 * @example
 * isSameName('김철수', '김 철수') // true
 * isSameName('23김철수', '김철수') // true
 */
export const isSameName = (n1?: string, n2?: string): boolean => {
  const clean = (n?: string) => (n || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').replace(/^\d{2}/, '').toLowerCase();
  return clean(n1) === clean(n2);
};

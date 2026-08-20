/**
 * Timestamp 또는 Date 객체에서 학기(예: '2024-1', '2024-2') 문자열을 추출합니다.
 * @param timestamp - Firebase Timestamp 객체 또는 JS Date 등 날짜 값
 * @returns 학기 포맷 문자열
 * @example
 * getSemester(new Date('2024-04-15')) // '2024-1'
 */
export const getSemester = (timestamp: { toDate?: () => Date } | number | string | Date | null | undefined): string => {
  if (!timestamp) return '알 수 없음';
  
  const date = typeof timestamp === 'object' && !(timestamp instanceof Date) && timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp as string | number | Date);
  if (isNaN(date.getTime())) return '알 수 없음';
  
  const year = date.getFullYear();
  const month = date.getMonth(); 
  
  // 3월(idx: 2) ~ 8월(idx: 7) -> 1학기
  if (month >= 2 && month <= 7) return `${year}-1`;
  // 9월(idx: 8) ~ 12월(idx: 11) -> 2학기
  if (month >= 8 && month <= 11) return `${year}-2`;
  // 1월(idx: 0) ~ 2월(idx: 1) -> 작년 2학기 편입
  return `${year - 1}-2`;
};

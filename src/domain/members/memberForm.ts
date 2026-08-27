export const AVAILABLE_GENRES = ['카드', '파티', '협상', '전략', '타일', '경매', '추리', '수학', '마피아', '심리', '협력', '주사위', '순발력', '퍼즐', '그림', '기억력', '배팅', '타이쿤', '퀴즈', '단어'];

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;

export const defaultSemester = (currentMonth >= 3 && currentMonth <= 8)
  ? `${currentYear}-1`
  : (currentMonth >= 9 ? `${currentYear}-2` : `${currentYear - 1}-2`);

export const defaultDormantSemester = defaultSemester.endsWith('-1')
  ? `${defaultSemester.split('-')[0]}-2`
  : `${parseInt(defaultSemester.split('-')[0] || '') + 1}-1`;

export interface MemberFormData {
  name: string;
  nickname: string;
  studentId: string;
  phone: string;
  gender: '남' | '여' | '기타';
  semester: string;
  preferredGenre: string[];
  memo: string;
  isBoardMember: boolean;
  dormantSemester: string;
}

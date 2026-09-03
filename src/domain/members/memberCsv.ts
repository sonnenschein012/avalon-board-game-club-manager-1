import type { Member } from '../../types';
import { GAME_GENRES } from '../games/gameCatalog';
import type { MemberFormData } from './memberForm';

type ImportedMember = MemberFormData & { status: '활동' | '휴면' };

/** The roster CSV retains its supplied student IDs, phone numbers, and nicknames. */
export function parseMemberCsv(
  rows: readonly Record<string, string>[],
  existingMembers: readonly Pick<Member, 'name' | 'studentId'>[],
  fallbackSemester: string,
) {
  const existingKeys = new Set(existingMembers.map(member => `${member.name}_${member.studentId}`));
  const members: ImportedMember[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    const name = row['이름']?.trim();
    const studentId = row['학번']?.trim();
    if (!name || !studentId) continue;

    const key = `${name}_${studentId}`;
    if (existingKeys.has(key)) {
      skippedCount++;
      continue;
    }
    existingKeys.add(key);

    const semester = (row['가입학기']?.trim() || fallbackSemester).replace(/jan/i, '1').replace(/feb/i, '2');
    const preferredGenre = (row['선호장르']?.trim() || '').split(',')
      .map(genre => genre.trim()).filter(genre => GAME_GENRES.includes(genre));
    const dormantSemester = row['휴면학기']?.trim() || '';
    const rawBoard = row['임원여부']?.trim().toLowerCase();

    members.push({
      name,
      nickname: row['닉네임']?.trim() || `${studentId} ${name}`,
      studentId,
      phone: row['연락처']?.trim() || '',
      gender: row['성별']?.trim() === '여' ? '여' : (row['성별']?.trim() === '기타' ? '기타' : '남'),
      semester,
      preferredGenre,
      memo: row['메모']?.trim() || '',
      status: row['상태']?.trim() === '휴면' || dormantSemester ? '휴면' : '활동',
      isBoardMember: rawBoard === 'y' || rawBoard === '임원' || rawBoard === 'true',
      dormantSemester,
    });
  }

  return { members, skippedCount };
}

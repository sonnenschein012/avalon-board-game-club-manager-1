import type { RequestChoice } from '../domain/matching/companionRequests';
import AttendanceNotice from './AttendanceNotice';

export default function CompanionRequestNotice({ choice, onOpen }: { choice: RequestChoice; onOpen: (key: string) => void }) {
  const selected = choice.candidates.find(candidate => candidate.id === choice.selectedId);
  return <AttendanceNotice onClick={() => onOpen(choice.key)}>
    {selected ? `동반 상대 확인: ${choice.requester}님의 ‘${choice.mention}’ 상대는 ${selected.name}님입니다. 눌러서 변경할 수 있습니다.`
      : `상대 확인 필요: ${choice.requester}님이 요청한 ‘${choice.mention}’의 상대를 선택해주세요. 이 알림을 누르면 선택창이 열립니다.`}
  </AttendanceNotice>;
}

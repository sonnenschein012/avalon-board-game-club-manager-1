import type { Attendee, Member } from '../../types';
import { getMemberFromAttendee } from '../matching/getMemberFromAttendee';

export const isGuest = (attendee: Attendee | undefined) => attendee?.participantType === 'guest';
export function attendeeMember(attendee: Attendee | undefined, members: Member[]) {
  return !attendee || isGuest(attendee) ? undefined : getMemberFromAttendee(members, attendee.name, attendee.studentIdPrefix, attendee.memberId);
}
export function validateGuestInvitation(inviterId: string, attendees: Attendee[], members: Member[]) {
  const inviter = attendees.find(a => a.id === inviterId);
  if (!inviter || inviter.status === '결석' || !attendeeMember(inviter, members))
    throw new Error('초대한 동아리원을 참석 명단에 먼저 추가해주세요.');
  if (attendees.some(a => isGuest(a) && a.invitedByAttendeeId === inviterId))
    throw new Error('한 회원은 게스트를 최대 1명만 초대할 수 있습니다.');
}
export function guestRelationLabel(attendee: Attendee, attendees: Attendee[]) {
  if (isGuest(attendee)) {
    const inviter = attendees.find(a => a.id === attendee.invitedByAttendeeId);
    return `게스트 · 초대자: ${inviter?.name ?? '확인 필요'}`;
  }
  return attendees.some(a => isGuest(a) && a.invitedByAttendeeId === attendee.id) ? '게스트 동반' : '';
}
export function guestRelationWarnings(attendees: Attendee[], members: Member[]) {
  return attendees.filter(isGuest).flatMap(guest => {
    const inviter = attendees.find(a => a.id === guest.invitedByAttendeeId);
    return !inviter || inviter.status === '결석' || !attendeeMember(inviter, members)
      ? [`${guest.name}: 초대한 회원이 삭제·결석 또는 미등록 상태입니다. 초대 관계를 확인해주세요.`] : [];
  });
}

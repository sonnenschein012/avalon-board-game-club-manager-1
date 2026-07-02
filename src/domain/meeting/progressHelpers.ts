import { StoredSessionGroup, Member, Attendee } from '../../types';

export const calculateGridPositions = (groups: StoredSessionGroup[]) => {
  const newPositions: Record<string, {x: number, y: number}> = {};
  const cols = 3;
  const containerW = 1200;
  const cardW = 340;
  const X = (containerW - (cardW * cols)) / (cols + 1);

  let currentY = X + 120;
  let maxBottomInRow = currentY;

  groups.forEach((group, idx) => {
    const colIdx = idx % cols;
    if (colIdx === 0 && idx !== 0) {
      currentY = maxBottomInRow + X;
      maxBottomInRow = currentY;
    }
    
    const xPos = 200 + X + colIdx * (cardW + X);
    newPositions[group.id] = { x: xPos, y: currentY };
    
    const cardEl = document.getElementById(`card-${group.id}`);
    let h: number;
    if (cardEl) {
      h = cardEl.offsetHeight;
    } else {
      const uniqueMembers = new Set(group.memberIds);
      h = 24 * 2 + 16 + 16 + 48 + (uniqueMembers.size * 36); 
    }

    if (currentY + h > maxBottomInRow) {
      maxBottomInRow = currentY + h;
    }
  });

  return newPositions;
};

export const generateDrinkOrderText = (
  groups: StoredSessionGroup[],
  members: Member[],
  getAttendeeFromMember: (m: Member | undefined) => Attendee | undefined
) => {
  let text = `[AVALON] 오늘 음료 주문 내역입니다.\n\n`;

  groups.forEach((group, idx) => {
    const groupName = group.name || `Team ${idx + 1}`;
    text += `<${groupName}>\n`;
    
    const groupMembers = Array.from(new Set(group.memberIds)).map(id => members.find(m => m.id === id)).filter(Boolean);
    
    const drinks = groupMembers.map(m => {
      const a = getAttendeeFromMember(m);
      return a?.drink || '미선택';
    }).sort((a, b) => a.localeCompare(b));

    drinks.forEach(drink => {
      text += `${drink}\n`;
    });
    text += `\n`;
  });

  return text.trim();
};

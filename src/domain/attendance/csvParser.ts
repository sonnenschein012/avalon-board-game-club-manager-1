export function parseAttendeeCsvRow(row: Record<string, string>) {
  const rawName = row['학번 및 이름'] || row['이름'] || row['Name'] || Object.values(row)[1] || '';
  const rawDrink = row['마시고 싶은 음료'] || row['음료'] || '';
  const rawAfterparty = row['뒷풀이에 참석하시나요?'] || row['뒷풀이 여부'] || '';
  const request = row['희망사항'] || row['행사 관련 희망사항'] || row['요청사항'] || Object.values(row)[4] || '';

  if (typeof rawName !== 'string' || rawName.trim() === '') {
    return null;
  }

  const match = rawName.trim().match(/^(\d{2})?\s*(.+)$/);
  const studentIdPrefix = match?.[1] || '';
  const name = match?.[2]?.trim() || rawName.trim();

  const afterparty = typeof rawAfterparty === 'string' && (rawAfterparty.includes('네') || rawAfterparty.includes('참석') || rawAfterparty.includes('O') || rawAfterparty.includes('o') || rawAfterparty.includes('필참'));

  return {
    name,
    studentIdPrefix,
    drink: typeof rawDrink === 'string' ? rawDrink.trim() : '',
    afterparty,
    afterpartyPay: false,
    request: typeof request === 'string' ? request.trim() : '',
  };
}

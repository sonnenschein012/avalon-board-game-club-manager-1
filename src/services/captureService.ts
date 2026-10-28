import * as htmlToImage from 'html-to-image';

export async function captureBoard(
  node: HTMLElement,
  boardHeight: number,
  dateString: string
): Promise<void> {
  try {
    const blob = await htmlToImage.toBlob(node, {
      pixelRatio: 2,
      backgroundColor: '#000000',
      width: 1600,
      height: boardHeight,
      style: {
        transform: 'none',
      },
      filter: (childNode) => {
        if (
          childNode instanceof HTMLElement &&
          childNode.classList.contains('hide-on-capture')
        ) {
          return false;
        }
        return true;
      },
    });
    if (!blob || blob.size === 0) {
      throw new Error('유효한 PNG 이미지를 만들지 못했습니다.');
    }
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    try {
      link.download = `AVALON_Notice_${dateString}.png`;
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
    } finally {
      link.remove();
      // Safari may still be using the URL while its download confirmation is open.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
  } catch (e) {
    console.error(e);
    alert('이미지 생성에 실패했습니다.');
  }
}

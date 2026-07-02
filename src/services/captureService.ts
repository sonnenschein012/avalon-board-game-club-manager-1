import * as htmlToImage from 'html-to-image';

export async function captureBoard(
  node: HTMLElement,
  boardHeight: number,
  dateString: string
): Promise<void> {
  try {
    const dataUrl = await htmlToImage.toPng(node, {
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
    const link = document.createElement('a');
    link.download = `AVALON_Notice_${dateString}.png`;
    link.href = dataUrl;
    link.click();
  } catch (e) {
    console.error(e);
    alert('이미지 생성에 실패했습니다.');
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as htmlToImage from 'html-to-image';
import { captureBoard } from './captureService';

vi.mock('html-to-image', () => ({ toBlob: vi.fn() }));

describe('board image download', () => {
  const url = 'blob:https://example.test/synthetic-image';
  let click: ReturnType<typeof vi.spyOn>;
  const createObjectURL = vi.fn(() => url);
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
    vi.mocked(htmlToImage.toBlob).mockResolvedValue(new Blob(['synthetic PNG'], { type: 'image/png' }));
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('downloads PNG through an attached Blob URL link and releases the URL later', async () => {
    click.mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true);
      expect(this.download).toBe('AVALON_Notice_2026-10-28.png');
      expect(this.href).toBe(url);
      expect(revokeObjectURL).not.toHaveBeenCalled();
    });
    const node = document.createElement('div');
    await captureBoard(node, 800, '2026-10-28');
    expect(htmlToImage.toBlob).toHaveBeenCalledWith(node, expect.objectContaining({
      width: 1600, height: 800, pixelRatio: 2, backgroundColor: '#000000', style: { transform: 'none' },
    }));
    expect(createObjectURL).toHaveBeenCalledWith(await vi.mocked(htmlToImage.toBlob).mock.results[0]!.value);
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
    expect(window.alert).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(url);
  });

  it.each(['missing', 'empty'])('does not download a %s PNG', async kind => {
    vi.mocked(htmlToImage.toBlob).mockResolvedValue(kind === 'missing' ? null : new Blob([]));
    await captureBoard(document.createElement('div'), 800, 'synthetic');
    expect(window.alert).toHaveBeenCalledWith('이미지 생성에 실패했습니다.');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('retains the existing failure alert when rendering rejects', async () => {
    vi.mocked(htmlToImage.toBlob).mockRejectedValue(new Error('synthetic failure'));
    await captureBoard(document.createElement('div'), 800, 'synthetic');
    expect(window.alert).toHaveBeenCalledWith('이미지 생성에 실패했습니다.');
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('cleans up the link and URL even if the download click throws', async () => {
    click.mockImplementation(() => { throw new Error('synthetic click failure'); });
    await captureBoard(document.createElement('div'), 800, 'synthetic');
    expect(window.alert).toHaveBeenCalledOnce();
    expect(document.querySelector('a')).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(url);
  });
});

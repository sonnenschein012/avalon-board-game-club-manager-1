import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeBatch } from 'firebase/firestore';
import { toast } from 'sonner';
import { useGamesLogic } from './useGamesLogic';
import type { Game } from '../types';

const game: Game = { id: 'unrated', title: '미평가 게임', minPlayers: 0, maxPlayers: 0,
  bestMinPlayers: 0, bestMaxPlayers: 0, complexity: 0, genres: [], memo: '' };
vi.mock('./useFirestore', () => ({ useFirestore: (name: string) => ({ data: name === 'games' ? [game] : [] }) }));
vi.mock('../lib/firebase', () => ({ db: {}, handleFirestoreError: vi.fn(), OperationType: {} }));
vi.mock('../services/auditService', () => ({
  addAuditEventToBatch: vi.fn(), createAuditEventOperation: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), collection: vi.fn(), writeBatch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let logic: ReturnType<typeof useGamesLogic>;
function Harness() {
  const value = useGamesLogic();
  React.useEffect(() => { logic = value; });
  return null;
}

describe('game saving validation', () => {
  let root: Root;
  let container: HTMLDivElement;
  const batch = { update: vi.fn(), commit: vi.fn(async () => undefined) };
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(writeBatch).mockReturnValue(batch as unknown as ReturnType<typeof writeBatch>);
    container = document.createElement('div');
    root = createRoot(container);
    await act(async () => root.render(<Harness />));
    await act(async () => logic.startEditing(game));
  });
  afterEach(() => { act(() => root.unmount()); });
  const submit = () => act(async () => logic.handleSubmit({ preventDefault() {} } as React.FormEvent));

  it('saves a memo-only edit while retaining the unrated and unspecified values', async () => {
    await act(async () => logic.setFormData(current => ({ ...current, memo: '새 메모' })));
    await submit();
    expect(batch.update).toHaveBeenCalledWith(undefined, expect.objectContaining({
      memo: '새 메모', complexity: 0, minPlayers: 0, maxPlayers: 0, bestMinPlayers: 0, bestMaxPlayers: 0,
    }));
    expect(batch.commit).toHaveBeenCalledOnce();
  });

  it.each([
    { minPlayers: -1 }, { minPlayers: 2.5 }, { minPlayers: 5, maxPlayers: 2 },
    { bestMinPlayers: 5, bestMaxPlayers: 2 }, { minPlayers: NaN }, { complexity: 0.5 },
  ])('retains invalid drafts without starting a write: %s', async values => {
    await act(async () => logic.setFormData(current => ({ ...current, ...values })));
    await submit();
    expect(writeBatch).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledOnce();
    expect(logic.editingId).toBe(game.id);
  });
});

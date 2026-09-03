import { describe, expect, it } from 'vitest';
import type { StoredSessionGroup } from '../../types';
import { mergeSessionGroups, normalizeSessionGroup } from './sessionGroups';

const group = (id: string, overrides: Partial<StoredSessionGroup> = {}): StoredSessionGroup => ({
  id, memberIds: ['member'], gameIds: [], ...overrides,
});

describe('session group edit merge', () => {
  it('preserves remotely recorded games when a legacy group is unchanged after normalization', () => {
    const initial = group('a');
    const remote = group('a', { gameIds: ['new-game'] });
    const merged = mergeSessionGroups([remote], [initial], [normalizeSessionGroup(initial)]);
    expect(merged).toEqual([remote]);
  });

  it('applies local changes and deletions while retaining remote additions', () => {
    const initial = [group('a'), group('b')];
    const remoteAddition = group('remote');
    const current = [group('a', { name: 'Remote name' }), group('b'), remoteAddition];
    const localChange = group('a', { name: 'Local name' });
    const localAddition = group('local');
    expect(mergeSessionGroups(current, initial, [localChange, localAddition])).toEqual([
      normalizeSessionGroup(localChange), remoteAddition, normalizeSessionGroup(localAddition),
    ]);
    expect(current[0]?.name).toBe('Remote name');
    expect(initial[0]?.name).toBeUndefined();
  });

  it('respects remote deletion of untouched groups but retains a locally edited group', () => {
    const initial = [group('untouched'), group('changed')];
    const changed = group('changed', { notes: 'Added notes' });
    expect(mergeSessionGroups([], initial, [group('untouched'), changed])).toEqual([
      normalizeSessionGroup(changed),
    ]);
  });

  it('uses the complete local draft when no initial edit snapshot exists', () => {
    expect(mergeSessionGroups([group('remote')], null, [group('draft')])).toEqual([
      normalizeSessionGroup(group('draft')),
    ]);
  });
});

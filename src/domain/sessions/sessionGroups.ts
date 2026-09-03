import type { StoredSessionGroup } from '../../types';

export function normalizeSessionGroup(group: StoredSessionGroup): StoredSessionGroup {
  return {
    id: group.id,
    name: group.name || '',
    memberIds: [...(group.memberIds || [])],
    targetSize: group.targetSize || 0,
    gameIds: [...(group.gameIds || [])],
    notes: group.notes || '',
  };
}

/** Keeps other operators' groups unless this editor changed or deleted that group. */
export function mergeSessionGroups(
  currentGroups: readonly StoredSessionGroup[],
  initialGroups: readonly StoredSessionGroup[] | null,
  editedGroups: readonly StoredSessionGroup[],
): StoredSessionGroup[] {
  const edited = editedGroups.map(normalizeSessionGroup);
  if (!initialGroups) return edited;

  const initialById = new Map(initialGroups.map(group => [group.id, normalizeSessionGroup(group)]));
  const editedIds = new Set(edited.map(group => group.id));
  const merged = currentGroups.filter(group => !initialById.has(group.id) || editedIds.has(group.id));

  for (const group of edited) {
    const initial = initialById.get(group.id);
    if (initial && JSON.stringify(initial) === JSON.stringify(group)) continue;
    const index = merged.findIndex(current => current.id === group.id);
    if (index === -1) merged.push(group);
    else merged[index] = group;
  }
  return merged;
}

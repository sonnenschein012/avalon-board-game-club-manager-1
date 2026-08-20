import { describe, expect, it } from 'vitest';
import { isSingleDocumentId } from './documentId';

describe('isSingleDocumentId', () => {
  it('accepts a normal opaque document ID', () => {
    expect(isSingleDocumentId('round_2026-2')).toBe(true);
  });

  it.each(['', '   ', '.', '..', 'round/child'])(
    'rejects an invalid single-document path segment: %s',
    value => expect(isSingleDocumentId(value)).toBe(false),
  );
});

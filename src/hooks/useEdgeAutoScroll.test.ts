import { describe, expect, it } from 'vitest';
import { verticalEdgeSpeed } from './useEdgeAutoScroll';

describe('verticalEdgeSpeed', () => {
  it('does not scroll while the pointer is away from an edge', () => {
    expect(verticalEdgeSpeed(200, 0, 400, 80, 20)).toBe(0);
  });

  it('scrolls toward the closest edge with a speed that increases near it', () => {
    expect(verticalEdgeSpeed(20, 0, 400, 80, 20)).toBeLessThan(0);
    expect(verticalEdgeSpeed(390, 0, 400, 80, 20)).toBeGreaterThan(0);
    expect(verticalEdgeSpeed(5, 0, 400, 80, 20)).toBeLessThan(verticalEdgeSpeed(50, 0, 400, 80, 20));
  });
});

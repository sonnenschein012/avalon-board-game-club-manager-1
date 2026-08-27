import { useCallback, useEffect, useRef } from 'react';

interface EdgeAutoScrollOptions {
  edgeSize?: number;
  maxSpeed?: number;
}

type ScrollTarget = HTMLElement | Window;

interface PointerPosition {
  clientY: number;
  source: Element | null;
}

function verticalEdgeSpeed(clientY: number, top: number, bottom: number, edgeSize: number, maxSpeed: number) {
  if (bottom <= top) return 0;
  if (clientY < top + edgeSize) return -maxSpeed * (1 - Math.max(0, clientY - top) / edgeSize);
  if (clientY > bottom - edgeSize) return maxSpeed * (1 - Math.max(0, bottom - clientY) / edgeSize);
  return 0;
}

function canScroll(target: ScrollTarget, amount: number) {
  if (target === window) {
    const root = document.scrollingElement;
    if (!root) return false;
    return amount < 0 ? root.scrollTop > 0 : root.scrollTop + root.clientHeight < root.scrollHeight;
  }
  const element = target as HTMLElement;
  return amount < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight;
}

function scrollTarget(target: ScrollTarget, amount: number) {
  if (target === window) window.scrollBy({ top: amount, behavior: 'auto' });
  else (target as HTMLElement).scrollTop += amount;
}

function supportsVerticalScroll(element: HTMLElement) {
  const overflowY = window.getComputedStyle(element).overflowY;
  return (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
    && element.scrollHeight > element.clientHeight;
}

function scrollableAncestors(source: Element | null) {
  const ancestors: HTMLElement[] = [];
  let current = source instanceof HTMLElement ? source : null;
  while (current) {
    if (supportsVerticalScroll(current)) ancestors.push(current);
    current = current.parentElement;
  }
  return ancestors;
}

/**
 * Keeps the nearest scrollable surface moving while a pointer-paint gesture rests at its edge.
 * When that surface reaches its end, the next scrollable ancestor (including the page) takes over.
 */
export function useEdgeAutoScroll({ edgeSize = 80, maxSpeed = 18 }: EdgeAutoScrollOptions = {}) {
  const pointer = useRef<PointerPosition | null>(null);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    pointer.current = null;
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  }, []);

  const tick = useCallback(() => {
    const nextPointer = pointer.current;
    if (!nextPointer) {
      return;
    }

    const ancestor = scrollableAncestors(nextPointer.source).find((target) => {
      const rect = target.getBoundingClientRect();
      const speed = verticalEdgeSpeed(nextPointer.clientY, rect.top, rect.bottom, edgeSize, maxSpeed);
      return Math.abs(speed) >= 0.5 && canScroll(target, speed);
    });

    if (ancestor) {
      const rect = ancestor.getBoundingClientRect();
      scrollTarget(ancestor, verticalEdgeSpeed(nextPointer.clientY, rect.top, rect.bottom, edgeSize, maxSpeed));
    } else {
      const speed = verticalEdgeSpeed(nextPointer.clientY, 0, window.innerHeight, edgeSize, maxSpeed);
      if (Math.abs(speed) >= 0.5 && canScroll(window, speed)) scrollTarget(window, speed);
    }

  }, [edgeSize, maxSpeed]);

  const update = useCallback((clientY: number, source: Element | null = null) => {
    pointer.current = { clientY, source: source ?? pointer.current?.source ?? null };
    if (timer.current === null) timer.current = window.setInterval(tick, 16);
  }, [tick]);

  useEffect(() => stop, [stop]);
  return { updateEdgeAutoScroll: update, stopEdgeAutoScroll: stop };
}

export { verticalEdgeSpeed };

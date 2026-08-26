import { useCallback, useEffect, useRef } from 'react';

interface EdgeAutoScrollOptions {
  edgeSize?: number;
  maxSpeed?: number;
}

/** Keeps the page moving while a pointer-paint or drag gesture rests near a viewport edge. */
export function useEdgeAutoScroll({ edgeSize = 80, maxSpeed = 18 }: EdgeAutoScrollOptions = {}) {
  const pointerY = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  const stop = useCallback(() => {
    pointerY.current = null;
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  }, []);

  const tick = useCallback(() => {
    const y = pointerY.current;
    if (y === null) return;
    const bottomStart = window.innerHeight - edgeSize;
    let speed = 0;
    if (y < edgeSize) speed = -maxSpeed * (1 - Math.max(0, y) / edgeSize);
    else if (y > bottomStart) speed = maxSpeed * (1 - Math.max(0, window.innerHeight - y) / edgeSize);
    if (Math.abs(speed) >= 0.5) window.scrollBy({ top: speed, behavior: 'auto' });
  }, [edgeSize, maxSpeed]);

  const update = useCallback((clientY: number) => {
    pointerY.current = clientY;
    if (timer.current === null) timer.current = window.setInterval(tick, 16);
  }, [tick]);

  useEffect(() => stop, [stop]);
  return { updateEdgeAutoScroll: update, stopEdgeAutoScroll: stop };
}

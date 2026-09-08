import { useEffect, useRef } from 'react';
import { useEdgeAutoScroll } from './useEdgeAutoScroll';

/** Native card dragging needs updates even over gaps between drop targets. */
export function useNativeDragAutoScroll() {
  const active = useRef(false);
  const { updateEdgeAutoScroll, stopEdgeAutoScroll } = useEdgeAutoScroll();
  useEffect(() => {
    const stop = () => { active.current = false; stopEdgeAutoScroll(); };
    const move = (event: DragEvent) => {
      if (!active.current) return;
      updateEdgeAutoScroll(event.clientY, document.elementFromPoint(event.clientX, event.clientY));
    };
    const leave = (event: DragEvent) => {
      if (!event.relatedTarget) stopEdgeAutoScroll();
    };
    document.addEventListener('dragover', move);
    document.addEventListener('dragleave', leave);
    document.addEventListener('drop', stop, true);
    document.addEventListener('dragend', stop, true);
    window.addEventListener('blur', stop);
    return () => {
      stop();
      document.removeEventListener('dragover', move);
      document.removeEventListener('dragleave', leave);
      document.removeEventListener('drop', stop, true);
      document.removeEventListener('dragend', stop, true);
      window.removeEventListener('blur', stop);
    };
  }, [updateEdgeAutoScroll, stopEdgeAutoScroll]);
  return { startDragAutoScroll: () => { active.current = true; } };
}

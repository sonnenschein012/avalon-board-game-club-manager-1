import { useCallback, useRef, useState, type ReactNode, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, TraversalOrder,
  closestCenter, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent,
} from '@dnd-kit/core';
import { cn } from '../lib/utils';

interface Props {
  children: ReactNode;
  onMoveAttendee: (attendeeId: string, targetGroupId: string | null) => void;
}

export function AttendanceDragAndDrop({ children, onMoveAttendee }: Props) {
  const [preview, setPreview] = useState<ReactNode>(null);
  const pointerPool = useRef<{ element: Element; inside: boolean } | null>(null);
  const detectCollision = useCallback<CollisionDetection>(args => {
    const pool = args.droppableContainers.find(container => container.id === 'pool')?.node.current?.closest('[data-attendance-pool]');
    const point = args.pointerCoordinates;
    const rect = pool?.getBoundingClientRect();
    // Wheel containment is CSS; dnd-kit's programmatic scrolling needs its own boundary.
    const inside = Boolean(point && rect
      && point.x >= rect.left && point.x <= rect.right
      && point.y >= rect.top && point.y <= rect.bottom);
    pointerPool.current = pool && point ? { element: pool, inside } : null;
    // The drop zone extends through the list; clipped content must not receive drops.
    return point ? pointerWithin(args).filter(collision => collision.id !== 'pool' || inside) : closestCenter(args);
  }, []);
  const canScroll = useCallback((element: Element) => {
    const pool = pointerPool.current;
    return !pool || (pool.inside ? element === pool.element : element !== pool.element);
  }, []);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const finish = ({ active, over }: DragEndEvent) => {
    pointerPool.current = null;
    setPreview(null);
    if (!over) return;
    const target = over.data.current?.groupId;
    if (typeof target === 'string' || target === null) onMoveAttendee(String(active.id), target);
  };
  return <DndContext
    sensors={sensors}
    collisionDetection={detectCollision}
    autoScroll={{ canScroll, order: TraversalOrder.ReversedTreeOrder, threshold: { x: 0, y: 0.15 }, acceleration: 18, interval: 16 }}
    onDragStart={({ active }) => setPreview(active.data.current?.preview ?? null)}
    onDragCancel={() => { pointerPool.current = null; setPreview(null); }} onDragEnd={finish}
    accessibility={{ screenReaderInstructions: { draggable: '스페이스 키로 조원 카드를 잡고, 방향키로 이동한 다음 스페이스 키로 놓으세요. 취소하려면 Escape 키를 누르세요.' } }}
  >
    {children}
    {createPortal(<DragOverlay dropAnimation={null} zIndex={100} style={{ pointerEvents: 'none' }}>
      {preview}
    </DragOverlay>, document.body)}
  </DndContext>;
}

interface CardProps {
  attendeeId: string;
  disabled?: boolean;
  children: ReactNode;
  className: string;
}

export function AttendanceDraggableCard({ attendeeId, disabled = false, children, className }: CardProps) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: attendeeId, disabled,
    data: { preview: <div data-attendance-drag-preview aria-hidden="true" inert className={cn(className, 'select-none shadow-xl ring-2 ring-gold/60')}>{children}</div> },
  });
  const isControl = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('button, input, select, textarea, a, [data-no-drag]'));
  // Disabling dragging must not mark nested registration/delete buttons disabled.
  return <div ref={setNodeRef} {...(disabled ? {} : attributes)}
    data-attendee-id={attendeeId} data-drag-enabled={!disabled} data-dragging={isDragging}
    draggable={false} onDragStart={event => event.preventDefault()}
    onMouseDown={event => { if (!isControl(event.target)) listeners?.onMouseDown?.(event); }}
    onTouchStart={event => { if (!isControl(event.target)) listeners?.onTouchStart?.(event); }}
    onKeyDown={event => { if (!isControl(event.target)) listeners?.onKeyDown?.(event); }}
    style={{ WebkitTouchCallout: 'none' }}
    className={cn(className, 'select-none', isDragging && 'opacity-30')}
  >{children}</div>;
}

interface DropZoneProps extends HTMLAttributes<HTMLDivElement> {
  groupId: string | null;
}

export function AttendanceDropZone({ groupId, className, ...props }: DropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: groupId === null ? 'pool' : `group:${groupId}`, data: { groupId } });
  return <div {...props} ref={setNodeRef} className={cn(className, isOver && 'ring-2 ring-inset ring-gold bg-amber-50/40')} />;
}

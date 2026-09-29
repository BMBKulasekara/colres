'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import { IconArrowDown, IconArrowUp, IconGripVertical } from '@tabler/icons-react';
import type { RowId } from './types';

type Controls = {
  /** The drag handle: drag with a pointer, or focus it and use Space + arrows. */
  handle: React.ReactNode;
  /** Up/down buttons, the single-pointer alternative to dragging. */
  moveButtons: React.ReactNode;
};

/**
 * A reorderable list. Dragging works with pointer or keyboard, and every row
 * also gets explicit up/down buttons so reordering never depends on dragging.
 */
export function SortableList<T extends RowId>({
  items,
  onChange,
  itemLabel,
  renderItem,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  itemLabel: (item: T) => string;
  renderItem: (item: T, index: number, controls: Controls) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    onChange(arrayMove(items, from, to));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item._rowId === active.id);
    const to = items.findIndex((item) => item._rowId === over.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${labelFor(active.id)}.`,
          onDragOver: ({ active, over }) =>
            over ? `${labelFor(active.id)} is over position ${indexOf(over.id) + 1}.` : '',
          onDragEnd: ({ active, over }) =>
            over ? `Dropped ${labelFor(active.id)} at position ${indexOf(over.id) + 1}.` : '',
          onDragCancel: ({ active }) => `Cancelled moving ${labelFor(active.id)}.`,
        },
      }}
    >
      <SortableContext
        items={items.map((item) => item._rowId)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => (
            <SortableRow key={item._rowId} id={item._rowId} label={itemLabel(item)}>
              {(handle) =>
                renderItem(item, index, {
                  handle,
                  moveButtons: (
                    <span className="flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                        aria-label={`Move ${itemLabel(item)} up`}
                      >
                        <IconArrowUp size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={index === items.length - 1}
                        onClick={() => move(index, index + 1)}
                        aria-label={`Move ${itemLabel(item)} down`}
                      >
                        <IconArrowDown size={14} />
                      </Button>
                    </span>
                  ),
                })
              }
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );

  function labelFor(id: string | number) {
    const item = items.find((i) => i._rowId === id);
    return item ? itemLabel(item) : 'item';
  }
  function indexOf(id: string | number) {
    return items.findIndex((i) => i._rowId === id);
  }
}

function SortableRow({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${label}`}
      className="grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
    >
      <IconGripVertical size={15} />
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 opacity-80 shadow-lg')}
    >
      {children(handle)}
    </li>
  );
}

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode, SyntheticEvent } from 'react'
import { MAX_PHOTOS } from '../lib/layout'
import type { Photo } from '../types'
import { PhotoImage } from './PhotoImage'

type Props = {
  photos: Photo[]
  onRemove: (id: string) => void
  onRotate: (id: string) => void
  onReorder: (activeId: string, overId: string) => void
}

/** Shows all 8 slots so the limit is visible at a glance. */
export function PhotoList({ photos, onRemove, onRotate, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press-and-hold on touch screens, so swiping still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id))
  }

  return (
    <div className="flex flex-col gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <ol className="grid grid-cols-4 gap-2">
            {photos.map((photo, i) => (
              <SortableThumb
                key={photo.id}
                photo={photo}
                index={i}
                onRemove={() => onRemove(photo.id)}
                onRotate={() => onRotate(photo.id)}
              />
            ))}
            {Array.from({ length: MAX_PHOTOS - photos.length }, (_, i) => (
              <li
                key={`empty-${i}`}
                className="aspect-square rounded-md border-2 border-dashed border-stone-200"
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {photos.length > 1 && (
        <p className="text-xs text-stone-500">Drag to change the order on the page.</p>
      )}
    </div>
  )
}

function SortableThumb({
  photo,
  index,
  onRemove,
  onRotate,
}: {
  photo: Photo
  index: number
  onRemove: () => void
  onRotate: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-label={`Photo ${index + 1}: ${photo.name}`}
      className={`relative aspect-square cursor-grab touch-manipulation select-none overflow-hidden rounded-md bg-stone-200 ring-1 ring-black/5 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isDragging ? 'z-10 cursor-grabbing shadow-lg ring-2 ring-blue-500' : ''
      }`}
    >
      <PhotoImage photo={photo} boxAspect={1} />
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold leading-5 text-white">
        {index + 1}
      </span>
      <ThumbButton label={`Rotate ${photo.name}`} title="Rotate" onClick={onRotate} className="left-1">
        <path d="M13 3v3.5H9.5M12.6 6.5A5 5 0 1 0 13 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </ThumbButton>
      <ThumbButton label={`Remove ${photo.name}`} title="Remove" onClick={onRemove} className="right-1 hover:bg-red-600">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </ThumbButton>
    </li>
  )
}

// Stops the thumbnail's drag handlers from treating a button press as the start of a drag.
const stop = (e: SyntheticEvent) => e.stopPropagation()

function ThumbButton({
  label,
  title,
  className,
  onClick,
  children,
}: {
  label: string
  title: string
  className: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={stop}
      onTouchStart={stop}
      onKeyDown={stop}
      aria-label={label}
      title={title}
      className={`absolute top-1 grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 ${className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}

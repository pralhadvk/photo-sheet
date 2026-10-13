import { useRef, useState } from 'react'

type Props = {
  remaining: number
  /** Set while files are being read. */
  progress: { done: number; total: number } | null
  onFiles: (files: File[]) => void
}

export function DropZone({ remaining, progress, onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const full = remaining === 0
  const disabled = full || progress !== null

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) onFiles(Array.from(e.dataTransfer.files))
      }}
      className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
        dragging ? 'border-blue-500 bg-blue-50' : 'border-stone-300 bg-stone-50'
      } ${full ? 'opacity-60' : ''}`}
    >
      <p className="text-sm font-medium text-stone-700">
        {progress
          ? `Reading photo ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
          : full
            ? 'Page is full'
            : 'Drag photos here'}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-stone-800 shadow-sm ring-1 ring-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Browse files
      </button>
      <p className="text-xs text-stone-500">
        {full ? 'Remove a photo to add another' : `JPG, PNG, WebP or HEIC · up to ${remaining} more`}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []))
          e.target.value = '' // allow picking the same file again
        }}
      />
    </div>
  )
}

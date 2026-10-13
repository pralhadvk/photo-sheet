import { PAGE_SIZES } from '../lib/layout'
import type { Layout, PageSizeId, Photo } from '../types'
import { PhotoImage } from './PhotoImage'

type Props = {
  photos: Photo[]
  layout: Layout
  pageSize: PageSizeId
}

const pct = (n: number) => `${n * 100}%`

/** Draws the same boxes the PDF uses, scaled to the screen. */
export function PagePreview({ photos, layout, pageSize }: Props) {
  const { pageWidth: pw, pageHeight: ph } = layout

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative bg-white shadow-lg ring-1 ring-black/5 transition-[aspect-ratio,width] duration-200"
        style={{ aspectRatio: `${pw} / ${ph}`, width: `min(100%, calc(75vh * ${pw / ph}))` }}
      >
        {photos.map((photo, i) => {
          const b = layout.boxes[i]
          return (
            <div
              key={photo.id}
              className="absolute overflow-hidden bg-stone-100 transition-all duration-300 ease-out"
              style={{ left: pct(b.x / pw), top: pct(b.y / ph), width: pct(b.w / pw), height: pct(b.h / ph) }}
            >
              <PhotoImage photo={photo} boxAspect={b.w / b.h} />
            </div>
          )
        })}
        {photos.length === 0 && (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-stone-400">
            Your photos will appear here
          </p>
        )}
      </div>
      <p className="text-xs text-stone-500">
        {PAGE_SIZES[pageSize].label} · {layout.orientation === 'portrait' ? 'Portrait' : 'Landscape'} ·{' '}
        {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
      </p>
    </div>
  )
}

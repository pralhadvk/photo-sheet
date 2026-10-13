import { useEffect, useMemo, useState } from 'react'
import { DropZone } from './components/DropZone'
import { PagePreview } from './components/PagePreview'
import { PhotoList } from './components/PhotoList'
import { SettingsPanel } from './components/SettingsPanel'
import { arrayMove } from '@dnd-kit/sortable'
import { PhotoError, readPhoto, releasePhoto } from './lib/imageProcess'
import { aspectOf, computeLayout, MAX_PHOTOS } from './lib/layout'
import { clearPrintSheet, isPhone, printSheet } from './lib/printSheet'
import type { Photo, Rotation, Settings } from './types'

const DEFAULT_SETTINGS: Settings = {
  mode: 'auto',
  fit: 'fit',
  pageSize: /^en-(US|CA)$/.test(navigator.language) ? 'letter' : 'a4',
  orientation: 'auto',
  marginMm: 10,
  gapMm: 4,
}

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [notice, setNotice] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [exporting, setExporting] = useState<ExportAction | null>(null)

  const layout = useMemo(
    () => computeLayout(photos.map(aspectOf), settings),
    [photos, settings],
  )

  // Dropping a file just outside the drop zone shouldn't navigate away from the app.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  // A print sheet left over from an earlier print would be out of date now.
  useEffect(() => clearPrintSheet, [photos, layout])

  // Photos only live in this tab, so warn before closing or reloading it.
  const hasPhotos = photos.length > 0
  useEffect(() => {
    if (!hasPhotos) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasPhotos])

  async function addFiles(files: File[]) {
    if (files.length === 0) return
    const accepted = files.slice(0, MAX_PHOTOS - photos.length)
    const skipped = files.length - accepted.length

    // One at a time: decoding several full-size phone photos at once can run a phone out of memory.
    const loaded: Photo[] = []
    const messages: string[] = []
    for (const [i, file] of accepted.entries()) {
      setProgress({ done: i, total: accepted.length })
      try {
        loaded.push(await readPhoto(file))
      } catch (err) {
        if (!(err instanceof PhotoError)) console.error(err)
        messages.push(err instanceof PhotoError ? err.message : `Couldn’t read ${file.name}.`)
      }
    }
    setProgress(null)
    setPhotos((prev) => [...prev, ...loaded].slice(0, MAX_PHOTOS))

    if (skipped > 0) {
      messages.unshift(
        `Only ${MAX_PHOTOS} photos fit on a page, so ${skipped} ${skipped === 1 ? 'was' : 'were'} skipped.`,
      )
    }
    setNotice(messages.length ? messages.join(' ') : null)
  }

  function removePhoto(id: string) {
    const photo = photos.find((p) => p.id === id)
    if (photo) releasePhoto(photo)
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  function rotatePhoto(id: string) {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: ((p.rotation + 90) % 360) as Rotation } : p)),
    )
  }

  function reorderPhotos(activeId: string, overId: string) {
    setPhotos((prev) =>
      arrayMove(
        prev,
        prev.findIndex((p) => p.id === activeId),
        prev.findIndex((p) => p.id === overId),
      ),
    )
  }

  function clearAll() {
    photos.forEach(releasePhoto)
    setPhotos([])
    setNotice(null)
  }

  async function exportPdf(action: ExportAction) {
    setExporting(action)
    try {
      if (action === 'print' && isPhone()) {
        await printSheet(photos, layout)
        return
      }
      // pdf-lib is large, so it's only downloaded once someone exports.
      const { buildPdf, downloadPdf, printPdf } = await import('./lib/pdf')
      const bytes = await buildPdf(photos, layout)
      if (action === 'download') {
        downloadPdf(bytes, `photos-${new Date().toISOString().slice(0, 10)}.pdf`)
      } else {
        printPdf(bytes)
      }
    } catch (err) {
      console.error(err)
      setNotice('Something went wrong while creating the PDF. Please try again.')
    } finally {
      setExporting(null)
    }
  }

  const exportButtons = (
    <ExportButtons
      exporting={exporting}
      disabled={photos.length === 0 || exporting !== null || progress !== null}
      onExport={exportPdf}
    />
  )

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <div>
              <h1 className="text-base font-semibold leading-tight">PhotoSheet</h1>
              <p className="hidden text-xs text-stone-500 sm:block">
                Up to 8 photos on one print-ready PDF page. Photos never leave your device.
              </p>
            </div>
          </div>
          <div className="hidden shrink-0 gap-2 sm:flex">{exportButtons}</div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 p-4 pb-28 sm:pb-4 lg:grid-cols-[300px_minmax(0,1fr)_260px] lg:items-start">
        <section className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              Photos <span className="font-normal text-stone-500">{photos.length} / {MAX_PHOTOS}</span>
            </h2>
            {photos.length > 0 && (
              <button type="button" onClick={clearAll} className="text-xs text-stone-500 hover:text-red-600">
                Clear all
              </button>
            )}
          </div>
          <DropZone remaining={MAX_PHOTOS - photos.length} progress={progress} onFiles={addFiles} />
          {notice && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
              <p className="flex-1">{notice}</p>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="font-semibold">
                ×
              </button>
            </div>
          )}
          <PhotoList
            photos={photos}
            onRemove={removePhoto}
            onRotate={rotatePhoto}
            onReorder={reorderPhotos}
          />
        </section>

        <section className="rounded-xl bg-stone-200/70 p-4 sm:p-8">
          <PagePreview photos={photos} layout={layout} pageSize={settings.pageSize} />
        </section>

        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <SettingsPanel
            settings={settings}
            resolvedOrientation={photos.length > 0 ? layout.orientation : null}
            onChange={setSettings}
            onReset={() => setSettings(DEFAULT_SETTINGS)}
          />
        </section>
      </main>

      {/* On phones the actions stay within thumb reach at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 flex gap-2 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:hidden [&>button]:flex-1">
        {exportButtons}
      </div>
    </div>
  )
}

type ExportAction = 'download' | 'print'

function ExportButtons({
  exporting,
  disabled,
  onExport,
}: {
  exporting: ExportAction | null
  disabled: boolean
  onExport: (action: ExportAction) => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onExport('print')}
        disabled={disabled}
        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400"
      >
        {exporting === 'print' ? 'Preparing…' : 'Print'}
      </button>
      <button
        type="button"
        onClick={() => onExport('download')}
        disabled={disabled}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {exporting === 'download' ? 'Creating PDF…' : 'Download PDF'}
      </button>
    </>
  )
}

import { PDFDocument } from 'pdf-lib'
import type { Layout, Photo } from '../types'
import { renderForPrint } from './imageProcess'

export async function buildPdf(photos: Photo[], layout: Layout): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle('Photo sheet')
  doc.setCreator('PhotoSheet')
  const page = doc.addPage([layout.pageWidth, layout.pageHeight])

  // One photo at a time keeps memory use low on phones.
  for (const [i, photo] of photos.entries()) {
    const box = layout.boxes[i]
    const image = await doc.embedJpg(await renderForPrint(photo, box))
    // PDF coordinates start at the bottom-left; our boxes start at the top-left.
    page.drawImage(image, {
      x: box.x,
      y: layout.pageHeight - box.y - box.h,
      width: box.w,
      height: box.h,
    })
  }

  return doc.save()
}

const toUrl = (bytes: Uint8Array) =>
  URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const url = toUrl(bytes)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

let printFrame: HTMLIFrameElement | null = null

/**
 * Opens the print dialog for the PDF. Desktop browsers print it from a hidden
 * iframe; iOS can't, so `fallbackWindow` (opened during the click, before any
 * await, so popup blockers allow it) shows the PDF to print from the share menu.
 */
export function printPdf(bytes: Uint8Array, fallbackWindow: Window | null) {
  const url = toUrl(bytes)
  if (fallbackWindow) {
    fallbackWindow.location.href = url
    return
  }
  // Keep the frame until the next print; removing it can cancel an open dialog.
  if (printFrame) {
    URL.revokeObjectURL(printFrame.src)
    printFrame.remove()
  }
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } catch {
      window.open(url, '_blank')
    }
  }
  frame.src = url
  document.body.appendChild(frame)
  printFrame = frame
}

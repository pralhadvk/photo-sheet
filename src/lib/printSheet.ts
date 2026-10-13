import type { Layout, Photo } from '../types'
import { renderForPrint } from './imageProcess'

/**
 * Phone browsers can't print a PDF from inside a page, so on phones we print
 * the page itself: a hidden sheet holding the same 300 DPI images as the PDF,
 * which print CSS (index.css) shows alone, sized by an @page rule. The phone's
 * system print screen (Android printing services, AirPrint) takes it from there.
 */

const SHEET_ID = 'print-sheet'
const PRINTING_CLASS = 'printing-sheet'
const ptToMm = (pt: number) => (pt * 25.4) / 72

export const isPhone = () =>
  /Android|iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPads that report themselves as Macs
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Removes the sheet so the browser's own print command prints the app normally again. */
export function clearPrintSheet() {
  const sheet = document.getElementById(SHEET_ID)
  if (!sheet) return
  sheet.querySelectorAll('img').forEach((img) => URL.revokeObjectURL(img.src))
  sheet.remove()
  document.documentElement.classList.remove(PRINTING_CLASS)
}

export async function printSheet(photos: Photo[], layout: Layout) {
  const { pageWidth: pw, pageHeight: ph } = layout
  const images = await Promise.all(
    layout.boxes.map(async (box, i) => {
      const img = new Image()
      img.src = URL.createObjectURL(await renderForPrint(photos[i], box))
      img.style.cssText = `position:absolute;left:${(box.x / pw) * 100}%;top:${(box.y / ph) * 100}%;width:${(box.w / pw) * 100}%;height:${(box.h / ph) * 100}%`
      await img.decode()
      return img
    }),
  )

  // The previous sheet stays until now: phones may still be laying it out
  // after print() returns, so it's never removed right after printing.
  clearPrintSheet()
  const sheet = document.createElement('div')
  sheet.id = SHEET_ID
  // A hair shorter than the page so rounding can't spill onto a blank second page.
  sheet.style.cssText = `position:relative;overflow:hidden;width:${ptToMm(pw)}mm;height:${ptToMm(ph) - 0.3}mm`
  const pageRule = document.createElement('style')
  pageRule.textContent = `@page { size: ${ptToMm(pw)}mm ${ptToMm(ph)}mm; margin: 0 }`
  sheet.append(pageRule, ...images)
  document.body.appendChild(sheet)
  document.documentElement.classList.add(PRINTING_CLASS)

  window.print()
}

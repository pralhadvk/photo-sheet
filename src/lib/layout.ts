import type { Box, FitMode, Layout, Orientation, PageSizeId, Photo, Settings } from '../types'

export const MAX_PHOTOS = 8

export const PAGE_SIZES: Record<PageSizeId, { label: string; width: number; height: number }> = {
  a4: { label: 'A4', width: 595.28, height: 841.89 },
  letter: { label: 'US Letter', width: 612, height: 792 },
}

export const mmToPt = (mm: number) => (mm * 72) / 25.4

/** Width / height of the photo as it will appear, after the user's rotation. */
export const aspectOf = (photo: Photo) =>
  photo.rotation % 180 === 0 ? photo.width / photo.height : photo.height / photo.width

type Candidate = { boxes: Box[]; score: number }

/**
 * Geometric mean of photo areas: big photos win, but one huge photo next to
 * several tiny ones scores worse than evenly sized photos.
 */
const balancedScore = (areas: number[]) =>
  Math.exp(areas.reduce((sum, a) => sum + Math.log(a), 0) / areas.length)

/**
 * Arranges photos (kept in order) into rows. Every photo in a row shares the
 * same height and the row spans the content width, so nothing is cropped.
 * With at most 8 photos there are at most 128 ways to split them into rows,
 * so we try them all and keep the best-scoring split.
 */
function justifiedRows(aspects: number[], width: number, height: number, gap: number): Candidate {
  const n = aspects.length
  let best: Candidate = { boxes: [], score: -1 }

  // Bit i of `mask` set = start a new row after photo i.
  for (let mask = 0; mask < 1 << (n - 1); mask++) {
    const rows: number[][] = [[]]
    for (let i = 0; i < n; i++) {
      rows[rows.length - 1].push(i)
      if (i < n - 1 && mask & (1 << i)) rows.push([])
    }

    const rowHeights = rows.map(
      (row) => (width - gap * (row.length - 1)) / row.reduce((sum, i) => sum + aspects[i], 0),
    )
    const verticalGaps = gap * (rows.length - 1)
    if (rowHeights.some((h) => h <= 0) || height - verticalGaps <= 0) continue

    // Shrink everything uniformly if the rows are taller than the page.
    const imagesHeight = rowHeights.reduce((a, b) => a + b, 0)
    const scale = Math.min(1, (height - verticalGaps) / imagesHeight)

    const score = balancedScore(
      rows.flatMap((row, r) => row.map((i) => (rowHeights[r] * scale) ** 2 * aspects[i])),
    )
    if (score <= best.score) continue

    // Center the block on the page and each row within the block.
    const boxes: Box[] = new Array(n)
    let y = (height - (imagesHeight * scale + verticalGaps)) / 2
    rows.forEach((row, r) => {
      const h = rowHeights[r] * scale
      const rowWidth = row.reduce((s, i) => s + aspects[i] * h, 0) + gap * (row.length - 1)
      let x = (width - rowWidth) / 2
      for (const i of row) {
        const w = aspects[i] * h
        boxes[i] = { x, y, w, h }
        x += w + gap
      }
      y += h + gap
    })
    best = { boxes, score }
  }
  return best
}

/**
 * Equal-sized cells, filled left to right; a short last row is centered.
 * Tries every column count and keeps the one where photos show largest.
 * `fit` shrinks each photo to sit whole inside its cell; `fill` uses the
 * whole cell and crops the photo.
 */
function grid(aspects: number[], width: number, height: number, gap: number, fit: FitMode): Candidate {
  const n = aspects.length
  let best: Candidate = { boxes: [], score: -1 }

  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const cellW = (width - gap * (cols - 1)) / cols
    const cellH = (height - gap * (rows - 1)) / rows
    if (cellW <= 0 || cellH <= 0) continue

    const fitted = aspects.map((a) =>
      a > cellW / cellH ? { w: cellW, h: cellW / a } : { w: cellH * a, h: cellH },
    )
    // Scored on the whole-photo size in both modes, so Fill doesn't pick
    // cells that would crop away most of each photo.
    const score = balancedScore(fitted.map((f) => f.w * f.h))
    if (score <= best.score) continue

    const lastRowOffset = ((rows * cols - n) * (cellW + gap)) / 2
    const boxes = fitted.map((f, i) => {
      const row = Math.floor(i / cols)
      const cellX = (i % cols) * (cellW + gap) + (row === rows - 1 ? lastRowOffset : 0)
      const cellY = row * (cellH + gap)
      return fit === 'fill'
        ? { x: cellX, y: cellY, w: cellW, h: cellH }
        : { x: cellX + (cellW - f.w) / 2, y: cellY + (cellH - f.h) / 2, w: f.w, h: f.h }
    })
    best = { boxes, score }
  }
  return best
}

/** Computes where each photo goes on the page. `aspects` are width / height ratios. */
export function computeLayout(aspects: number[], settings: Settings): Layout {
  const size = PAGE_SIZES[settings.pageSize]
  const margin = mmToPt(settings.marginMm)
  const gap = mmToPt(settings.gapMm)
  const orientations: Orientation[] =
    settings.orientation === 'auto' ? ['portrait', 'landscape'] : [settings.orientation]

  let best: { layout: Layout; score: number } | null = null
  for (const orientation of orientations) {
    const pageWidth = orientation === 'portrait' ? size.width : size.height
    const pageHeight = orientation === 'portrait' ? size.height : size.width
    const width = pageWidth - 2 * margin
    const height = pageHeight - 2 * margin
    const fit =
      aspects.length === 0
        ? { boxes: [], score: 0 }
        : settings.mode === 'grid'
          ? grid(aspects, width, height, gap, settings.fit)
          : justifiedRows(aspects, width, height, gap)

    // Portrait is tried first and kept unless landscape is clearly better.
    if (!best || fit.score > best.score * 1.01) {
      best = {
        score: fit.score,
        layout: {
          pageWidth,
          pageHeight,
          orientation,
          boxes: fit.boxes.map((b) => ({ ...b, x: b.x + margin, y: b.y + margin })),
        },
      }
    }
  }
  return best!.layout
}

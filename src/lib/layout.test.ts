import { describe, expect, it } from 'vitest'
import type { Box, Layout, Settings } from '../types'
import { computeLayout, mmToPt } from './layout'

const base: Settings = { mode: 'auto', fit: 'fit', pageSize: 'a4', orientation: 'auto', marginMm: 10, gapMm: 4 }

const photoSets: Record<string, number[]> = {
  '1 landscape': [1.5],
  '1 portrait': [0.75],
  '3 mixed': [1.5, 0.75, 1.33],
  '4 landscape': [1.5, 1.5, 1.5, 1.5],
  '5 portrait': [0.75, 0.75, 0.75, 0.75, 0.75],
  '7 portrait': Array(7).fill(0.75),
  '8 mixed': [1.5, 0.75, 1.33, 0.56, 1.78, 1, 0.75, 1.5],
  'panorama + 2': [4, 0.75, 0.75],
  '10 landscape': Array(10).fill(1.5),
  '10 mixed': [1.5, 0.75, 1.33, 0.56, 1.78, 1, 0.75, 1.5, 0.75, 1.33],
}

const variants: Partial<Settings>[] = [
  { mode: 'auto' },
  { mode: 'grid', fit: 'fit' },
  { mode: 'grid', fit: 'fill' },
  { mode: 'auto', orientation: 'portrait', pageSize: 'letter', marginMm: 0, gapMm: 0 },
  { mode: 'grid', fit: 'fill', orientation: 'landscape', marginMm: 25, gapMm: 15 },
]

const EPS = 1e-6
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS
const rowSizes = (l: Layout) => {
  const centers = l.boxes.map((b) => Math.round(b.y + b.h / 2))
  return [...new Set(centers)].map((c) => centers.filter((x) => x === c).length)
}

describe.each(variants)('computeLayout %o', (variant) => {
  const settings = { ...base, ...variant }
  const margin = mmToPt(settings.marginMm)

  it.each(Object.entries(photoSets))('%s: one box per photo, inside the margins, no overlaps', (_, aspects) => {
    const l = computeLayout(aspects, settings)
    expect(l.boxes).toHaveLength(aspects.length)
    for (const b of l.boxes) {
      expect(b.w).toBeGreaterThan(0)
      expect(b.x).toBeGreaterThanOrEqual(margin - EPS)
      expect(b.y).toBeGreaterThanOrEqual(margin - EPS)
      expect(b.x + b.w).toBeLessThanOrEqual(l.pageWidth - margin + EPS)
      expect(b.y + b.h).toBeLessThanOrEqual(l.pageHeight - margin + EPS)
    }
    l.boxes.forEach((a, i) => l.boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)))
  })

  if (settings.mode === 'auto' || settings.fit === 'fit') {
    it.each(Object.entries(photoSets))('%s: photos keep their shape (no cropping)', (_, aspects) => {
      computeLayout(aspects, settings).boxes.forEach((b, i) => expect(b.w / b.h).toBeCloseTo(aspects[i], 6))
    })
  } else {
    it.each(Object.entries(photoSets))('%s: every cell is the same size', (_, aspects) => {
      const [first, ...rest] = computeLayout(aspects, settings).boxes
      rest.forEach((b) => expect([b.w, b.h]).toEqual([first.w, first.h]))
    })
  }
})

describe('layout choices', () => {
  it('returns an empty portrait page when there are no photos', () => {
    expect(computeLayout([], base)).toMatchObject({ orientation: 'portrait', boxes: [] })
  })

  it('keeps photos evenly sized instead of one huge photo plus tiny ones', () => {
    const l = computeLayout(Array(8).fill(0.75), base)
    const areas = l.boxes.map((b) => b.w * b.h)
    expect(Math.max(...areas) / Math.min(...areas)).toBeCloseTo(1, 6)
  })

  it('balances rows when the photos can’t split evenly (10 into 3, 3, 4)', () => {
    const rows = rowSizes(computeLayout(Array(10).fill(1.5), base))
    expect(rows.reduce((a, b) => a + b)).toBe(10)
    expect(Math.max(...rows) - Math.min(...rows)).toBeLessThanOrEqual(1)
  })

  it('uses a landscape 2×2 grid for 4 landscape photos', () => {
    const l = computeLayout(Array(4).fill(1.5), { ...base, mode: 'grid' })
    expect(l.orientation).toBe('landscape')
    expect(rowSizes(l)).toEqual([2, 2])
  })

  it('centers a short last row in grid mode', () => {
    const l = computeLayout(Array(5).fill(0.75), { ...base, mode: 'grid', fit: 'fill', orientation: 'portrait' })
    expect(rowSizes(l)).toEqual([2, 2, 1])
    const last = l.boxes[4]
    expect(last.x + last.w / 2).toBeCloseTo(l.pageWidth / 2, 6)
  })

  it('respects a forced orientation', () => {
    expect(computeLayout([1.5, 1.5], { ...base, orientation: 'landscape' }).orientation).toBe('landscape')
    expect(computeLayout([4], { ...base, orientation: 'portrait' }).orientation).toBe('portrait')
  })
})

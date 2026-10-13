export type Photo = {
  id: string
  name: string
  /** Object URL for the full-resolution image, used for the PDF. */
  url: string
  /** Object URL for a small copy, used on screen. */
  previewUrl: string
  /** Pixel size after EXIF orientation is applied, before `rotation`. */
  width: number
  height: number
  /** Extra clockwise rotation chosen by the user. */
  rotation: Rotation
}

export type Rotation = 0 | 90 | 180 | 270

export type PageSizeId = 'a4' | 'letter'
export type Orientation = 'portrait' | 'landscape'

export type LayoutMode = 'auto' | 'grid'
export type FitMode = 'fit' | 'fill'

export type Settings = {
  mode: LayoutMode
  /** Grid mode only: show the whole photo, or crop it to fill its cell. */
  fit: FitMode
  pageSize: PageSizeId
  orientation: Orientation | 'auto'
  marginMm: number
  gapMm: number
}

/**
 * A rectangle in PDF points (1/72 inch), origin at the top-left of the page.
 * Photos are drawn to cover their box, center-cropped if the aspect ratios differ.
 */
export type Box = { x: number; y: number; w: number; h: number }

export type Layout = {
  pageWidth: number
  pageHeight: number
  orientation: Orientation
  /** One box per photo, in the same order as the photos. */
  boxes: Box[]
}

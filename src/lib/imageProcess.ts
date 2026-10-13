import type { Box, Photo } from '../types'

/** Print resolution used when downscaling photos for the PDF. */
const PRINT_DPI = 300
const JPEG_QUALITY = 0.9
/** Longest side of the copy shown on screen; full resolution is kept for the PDF. */
const PREVIEW_MAX_PX = 1600
export const MAX_FILE_MB = 50
/** Browsers refuse canvases much larger than this; iOS Safari's limit is the lowest. */
const MAX_CANVAS_PIXELS = 16_000_000

/** A problem with one file, with a message that can be shown to the user as is. */
export class PhotoError extends Error {}

const isHeic = (file: File) => /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name)

/** Browsers apply EXIF orientation when decoding into an <img>, so sizes and pixels come out upright. */
function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  return img.decode().then(() => img)
}

async function tryLoad(blob: Blob): Promise<{ img: HTMLImageElement; url: string } | null> {
  const url = URL.createObjectURL(blob)
  try {
    return { img: await loadImage(url), url }
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

export async function readPhoto(file: File): Promise<Photo> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new PhotoError(`${file.name} isn’t a photo.`)
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new PhotoError(`${file.name} is over ${MAX_FILE_MB} MB.`)
  }

  // Safari opens iPhone HEIC photos itself; other browsers need them converted.
  let loaded = await tryLoad(file)
  if (!loaded && isHeic(file)) {
    const { heicTo } = await import('heic-to') // large, so only fetched when needed
    const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 }).catch(() => null)
    if (jpeg) loaded = await tryLoad(jpeg)
  }
  if (!loaded) throw new PhotoError(`Couldn’t read ${file.name}.`)

  const { img, url } = loaded
  try {
    return {
      id: crypto.randomUUID(),
      name: file.name,
      url,
      previewUrl: URL.createObjectURL(await makePreview(img)),
      width: img.naturalWidth,
      height: img.naturalHeight,
      rotation: 0,
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

export function releasePhoto(photo: Photo) {
  URL.revokeObjectURL(photo.url)
  URL.revokeObjectURL(photo.previewUrl)
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  return { canvas, ctx }
}

/**
 * Halves the image until it's at most about 1.5× `targetWidth` wide (one big
 * downscale with drawImage looks jagged) and small enough to fit in a canvas.
 */
function stepDown(img: HTMLImageElement, targetWidth: number) {
  let source: CanvasImageSource = img
  let w = img.naturalWidth
  let h = img.naturalHeight
  while (w / 2 >= targetWidth * 1.5 || w * h > MAX_CANVAS_PIXELS) {
    w = Math.round(w / 2)
    h = Math.round(h / 2)
    const step = makeCanvas(w, h)
    step.ctx.drawImage(source, 0, 0, w, h)
    source = step.canvas
  }
  return { source, w, h }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))),
      'image/jpeg',
      quality,
    ),
  )
}

/** A small copy for the screen, so 8 phone photos don't exhaust a phone's memory. */
function makePreview(img: HTMLImageElement): Promise<Blob> {
  const scale = Math.min(1, PREVIEW_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight))
  const outW = Math.max(1, Math.round(img.naturalWidth * scale))
  const outH = Math.max(1, Math.round(img.naturalHeight * scale))
  const { source } = stepDown(img, outW)
  const { canvas, ctx } = makeCanvas(outW, outH)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(source, 0, 0, outW, outH)
  return toJpeg(canvas, 0.85)
}

/**
 * Re-encodes a photo as a JPEG for its box on the page: rotated, center-cropped
 * to the box's shape, and sized for 300 DPI (never upscaled). This keeps the
 * PDF small without visible quality loss.
 */
export async function renderForPrint(photo: Photo, box: Box): Promise<ArrayBuffer> {
  const img = await loadImage(photo.url)
  const sideways = photo.rotation % 180 !== 0
  const shownW = sideways ? img.naturalHeight : img.naturalWidth
  const shownH = sideways ? img.naturalWidth : img.naturalHeight

  // Largest centered region with the box's aspect ratio (all of it, unless cropping for Fill).
  const boxAspect = box.w / box.h
  const cropW = Math.min(shownW, shownH * boxAspect)
  const cropH = cropW / boxAspect
  const scale = Math.min(1, ((box.w / 72) * PRINT_DPI) / cropW)
  const outW = Math.max(1, Math.round(cropW * scale))
  const outH = Math.max(1, Math.round(cropH * scale))

  let { source, w, h } = stepDown(img, img.naturalWidth * scale)

  if (photo.rotation !== 0) {
    const rotated = makeCanvas(sideways ? h : w, sideways ? w : h)
    rotated.ctx.translate(rotated.canvas.width / 2, rotated.canvas.height / 2)
    rotated.ctx.rotate((photo.rotation * Math.PI) / 180)
    rotated.ctx.drawImage(source, -w / 2, -h / 2, w, h)
    source = rotated.canvas
    ;[w, h] = [rotated.canvas.width, rotated.canvas.height]
  }

  const { canvas, ctx } = makeCanvas(outW, outH)
  ctx.fillStyle = '#fff' // JPEG has no transparency; avoid black backgrounds on PNGs
  ctx.fillRect(0, 0, outW, outH)
  const k = w / shownW // crop was measured on the full-size photo
  ctx.drawImage(source, ((shownW - cropW) / 2) * k, ((shownH - cropH) / 2) * k, cropW * k, cropH * k, 0, 0, outW, outH)

  return (await toJpeg(canvas, JPEG_QUALITY)).arrayBuffer()
}

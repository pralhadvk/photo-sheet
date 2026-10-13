import type { Photo } from '../types'

type Props = {
  photo: Photo
  /** Width / height of the box the image covers. */
  boxAspect: number
}

/**
 * Covers its (relatively positioned, overflow-hidden) parent with the photo,
 * applying the user's rotation the same way the PDF does.
 */
export function PhotoImage({ photo, boxAspect }: Props) {
  // A sideways image needs the box's width and height swapped before it's rotated into place.
  const sideways = photo.rotation % 180 !== 0
  return (
    <img
      src={photo.previewUrl}
      alt=""
      draggable={false}
      className="absolute left-1/2 top-1/2 max-w-none object-cover"
      style={{
        width: sideways ? `${100 / boxAspect}%` : '100%',
        height: sideways ? `${100 * boxAspect}%` : '100%',
        transform: `translate(-50%, -50%) rotate(${photo.rotation}deg)`,
      }}
    />
  )
}

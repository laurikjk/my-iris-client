import {decode, encode} from "blurhash"

export interface Dimensions {
  width: string
  height: string
}

export interface ImageMetadata {
  width: number
  height: number
  blurhash: string
}

export const calculateDimensions = (
  originalWidth: number | null,
  originalHeight: number | null,
  limitHeight?: boolean
): Dimensions | undefined => {
  if (!originalWidth || !originalHeight) return undefined

  const maxWidth = Math.min(650, window.innerWidth)
  const maxHeight = limitHeight ? 600 : window.innerHeight * 0.9

  let width = originalWidth
  let height = originalHeight

  // Scale down if width exceeds max
  if (width > maxWidth) {
    const ratio = maxWidth / width
    width = maxWidth
    height = Math.round(height * ratio)
  }

  // Scale down if height exceeds max
  if (height > maxHeight) {
    const ratio = maxHeight / height
    height = maxHeight
    width = Math.round(width * ratio)
  }

  return {width: `${width}px`, height: `${height}px`}
}

export const generateBlurhashUrl = (
  blurhash: string | undefined,
  calculatedDimensions: Dimensions | undefined
): string | null => {
  if (!blurhash || !calculatedDimensions) return null

  // Use smaller dimensions for blurhash preview (max 32px)
  const maxPreviewSize = 32
  const originalWidth = parseInt(calculatedDimensions.width)
  const originalHeight = parseInt(calculatedDimensions.height)
  let width = originalWidth
  let height = originalHeight

  // Scale down if either dimension exceeds maxPreviewSize
  if (width > maxPreviewSize || height > maxPreviewSize) {
    const ratio = Math.min(maxPreviewSize / width, maxPreviewSize / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const pixels = decode(blurhash, width, height)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const imageData = ctx.createImageData(width, height)
  imageData.data.set(pixels)
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL()
}

export async function calculateImageMetadata(file: File): Promise<ImageMetadata | null> {
  if (!file.type.startsWith("image/")) {
    return null
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve(null)
        return
      }

      // Set canvas size to a reasonable size for blurhash calculation
      const maxSize = 32
      let width = img.width
      let height = img.height

      // Scale down if either dimension exceeds maxSize
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      const imageData = ctx.getImageData(0, 0, width, height)
      const blurhash = encode(imageData.data, width, height, 4, 3)

      resolve({
        width: img.width,
        height: img.height,
        blurhash,
      })
    }
    img.onerror = () => resolve(null)
    img.src = URL.createObjectURL(file)
  })
}

import {useState, MouseEvent, useMemo} from "react"
import ProxyImg from "../../ProxyImg"
import classNames from "classnames"
import {decode} from "blurhash"

interface ImageComponentProps {
  match: string
  index: number
  onClickImage: () => void
  blur?: boolean
  limitHeight?: boolean
  imeta?: string[]
}

const ImageComponent = ({
  match,
  index,
  onClickImage,
  blur,
  limitHeight,
  imeta,
}: ImageComponentProps) => {
  const [hasError, setHasError] = useState(false)

  // Extract dimensions from imeta tag if available
  const dimensions = imeta?.find((tag) => tag.startsWith("dim "))?.split(" ")[1]
  const [originalWidth, originalHeight] = dimensions
    ? dimensions.split("x").map(Number)
    : [null, null]

  // Extract blurhash from imeta tag if available
  const blurhash = imeta?.find((tag) => tag.startsWith("blurhash "))?.split(" ")[1]

  // Calculate dimensions that respect max constraints while maintaining aspect ratio
  const calculateDimensions = () => {
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

  const onClick = (event: MouseEvent) => {
    event.stopPropagation()
    onClickImage()
  }

  const calculatedDimensions = calculateDimensions()

  // Decode blurhash to data URL
  const blurhashUrl = useMemo(() => {
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
  }, [blurhash, calculatedDimensions])

  return (
    <div
      key={match + index}
      className={classNames("flex justify-center items-center md:justify-start my-2", {
        "h-[600px]": limitHeight || !dimensions,
      })}
    >
      {hasError ? (
        <div
          className="my-2 text-sm break-all flex items-center justify-center p-4 bg-base-200 rounded"
          style={{
            ...calculatedDimensions,
            backgroundImage: blurhashUrl ? `url(${blurhashUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <span className="relative z-10">{match}</span>
        </div>
      ) : (
        <div className="relative">
          <ProxyImg
            width={originalWidth || Math.min(650, window.innerWidth)}
            onError={() => setHasError(true)}
            onClick={onClick}
            className={classNames("my-2 max-w-full cursor-pointer object-contain", {
              "blur-md": blur,
              "h-full max-h-[600px]": limitHeight || !dimensions,
              "max-h-[90vh] lg:max-h-[600px]": !limitHeight && dimensions,
            })}
            style={{
              ...calculatedDimensions,
              backgroundImage: blurhashUrl ? `url(${blurhashUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            src={match}
          />
        </div>
      )}
    </div>
  )
}

export default ImageComponent

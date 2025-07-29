import {calculateDimensions, generateBlurhashUrl} from "./mediaUtils"
import {useState, MouseEvent, useMemo} from "react"
import ProxyImg from "../../ProxyImg"
import classNames from "classnames"

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

  const calculatedDimensions = calculateDimensions(
    originalWidth,
    originalHeight,
    limitHeight
  )

  // Generate blurhash URL
  const blurhashUrl = useMemo(
    () => generateBlurhashUrl(blurhash, calculatedDimensions),
    [blurhash, calculatedDimensions]
  )

  const onClick = (event: MouseEvent) => {
    event.stopPropagation()
    onClickImage()
  }

  return (
    <div
      className={classNames("flex justify-center items-center my-2", {
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

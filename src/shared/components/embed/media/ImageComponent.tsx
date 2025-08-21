import {calculateDimensions, generateBlurhashUrl} from "./mediaUtils"
import {useState, MouseEvent, useMemo, memo} from "react"
import ProxyImg from "../../ProxyImg"
import classNames from "classnames"
import {parseImetaTag} from "@/shared/utils/imetaUtils"

interface ImageComponentProps {
  match: string
  onClickImage: () => void
  blur?: boolean
  limitHeight?: boolean
  imeta?: string[]
}

const ImageComponent = ({
  match,
  onClickImage,
  blur,
  limitHeight,
  imeta,
}: ImageComponentProps) => {
  const [hasError, setHasError] = useState(false)

  // Parse imeta data
  const imetaData = useMemo(() => {
    if (!imeta) return undefined
    return parseImetaTag(imeta)
  }, [imeta])

  const originalWidth = imetaData?.width || null
  const originalHeight = imetaData?.height || null
  const blurhash = imetaData?.blurhash

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
        "h-[600px]": limitHeight || !originalWidth || !originalHeight,
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
          <span className="relative z-10 select-all cursor-text">{match}</span>
        </div>
      ) : (
        <div className="relative">
          <ProxyImg
            width={originalWidth || Math.min(650, window.innerWidth)}
            onError={() => setHasError(true)}
            onClick={onClick}
            className={classNames("my-2 max-w-full cursor-pointer object-contain", {
              "blur-md": blur,
              "h-full max-h-[600px]": limitHeight || !originalWidth || !originalHeight,
              "max-h-[90vh] lg:max-h-[600px]":
                !limitHeight && originalWidth && originalHeight,
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

export default memo(ImageComponent)
